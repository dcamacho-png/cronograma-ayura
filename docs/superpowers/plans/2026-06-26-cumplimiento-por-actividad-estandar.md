# Cumplimiento por actividad (versión estándar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En `/cumplimiento`, la versión estándar (no maquinaria) registra el cumplimiento una sola vez por actividad (grupo `tareaId`): con lotes mediante avances y cierre manual; sin lotes mediante observación + Cumplida. Nunca día a día ni por responsable.

**Architecture:** Sin cambios de esquema. Cada acción del estándar opera sobre **todas las filas del grupo** `(tareaId, anio, semana)`, resolviendo el grupo a partir de un **id representativo** de fila (la fila más temprana de la tarjeta). Como las filas comparten lotes y quedan en el mismo estado/`avancePorLote`, las métricas existentes (que ya agrupan por `tareaId`) salen correctas sin tocarlas. La UI del estándar colapsa las sub-filas por día/responsable en un único bloque por tarjeta.

**Tech Stack:** Next.js 16 (App Router, Server Actions, RSC + client components), Prisma, TypeScript.

## Global Constraints

- Cambio acotado al **estándar** (`esMaquinaria === false`). **Maquinaria no se toca** (flujo por día actual).
- **No** modificar el esquema de Prisma, la programación ni la parrilla.
- Reusar funciones de dominio existentes (`agregarAvances`, `normalizarAvancePorLote`, `totalAvanceLotes`, `estadoActividad`) — NO reimplementar lógica de avance.
- Reusar el **guard de plazo** ya existente: las acciones nuevas validan con `bloqueadoPorPlazoActividad(id)` (resuelve anio/semana desde la fila representativa). El ADMIN nunca queda bloqueado.
- Actividades **sin `tareaId`** (sueltas): el grupo es solo esa fila (las funciones de grupo devuelven `[fila]`).
- Convención del repo: se prueban con unidad las funciones de **dominio**; repositorio, server actions y páginas (RSC) NO tienen pruebas unitarias automáticas — se verifican con typecheck + build + ejecución. No se introduce lógica de dominio nueva en este plan, así que no hay tests unitarios nuevos.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- El build local (`npm run build`) falla en `prisma migrate deploy` por falta de `DATABASE_URL`; eso es esperado. El build real corre en Vercel. Verificación local = typecheck + arranque/inspección manual donde aplique.

---

### Task 1: Funciones de repositorio a nivel de grupo

**Files:**
- Modify: `src/datos/repositorio.ts` (añadir tras `marcarCumplidaDesdeParcial`/`devolverAlBanco`, junto al resto de funciones de cumplimiento; ~línea 534)

**Interfaces:**
- Consumes: `prisma`, `Prisma`, y los helpers de dominio ya importados en el archivo: `agregarAvances`, `normalizarAvancePorLote`, `totalAvanceLotes` (verificar el import existente al inicio del archivo; si falta alguno, agregarlo a la línea de import desde `@/dominio/avance-lote`).
- Produces (todas reciben un **id representativo** de fila):
  - `registrarAvanceLoteGrupo(id: string, dia: number, maquinaId: string | null, avances: { loteId: string; cantidad: number }[]): Promise<boolean | null>`
  - `registrarAvanceObservacionGrupo(id: string, nota: string): Promise<boolean | null>`
  - `marcarCumplidaGrupo(id: string): Promise<boolean | null>`
  - `registrarNovedadGrupo(id: string, estado: string, motivoId: string | null, nota: string | null, reemplazo?: { descripcion: string; loteId: string | null } | null, lotesHechos?: string[]): Promise<boolean | null>`
  - `reabrirGrupo(id: string): Promise<boolean | null>`

- [ ] **Step 1: Verificar imports de dominio en `repositorio.ts`**

Buscar al inicio del archivo el import desde `@/dominio/avance-lote`. Debe incluir `agregarAvances`, `normalizarAvancePorLote`, `totalAvanceLotes`. Si alguno falta, agregarlo. Comando para inspeccionar:
```bash
grep -n "@/dominio/avance-lote" src/datos/repositorio.ts
```

- [ ] **Step 2: Añadir el helper interno + las cinco funciones de grupo**

Insertar en `src/datos/repositorio.ts` después de la función `devolverAlBanco` (~línea 534):

```ts
// ---- Cumplimiento a nivel de ACTIVIDAD (grupo tareaId), versión estándar ----

// Filas hermanas: todas las de la misma (tareaId, anio, semana). A partir de un id
// representativo. Sin tareaId, el grupo es solo esa fila. Incluye lotes (compartidos).
async function filasHermanas(id: string) {
  const base = await prisma.actividad.findUnique({ where: { id }, include: { lotes: true } })
  if (!base) return null
  if (!base.tareaId) return { base, filas: [base] }
  const filas = await prisma.actividad.findMany({
    where: { tareaId: base.tareaId, anio: base.anio, semana: base.semana },
    include: { lotes: true },
  })
  return { base, filas }
}

// Agrega un avance por lote a TODA la actividad: mismo avancePorLote consolidado en
// cada fila del grupo; todas quedan PARCIAL. Solo afecta filas PENDIENTE/PARCIAL.
export async function registrarAvanceLoteGrupo(
  id: string,
  dia: number,
  maquinaId: string | null,
  avances: { loteId: string; cantidad: number }[],
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const actual = agregarAvances(
    normalizarAvancePorLote(g.base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
    dia,
    maquinaId,
    avances,
  )
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) =>
        prisma.actividad.update({
          where: { id: f.id },
          data: { avancePorLote: actual as Prisma.InputJsonValue, estado: 'PARCIAL' },
        }),
      ),
  )
  return true
}

// Avance "genérico" (actividad SIN lotes): guarda la observación en nota de todas las
// filas y las deja PARCIAL. Editable (sobrescribe la nota previa).
export async function registrarAvanceObservacionGrupo(id: string, nota: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) =>
        prisma.actividad.update({ where: { id: f.id }, data: { nota, estado: 'PARCIAL' } }),
      ),
  )
  return true
}

// Cierra la actividad: todas las filas no cumplidas pasan a CUMPLIDA. Si hay lotes,
// haRealizada = suma de avances de los lotes vigentes (igual en todas las filas).
export async function marcarCumplidaGrupo(id: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  const total = totalAvanceLotes(
    g.base.lotes,
    normalizarAvancePorLote(g.base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
  )
  const tieneLotes = g.base.lotes.length > 0
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado !== 'CUMPLIDA')
      .map((f) =>
        prisma.actividad.update({
          where: { id: f.id },
          data: { estado: 'CUMPLIDA', ...(tieneLotes ? { haRealizada: total } : {}) },
        }),
      ),
  )
  return true
}

// Novedad de la actividad completa: aplica estado (NO_CUMPLIDA/PARCIAL/REPROGRAMADA) +
// motivo/nota a todas las filas. Para No cumplida/Reprogramada devuelve la tarea al banco
// (toda la actividad es una sola novedad). Cambio de actividad: crea UNA actividad de
// reemplazo (cumplida) con el día/responsable de la fila base.
export async function registrarNovedadGrupo(
  id: string,
  estado: string,
  motivoId: string | null,
  nota: string | null,
  reemplazo?: { descripcion: string; loteId: string | null } | null,
  lotesHechos: string[] = [],
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const notaFinal = reemplazo ? `Cambiada por: ${reemplazo.descripcion}` : nota
  let fincaId: string | null = null
  if (reemplazo?.loteId) {
    const lote = await prisma.lote.findUnique({ where: { id: reemplazo.loteId } })
    fincaId = lote?.fincaId ?? null
  }
  await prisma.$transaction(async (tx) => {
    for (const f of g.filas) {
      if (f.estado === 'CUMPLIDA') continue
      await tx.actividad.update({
        where: { id: f.id },
        data: {
          estado,
          motivoId,
          nota: notaFinal,
          ...(lotesHechos.length ? { lotesHechos: lotesHechos as Prisma.InputJsonValue } : {}),
        },
      })
    }
    if ((estado === 'NO_CUMPLIDA' || estado === 'REPROGRAMADA') && g.base.tareaId) {
      await tx.tarea.update({
        where: { id: g.base.tareaId },
        data: {
          estado: 'PENDIENTE',
          anioSel: null,
          semanaSel: null,
          vecesReprogramada: g.base.vecesReprogramada + 1,
        },
      })
    }
    if (reemplazo?.descripcion) {
      await tx.actividad.create({
        data: {
          anio: g.base.anio,
          semana: g.base.semana,
          dia: g.base.dia,
          descripcion: reemplazo.descripcion,
          turno: g.base.turno,
          estado: 'CUMPLIDA',
          areaId: g.base.areaId,
          fincaId,
          responsableId: g.base.responsableId,
          nota: `En reemplazo de: ${g.base.descripcion}`,
          lotes: reemplazo.loteId ? { connect: [{ id: reemplazo.loteId }] } : undefined,
        },
      })
    }
  })
  return true
}

// Desmarca toda la actividad: todas las filas vuelven a PENDIENTE y se limpia lo
// capturado (medida, centro de costo, motivo, nota, potreros, avances).
export async function reabrirGrupo(id: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas.map((f) =>
      prisma.actividad.update({
        where: { id: f.id },
        data: {
          estado: 'PENDIENTE',
          haRealizada: null,
          centroCosto: null,
          motivoId: null,
          nota: null,
          lotesHechos: Prisma.DbNull,
          avancePorLote: Prisma.DbNull,
        },
      }),
    ),
  )
  return true
}
```

> Si `AvanceEntrada` no está importado en `repositorio.ts`, agregarlo al import desde `@/dominio/avance-lote` (verificar con el grep del Step 1).

- [ ] **Step 3: Typecheck**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(cumplimiento): funciones de repositorio por actividad (grupo tareaId)"
```

---

### Task 2: Server actions a nivel de grupo

**Files:**
- Modify: `src/app/cumplimiento/acciones.ts` (imports + cinco acciones nuevas al final)

**Interfaces:**
- Consumes: las funciones de Task 1; helpers locales `texto`, `textoOpcional`, `numeroOpcional`; el guard `bloqueadoPorPlazoActividad` (ya existe en el archivo); `ESTADOS_VALIDOS`.
- Produces (server actions):
  - `registrarAvanceLoteActividadAccion(form: FormData): Promise<void>`
  - `registrarAvanceObservacionAccion(form: FormData): Promise<void>`
  - `marcarCumplidaActividadAccion(form: FormData): Promise<void>`
  - `registrarNovedadActividadAccion(form: FormData): Promise<void>`
  - `desmarcarActividadAccion(form: FormData): Promise<void>`

- [ ] **Step 1: Ampliar el import de repositorio en `acciones.ts`**

En `src/app/cumplimiento/acciones.ts`, agregar las funciones nuevas al import desde `@/datos/repositorio` (línea 4). Resultado:
```ts
import { marcarEstado, reprogramarActividad, registrarCumplimiento, crearActividadRealizada, reabrirActividad, registrarAvanceLote, devolverAlBanco, marcarCumplidaDesdeParcial, semanaDeActividad, registrarAvanceLoteGrupo, registrarAvanceObservacionGrupo, marcarCumplidaGrupo, registrarNovedadGrupo, reabrirGrupo } from '@/datos/repositorio'
```

- [ ] **Step 2: Añadir las cinco acciones al final de `acciones.ts`**

Agregar al final del archivo:

```ts
// ---- Acciones a nivel de ACTIVIDAD (estándar). El `id` es una fila representativa. ----

export async function registrarAvanceLoteActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  if (!id || !(dia >= 1 && dia <= 7)) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const loteIds = form.getAll('loteAvance').map((v) => String(v))
  const avances = loteIds
    .map((loteId) => ({ loteId, cantidad: numeroOpcional(form, `cantidad_${loteId}`) ?? 0 }))
    .filter((a) => a.cantidad > 0)
  if (avances.length === 0) return
  await registrarAvanceLoteGrupo(id, dia, null, avances)
  revalidatePath('/cumplimiento')
}

export async function registrarAvanceObservacionAccion(form: FormData) {
  const id = texto(form, 'id')
  const nota = texto(form, 'nota')
  if (!id || nota === '') return
  if (await bloqueadoPorPlazoActividad(id)) return
  await registrarAvanceObservacionGrupo(id, nota)
  revalidatePath('/cumplimiento')
}

export async function marcarCumplidaActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await marcarCumplidaGrupo(id)
  revalidatePath('/cumplimiento')
}

export async function registrarNovedadActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  const estado = texto(form, 'estado')
  if (!id || !ESTADOS_VALIDOS.includes(estado) || estado === 'PENDIENTE' || estado === 'CUMPLIDA') return
  const motivoId = textoOpcional(form, 'motivoId')
  if (!motivoId) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const nota = textoOpcional(form, 'nota')
  const lotesHechos = form.getAll('loteHecho').map((v) => String(v))
  // Cambio de actividad (estándar): descripción + lote, sin máquina/medida.
  const reemplazoDesc = texto(form, 'reemplazoDescripcion')
  const reemplazo = reemplazoDesc
    ? { descripcion: reemplazoDesc, loteId: textoOpcional(form, 'reemplazoLoteId') }
    : null
  await registrarNovedadGrupo(id, estado, motivoId, nota, reemplazo, lotesHechos)
  revalidatePath('/cumplimiento')
}

export async function desmarcarActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await reabrirGrupo(id)
  revalidatePath('/cumplimiento')
}
```

> Nota: `registrarNovedadActividadAccion` exige motivo (toda novedad lleva motivo) y rechaza PENDIENTE/CUMPLIDA (CUMPLIDA se hace con `marcarCumplidaActividadAccion`). El avance por lote a nivel de actividad no usa máquina (`maquinaId = null`): es el estándar.

- [ ] **Step 3: Typecheck**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): server actions por actividad (estándar)"
```

---

### Task 3: Componente cliente `ActividadEstandar`

**Files:**
- Create: `src/app/cumplimiento/actividad-estandar.tsx`

**Interfaces:**
- Consumes: `FormAvanceLote` (`./form-avance-lote`), `FormRegistrar` (`./form-registrar`), tipo `Unidad` (`@/dominio/unidad`), tipo `Estado` (`@/dominio/tipos`).
- Produces: componente `ActividadEstandar` (client) que renderiza los controles interactivos para una actividad estándar en estado `PENDIENTE` o `PARCIAL`.

Props:
```ts
{
  actividadId: string            // id representativo (fila más temprana de la tarjeta)
  estado: Estado                 // 'PENDIENTE' | 'PARCIAL' (el llamador solo lo usa en esos casos)
  unidad: Unidad
  dia: number                    // día representativo (para el form de avance)
  tieneLotes: boolean
  lotesActividad: { id: string; nombre: string }[]   // lotes de la actividad (avance + potreros)
  lotesCatalogo: { id: string; nombre: string; finca: { nombre: string } }[]  // catálogo global (reemplazo)
  estipuladas: { id: string; nombre: string; unidad: string }[]
  motivos: { id: string; nombre: string }[]
  motivoCambioId: string | null
  nota: string | null            // observación actual (caso sin lotes)
  registrarAvanceLote: (f: FormData) => void | Promise<void>
  registrarObservacion: (f: FormData) => void | Promise<void>
  marcarCumplida: (f: FormData) => void | Promise<void>
  registrarNovedad: (f: FormData) => void | Promise<void>
  devolverAlBanco: (f: FormData) => void | Promise<void>
}
```

- [ ] **Step 1: Crear el componente**

Crear `src/app/cumplimiento/actividad-estandar.tsx` con:

```tsx
'use client'

import { useState } from 'react'
import type { Unidad } from '@/dominio/unidad'
import type { Estado } from '@/dominio/tipos'
import { FormAvanceLote } from './form-avance-lote'
import { FormRegistrar } from './form-registrar'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Control único de cumplimiento de UNA actividad estándar (no maquinaria), en estado
// PENDIENTE o PARCIAL. Con lotes: avances por lote. Sin lotes: observación. El cierre
// (Cumplida) es manual; la novedad (No cumplida/Reprogramada/cambio) usa FormRegistrar.
export function ActividadEstandar({
  actividadId,
  estado,
  unidad,
  dia,
  tieneLotes,
  lotesActividad,
  lotesCatalogo,
  estipuladas,
  motivos,
  motivoCambioId,
  nota,
  registrarAvanceLote,
  registrarObservacion,
  marcarCumplida,
  registrarNovedad,
  devolverAlBanco,
}: {
  actividadId: string
  estado: Estado
  unidad: Unidad
  dia: number
  tieneLotes: boolean
  lotesActividad: { id: string; nombre: string }[]
  lotesCatalogo: Lote[]
  estipuladas: Estipulada[]
  motivos: Motivo[]
  motivoCambioId: string | null
  nota: string | null
  registrarAvanceLote: (f: FormData) => void | Promise<void>
  registrarObservacion: (f: FormData) => void | Promise<void>
  marcarCumplida: (f: FormData) => void | Promise<void>
  registrarNovedad: (f: FormData) => void | Promise<void>
  devolverAlBanco: (f: FormData) => void | Promise<void>
}) {
  const [novedad, setNovedad] = useState(false)
  const esParcial = estado === 'PARCIAL'
  // Cumplida visible: sin lotes siempre; con lotes solo cuando ya hay avance (PARCIAL).
  const mostrarCumplida = !tieneLotes || esParcial

  if (novedad) {
    return (
      <div>
        <FormRegistrar
          actividadId={actividadId}
          esMaquinaria={false}
          unidad={unidad}
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          lotes={lotesCatalogo}
          maquinas={[]}
          estipuladas={estipuladas}
          haProgramada={0}
          lotesActividad={lotesActividad}
          accion={registrarNovedad}
        />
        <button
          type="button"
          onClick={() => setNovedad(false)}
          className="mt-1 text-xs text-tierra underline"
        >
          cancelar novedad
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      {tieneLotes ? (
        <FormAvanceLote
          actividadId={actividadId}
          diaActividad={dia}
          esMaquinaria={false}
          maquinas={[]}
          unidad={unidad}
          lotes={lotesActividad}
          accion={registrarAvanceLote}
        />
      ) : (
        <form action={registrarObservacion} className="flex flex-1 items-end gap-2">
          <input type="hidden" name="id" value={actividadId} />
          <label className="flex flex-1 flex-col text-xs">
            Avance / observación
            <input
              name="nota"
              defaultValue={nota ?? ''}
              placeholder="¿qué se avanzó?"
              className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
            />
          </label>
          <button className="rounded-lg border border-bosque px-2 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">
            Guardar avance
          </button>
        </form>
      )}

      {mostrarCumplida && (
        <form action={marcarCumplida}>
          <input type="hidden" name="id" value={actividadId} />
          <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">
            ✓ {esParcial ? 'Marcar cumplida' : 'Cumplida'}
          </button>
        </form>
      )}

      {esParcial && (
        <form action={devolverAlBanco}>
          <input type="hidden" name="id" value={actividadId} />
          <button className="rounded-lg border border-borde px-2 py-1 text-xs text-tierra hover:bg-arena/40">
            Devolver al banco
          </button>
        </form>
      )}

      {!esParcial && (
        <button type="button" onClick={() => setNovedad(true)} className="text-xs text-tierra underline">
          registrar novedad
        </button>
      )}
    </div>
  )
}
```

> `FormRegistrar` con `esMaquinaria={false}` ya oculta máquina/medida/centro de costo y, en cambio de actividad, pide solo descripción + lote (campos `reemplazoDescripcion`/`reemplazoLoteId`), que es justo lo que parsea `registrarNovedadActividadAccion`. `maquinas={[]}` es seguro porque no se renderiza en el estándar.

- [ ] **Step 2: Typecheck**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add src/app/cumplimiento/actividad-estandar.tsx
git commit -m "feat(cumplimiento): componente ActividadEstandar (control único)"
```

---

### Task 4: Integrar el bloque estándar en la página

**Files:**
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `ActividadEstandar` (Task 3); las acciones de Task 2; `estadoActividad` (`@/dominio/metricas`); variables ya presentes en la tarjeta: `cab`, `dias`, `unidad`, `esMaquinaria`, `bloqueado`, `motivos`, `motivoCambioId`, `lotes`, `estipuladas`, `ESTADOS`, `unidadAbreviada`, helpers de avance.
- Produces: nada para otras tareas (capa de presentación).

- [ ] **Step 1: Imports**

En `src/app/cumplimiento/page.tsx`:

Agregar `estadoActividad` al import de métricas (línea 10):
```ts
import { porcentajeCumplimiento, colorSemaforo, agruparPorActividad, diasDistintos, responsablesDistintos, conteoEstadoActividades, tieneDiaPendiente, estadoActividad } from '@/dominio/metricas'
```

Agregar el componente y las acciones nuevas a los imports (líneas 13 y 18). Para acciones (línea 13):
```ts
import { registrarAccion, agregarActividadRealizadaAccion, marcarEstadoAccion, desmarcarAccion, registrarAvanceLoteAccion, devolverAlBancoAccion, marcarCumplidaParcialAccion, registrarAvanceLoteActividadAccion, registrarAvanceObservacionAccion, marcarCumplidaActividadAccion, registrarNovedadActividadAccion, desmarcarActividadAccion } from './acciones'
```
Y tras el import de `DiaMaquinaria` (línea 18):
```ts
import { ActividadEstandar } from './actividad-estandar'
```

- [ ] **Step 2: Calcular estado del grupo en la tarjeta**

En el cuerpo del `.map(gruposActividad)` (tras `const cab = dias[0]`, ~línea 182), añadir:
```ts
            const estadoGrupo = estadoActividad(dias)
```

- [ ] **Step 3: Ramificar el cuerpo de la tarjeta (maquinaria vs estándar)**

Localizar el bloque que lista los días dentro de la tarjeta. Empieza tras `<InfoLotes ... className="mb-2" />` (línea 216) con:
```tsx
                <ul className="space-y-2">
                  {diasOrdenados.map(([dia, filas]) => (
```
y termina con el cierre de ese `<ul>` (línea 328: `</ul>` antes de `</li>` de la tarjeta).

Envolver TODO ese `<ul>...</ul>` (líneas 218–328) para que solo se use en maquinaria, y añadir el bloque estándar a continuación. Es decir, reemplazar la apertura:
```tsx
                <ul className="space-y-2">
                  {diasOrdenados.map(([dia, filas]) => (
```
por:
```tsx
                {esMaquinaria && (
                <ul className="space-y-2">
                  {diasOrdenados.map(([dia, filas]) => (
```
y reemplazar el cierre de ese `<ul>` (el `</ul>` de la línea 328) por:
```tsx
                </ul>
                )}

                {!esMaquinaria && (() => {
                  const avances = normalizarAvancePorLote(
                    cab.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
                  )
                  const tieneAvances = Object.values(avances).some((es) => es.length > 0)
                  const etiquetaDia = (d: number) =>
                    `${DIAS[d] ?? ''} ${fechas[d - 1] ? fmtFecha(fechas[d - 1]) : ''}`.trim()
                  const resumenAvances = textoAvanceConFecha(cab.lotes, avances, unidadAbreviada(unidad), etiquetaDia)
                  const tieneLotes = cab.lotes.length > 0
                  const interactivo = estadoGrupo === 'PENDIENTE' || estadoGrupo === 'PARCIAL'
                  return (
                    <div className="flex flex-col gap-2">
                      {/* Estado/resumen (no PENDIENTE): solo lectura */}
                      {estadoGrupo !== 'PENDIENTE' && (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold">{ESTADOS.find((e) => e.valor === estadoGrupo)?.etiqueta ?? estadoGrupo}</span>
                          {(tieneAvances || cab.haRealizada != null) && (
                            <span className="text-tierra">· {tieneAvances ? totalAvanceLotes(cab.lotes, avances) : cab.haRealizada} {unidadAbreviada(unidad)}</span>
                          )}
                          {cab.motivo && <span className="text-tierra">· {cab.motivo.nombre}</span>}
                          {cab.nota && <span className="text-tierra">· {cab.nota}</span>}
                          {textoLotesHechos(cab.lotes, cab.lotesHechos as string[] | null) && (
                            <span className="text-tierra">· ✅ Realizados: {textoLotesHechos(cab.lotes, cab.lotesHechos as string[] | null)}</span>
                          )}
                          {estadoGrupo !== 'PARCIAL' && !bloqueado && (
                            <form action={desmarcarActividadAccion} className="ml-auto">
                              <input type="hidden" name="id" value={cab.id} />
                              <button className="text-xs text-tierra underline hover:text-tinta">↩ desmarcar</button>
                            </form>
                          )}
                        </div>
                      )}
                      {resumenAvances && (
                        <span className="text-sm text-tierra">Avances: {resumenAvances}</span>
                      )}
                      {/* Controles interactivos (PENDIENTE/PARCIAL) */}
                      {interactivo && (
                        bloqueado ? (
                          estadoGrupo === 'PENDIENTE' && (
                            <span className="text-sm text-tierra">Pendiente (plazo vencido)</span>
                          )
                        ) : (
                          <ActividadEstandar
                            actividadId={cab.id}
                            estado={estadoGrupo}
                            unidad={unidad}
                            dia={cab.dia}
                            tieneLotes={tieneLotes}
                            lotesActividad={cab.lotes}
                            lotesCatalogo={lotes}
                            estipuladas={estipuladas}
                            motivos={motivos}
                            motivoCambioId={motivoCambioId}
                            nota={cab.nota}
                            registrarAvanceLote={registrarAvanceLoteActividadAccion}
                            registrarObservacion={registrarAvanceObservacionAccion}
                            marcarCumplida={marcarCumplidaActividadAccion}
                            registrarNovedad={registrarNovedadActividadAccion}
                            devolverAlBanco={devolverAlBancoAccion}
                          />
                        )
                      )}
                    </div>
                  )
                })()}
```

> El bloque estándar reutiliza los helpers ya importados en `page.tsx` (`normalizarAvancePorLote`, `textoAvanceConFecha`, `totalAvanceLotes`, `unidadAbreviada`, `textoLotesHechos`, `DIAS`, `fechas`, `fmtFecha`, `ESTADOS`). Para PARCIAL no se ofrece "desmarcar" (se usa Devolver al banco / Cumplida desde el control); el desmarcar aparece solo en estados terminales. `devolverAlBancoAccion` (existente) opera sobre la tarea a partir de la fila `cab.id`.

- [ ] **Step 4: Verificar que `cab.lotes` trae `finca`**

`lotesCatalogo` (prop `lotes` global) ya incluye `finca` (lo usa `FormRegistrar`). `cab.lotes` (lotes de la actividad) se pasa como `lotesActividad` que solo requiere `{id, nombre}`. Confirmar que el tipo de `cab.lotes` es compatible con `{id: string; nombre: string}[]` (lo es: el include de actividades trae los lotes con id/nombre). Si el typecheck se queja por campos extra, no pasa nada (estructuralmente compatible).

- [ ] **Step 5: Typecheck**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida. (Si hay error de JSX por el `(() => { ... })()`, revisar el balance de llaves/paréntesis del bloque añadido en el Step 3.)

- [ ] **Step 6: Verificación manual**

Run: `npm run dev` y abrir `/cumplimiento` como un área **estándar** (no maquinaria), en la semana en curso.
Verificar:
- Una actividad **con lotes**: muestra un solo control con "Registrar avance"; al guardar un avance pasa a PARCIAL (aparece "Marcar cumplida" y "Devolver al banco"); "Marcar cumplida" la cierra; "registrar novedad" abre el form (No cumplida/Reprogramada/cambio).
- Una actividad **sin lotes**: muestra "Avance / observación" + "Cumplida" + "registrar novedad"; guardar observación deja PARCIAL con la nota; "Cumplida" la cierra.
- **No** aparecen sub-filas por día ni por responsable: es un solo bloque por tarjeta.
- El contador "Faltan N actividades" y el % se mantienen coherentes (cuentan por actividad).
- En un área **de maquinaria**: todo sigue igual que antes (por día).
- En una **semana pasada** (área, plazo vencido): solo lectura ("Pendiente (plazo vencido)", sin formularios).

Si no hay `DATABASE_URL` local, dejar constancia y validar en el deploy de preview/prod.

- [ ] **Step 7: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): bloque único por actividad en el estándar"
```

---

## Notas de cierre

- Tras revisar, desplegar con el flujo habitual (`git push` + `npx vercel@latest deploy --prod`). El build de Vercel regenera `.next` limpio y corre el typecheck real.
- Maquinaria queda intacta; este plan no toca su flujo por día.
- El ranking por responsable no se modifica (una actividad multi-responsable reparte el mismo resultado a todos sus responsables, en línea con "no se registra cumplimiento por responsable").

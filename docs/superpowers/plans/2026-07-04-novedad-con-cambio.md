# "+ Novedad" con bloque de cambio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el formulario "+ Novedad" de la tarjeta muestre el bloque rico de "cambio" (actividad de reemplazo + lotes + medida + cantidades) cuando el motivo es "cambio", cree la actividad "En reemplazo de…" y NO cambie el estado de la actividad original.

**Architecture:** Se extrae el bloque de reemplazo de `FormCerrar` a un componente compartido `BloqueReemplazo` (client, estado propio, mismos `name`s). `NovedadesLista` lo muestra en su form de agregar cuando el motivo elegido es el de "cambio". La acción `agregarNovedadAccion` lee los campos de reemplazo (mismo contrato que el cierre) y los pasa a `agregarNovedadGrupo`, que crea la actividad de reemplazo mediante un helper `crearActividadReemplazo` reutilizado por `registrarNovedadGrupo`. El día de la novedad se reutiliza como día del reemplazo.

**Tech Stack:** Next.js 16, React 19, Prisma/Postgres, TypeScript, Tailwind v4.

## Global Constraints

- Ante dudas de API de Next, leer `node_modules/next/dist/docs/`.
- El repo NO tiene tests automatizados: el ciclo de verificación de cada tarea es typecheck (+ build donde aplique). La verificación funcional en vivo va al final.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
- Reutilizar estilos Tailwind existentes.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- El contrato de `name`s del reemplazo NO cambia: `reemplazoDescripcion`, `reemplazoDescripcionOtra`, `reemplazoUnidad`, `reemplazoUnidadOtra`, `reemplazoMaquinaId`, `reemplazoLoteId` (múltiple), `reemplazoMedida_<loteId>`, `reemplazoBultos_<loteId>`, `reemplazoDia`.

---

### Task 1: Extraer `BloqueReemplazo` compartido y usarlo en `FormCerrar`

**Files:**
- Create: `src/app/cumplimiento/bloque-reemplazo.tsx`
- Modify: `src/app/cumplimiento/form-cerrar.tsx`

**Interfaces:**
- Produces: `BloqueReemplazo` (client) con props
  `{ esMaquinaria: boolean; estipuladas: {id:string;nombre:string;unidad:string}[]; lotes: {id:string;nombre:string;hectareas?:number|null;finca:{nombre:string}}[]; maquinas: {id:string;nombre:string}[]; diaActividad: number; mostrarDia?: boolean }`.
  Renderiza los campos de reemplazo con los `name`s del contrato. Si `mostrarDia` es `false`, NO renderiza el selector `reemplazoDia`.
- Consumes (Task 3/4): mismos `name`s.

- [ ] **Step 1: Crear `BloqueReemplazo`**

Crear `src/app/cumplimiento/bloque-reemplazo.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { PickerReemplazoPotreros } from './picker-reemplazo-potreros'
import { etiquetaMedida, normalizarUnidad, type Unidad } from '@/dominio/unidad'
import { usaBultos } from '@/dominio/bultos'

type Lote = { id: string; nombre: string; hectareas?: number | null; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro"
const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Bloque "actividad que se hizo en su lugar" (cambio). Estado propio; emite los name-s del
// contrato de reemplazo que leen registrarNovedadActividadAccion y agregarNovedadAccion.
// mostrarDia=false: el día lo aporta el formulario contenedor (p. ej. el día de la novedad).
export function BloqueReemplazo({
  esMaquinaria,
  estipuladas,
  lotes,
  maquinas,
  diaActividad,
  mostrarDia = true,
}: {
  esMaquinaria: boolean
  estipuladas: Estipulada[]
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  diaActividad: number
  mostrarDia?: boolean
}) {
  const [reemplazoDesc, setReemplazoDesc] = useState('')
  const [reemplazoUnidadSel, setReemplazoUnidadSel] = useState('Jornales')
  const [reemplazoDia, setReemplazoDia] = useState(String(diaActividad))

  const unidadPorNombre = new Map(estipuladas.map((e) => [e.nombre, normalizarUnidad(e.unidad)]))
  const reemplazoOtra = reemplazoDesc === '__otra__'
  const reemplazoUnidad: Unidad = reemplazoOtra || reemplazoDesc === '' ? 'ha' : unidadPorNombre.get(reemplazoDesc) ?? 'ha'

  return (
    <div className="flex w-full flex-wrap items-end gap-2 rounded border border-amber-200 bg-amber-50 p-2">
      <span className="w-full text-xs font-semibold text-amber-800">Actividad que se hizo en su lugar</span>
      {esMaquinaria ? (
        <>
          <label className="flex flex-1 flex-col text-xs">
            Actividad *
            <select
              name="reemplazoDescripcion"
              required
              value={reemplazoDesc}
              onChange={(e) => setReemplazoDesc(e.target.value)}
              className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
            >
              <option value="" disabled>— elige —</option>
              {estipuladas.map((e) => (
                <option key={e.id} value={e.nombre}>{e.nombre}</option>
              ))}
              <option value="__otra__">Otra…</option>
            </select>
          </label>
          {reemplazoOtra && (
            <label className="flex flex-1 flex-col text-xs">
              Otra (texto libre) *
              <input name="reemplazoDescripcionOtra" required className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
          <label className="flex flex-col text-xs">
            Máquina
            <select name="reemplazoMaquinaId" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— sin máquina —</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
          <span className="flex flex-col text-xs text-tierra">
            Medida: {etiquetaMedida(reemplazoUnidad)}
            <input type="hidden" name="reemplazoUnidad" value={reemplazoUnidad} />
          </span>
        </>
      ) : (
        <>
          <label className="flex flex-1 flex-col text-xs">
            Descripción *
            <input name="reemplazoDescripcion" required value={reemplazoDesc} onChange={(e) => setReemplazoDesc(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
          <label className="flex flex-col text-xs">
            Unidad
            <select
              name="reemplazoUnidad"
              value={reemplazoUnidadSel === 'Otro' ? 'otro' : reemplazoUnidadSel.toLowerCase()}
              onChange={(e) => setReemplazoUnidadSel(e.target.value === 'otro' ? 'Otro' : e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
              className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
            >
              {UNIDADES.map((u) => (<option key={u} value={u.toLowerCase()}>{u}</option>))}
              <option value="otro">Otro…</option>
            </select>
          </label>
          {reemplazoUnidadSel === 'Otro' && (
            <label className="flex flex-col text-xs">
              Unidad (texto)
              <input name="reemplazoUnidadOtra" placeholder="ej. jornales" className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
        </>
      )}
      {mostrarDia && (
        <label className="flex flex-col text-xs">
          Día *
          <select name="reemplazoDia" value={reemplazoDia} onChange={(e) => setReemplazoDia(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{DIAS[d]}</option>))}
          </select>
        </label>
      )}
      <label className="flex w-full flex-col text-xs">
        Potreros (marca y pon medida{usaBultos(reemplazoDesc) ? ' + bultos' : ''})
        <PickerReemplazoPotreros
          lotes={lotes}
          conBultos={usaBultos(reemplazoDesc)}
          unidadLabel={esMaquinaria ? etiquetaMedida(reemplazoUnidad) : reemplazoUnidadSel === 'Otro' ? 'medida' : reemplazoUnidadSel}
        />
      </label>
    </div>
  )
}
```

- [ ] **Step 2: Usar `BloqueReemplazo` en `FormCerrar` (quitar el bloque inline)**

En `src/app/cumplimiento/form-cerrar.tsx`:

1. Reemplazar los imports de la cabecera:

```tsx
import { useState } from 'react'
import { PickerReemplazoPotreros } from './picker-reemplazo-potreros'
import { etiquetaMedida, normalizarUnidad, type Unidad } from '@/dominio/unidad'
import { usaBultos } from '@/dominio/bultos'
```

por:

```tsx
import { useState } from 'react'
import { BloqueReemplazo } from './bloque-reemplazo'
```

2. Quitar las constantes `UNIDADES` y `DIAS` del tope del archivo (ya viven en `BloqueReemplazo`).

3. Dentro del componente, quitar el estado y los cómputos que ya no se usan:

Borrar estas líneas:
```tsx
  const [reemplazoDesc, setReemplazoDesc] = useState('')
  const [reemplazoUnidadSel, setReemplazoUnidadSel] = useState('Jornales')
  const [reemplazoDia, setReemplazoDia] = useState(String(diaActividad))

  const esCambio = motivoSel !== '' && motivoSel === motivoCambioId
  // Unidad de la actividad de reemplazo elegida ("Otra"/vacío ⇒ ha).
  const unidadPorNombre = new Map(estipuladas.map((e) => [e.nombre, normalizarUnidad(e.unidad)]))
  const reemplazoOtra = reemplazoDesc === '__otra__'
  const reemplazoUnidad: Unidad = reemplazoOtra || reemplazoDesc === '' ? 'ha' : unidadPorNombre.get(reemplazoDesc) ?? 'ha'
```
y dejar solo:
```tsx
  const esCambio = motivoSel !== '' && motivoSel === motivoCambioId
```

4. Reemplazar TODO el bloque JSX `{esCambio && ( <div …> … </div> )}` (el `<div className="flex w-full flex-wrap items-end gap-2 rounded border border-amber-200 bg-amber-50 p-2">…`) por:

```tsx
      {esCambio && (
        <BloqueReemplazo
          esMaquinaria={esMaquinaria}
          estipuladas={estipuladas}
          lotes={lotes}
          maquinas={maquinas}
          diaActividad={diaActividad}
        />
      )}
```

(No se pasa `mostrarDia`, así que usa el default `true` — mantiene su propio selector de día, idéntico a hoy.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores. (Si sale "declared but never read" para algún import/const, es porque quedó algo sin borrar en el Step 2 — quitarlo.)

- [ ] **Step 4: Build**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/bloque-reemplazo.tsx src/app/cumplimiento/form-cerrar.tsx
git commit -m "refactor(cumplimiento): extraer BloqueReemplazo compartido desde FormCerrar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Repo — helper `crearActividadReemplazo` + `reemplazo?` en `agregarNovedadGrupo`

**Files:**
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Produces:
  - `agregarNovedadGrupo(id: string, entrada: { dia: number; motivoId: string | null; observacion: string | null }, reemplazo?: Reemplazo | null)` donde
    `Reemplazo = { descripcion: string; unidad?: string | null; loteIds?: string[]; medida?: Record<string, number>; bultos?: Record<string, number>; dia?: number | null }`.
- Consumes: patrón de creación ya existente en `registrarNovedadGrupo`.

- [ ] **Step 1: Añadir el helper `crearActividadReemplazo` y refactorizar `registrarNovedadGrupo`**

En `src/datos/repositorio.ts`, justo ANTES de `export async function registrarNovedadGrupo(` (línea ~919, encima de su comentario), insertar el helper:

```ts
type Reemplazo = { descripcion: string; unidad?: string | null; loteIds?: string[]; medida?: Record<string, number>; bultos?: Record<string, number>; dia?: number | null }

// Crea UNA actividad de reemplazo ("En reemplazo de: <base.descripcion>", CUMPLIDA) dentro de
// una transacción. Reutilizado por registrarNovedadGrupo (al cerrar por cambio) y por
// agregarNovedadGrupo (al registrar una novedad de cambio, sin cerrar la original).
async function crearActividadReemplazo(
  tx: Prisma.TransactionClient,
  base: { anio: number; semana: number; dia: number; turno: string; areaId: string; responsableId: string; descripcion: string },
  reemplazo: Reemplazo,
) {
  let fincaId: string | null = null
  if (reemplazo.loteIds?.[0]) {
    const lote = await tx.lote.findUnique({ where: { id: reemplazo.loteIds[0] } })
    fincaId = lote?.fincaId ?? null
  }
  await tx.actividad.create({
    data: {
      anio: base.anio,
      semana: base.semana,
      dia: reemplazo.dia ?? base.dia,
      descripcion: reemplazo.descripcion,
      turno: base.turno,
      estado: 'CUMPLIDA',
      areaId: base.areaId,
      fincaId,
      responsableId: base.responsableId,
      nota: `En reemplazo de: ${base.descripcion}`,
      lotes: reemplazo.loteIds?.length ? { connect: reemplazo.loteIds.map((lid) => ({ id: lid })) } : undefined,
      ...(reemplazo.medida && Object.keys(reemplazo.medida).length ? { haRealizada: Object.values(reemplazo.medida).reduce((s, n) => s + n, 0) } : {}),
      ...(reemplazo.unidad ? { unidadRealizada: reemplazo.unidad } : {}),
      ...(reemplazo.bultos && Object.keys(reemplazo.bultos).length ? { bultosPorLote: reemplazo.bultos as Prisma.InputJsonValue } : {}),
    },
  })
}
```

Luego, dentro de `registrarNovedadGrupo`, reemplazar el cómputo de `fincaId` y el bloque de creación:

Borrar (arriba de la transacción):
```ts
  let fincaId: string | null = null
  if (reemplazo?.loteIds?.[0]) {
    const lote = await prisma.lote.findUnique({ where: { id: reemplazo.loteIds[0] } })
    fincaId = lote?.fincaId ?? null
  }
```

Y dentro de la transacción, reemplazar:
```ts
    if (reemplazo?.descripcion) {
      await tx.actividad.create({
        data: {
          anio: g.base.anio,
          semana: g.base.semana,
          dia: reemplazo.dia ?? g.base.dia,
          descripcion: reemplazo.descripcion,
          turno: g.base.turno,
          estado: 'CUMPLIDA',
          areaId: g.base.areaId,
          fincaId,
          responsableId: g.base.responsableId,
          nota: `En reemplazo de: ${g.base.descripcion}`,
          lotes: reemplazo.loteIds?.length ? { connect: reemplazo.loteIds.map((lid) => ({ id: lid })) } : undefined,
          ...(reemplazo.medida && Object.keys(reemplazo.medida).length ? { haRealizada: Object.values(reemplazo.medida).reduce((s, n) => s + n, 0) } : {}),
          ...(reemplazo.unidad ? { unidadRealizada: reemplazo.unidad } : {}),
          ...(reemplazo.bultos && Object.keys(reemplazo.bultos).length ? { bultosPorLote: reemplazo.bultos as Prisma.InputJsonValue } : {}),
        },
      })
    }
```
por:
```ts
    if (reemplazo?.descripcion) {
      await crearActividadReemplazo(tx, g.base, reemplazo)
    }
```

(El tipo del parámetro `reemplazo?` de `registrarNovedadGrupo` es estructuralmente compatible con `Reemplazo`; no hace falta cambiar su firma. `g.base` provee `anio/semana/dia/turno/areaId/responsableId/descripcion`.)

- [ ] **Step 2: Añadir `reemplazo?` a `agregarNovedadGrupo`**

Reemplazar la función `agregarNovedadGrupo` (líneas ~740-756) por:

```ts
export async function agregarNovedadGrupo(
  id: string,
  entrada: { dia: number; motivoId: string | null; observacion: string | null },
  reemplazo?: Reemplazo | null,
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const lista = agregarNovedad(normalizarNovedades(g.base.novedades), entrada)
  await prisma.$transaction(async (tx) => {
    for (const f of g.filas) {
      if (f.estado !== 'PENDIENTE' && f.estado !== 'PARCIAL') continue
      await tx.actividad.update({
        where: { id: f.id },
        data: { novedades: lista as unknown as Prisma.InputJsonValue },
      })
    }
    if (reemplazo?.descripcion) {
      await crearActividadReemplazo(tx, g.base, reemplazo)
    }
  })
  return true
}
```

(No toca `estado` ni `cerrada`; la creación del reemplazo es aditiva.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 4: Build**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(repo): crearActividadReemplazo compartido + reemplazo opcional en agregarNovedadGrupo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `agregarNovedadAccion` — leer campos de reemplazo y pasarlos

**Files:**
- Modify: `src/app/cumplimiento/acciones.ts`

**Interfaces:**
- Consumes: `agregarNovedadGrupo(id, entrada, reemplazo?)` (Task 2).

- [ ] **Step 1: Reescribir `agregarNovedadAccion`**

Reemplazar la función `agregarNovedadAccion` (líneas ~173-183) por:

```ts
export async function agregarNovedadAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  if (!id || !(dia >= 1 && dia <= 7)) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const motivoId = textoOpcional(form, 'motivoId')
  const observacion = textoOpcional(form, 'observacion')
  // Bloque de cambio (opcional): si llega una descripción de reemplazo, se crea la actividad
  // "En reemplazo de…" con los mismos name-s que usa el cierre. El día del reemplazo es el de
  // la novedad (este formulario no envía reemplazoDia).
  const reemplazoSel = texto(form, 'reemplazoDescripcion')
  const reemplazoDescripcion = reemplazoSel === '__otra__' ? texto(form, 'reemplazoDescripcionOtra') : reemplazoSel
  const reemplazoUnidadSel = texto(form, 'reemplazoUnidad')
  const reemplazoUnidad = reemplazoUnidadSel === 'otro' ? texto(form, 'reemplazoUnidadOtra') || 'otro' : reemplazoUnidadSel || 'ha'
  const reemplazoLoteIds = form.getAll('reemplazoLoteId').map(String).filter(Boolean)
  const reemplazoMedida: Record<string, number> = {}
  const reemplazoBultos: Record<string, number> = {}
  for (const lid of reemplazoLoteIds) {
    const m = numeroOpcional(form, `reemplazoMedida_${lid}`)
    if (m != null) reemplazoMedida[lid] = m
    const b = numeroOpcional(form, `reemplazoBultos_${lid}`)
    if (b != null) reemplazoBultos[lid] = b
  }
  const reemplazo = reemplazoDescripcion
    ? { descripcion: reemplazoDescripcion, unidad: reemplazoUnidad, loteIds: reemplazoLoteIds, medida: reemplazoMedida, bultos: reemplazoBultos, dia }
    : null
  if (!motivoId && !observacion && !reemplazo) return
  await agregarNovedadGrupo(id, { dia, motivoId, observacion }, reemplazo)
  revalidatePath('/cumplimiento')
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): agregarNovedadAccion lee el bloque de cambio y crea el reemplazo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `NovedadesLista` — motivo controlado + `BloqueReemplazo` en "+ Novedad"

**Files:**
- Modify: `src/app/cumplimiento/novedades-lista.tsx`

**Interfaces:**
- Consumes: `BloqueReemplazo` (Task 1).
- Produces: `NovedadesLista` con props nuevos `esMaquinaria`, `motivoCambioId`, `estipuladas`, `lotes`, `maquinas`, `diaActividad`.

> Nota: este componente añade props REQUERIDOS; hasta que la Task 5 los pase desde `page.tsx`, el typecheck reportará error en `page.tsx`. Eso es esperado: la verificación completa (typecheck+build) se corre al final de la Task 5.

- [ ] **Step 1: Imports y tipos de props**

En `src/app/cumplimiento/novedades-lista.tsx`:

1. Añadir el import al tope (después de `import { useState } from 'react'`):
```tsx
import { BloqueReemplazo } from './bloque-reemplazo'
```

2. Añadir arriba (después de la línea `type Entrada = …`) los tipos auxiliares:
```tsx
type Lote = { id: string; nombre: string; hectareas?: number | null; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }
```

3. En el destructuring de props, añadir `esMaquinaria`, `motivoCambioId`, `estipuladas`, `lotes`, `maquinas`, `diaActividad`:
```tsx
export function NovedadesLista({
  actividadId,
  entradas,
  editable,
  motivos,
  diaLabels,
  esMaquinaria,
  motivoCambioId,
  estipuladas,
  lotes,
  maquinas,
  diaActividad,
  agregar,
  editar,
  eliminar,
}: {
  actividadId: string
  entradas: Entrada[]
  editable: boolean
  motivos: { id: string; nombre: string }[]
  diaLabels: string[]
  esMaquinaria: boolean
  motivoCambioId: string | null
  estipuladas: Estipulada[]
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  diaActividad: number
  agregar: (f: FormData) => void | Promise<void>
  editar: (f: FormData) => void | Promise<void>
  eliminar: (f: FormData) => void | Promise<void>
}) {
```

- [ ] **Step 2: Estado del motivo en el form de agregar**

Añadir un estado junto a los existentes (`const [abierto, setAbierto] = useState(false)` …):
```tsx
  const [motivoNuevo, setMotivoNuevo] = useState('')
```

- [ ] **Step 3: Form de agregar — motivo controlado + BloqueReemplazo**

Reemplazar el `<form action={agregar} …>` del ramo `abierto` (el que hoy tiene día + motivo + observación + botones) por:

```tsx
          <form action={agregar} onSubmit={() => { setAbierto(false); setMotivoNuevo('') }} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={actividadId} />
            <label className="flex flex-col">
              Día
              <select name="dia" defaultValue={diaActividad} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{diaLabels[d]}</option>))}
              </select>
            </label>
            <label className="flex flex-col">
              Motivo
              <select name="motivoId" value={motivoNuevo} onChange={(e) => setMotivoNuevo(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                <option value="">—</option>
                {motivos.map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
              </select>
            </label>
            <label className="flex flex-1 flex-col">
              Observación
              <input name="observacion" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
            {motivoNuevo !== '' && motivoNuevo === motivoCambioId && (
              <BloqueReemplazo
                esMaquinaria={esMaquinaria}
                estipuladas={estipuladas}
                lotes={lotes}
                maquinas={maquinas}
                diaActividad={diaActividad}
                mostrarDia={false}
              />
            )}
            <button className="rounded-lg border border-bosque px-2 py-1 font-semibold text-bosque hover:bg-arena/40">Agregar</button>
            <button type="button" onClick={() => { setAbierto(false); setMotivoNuevo('') }} className="text-tierra underline">cancelar</button>
          </form>
```

(El `defaultValue={diaActividad}` del select de día hace que ese día sea el del reemplazo; `mostrarDia={false}` evita un segundo selector de día.)

- [ ] **Step 4: Typecheck (parcial, esperado)**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: SOLO errores en `src/app/cumplimiento/page.tsx` por props faltantes de `NovedadesLista` (se resuelven en Task 5). El archivo `novedades-lista.tsx` no debe tener errores propios.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/novedades-lista.tsx
git commit -m "feat(cumplimiento): '+ Novedad' muestra el bloque de cambio cuando el motivo es cambio

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `page.tsx` — pasar props nuevos a `NovedadesLista`

**Files:**
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: vars ya existentes en el scope: `esMaquinaria` (línea ~56), `motivoCambioId` (~74), `estipuladasMaq` (~77), `maquinas`, `lotes`, `cab.dia`.

- [ ] **Step 1: Añadir los props al `<NovedadesLista>`**

En `src/app/cumplimiento/page.tsx`, en el render de `<NovedadesLista …>`, añadir los props nuevos (junto a los existentes `actividadId`, `entradas`, `editable`, `motivos`, `diaLabels`, `agregar`, `editar`, `eliminar`):

```tsx
                      <NovedadesLista
                        actividadId={cab.id}
                        entradas={entradasNovedad}
                        editable={interactivo && !bloqueado}
                        motivos={motivos}
                        diaLabels={DIAS}
                        esMaquinaria={esMaquinaria}
                        motivoCambioId={motivoCambioId}
                        estipuladas={estipuladasMaq}
                        lotes={lotes}
                        maquinas={maquinas}
                        diaActividad={cab.dia}
                        agregar={agregarNovedadAccion}
                        editar={editarNovedadAccion}
                        eliminar={eliminarNovedadAccion}
                      />
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): cablear props del bloque de cambio en NovedadesLista

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras todas las tareas)

Server local (`next dev`) apuntando a la DB real + cookie de sesión firmada (ver memoria `verificacion-navegador`), con escrituras reversibles (snapshot/restore por id). Comprobar renderizado por HTML (curl) y, para el flujo completo con selects controladas, en navegador real:

1. **"+ Novedad" simple:** motivo distinto de "cambio" → guarda `{día, motivo, observación}` en el log; NO crea actividad de reemplazo; la original sigue en su estado.
2. **"+ Novedad" con cambio:** elegir el motivo "cambio" despliega `BloqueReemplazo`; al Agregar, la novedad queda en el log **y** aparece una actividad "En reemplazo de: …" CUMPLIDA (con lotes/medida/bultos y el día de la novedad); la actividad original **sigue** PENDIENTE/PARCIAL (no cerrada).
3. **Cierre sin regresión:** `FormCerrar` "No se hizo → cambio" sigue creando el reemplazo igual que antes (usa el mismo `BloqueReemplazo` con `mostrarDia`).
4. Verificar persistencia en Neon (novedades JSON, actividad de reemplazo creada, estado de la original intacto) y limpiar los datos de prueba por id.

## Nota

Este plan se integra a la Entrega B ya en curso. Al terminar y verificar, se despliega junto con el resto de la Entrega B (ver plan `2026-07-03-ui-cierre-y-novedad`).

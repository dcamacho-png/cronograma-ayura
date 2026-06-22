# Cumplimiento por actividad (no por días) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el cumplimiento cuente cada actividad como **una sola** (sin importar cuántos días tenga), con seguimiento día a día, y que la página de registro lo muestre como una tarjeta por actividad.

**Architecture:** El cálculo está centralizado en `porcentajeCumplimiento` (dominio). Se introduce un agrupamiento por `tareaId` (helper `agruparPorActividad`) que convierte las filas-día en actividades antes de promediar; cada actividad pesa 1. El cambio se propaga solo a tablero/resumen/ranking/tendencia porque todos consumen esa función. En la UI, `/cumplimiento` agrupa las filas en tarjetas reutilizando el mismo helper.

**Tech Stack:** Next.js (App Router, React Server Components), TypeScript, Prisma/Postgres, Vitest. Las pruebas de dominio son unitarias (Vitest); la UI se verifica con typecheck/lint + revisión manual (no hay infraestructura de pruebas de componentes).

## Global Constraints

- **NO cambiar el modelo de datos:** cada día sigue siendo una fila `Actividad` en Prisma. No hay migraciones.
- **NO cambiar la exportación a Excel:** se mantiene una fila por día (`cumplimiento-export.ts` y `exportar/route.ts` intactos).
- **Pesos por día sin cambios:** Cumplida=1, Parcial=0.5, No cumplida / Pendiente / Reprogramada=0 (`pesoEstado`).
- **Agrupamiento de una actividad:** filas con el mismo `tareaId` = una actividad; filas con `tareaId = null` = una actividad por fila (clave `solo:${id}`).
- **% de una actividad:** `Σ peso(día) ÷ nº de días` (proporcional; denominador = todos los días).
- **Seguir patrones del repo:** comentarios en español, color de marca `#11603a`, server actions con `revalidatePath('/cumplimiento')`.

---

### Task 1: Agrupar el cumplimiento por actividad (`tareaId`)

Cambio núcleo en el dominio. Es donde vive la corrección; al arreglar `porcentajeCumplimiento` se propaga a ranking, área, tendencia, tablero y resumen sin tocarlos.

**Files:**
- Modify: `src/dominio/tipos.ts` (agregar campo `tareaId`)
- Modify: `src/dominio/metricas.ts` (nuevo `agruparPorActividad`; refactor de `porcentajeCumplimiento`)
- Test: `src/dominio/metricas.test.ts` (helper + casos nuevos)

**Interfaces:**
- Produces:
  - `interface Actividad { …; tareaId: string | null }` — nuevo campo requerido.
  - `agruparPorActividad<T extends { id: string; tareaId?: string | null }>(items: T[]): Map<string, T[]>` — genérico, exportado, reutilizable sobre filas de Prisma en la Task 2.
  - `porcentajeCumplimiento(actividades: Actividad[]): number | null` — misma firma, ahora cuenta por actividad.

- [ ] **Step 1: Agregar `tareaId` al tipo de dominio**

En `src/dominio/tipos.ts`, dentro de `interface Actividad`, agregar el campo después de `origenId`:

```ts
  vecesReprogramada: number   // 0 si nunca se ha arrastrado
  origenId: string | null     // id de la actividad de la que proviene (reprogramación)
  tareaId: string | null      // tarea de origen; null si es una actividad suelta
```

- [ ] **Step 2: Actualizar el helper de pruebas para incluir `tareaId`**

En `src/dominio/metricas.test.ts`, la función `act` debe fijar `tareaId: null` por defecto (si no, no compila por el campo requerido):

```ts
function act(parcial: Partial<Actividad>): Actividad {
  return {
    id: 'x', anio: 2026, semana: 25, dia: 1,
    areaId: 'a', fincaId: 'f', responsableId: 'r',
    descripcion: '', turno: '', estado: 'PENDIENTE',
    motivoId: null, nota: null, vecesReprogramada: 0, origenId: null,
    tareaId: null,
    ...parcial,
  }
}
```

- [ ] **Step 3: Escribir las pruebas nuevas (que fallan)**

Añadir este bloque al final de `describe('porcentajeCumplimiento', …)` (o como nuevo `describe`) en `src/dominio/metricas.test.ts`. Usan `id` distintos y `tareaId` compartido para forzar el agrupamiento real:

```ts
describe('porcentajeCumplimiento por actividad', () => {
  it('cuenta cada actividad como una, no por días (agrupa por tareaId)', () => {
    const acts: Actividad[] = [
      ...[1, 2, 3, 4, 5].map((dia) =>
        act({ id: `x${dia}`, tareaId: 'T1', dia, estado: 'CUMPLIDA' })),
      act({ id: 'y1', tareaId: 'T2', dia: 1, estado: 'NO_CUMPLIDA' }),
    ]
    // Por actividad: (100% + 0%) / 2 = 50  (por día sería 5/6 = 83)
    expect(porcentajeCumplimiento(acts)).toBe(50)
  })

  it('una actividad multi-día parcial da su fracción proporcional', () => {
    const acts: Actividad[] = [1, 2, 3, 4, 5].map((dia) =>
      act({ id: `x${dia}`, tareaId: 'T1', dia, estado: dia <= 3 ? 'CUMPLIDA' : 'NO_CUMPLIDA' }))
    // 3 de 5 días = 60%; una sola actividad => 60
    expect(porcentajeCumplimiento(acts)).toBe(60)
  })

  it('una novedad por día (NO_CUMPLIDA) baja el % de su actividad', () => {
    const acts: Actividad[] = [
      act({ id: 'a1', tareaId: 'T1', dia: 1, estado: 'CUMPLIDA' }),
      act({ id: 'a2', tareaId: 'T1', dia: 2, estado: 'CUMPLIDA' }),
      act({ id: 'a3', tareaId: 'T1', dia: 3, estado: 'NO_CUMPLIDA' }),
    ]
    // 2/3 = 0.667 -> 67
    expect(porcentajeCumplimiento(acts)).toBe(67)
  })

  it('actividades sueltas (sin tareaId) cuentan una cada una', () => {
    const acts: Actividad[] = [
      act({ id: 's1', tareaId: null, estado: 'CUMPLIDA' }),
      act({ id: 's2', tareaId: null, estado: 'NO_CUMPLIDA' }),
    ]
    // (100 + 0) / 2 = 50
    expect(porcentajeCumplimiento(acts)).toBe(50)
  })

  it('mezcla: 1 actividad multi-día + 1 suelta', () => {
    const acts: Actividad[] = [
      ...[1, 2, 3, 4, 5].map((dia) =>
        act({ id: `m${dia}`, tareaId: 'T1', dia, estado: 'CUMPLIDA' })),
      act({ id: 's1', tareaId: null, estado: 'NO_CUMPLIDA' }),
    ]
    // (100 + 0) / 2 = 50  (por día sería 5/6 = 83)
    expect(porcentajeCumplimiento(acts)).toBe(50)
  })
})

describe('agruparPorActividad', () => {
  it('une las filas con el mismo tareaId y separa las sueltas', () => {
    const acts: Actividad[] = [
      act({ id: 'a1', tareaId: 'T1', dia: 1 }),
      act({ id: 'a2', tareaId: 'T1', dia: 2 }),
      act({ id: 's1', tareaId: null }),
      act({ id: 's2', tareaId: null }),
    ]
    const grupos = agruparPorActividad(acts)
    expect(grupos.size).toBe(3)               // T1 (2 días) + 2 sueltas
    expect(grupos.get('T1')?.length).toBe(2)
    expect(grupos.get('solo:s1')?.length).toBe(1)
  })
})
```

Asegúrate de que `agruparPorActividad` esté importado al inicio del archivo:

```ts
import { pesoEstado, porcentajeCumplimiento, agruparPorActividad } from './metricas'
```

- [ ] **Step 4: Correr las pruebas para verlas fallar**

Run: `npm test -- src/dominio/metricas.test.ts`
Expected: FALLA — `agruparPorActividad` no existe (import roto) y/o los nuevos casos no pasan.

- [ ] **Step 5: Implementar `agruparPorActividad` y refactorizar `porcentajeCumplimiento`**

En `src/dominio/metricas.ts`, agregar el helper exportado (cerca de la función `agrupar` existente) y reescribir `porcentajeCumplimiento`:

```ts
// Agrupa filas-día en actividades: misma tareaId = una actividad;
// sin tareaId, cada fila es su propia actividad (clave `solo:${id}`).
// Genérico para reutilizarse también sobre filas de Prisma en la UI.
export function agruparPorActividad<T extends { id: string; tareaId?: string | null }>(
  items: T[],
): Map<string, T[]> {
  const grupos = new Map<string, T[]>()
  for (const a of items) {
    const k = a.tareaId ?? `solo:${a.id}`
    const lista = grupos.get(k) ?? []
    lista.push(a)
    grupos.set(k, lista)
  }
  return grupos
}

// Fracción de cumplimiento (0..1) de UNA actividad: promedio del peso de sus
// días. Pendiente/Reprogramada cuentan 0; el denominador son todos los días.
function fraccionActividad(dias: { estado: Estado }[]): number {
  const suma = dias.reduce((acc, a) => acc + (pesoEstado(a.estado) ?? 0), 0)
  return suma / dias.length
}

// % de cumplimiento contando cada actividad como UNA (no por días).
// Agrupa por tareaId, calcula la fracción de cada actividad y las promedia.
// Devuelve null solo si no hay actividades.
export function porcentajeCumplimiento(actividades: Actividad[]): number | null {
  if (actividades.length === 0) return null
  const grupos = agruparPorActividad(actividades)
  let suma = 0
  for (const dias of grupos.values()) suma += fraccionActividad(dias)
  return Math.round((suma / grupos.size) * 100)
}
```

> Nota: la antigua versión de `porcentajeCumplimiento` (suma de pesos / longitud) se reemplaza por completo. `pesoEstado` no cambia.

- [ ] **Step 6: Correr todas las pruebas de dominio**

Run: `npm test`
Expected: PASA — los casos nuevos y los existentes (`rankingResponsables`, `cumplimientoPorArea`, `tendenciaSemanal`, etc.) siguen verdes.

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores (el campo `tareaId` requerido ya está cubierto por el helper de pruebas y por los datos de Prisma, que ya lo traen).

- [ ] **Step 8: Commit**

```bash
git add src/dominio/tipos.ts src/dominio/metricas.ts src/dominio/metricas.test.ts
git commit -m "feat(cumplimiento): contar por actividad (agrupar por tareaId), no por días"
```

---

### Task 2: Tarjeta por actividad en la página de cumplimiento

Agrupa visualmente las filas-día en una tarjeta por actividad, con el % en vivo en la cabecera. En esta task el registro por día **sigue funcionando igual** (se reusa `FormRegistrar` dentro de la tarjeta); solo cambia la presentación. Software funcional al terminar.

**Files:**
- Modify: `src/app/cumplimiento/page.tsx` (sección de listado de actividades, ~líneas 174-228)

**Interfaces:**
- Consumes: `agruparPorActividad`, `porcentajeCumplimiento` de `@/dominio/metricas` (Task 1).
- Produces: render agrupado; no expone nuevas funciones.

- [ ] **Step 1: Importar el helper de agrupamiento**

En `src/app/cumplimiento/page.tsx`, ampliar el import de métricas (línea 8):

```ts
import { porcentajeCumplimiento, colorSemaforo, agruparPorActividad } from '@/dominio/metricas'
```

- [ ] **Step 2: Construir los grupos y ordenarlos**

Después de calcular `pendientes` y antes del `return` (cerca de la línea 91), agregar:

```ts
  // Agrupar las filas-día en actividades (misma tarea = una tarjeta).
  // Cada grupo se ordena por día; las tarjetas, por el primer día de la actividad.
  const gruposActividad = [...agruparPorActividad(actividades).values()]
    .map((dias) => [...dias].sort((a, b) => a.dia - b.dia))
    .sort((g1, g2) => g1[0].dia - g2[0].dia)
```

- [ ] **Step 3: Reemplazar el listado plano por tarjetas agrupadas**

Sustituir el bloque `{actividades.length === 0 ? (…) : (<ul>…</ul>)}` (líneas ~174-228) por:

```tsx
      {actividades.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay actividades en esta semana. Prográmalas en la pestaña <b>Programar</b>.
        </p>
      ) : (
        <ul className="space-y-4">
          {gruposActividad.map((dias) => {
            const cab = dias[0]
            const pctAct = porcentajeCumplimiento(dias as unknown as ActividadDominio[])
            const esMultiDia = dias.length > 1
            return (
              <li key={cab.tareaId ?? cab.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="font-medium">{cab.descripcion}</span>
                  <span>·</span>
                  <span>{cab.responsable.nombre}</span>
                  {cab.maquina && <span className="text-gray-600">· 🚜 {cab.maquina.nombre}</span>}
                  {cab.vecesReprogramada > 0 && (
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: COLOR_HEX[colorSemaforo(cab.vecesReprogramada)] }}
                    >
                      reprogramada {cab.vecesReprogramada}×
                    </span>
                  )}
                  <span className="ml-auto rounded bg-gray-100 px-2 py-0.5 text-xs">
                    {esMultiDia ? `${dias.length} días · ` : ''}Cumplido: <b>{pctAct === null ? '—' : `${pctAct}%`}</b>
                  </span>
                </div>
                <InfoLotes lotes={cab.lotes} bultosPorLote={cab.bultosPorLote as Record<string, number> | null} className="mb-2" />

                <ul className="space-y-2">
                  {dias.map((a) => (
                    <li key={a.id} className="rounded border border-gray-100 bg-gray-50/50 p-2">
                      <div className="mb-1 text-xs font-semibold text-gray-600">
                        {DIAS[a.dia] ?? ''} {fechas[a.dia - 1] ? fmtFecha(fechas[a.dia - 1]) : ''}
                      </div>
                      {a.estado === 'PENDIENTE' ? (
                        <FormRegistrar
                          actividadId={a.id}
                          esMaquinaria={esMaquinaria}
                          unidad={unidadDe(unidadPorNombre, a.descripcion)}
                          motivos={motivos}
                          motivoCambioId={motivoCambioId}
                          lotes={lotes}
                          maquinas={maquinas}
                          estipuladas={estipuladas}
                          haProgramada={a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)}
                          lotesActividad={a.lotes}
                          accion={registrarAccion}
                        />
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold">{ESTADOS.find((e) => e.valor === a.estado)?.etiqueta ?? a.estado}</span>
                          {a.motivo && <span className="text-gray-500">· {a.motivo.nombre}</span>}
                          {a.nota && <span className="text-gray-500">· {a.nota}</span>}
                          {a.centroCosto && <span className="text-gray-500">· 🏷️ {a.centroCosto}</span>}
                          {textoLotesHechos(a.lotes, a.lotesHechos as string[] | null) && (
                            <span className="text-gray-500">· ✅ Realizados: {textoLotesHechos(a.lotes, a.lotesHechos as string[] | null)}</span>
                          )}
                          <span className="text-xs text-gray-400">🔒 registrada</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
```

> La cabecera ahora muestra descripción + responsable + % de la actividad; el día (Lun/Mar…) pasa a cada sub-fila. `InfoLotes` se muestra una vez por actividad (los lotes son los mismos en todos sus días).

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

Run: `npm run dev` y abrir `/cumplimiento`. Confirmar:
- Una tarea programada en varios días aparece como **una tarjeta** con sus días adentro y un `Cumplido: X%` en la cabecera.
- Registrar un día (con `FormRegistrar`) actualiza el % de la tarjeta al recargar.
- Las actividades sueltas de un día se ven como una tarjeta de un día.

- [ ] **Step 6: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): una tarjeta por actividad con % en vivo y días adentro"
```

---

### Task 3: Checkbox "cumplido" por día + novedad colapsable (no maquinaria)

Para días **sin medida** (no maquinaria), el registro pasa a ser un **checkbox de un clic** que marca el día como cumplido; la novedad (no cumplida, con motivo) queda detrás de un toggle. En maquinaria se mantiene `FormRegistrar` (para ingresar ha/kg/horas).

**Files:**
- Create: `src/app/cumplimiento/dia-no-maquinaria.tsx` (componente cliente)
- Modify: `src/app/cumplimiento/page.tsx` (usar el nuevo componente cuando `!esMaquinaria`)

**Interfaces:**
- Consumes: `marcarEstadoAccion`, `registrarAccion` de `./acciones`; `FormRegistrar` de `./form-registrar`.
- Produces:
  - Componente `DiaNoMaquinaria` con props:
    ```ts
    {
      actividadId: string
      motivos: { id: string; nombre: string }[]
      motivoCambioId: string | null
      lotes: { id: string; nombre: string; finca: { nombre: string } }[]
      maquinas: { id: string; nombre: string }[]
      estipuladas: { id: string; nombre: string; unidad: string }[]
      lotesActividad: { id: string; nombre: string }[]
      unidad: Unidad
      marcarCumplido: (formData: FormData) => void | Promise<void>
      accionRegistrar: (formData: FormData) => void | Promise<void>
    }
    ```

- [ ] **Step 1: Confirmar que `marcarEstadoAccion` está exportada y disponible**

`src/app/cumplimiento/acciones.ts` ya exporta `marcarEstadoAccion(form)` que aplica `marcarEstado(id, estado, motivoId, nota)` y revalida `/cumplimiento`. No requiere cambios.

- [ ] **Step 2: Crear el componente `DiaNoMaquinaria`**

Crear `src/app/cumplimiento/dia-no-maquinaria.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { Unidad } from '@/dominio/unidad'
import { FormRegistrar } from './form-registrar'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Registro de un día SIN medida (no maquinaria): un clic en "cumplido" marca el
// día como CUMPLIDA; "novedad" revela el formulario completo (no cumplida, motivo).
export function DiaNoMaquinaria({
  actividadId,
  motivos,
  motivoCambioId,
  lotes,
  maquinas,
  estipuladas,
  lotesActividad,
  unidad,
  marcarCumplido,
  accionRegistrar,
}: {
  actividadId: string
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  lotesActividad: { id: string; nombre: string }[]
  unidad: Unidad
  marcarCumplido: (formData: FormData) => void | Promise<void>
  accionRegistrar: (formData: FormData) => void | Promise<void>
}) {
  const [novedad, setNovedad] = useState(false)

  if (novedad) {
    return (
      <div>
        <FormRegistrar
          actividadId={actividadId}
          esMaquinaria={false}
          unidad={unidad}
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          lotes={lotes}
          maquinas={maquinas}
          estipuladas={estipuladas}
          haProgramada={0}
          lotesActividad={lotesActividad}
          accion={accionRegistrar}
        />
        <button
          type="button"
          onClick={() => setNovedad(false)}
          className="mt-1 text-xs text-gray-500 underline"
        >
          cancelar novedad
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <form action={marcarCumplido}>
        <input type="hidden" name="id" value={actividadId} />
        <input type="hidden" name="estado" value="CUMPLIDA" />
        <button className="flex items-center gap-1 rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">
          ✓ Cumplido
        </button>
      </form>
      <button
        type="button"
        onClick={() => setNovedad(true)}
        className="text-xs text-gray-500 underline"
      >
        registrar novedad
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Usar el componente en la página para días no-maquinaria**

En `src/app/cumplimiento/page.tsx`, importar el componente y la acción:

```ts
import { registrarAccion, agregarActividadRealizadaAccion, marcarEstadoAccion } from './acciones'
import { DiaNoMaquinaria } from './dia-no-maquinaria'
```

Dentro de la sub-fila de cada día (Task 2, Step 3), reemplazar la rama `a.estado === 'PENDIENTE' ? (<FormRegistrar … />)` por una bifurcación según el área:

```tsx
                      {a.estado === 'PENDIENTE' ? (
                        esMaquinaria ? (
                          <FormRegistrar
                            actividadId={a.id}
                            esMaquinaria={esMaquinaria}
                            unidad={unidadDe(unidadPorNombre, a.descripcion)}
                            motivos={motivos}
                            motivoCambioId={motivoCambioId}
                            lotes={lotes}
                            maquinas={maquinas}
                            estipuladas={estipuladas}
                            haProgramada={a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)}
                            lotesActividad={a.lotes}
                            accion={registrarAccion}
                          />
                        ) : (
                          <DiaNoMaquinaria
                            actividadId={a.id}
                            motivos={motivos}
                            motivoCambioId={motivoCambioId}
                            lotes={lotes}
                            maquinas={maquinas}
                            estipuladas={estipuladas}
                            lotesActividad={a.lotes}
                            unidad={unidadDe(unidadPorNombre, a.descripcion)}
                            marcarCumplido={marcarEstadoAccion}
                            accionRegistrar={registrarAccion}
                          />
                        )
                      ) : (
```

(El bloque `else` con el estado registrado/`🔒 registrada` queda igual.)

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

Run: `npm run dev`. En un área que **no** sea maquinaria, abrir `/cumplimiento`:
- Cada día pendiente muestra un botón **✓ Cumplido** y un enlace **registrar novedad**.
- Un clic en "✓ Cumplido" marca el día y sube el % de la tarjeta.
- "registrar novedad" abre el formulario con motivo/nota; al guardar como No cumplida, el día baja el % de la tarjeta.
- En un área de **maquinaria**, el día sigue mostrando el formulario con el campo de medida (ha/kg/horas).

- [ ] **Step 6: Commit**

```bash
git add src/app/cumplimiento/dia-no-maquinaria.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): checkbox cumplido por día y novedad colapsable (no maquinaria)"
```

---

### Task 4: Desmarcar un día (revertir a Pendiente) en no-maquinaria

La spec quiere un checkbox reversible. El botón "✓ Cumplido" (Task 3) es de un solo sentido; esta task agrega un control "↩ desmarcar" en el estado registrado para devolver el día a Pendiente. Acotado a **no-maquinaria**: ahí un día solo puede llevar motivo/nota, así que revertir no deja datos huérfanos (en maquinaria habría medida/centro de costo, por eso se deja de un solo sentido).

**Files:**
- Modify: `src/app/cumplimiento/page.tsx` (bloque de estado registrado dentro de la sub-fila del día)

**Interfaces:**
- Consumes: `marcarEstadoAccion` de `./acciones` (ya importada en Task 3). `marcarEstadoAccion` valida `estado` contra `ESTADOS_VALIDOS` (que incluye `PENDIENTE`) y aplica `marcarEstado(id, 'PENDIENTE', null, null)` → limpia motivoId/nota. No requiere acción ni función de repositorio nuevas.
- Produces: nada nuevo; solo un botón de formulario.

- [ ] **Step 1: Agregar el botón "↩ desmarcar" al estado registrado (solo no-maquinaria)**

En `src/app/cumplimiento/page.tsx`, dentro del bloque `else` que muestra el estado registrado (`🔒 registrada`), agregar el botón al final del `<div>`, después del `<span>🔒 registrada</span>`:

```tsx
                          <span className="text-xs text-gray-400">🔒 registrada</span>
                          {!esMaquinaria && (
                            <form action={marcarEstadoAccion} className="ml-auto">
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="estado" value="PENDIENTE" />
                              <button className="text-xs text-gray-500 underline hover:text-gray-700">↩ desmarcar</button>
                            </form>
                          )}
```

> `marcarEstadoAccion` ya está importada (Task 3) y revalida `/cumplimiento`, así que al desmarcar el día vuelve a aparecer con el botón "✓ Cumplido" / "registrar novedad". En maquinaria no se muestra el control (el día conserva su medida).

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`. En un área **no** maquinaria, marcar un día como "✓ Cumplido" y luego "↩ desmarcar": el día vuelve a Pendiente y el % de la tarjeta baja. En maquinaria, el día registrado **no** muestra "↩ desmarcar".

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): desmarcar un día (volver a pendiente) en no-maquinaria"
```

---

## Self-Review

**Spec coverage:**
- Cálculo por actividad / agrupar por `tareaId` → Task 1. ✅
- % proporcional (días cumplidos ÷ totales) → Task 1, `fraccionActividad`. ✅
- Novedad por día baja el % → Task 1 (test) + Task 3 (UI de novedad). ✅
- Cada actividad pesa 1; propagación a tablero/resumen/ranking/tendencia → Task 1 (sin cambios en consumidores). ✅
- Tipo de dominio con `tareaId`; sin cambiar la consulta de Prisma → Task 1. ✅
- UI: una tarjeta por actividad con % en vivo → Task 2. ✅
- UI: checkbox por día sin medida; medida en maquinaria; novedad por día → Task 3. ✅
- Excel sin cambios → Global Constraints (no hay task que lo toque). ✅
- Helper `agruparPorActividad` reutilizable → Task 1 (exportado, genérico), usado en Task 2. ✅

**Placeholder scan:** sin TBD/TODO; todo el código de cada paso está completo.

**Type consistency:** `agruparPorActividad` (genérico) usado igual en Task 1 y Task 2; `porcentajeCumplimiento` mantiene firma; props de `DiaNoMaquinaria` coinciden con las de `FormRegistrar` que consume; `marcarEstadoAccion` existe en `acciones.ts`.

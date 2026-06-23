# Avance por lote en actividades parciales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el Parcial en un seguimiento por lote: al marcarlo, ofrecer "Devolver al banco" o "Registrar avance" (día/máquina/lotes/cantidad por lote); la actividad avanza proporcional a los lotes hechos y pasa a Cumplida cuando están todos.

**Architecture:** Nueva columna `Actividad.avancePorLote` (Json) guarda por lote `{ dia, maquinaId, cantidad }`. El dominio calcula la fracción de cada fila proporcional a los lotes hechos (`fraccionFila`), y helpers puros (`lotesPendientes`, `textoAvancePorLote`) alimentan la UI. El repositorio gana `registrarAvanceLote` (fusiona avances y decide CUMPLIDA/PARCIAL) y `devolverAlBanco` (la devolución que hoy es automática); `registrarCumplimiento` deja de devolver el Parcial al banco. La página de cumplimiento muestra el progreso y los dos botones.

**Tech Stack:** Next.js (App Router, server actions), TypeScript, Prisma/Postgres (migración), Vitest.

## Global Constraints

- **Cambio solo para PARCIAL:** No cumplida y Reprogramada conservan su comportamiento actual (devolución automática al banco). El Parcial ya **no** se devuelve solo.
- **100% por lotes:** la actividad pasa a CUMPLIDA solo cuando **todos** sus lotes están en `avancePorLote`; mientras falten, queda PARCIAL.
- **Parcial proporcional:** la fila parcial aporta `lotes hechos ÷ lotes totales` (0.5 solo si la fila no tiene lotes). CUMPLIDA=1; No cumplida/Pendiente/Reprogramada=0.
- **`avancePorLote`:** `Record<loteId, { dia: number; maquinaId: string | null; cantidad: number }>`; un lote presente = realizado.
- **No tocar** Excel, agrupación por actividad, multi-responsable, maquinaria por avance, `agruparPorActividad`, ni la firma de `porcentajeCumplimiento`.
- Comentarios en español; color de marca `#11603a`; server actions revalidan `/cumplimiento`.

---

### Task 1: Migración + schema + tipo de dominio

Agrega la columna `avancePorLote` y los campos opcionales en el tipo de dominio.

**Files:**
- Create: `prisma/migrations/20260622180000_avance_por_lote/migration.sql`
- Modify: `prisma/schema.prisma`
- Modify: `src/dominio/tipos.ts`

**Interfaces:**
- Produces: columna `Actividad.avancePorLote Json?`; tipo de dominio `Actividad` con
  `lotes?: { id: string }[]` y `avancePorLote?: Record<string, { dia: number; maquinaId: string | null; cantidad: number }> | null`.

- [ ] **Step 1: Crear la migración**

Crear `prisma/migrations/20260622180000_avance_por_lote/migration.sql`:

```sql
-- Avance por lote en actividades parciales: mapa JSON { loteId: { dia, maquinaId, cantidad } }
ALTER TABLE "Actividad" ADD COLUMN "avancePorLote" JSONB;
```

- [ ] **Step 2: Agregar la columna al schema**

En `prisma/schema.prisma`, en el modelo `Actividad`, junto a `lotesHechos  Json?` (línea ~100):

```prisma
  lotesHechos  Json?
  avancePorLote Json?
```

- [ ] **Step 3: Regenerar el cliente Prisma**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" sin errores. (No corras `migrate`; no hay base local — la migración se aplica en el deploy con `prisma migrate deploy`.)

- [ ] **Step 4: Agregar los campos al tipo de dominio**

En `src/dominio/tipos.ts`, dentro de `interface Actividad`, después de `tareaId`:

```ts
  tareaId: string | null      // tarea de origen; null si es una actividad suelta

  // Lotes y avance por lote (para el cálculo proporcional del parcial).
  lotes?: { id: string }[]
  avancePorLote?: Record<string, { dia: number; maquinaId: string | null; cantidad: number }> | null
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/` (ignora errores en archivos autogenerados de `.next/`).

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations/20260622180000_avance_por_lote/migration.sql prisma/schema.prisma src/dominio/tipos.ts
git commit -m "feat(datos): columna avancePorLote + tipo de dominio (lotes/avancePorLote)"
```

---

### Task 2: Dominio — fracción proporcional + helpers de lote

Cálculo proporcional del parcial y helpers puros para la UI.

**Files:**
- Modify: `src/dominio/metricas.ts` (`fraccionFila`; `fraccionActividad` lo usa)
- Create: `src/dominio/avance-lote.ts`
- Test: `src/dominio/metricas.test.ts`, `src/dominio/avance-lote.test.ts`

**Interfaces:**
- Consumes: tipo `Actividad` (Task 1).
- Produces:
  - `fraccionFila(a: { estado: Estado; lotes?: { id: string }[]; avancePorLote?: Record<string, unknown> | null }): number`
  - `type AvancePorLote = Record<string, { dia: number; maquinaId: string | null; cantidad: number }>`
  - `lotesPendientes<T extends { id: string }>(lotes: T[], avance: AvancePorLote | null | undefined): T[]`
  - `textoAvancePorLote(lotes: { id: string; nombre: string }[], avance: AvancePorLote | null | undefined): string`

- [ ] **Step 1: Escribir las pruebas de `avance-lote.ts` (que fallan)**

Crear `src/dominio/avance-lote.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { lotesPendientes, textoAvancePorLote, type AvancePorLote } from './avance-lote'

const lotes = [{ id: 'a', nombre: 'L-A' }, { id: 'b', nombre: 'L-B' }, { id: 'c', nombre: 'L-C' }]
const avance: AvancePorLote = { a: { dia: 1, maquinaId: null, cantidad: 3 }, b: { dia: 2, maquinaId: 'm1', cantidad: 2 } }

describe('lotesPendientes', () => {
  it('devuelve los lotes sin avance', () => {
    expect(lotesPendientes(lotes, avance).map((l) => l.id)).toEqual(['c'])
  })
  it('sin avance devuelve todos', () => {
    expect(lotesPendientes(lotes, null).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('textoAvancePorLote', () => {
  it('lista los lotes con avance y su cantidad, en orden', () => {
    expect(textoAvancePorLote(lotes, avance)).toBe('L-A: 3, L-B: 2')
  })
  it('vacío si no hay avance', () => {
    expect(textoAvancePorLote(lotes, null)).toBe('')
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- src/dominio/avance-lote.test.ts`
Expected: FALLA — el módulo `./avance-lote` no existe.

- [ ] **Step 3: Implementar `avance-lote.ts`**

Crear `src/dominio/avance-lote.ts`:

```ts
export type AvancePorLote = Record<string, { dia: number; maquinaId: string | null; cantidad: number }>

// Lotes de la actividad que aún no tienen avance registrado.
export function lotesPendientes<T extends { id: string }>(
  lotes: T[],
  avance: AvancePorLote | null | undefined,
): T[] {
  if (!avance) return lotes
  return lotes.filter((l) => !(l.id in avance))
}

// Texto "L-A: 3, L-B: 2" con los lotes que tienen avance, en el orden dado.
export function textoAvancePorLote(
  lotes: { id: string; nombre: string }[],
  avance: AvancePorLote | null | undefined,
): string {
  if (!avance) return ''
  return lotes
    .filter((l) => l.id in avance)
    .map((l) => `${l.nombre}: ${avance[l.id].cantidad}`)
    .join(', ')
}
```

- [ ] **Step 4: Escribir las pruebas de `fraccionFila` (que fallan)**

En `src/dominio/metricas.test.ts`, ampliar el import de métricas para incluir `fraccionFila`:

```ts
import { pesoEstado, porcentajeCumplimiento, agruparPorActividad, diasDistintos, responsablesDistintos, fraccionFila } from './metricas'
```

Y agregar:

```ts
describe('fraccionFila (parcial proporcional por lotes)', () => {
  it('CUMPLIDA = 1', () => {
    expect(fraccionFila({ estado: 'CUMPLIDA' })).toBe(1)
  })
  it('PARCIAL con 1 de 3 lotes = 1/3', () => {
    expect(fraccionFila({ estado: 'PARCIAL', lotes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], avancePorLote: { a: {} } })).toBeCloseTo(1 / 3)
  })
  it('PARCIAL sin lotes = 0.5', () => {
    expect(fraccionFila({ estado: 'PARCIAL' })).toBe(0.5)
  })
  it('NO_CUMPLIDA / PENDIENTE / REPROGRAMADA = 0', () => {
    expect(fraccionFila({ estado: 'NO_CUMPLIDA' })).toBe(0)
    expect(fraccionFila({ estado: 'PENDIENTE' })).toBe(0)
    expect(fraccionFila({ estado: 'REPROGRAMADA' })).toBe(0)
  })
})

describe('porcentajeCumplimiento con parcial proporcional', () => {
  it('una actividad parcial con 2 de 4 lotes aporta 0.5', () => {
    const acts = [act({ id: 'p', tareaId: 'T', estado: 'PARCIAL', lotes: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }], avancePorLote: { '1': { dia: 1, maquinaId: null, cantidad: 1 }, '2': { dia: 1, maquinaId: null, cantidad: 1 } } })]
    expect(porcentajeCumplimiento(acts)).toBe(50)
  })
  it('parcial (1/3) + cumplida → 67', () => {
    const acts = [
      act({ id: 'p', tareaId: 'T1', estado: 'PARCIAL', lotes: [{ id: '1' }, { id: '2' }, { id: '3' }], avancePorLote: { '1': { dia: 1, maquinaId: null, cantidad: 1 } } }),
      act({ id: 'c', tareaId: 'T2', estado: 'CUMPLIDA' }),
    ]
    // (1/3 + 1) / 2 = 0.667 → 67
    expect(porcentajeCumplimiento(acts)).toBe(67)
  })
})
```

- [ ] **Step 5: Correr y ver fallar**

Run: `npm test -- src/dominio/metricas.test.ts`
Expected: FALLA — `fraccionFila` no existe (import roto).

- [ ] **Step 6: Implementar `fraccionFila` y usarla en `fraccionActividad`**

En `src/dominio/metricas.ts`, reemplazar la función interna `fraccionActividad` por:

```ts
// Fracción (0..1) de UNA fila-actividad. CUMPLIDA=1; PARCIAL=lotes realizados/total
// (0.5 si la fila no tiene lotes); el resto (No cumplida/Pendiente/Reprogramada)=0.
export function fraccionFila(a: {
  estado: Estado
  lotes?: { id: string }[]
  avancePorLote?: Record<string, unknown> | null
}): number {
  if (a.estado === 'CUMPLIDA') return 1
  if (a.estado === 'PARCIAL') {
    const total = a.lotes?.length ?? 0
    if (total === 0) return 0.5
    const hechos = a.lotes!.filter((l) => !!a.avancePorLote && l.id in a.avancePorLote).length
    return hechos / total
  }
  return 0
}

// Fracción de cumplimiento (0..1) de UNA actividad: promedio de fraccionFila por día/fila.
function fraccionActividad(dias: Actividad[]): number {
  const suma = dias.reduce((acc, a) => acc + fraccionFila(a), 0)
  return suma / dias.length
}
```

> `pesoEstado` se mantiene exportado e intacto (otros usos), pero `fraccionActividad` ya no lo usa.

- [ ] **Step 7: Correr toda la suite**

Run: `npm test`
Expected: PASA — casos nuevos verdes y los existentes también (el PARCIAL sin lotes sigue valiendo 0.5).

- [ ] **Step 8: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/`.

- [ ] **Step 9: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts src/dominio/avance-lote.ts src/dominio/avance-lote.test.ts
git commit -m "feat(dominio): parcial proporcional por lotes (fraccionFila) + helpers de avance"
```

---

### Task 3: Repositorio + acciones

El Parcial deja de devolverse solo; nuevas funciones de avance y de devolución manual; el tablero incluye lotes.

**Files:**
- Modify: `src/datos/repositorio.ts` (`registrarCumplimiento`, `reabrirActividad`, `listarActividadesDeSemanas`; nuevas `registrarAvanceLote`, `devolverAlBanco`)
- Modify: `src/app/cumplimiento/acciones.ts` (nuevas `registrarAvanceLoteAccion`, `devolverAlBancoAccion`)

**Interfaces:**
- Consumes: `Prisma` (ya importado en `repositorio.ts`).
- Produces:
  - `registrarAvanceLote(actividadId: string, dia: number, maquinaId: string | null, avances: { loteId: string; cantidad: number }[])`
  - `devolverAlBanco(actividadId: string)`
  - acciones `registrarAvanceLoteAccion(form)`, `devolverAlBancoAccion(form)`

- [ ] **Step 1: Que el Parcial NO se devuelva solo al banco**

En `src/datos/repositorio.ts`, dentro de `registrarCumplimiento`, la condición del bloque de devolución automática (hoy `if (estado !== 'CUMPLIDA' && act.tareaId)`) debe excluir PARCIAL:

```ts
  // Novedad que vuelve al banco automáticamente: solo No cumplida / Reprogramada
  // (el Parcial se maneja con los botones de la UI). Solo tareas de un día.
  if ((estado === 'NO_CUMPLIDA' || estado === 'REPROGRAMADA') && act.tareaId) {
    const enLaSemana = await prisma.actividad.count({
      where: { tareaId: act.tareaId, anio: act.anio, semana: act.semana },
    })
    if (enLaSemana === 1) {
      await prisma.tarea.update({
        where: { id: act.tareaId },
        data: { estado: 'PENDIENTE', anioSel: null, semanaSel: null, vecesReprogramada: act.vecesReprogramada + 1 },
      })
    }
  }
```

- [ ] **Step 2: `reabrirActividad` también limpia `avancePorLote`**

En `reabrirActividad`, agregar el campo al `data` (junto a los demás que limpia):

```ts
      lotesHechos: Prisma.DbNull,
      avancePorLote: Prisma.DbNull,
```

- [ ] **Step 3: `registrarAvanceLote` y `devolverAlBanco`**

Agregar en `src/datos/repositorio.ts` (cerca de `registrarCumplimiento`):

```ts
// Registra el avance de uno o varios lotes en una actividad parcial: fusiona en
// avancePorLote { loteId: { dia, maquinaId, cantidad } }. Si quedan TODOS los lotes
// de la actividad registrados, pasa a CUMPLIDA; si no, queda PARCIAL.
export async function registrarAvanceLote(
  actividadId: string,
  dia: number,
  maquinaId: string | null,
  avances: { loteId: string; cantidad: number }[],
) {
  const act = await prisma.actividad.findUnique({ where: { id: actividadId }, include: { lotes: true } })
  if (!act) return null
  const actual =
    (act.avancePorLote as Record<string, { dia: number; maquinaId: string | null; cantidad: number }> | null) ?? {}
  for (const a of avances) {
    actual[a.loteId] = { dia, maquinaId, cantidad: a.cantidad }
  }
  const completa = act.lotes.length > 0 && act.lotes.every((l) => l.id in actual)
  return prisma.actividad.update({
    where: { id: actividadId },
    data: {
      avancePorLote: actual as Prisma.InputJsonValue,
      estado: completa ? 'CUMPLIDA' : 'PARCIAL',
    },
  })
}

// Devuelve al banco la tarea de origen de una actividad (conserva la actividad
// registrada): tarea PENDIENTE, sin semana, +1 reprogramada. Misma lógica que la
// devolución que antes era automática para las novedades de un día.
export async function devolverAlBanco(actividadId: string) {
  const act = await prisma.actividad.findUnique({ where: { id: actividadId } })
  if (!act || !act.tareaId) return null
  return prisma.tarea.update({
    where: { id: act.tareaId },
    data: { estado: 'PENDIENTE', anioSel: null, semanaSel: null, vecesReprogramada: act.vecesReprogramada + 1 },
  })
}
```

- [ ] **Step 4: El tablero incluye lotes (para el parcial proporcional)**

En `listarActividadesDeSemanas`, agregar `lotes` al `include`:

```ts
    include: { area: true, motivo: true, lotes: { select: { id: true } } },
```

- [ ] **Step 5: Acciones de servidor**

En `src/app/cumplimiento/acciones.ts`, ampliar el import de repositorio:

```ts
import { marcarEstado, reprogramarActividad, registrarCumplimiento, crearActividadRealizada, reabrirActividad, registrarAvanceLote, devolverAlBanco } from '@/datos/repositorio'
```

Y agregar las acciones:

```ts
export async function registrarAvanceLoteAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  if (!id || !(dia >= 1 && dia <= 7)) return
  const maquinaId = textoOpcional(form, 'maquinaId')
  const loteIds = form.getAll('loteAvance').map((v) => String(v))
  const avances = loteIds.map((loteId) => ({ loteId, cantidad: numeroOpcional(form, `cantidad_${loteId}`) ?? 0 }))
  if (avances.length === 0) return
  await registrarAvanceLote(id, dia, maquinaId, avances)
  revalidatePath('/cumplimiento')
}

export async function devolverAlBancoAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  await devolverAlBanco(id)
  revalidatePath('/cumplimiento')
}
```

- [ ] **Step 6: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores en `src/`.

- [ ] **Step 7: Commit**

```bash
git add src/datos/repositorio.ts src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): registrarAvanceLote + devolverAlBanco; parcial ya no vuelve solo"
```

---

### Task 4: UI — progreso por lote y dos opciones en el parcial

En el estado registrado de una actividad PARCIAL: mostrar el progreso por lotes y los botones "Devolver al banco" y "Registrar avance" (formulario por lote).

**Files:**
- Create: `src/app/cumplimiento/form-avance-lote.tsx`
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `lotesPendientes`, `textoAvancePorLote`, `AvancePorLote` (`@/dominio/avance-lote`); `registrarAvanceLoteAccion`, `devolverAlBancoAccion` (`./acciones`); `etiquetaMedida`/`Unidad` (`@/dominio/unidad`).
- Produces: componente `FormAvanceLote`.

- [ ] **Step 1: Crear el componente `FormAvanceLote`**

Crear `src/app/cumplimiento/form-avance-lote.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { etiquetaMedida, type Unidad } from '@/dominio/unidad'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Formulario para registrar el avance de uno o varios lotes pendientes de una
// actividad parcial: día, máquina (maquinaria) y, por lote, casilla + cantidad.
export function FormAvanceLote({
  actividadId,
  diaActividad,
  esMaquinaria,
  maquinas,
  unidad,
  pendientes,
  accion,
}: {
  actividadId: string
  diaActividad: number
  esMaquinaria: boolean
  maquinas: { id: string; nombre: string }[]
  unidad: Unidad
  pendientes: { id: string; nombre: string }[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded border border-[#11603a] px-2 py-1 text-xs font-semibold text-[#11603a] hover:bg-green-50"
      >
        Registrar avance
      </button>
    )
  }

  return (
    <form action={accion} className="flex w-full flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs">
      <input type="hidden" name="id" value={actividadId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col">
          Día
          <select name="dia" defaultValue={diaActividad} className="rounded border p-1">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>{DIAS[d]}</option>
            ))}
          </select>
        </label>
        {esMaquinaria && (
          <label className="flex flex-col">
            Máquina
            <select name="maquinaId" className="rounded border p-1">
              <option value="">— sin máquina —</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-gray-700">Lotes realizados — {etiquetaMedida(unidad)}</span>
        {pendientes.map((l) => (
          <div key={l.id} className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              <input type="checkbox" name="loteAvance" value={l.id} className="accent-[#11603a]" />
              {l.nombre}
            </label>
            <input name={`cantidad_${l.id}`} type="number" step="any" min="0" placeholder="cantidad" className="w-24 rounded border p-1" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="rounded bg-[#11603a] px-3 py-1 font-semibold text-white">Guardar avance</button>
        <button type="button" onClick={() => setAbierto(false)} className="text-gray-500 underline">cancelar</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Imports en `page.tsx`**

En `src/app/cumplimiento/page.tsx`, agregar:

```ts
import { lotesPendientes, textoAvancePorLote, type AvancePorLote } from '@/dominio/avance-lote'
import { FormAvanceLote } from './form-avance-lote'
```

Y ampliar el import de acciones para incluir las nuevas:

```ts
import { registrarAccion, agregarActividadRealizadaAccion, marcarEstadoAccion, desmarcarAccion, registrarAvanceLoteAccion, devolverAlBancoAccion } from './acciones'
```

- [ ] **Step 3: Sección de avance en el estado registrado del PARCIAL**

En `src/app/cumplimiento/page.tsx`, dentro del bloque `else` del estado registrado (el `<div className="flex flex-wrap items-center gap-2 text-sm">` que muestra estado + medida + motivo + … + `↩ desmarcar`), agregar **después** de ese `<div>` (es decir, dentro del mismo `<li>` del día, tras el bloque de estado) el avance solo para PARCIAL con lotes:

```tsx
                                {a.estado === 'PARCIAL' && a.lotes.length > 0 && (
                                  <div className="mt-1 flex w-full flex-col gap-1 text-sm">
                                    <span className="text-gray-600">
                                      Progreso: {a.lotes.length - lotesPendientes(a.lotes, a.avancePorLote as AvancePorLote | null).length} de {a.lotes.length} lotes
                                      {textoAvancePorLote(a.lotes, a.avancePorLote as AvancePorLote | null) ? ` · ${textoAvancePorLote(a.lotes, a.avancePorLote as AvancePorLote | null)}` : ''}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {lotesPendientes(a.lotes, a.avancePorLote as AvancePorLote | null).length > 0 && (
                                        <FormAvanceLote
                                          actividadId={a.id}
                                          diaActividad={a.dia}
                                          esMaquinaria={esMaquinaria}
                                          maquinas={maquinas}
                                          unidad={unidad}
                                          pendientes={lotesPendientes(a.lotes, a.avancePorLote as AvancePorLote | null)}
                                          accion={registrarAvanceLoteAccion}
                                        />
                                      )}
                                      <form action={devolverAlBancoAccion}>
                                        <input type="hidden" name="id" value={a.id} />
                                        <button className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Devolver al banco</button>
                                      </form>
                                    </div>
                                  </div>
                                )}
```

> Notas: `unidad` es la variable de grupo ya calculada en la tarjeta (`unidadDe(unidadPorNombre, cab.descripcion)`). `a.lotes` viene del query (`listarActividades` incluye `lotes`). El "↩ desmarcar" existente sigue disponible para revertir el día (ya limpia `avancePorLote` por la Task 3). Para PARCIAL sin lotes no se muestra esta sección (no aplica el avance por lote).

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores en `src/`.

- [ ] **Step 5: Verificación manual**

Run: `npm run dev` (requiere `DATABASE_URL`). En `/cumplimiento`:
- Marca una actividad (con lotes) como **Parcial** → aparece "Progreso: 0 de N lotes", el botón **Registrar avance** y **Devolver al banco** (ya no se va sola al banco).
- "Registrar avance": elige día, máquina (si maquinaria), marca lotes con cantidad, guarda → el progreso sube y los lotes registrados se listan; la actividad sigue Parcial.
- Completa todos los lotes → pasa a **Cumplida**.
- "Devolver al banco" → la tarea reaparece en el banco (Programar) con su contador +1.

- [ ] **Step 6: Commit**

```bash
git add src/app/cumplimiento/form-avance-lote.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): progreso por lote y dos opciones (avance / devolver al banco) en el parcial"
```

---

## Self-Review

**Spec coverage:**
- Dos opciones al marcar Parcial (devolver / registrar avance) → Task 3 (no auto-return) + Task 4 (botones). ✅
- Formulario de avance (día, máquina, lotes pendientes, cantidad por lote) → Task 4 (`FormAvanceLote`) + Task 3 (acción). ✅
- 100% por lotes (CUMPLIDA cuando todos) → Task 3 (`registrarAvanceLote`). ✅
- Parcial proporcional → Task 2 (`fraccionFila`). ✅
- Almacenamiento `avancePorLote` + migración → Task 1. ✅
- Consistencia del tablero (incluir lotes) → Task 3 Step 4. ✅
- Devolver al banco reproduce la devolución actual → Task 3 (`devolverAlBanco`). ✅
- Desmarcar limpia el avance → Task 3 Step 2. ✅
- No tocar Excel/agrupación/multi-responsable/maquinaria → ninguna task los toca. ✅

**Placeholder scan:** sin TBD/TODO; código completo en cada paso.

**Type consistency:** `AvancePorLote` se define en `avance-lote.ts` (Task 2) y se importa en `page.tsx` (Task 4); el tipo de dominio usa la misma forma estructural. `fraccionFila` firma estable entre Task 2 y su uso interno. `registrarAvanceLote(actividadId, dia, maquinaId, avances)` y `devolverAlBanco(actividadId)` coinciden entre Task 3 (repo), sus acciones, y el consumo en Task 4. Los nombres de campos del form (`id`, `dia`, `maquinaId`, `loteAvance`, `cantidad_<loteId>`) coinciden entre `FormAvanceLote` (Task 4) y `registrarAvanceLoteAccion` (Task 3).

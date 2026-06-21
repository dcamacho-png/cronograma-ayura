# Bultos por lote (fertilización/encalada) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar bultos por lote al crear tareas de FERTILIZACION GRANULADA / ENCALADORA / FERTILIZACION POLLINAZA, propagarlos a las actividades al asignar, y mostrarlos en Cumplimiento, en la grilla/PDF de Programar y en el Excel.

**Architecture:** `bultosPorLote Json?` (mapa `{loteId: number}`) en `Tarea` (se guarda al crear) y `Actividad` (se copia al asignar). Un picker dedicado en el formulario de tarea de maquinaria captura los bultos por lote; `InfoLotes` (compartido por grilla, PDF y Cumplimiento) y el Excel los muestran. Helpers puros `usaBultos`/`textoBultosPorLote` con tests.

**Tech Stack:** Next.js 16 (App Router), Prisma 6 (Postgres/Neon, JSONB), React 19, Tailwind v4, Vitest, exceljs.

## Global Constraints

- Actividades con bultos (exactas, del catálogo): **`FERTILIZACION GRANULADA`, `ENCALADORA`, `FERTILIZACION POLLINAZA`**.
- Bultos: **decimales**, **opcionales** por lote. Captura **al crear la tarea** (no al asignar).
- Dato en `bultosPorLote Json?` (mapa `{loteId: number}`) en **`Tarea`** y **`Actividad`**; migración **aditiva** (columnas JSONB nullable).
- Prisma: un campo `Json?` NO acepta `null` de JS directo — para "sin dato" se **omite el campo** en el `create` (queda NULL); para copiar un valor existente se castea a `Prisma.InputJsonValue`.
- `asignarTarea` **copia** `tarea.bultosPorLote` a cada actividad creada (mismo mapa en todos los días).
- Visible en: Cumplimiento, grilla/PDF de Programar (vía `InfoLotes`), Excel (columna "Bultos por lote", 10ª). **No** en Resumen.
- `InfoLotes` retrocompatible: sin la prop de bultos, render idéntico al actual.
- Migración nueva: `prisma/migrations/20260620170000_bultos_por_lote/migration.sql`.
- NO tocar Resumen, login, cambio de actividad, ni `form-solicitar.tsx`. Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` (y `npm test` donde aplique). NO ejecutar app/seed/build local (base en Neon).
- AGENTS.md: este NO es el Next.js estándar — el picker y el form son componentes cliente `'use client'`; seguir los patrones existentes (FormNuevaTareaMaquinaria, SelectFincaLote).
- Spec: `docs/superpowers/specs/2026-06-20-bultos-por-lote-design.md`.

## File Structure

- `src/dominio/bultos.ts` — NUEVO: `ACTIVIDADES_CON_BULTOS`, `usaBultos`, `textoBultosPorLote`, tipo `BultosPorLote`.
- `src/dominio/bultos.test.ts` — NUEVO.
- `prisma/schema.prisma` — `bultosPorLote Json?` en `Tarea` y `Actividad`.
- `prisma/migrations/20260620170000_bultos_por_lote/migration.sql` — NUEVO.
- `src/datos/repositorio.ts` — `crearTarea` (param `bultosPorLote`); `asignarTarea` (copia a la actividad).
- `src/app/tareas/picker-lotes-bultos.tsx` — NUEVO (cliente): finca → lotes con checkbox + input de bultos.
- `src/app/tareas/form-nueva-tarea-maquinaria.tsx` — usa el picker cuando `usaBultos(estipulada)`.
- `src/app/tareas/acciones.ts` — `crearTareaAccion` lee `bultos_<loteId>`.
- `src/app/_componentes/info-lotes.tsx` — prop `bultosPorLote` + `id` en lotes.
- `src/app/programar/grilla-semana.tsx` — `id` en lotes + pasar `bultosPorLote`.
- `src/app/cumplimiento/page.tsx` — pasar `bultosPorLote` a `InfoLotes`.
- `src/dominio/cumplimiento-export.ts` + `.test.ts` — columna "Bultos por lote".
- `src/app/cumplimiento/exportar/route.ts` — pasar lotes con `id` + `bultosPorLote` al helper.

---

## Task 1: Helper de dominio `bultos` (TDD)

**Files:**
- Create: `src/dominio/bultos.ts`
- Create: `src/dominio/bultos.test.ts`

**Interfaces:**
- Produces:
  - `ACTIVIDADES_CON_BULTOS: string[]` = `['FERTILIZACION GRANULADA', 'ENCALADORA', 'FERTILIZACION POLLINAZA']`.
  - `type BultosPorLote = Record<string, number>`.
  - `usaBultos(descripcion: string): boolean` — true si la descripción (trim + mayúsculas) está en el set.
  - `textoBultosPorLote(lotes: { id: string; nombre: string }[], bultos: BultosPorLote | null | undefined): string` — `"L1: 3, L2: 2.5"` (solo lotes con bulto numérico), `''` si no hay.

- [ ] **Step 1: Escribir el test (RED)**

Crear `src/dominio/bultos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { usaBultos, textoBultosPorLote, type BultosPorLote } from './bultos'

describe('usaBultos', () => {
  it('acepta las 3 actividades (con espacios/minúsculas) y rechaza otras', () => {
    expect(usaBultos('FERTILIZACION GRANULADA')).toBe(true)
    expect(usaBultos('ENCALADORA')).toBe(true)
    expect(usaBultos('FERTILIZACION POLLINAZA')).toBe(true)
    expect(usaBultos('  fertilizacion granulada  ')).toBe(true)
    expect(usaBultos('SIEMBRA PASTOS')).toBe(false)
    expect(usaBultos('')).toBe(false)
    expect(usaBultos('Riego')).toBe(false)
  })
})

describe('textoBultosPorLote', () => {
  const lotes = [{ id: 'a', nombre: 'L1' }, { id: 'b', nombre: 'L2' }, { id: 'c', nombre: 'L3' }]
  it('lista solo los lotes con bulto, en el orden de lotes', () => {
    const b: BultosPorLote = { a: 3, b: 2.5 }
    expect(textoBultosPorLote(lotes, b)).toBe('L1: 3, L2: 2.5')
  })
  it('ignora lotes sin bulto', () => {
    expect(textoBultosPorLote(lotes, { b: 4 })).toBe('L2: 4')
  })
  it('devuelve cadena vacía sin mapa', () => {
    expect(textoBultosPorLote(lotes, null)).toBe('')
    expect(textoBultosPorLote(lotes, undefined)).toBe('')
    expect(textoBultosPorLote(lotes, {})).toBe('')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/dominio/bultos.test.ts`
Expected: FAIL — "Cannot find module './bultos'".

- [ ] **Step 3: Implementar (GREEN)**

Crear `src/dominio/bultos.ts`:

```ts
export const ACTIVIDADES_CON_BULTOS = ['FERTILIZACION GRANULADA', 'ENCALADORA', 'FERTILIZACION POLLINAZA']

export type BultosPorLote = Record<string, number>

// ¿La actividad (por su descripción del catálogo) captura bultos por lote?
export function usaBultos(descripcion: string): boolean {
  return ACTIVIDADES_CON_BULTOS.includes(descripcion.trim().toUpperCase())
}

// Texto "L1: 3, L2: 2.5" con los lotes que tienen un bulto numérico, en el orden dado.
export function textoBultosPorLote(
  lotes: { id: string; nombre: string }[],
  bultos: BultosPorLote | null | undefined,
): string {
  if (!bultos) return ''
  return lotes
    .filter((l) => typeof bultos[l.id] === 'number')
    .map((l) => `${l.nombre}: ${bultos[l.id]}`)
    .join(', ')
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/dominio/bultos.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite + gate**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: suite verde (82 → 89, +7 casos), sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/dominio/bultos.ts src/dominio/bultos.test.ts
git commit -m "feat(dominio): helpers usaBultos y textoBultosPorLote"
```

---

## Task 2: Esquema + migración + repositorio

**Files:**
- Modify: `prisma/schema.prisma` (modelos `Tarea` y `Actividad`)
- Create: `prisma/migrations/20260620170000_bultos_por_lote/migration.sql`
- Modify: `src/datos/repositorio.ts` (`crearTarea` ~200-209; `asignarTarea` create ~291)

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `Tarea.bultosPorLote` y `Actividad.bultosPorLote` (Json nullable).
  - `crearTarea(areaId: string, descripcion: string, loteIds: string[], bultosPorLote?: Record<string, number> | null)` — default null; omite el campo si null.
  - `asignarTarea(...)` copia `tarea.bultosPorLote` a cada actividad creada (sin cambio de firma).

- [ ] **Step 1: Campos en el esquema**

En `prisma/schema.prisma`, agregar al modelo `Tarea` (junto a sus otros campos escalares):

```prisma
  bultosPorLote Json?
```

Y al modelo `Actividad` (junto a `haRealizada`, `noProgramada`):

```prisma
  bultosPorLote Json?
```

- [ ] **Step 2: Migración**

Crear `prisma/migrations/20260620170000_bultos_por_lote/migration.sql`:

```sql
-- Bultos por lote (mapa JSON { loteId: cantidad }) en tareas y actividades
ALTER TABLE "Tarea" ADD COLUMN "bultosPorLote" JSONB;
ALTER TABLE "Actividad" ADD COLUMN "bultosPorLote" JSONB;
```

- [ ] **Step 3: Regenerar el cliente**

Run: `npx prisma generate`
Expected: "Generated Prisma Client ...".

- [ ] **Step 4: `crearTarea` guarda los bultos**

En `src/datos/repositorio.ts`, reemplazar `crearTarea` (líneas ~200-209):

```ts
export async function crearTarea(
  areaId: string,
  descripcion: string,
  loteIds: string[],
  bultosPorLote: Record<string, number> | null = null,
) {
  let fincaId: string | null = null
  if (loteIds.length > 0) {
    const primer = await prisma.lote.findUnique({ where: { id: loteIds[0] } })
    fincaId = primer?.fincaId ?? null
  }
  return prisma.tarea.create({
    data: {
      areaId,
      descripcion,
      fincaId,
      lotes: { connect: loteIds.map((id) => ({ id })) },
      ...(bultosPorLote ? { bultosPorLote } : {}),
    },
  })
}
```

(Se omite `bultosPorLote` cuando es null para no chocar con el tipado `Json?` de Prisma.)

- [ ] **Step 5: `asignarTarea` copia los bultos a la actividad**

En `src/datos/repositorio.ts`, asegurar el import de `Prisma`:

```ts
import { Prisma } from '@prisma/client'
```

(Si ya existe `import { PrismaClient } from '@prisma/client'`, añadir `Prisma` a esa misma línea.)

En el `tx.actividad.create({ data: { ... } })` de `asignarTarea` (donde está `lotes: { connect: loteIds.map((id) => ({ id })) },`, ~línea 291), agregar como última propiedad del `data`:

```ts
          lotes: { connect: loteIds.map((id) => ({ id })) },
          ...(tarea.bultosPorLote != null ? { bultosPorLote: tarea.bultosPorLote as Prisma.InputJsonValue } : {}),
```

- [ ] **Step 6: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (Las llamadas existentes a `crearTarea(areaId, descripcion, loteIds)` siguen válidas por el default.)

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260620170000_bultos_por_lote/migration.sql src/datos/repositorio.ts
git commit -m "feat(datos): bultosPorLote en Tarea y Actividad; crearTarea lo guarda y asignarTarea lo copia"
```

---

## Task 3: Captura — picker + formulario + acción

**Files:**
- Create: `src/app/tareas/picker-lotes-bultos.tsx`
- Modify: `src/app/tareas/form-nueva-tarea-maquinaria.tsx`
- Modify: `src/app/tareas/acciones.ts` (`crearTareaAccion` ~22-29; agregar `numeroOpcional`)

**Interfaces:**
- Consumes: `usaBultos` (Task 1); `crearTarea(..., bultosPorLote)` (Task 2).
- Produces: el form, para las 3 actividades, envía `loteId` (múltiple) y `bultos_<loteId>`; `crearTareaAccion` arma el mapa y lo pasa a `crearTarea`.

- [ ] **Step 1: Componente `PickerLotesBultos`**

Crear `src/app/tareas/picker-lotes-bultos.tsx`:

```tsx
'use client'

import { useState } from 'react'

type Lote = { id: string; nombre: string; finca: { nombre: string } }

// Selector de varios lotes con cantidad de bultos por lote. Envía un <input name="loteId">
// por lote marcado y, si tiene cantidad, <input name="bultos_<id>">. La selección persiste
// aunque se cambie de finca (estado por id de lote).
export function PickerLotesBultos({ lotes }: { lotes: Lote[] }) {
  const [finca, setFinca] = useState('')
  const [sel, setSel] = useState<Record<string, string>>({}) // loteId -> bultos (texto); presencia = marcado

  const fincas = [...new Set(lotes.map((l) => l.finca.nombre))].sort()
  const filtrados = finca ? lotes.filter((l) => l.finca.nombre === finca) : []
  const seleccionados = lotes.filter((l) => l.id in sel)

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = { ...prev }
      if (id in next) delete next[id]
      else next[id] = ''
      return next
    })
  const setBultos = (id: string, v: string) => setSel((prev) => ({ ...prev, [id]: v }))

  return (
    <div className="flex flex-col gap-1">
      <select value={finca} onChange={(e) => setFinca(e.target.value)} className="rounded border p-2 text-sm">
        <option value="">— elegir finca —</option>
        {fincas.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      {finca && (
        <div className="flex max-h-48 flex-col gap-1 overflow-auto rounded border p-2">
          {filtrados.map((l) => {
            const checked = l.id in sel
            return (
              <div key={l.id} className="flex items-center gap-2 text-sm">
                <label className="flex flex-1 items-center gap-1">
                  <input type="checkbox" checked={checked} onChange={() => toggle(l.id)} className="accent-[#11603a]" />
                  {l.nombre}
                </label>
                {checked && (
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="bultos"
                    value={sel[l.id]}
                    onChange={(e) => setBultos(l.id, e.target.value)}
                    className="w-24 rounded border p-1 text-sm"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
      {seleccionados.map((l) => (
        <span key={l.id}>
          <input type="hidden" name="loteId" value={l.id} />
          {sel[l.id] !== '' && <input type="hidden" name={`bultos_${l.id}`} value={sel[l.id]} />}
        </span>
      ))}
      {seleccionados.length > 0 && (
        <div className="text-xs text-gray-500">Lotes: {seleccionados.map((l) => l.nombre).join(', ')}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Usar el picker en el formulario**

En `src/app/tareas/form-nueva-tarea-maquinaria.tsx`:

1. Imports (después de la línea de `SelectFincaLote`):

```tsx
import { PickerLotesBultos } from './picker-lotes-bultos'
import { usaBultos } from '@/dominio/bultos'
```

2. Reemplazar `const esFertilizacion = estipulada.toUpperCase().includes('FERTILIZA')` por:

```tsx
  const conBultos = usaBultos(estipulada)
```

3. Reemplazar el `<label>` de "Finca y lote(s)" (el bloque con `SelectFincaLote ... multiple={esFertilizacion}`) por:

```tsx
      <label className="flex flex-col text-sm">
        {conBultos ? 'Lotes y bultos por lote' : 'Finca y lote'}
        {conBultos ? (
          <PickerLotesBultos lotes={lotes} />
        ) : (
          <SelectFincaLote lotes={lotes} name="loteId" />
        )}
      </label>
```

- [ ] **Step 3: La acción arma el mapa de bultos**

En `src/app/tareas/acciones.ts`, agregar el helper `numeroOpcional` (junto a `texto`/`textoOpcional`):

```ts
function numeroOpcional(form: FormData, clave: string): number | null {
  const v = texto(form, clave)
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
```

Y reemplazar `crearTareaAccion` (líneas ~22-29):

```ts
export async function crearTareaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const descripcion =
    textoOpcional(form, 'otra') ?? textoOpcional(form, 'estipulada') ?? texto(form, 'descripcion')
  if (!areaId || !descripcion) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  for (const id of loteIds) {
    const b = numeroOpcional(form, `bultos_${id}`)
    if (b != null) bultos[id] = b
  }
  await crearTarea(areaId, descripcion, loteIds, Object.keys(bultos).length > 0 ? bultos : null)
  revalidatePath('/tareas')
}
```

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/tareas/picker-lotes-bultos.tsx src/app/tareas/form-nueva-tarea-maquinaria.tsx src/app/tareas/acciones.ts
git commit -m "feat(tareas): capturar bultos por lote al crear tareas de fertilización/encalada"
```

---

## Task 4: Visualización en `InfoLotes` (grilla, PDF, Cumplimiento)

**Files:**
- Modify: `src/app/_componentes/info-lotes.tsx`
- Modify: `src/app/programar/grilla-semana.tsx` (tipo de lotes + pasar prop)
- Modify: `src/app/cumplimiento/page.tsx` (pasar prop a `InfoLotes`)

**Interfaces:**
- Consumes: `type BultosPorLote` (Task 1); `Actividad.bultosPorLote` (Task 2).
- Produces: `InfoLotes` acepta `bultosPorLote?: BultosPorLote | null` y `lotes` con `id`.

- [ ] **Step 1: `InfoLotes` muestra bultos por lote**

Reemplazar `src/app/_componentes/info-lotes.tsx`:

```tsx
import type { BultosPorLote } from '@/dominio/bultos'

type LoteInfo = { id: string; nombre: string; hectareas: number | null }

export function InfoLotes({
  lotes,
  bultosPorLote,
  className = '',
}: {
  lotes: LoteInfo[]
  bultosPorLote?: BultosPorLote | null
  className?: string
}) {
  if (lotes.length === 0) return null
  const ha = lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)
  const etiqueta = (l: LoteInfo) => {
    const b = bultosPorLote?.[l.id]
    return typeof b === 'number' ? `${l.nombre} (${b} bultos)` : l.nombre
  }
  const nombres = lotes.map(etiqueta).join(', ')
  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      📍 {nombres}
      {ha > 0 ? <> · <b>{ha.toFixed(1)} ha</b></> : null}
    </div>
  )
}
```

(Sin `bultosPorLote`, el render es idéntico al actual: nombres separados por `, ` + total ha.)

- [ ] **Step 2: Grilla — agregar `id` a lotes y pasar bultos**

En `src/app/programar/grilla-semana.tsx`:

1. En el tipo de actividad (líneas ~6-15), cambiar la línea de `lotes` y agregar `bultosPorLote`:

```tsx
  lotes: { id: string; nombre: string; hectareas: number | null }[]
  bultosPorLote?: Record<string, number> | null
```

2. En el uso de `InfoLotes` (línea ~69), pasar la prop:

```tsx
                            <InfoLotes lotes={a.lotes} bultosPorLote={a.bultosPorLote} className="mt-1" />
```

(Los objetos de actividad que las páginas pasan a `GrillaSemana` ya incluyen `lotes` con `id` y la columna `bultosPorLote`.)

- [ ] **Step 3: Cumplimiento — pasar bultos a `InfoLotes`**

En `src/app/cumplimiento/page.tsx`, en el uso de `InfoLotes` (`<InfoLotes lotes={a.lotes} className="mb-2" />`), agregar la prop:

```tsx
              <InfoLotes lotes={a.lotes} bultosPorLote={a.bultosPorLote as Record<string, number> | null} className="mb-2" />
```

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (Si `tsc` se queja del tipo de `a.bultosPorLote` en la grilla, castear igual que en cumplimiento: `a.bultosPorLote as Record<string, number> | null`.)

- [ ] **Step 5: Commit**

```bash
git add src/app/_componentes/info-lotes.tsx src/app/programar/grilla-semana.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(ui): mostrar bultos por lote en grilla, PDF y cumplimiento (InfoLotes)"
```

---

## Task 5: Columna "Bultos por lote" en el Excel

**Files:**
- Modify: `src/dominio/cumplimiento-export.ts`
- Modify: `src/dominio/cumplimiento-export.test.ts`
- Modify: `src/app/cumplimiento/exportar/route.ts`

**Interfaces:**
- Consumes: `textoBultosPorLote`, `type BultosPorLote` (Task 1); `Actividad.bultosPorLote` (Task 2).
- Produces: `COLUMNAS_CUMPLIMIENTO` con 10ª columna "Bultos por lote"; `ActividadExport` con `lotes: {id,nombre}[]` y `bultosPorLote`.

- [ ] **Step 1: Actualizar el test del helper (RED)**

En `src/dominio/cumplimiento-export.test.ts`:

1. Actualizar el `act(...)` para que los lotes tengan `id` y agregar `bultosPorLote`. Reemplazar el helper `act` y la aserción de columnas, y añadir un caso. Cambiar la función `act`:

```ts
function act(p: Partial<ActividadExport>): ActividadExport {
  return {
    dia: 1,
    descripcion: 'ENCALADORA',
    estado: 'CUMPLIDA',
    haRealizada: 3,
    responsable: { nombre: 'Ana' },
    maquina: { nombre: '6603' },
    lotes: [{ id: 'l1', nombre: 'L1' }],
    bultosPorLote: null,
    ...p,
  }
}
```

2. Reemplazar la aserción de `COLUMNAS_CUMPLIMIENTO` para incluir la 10ª columna:

```ts
    expect([...COLUMNAS_CUMPLIMIENTO]).toEqual([
      'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote',
    ])
  })
})
```

3. En cada `expect(filaCumplimiento(...)).toEqual([...])` existente, agregar `''` como último elemento (no hay bultos en esos casos). Por ejemplo, el caso de ha con medida pasa a:

```ts
    expect(filaCumplimiento(act({}), '15 jun', mapa)).toEqual(
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 3, 'ha', ''],
    )
```

Hacer lo mismo (agregar `''` al final) en los casos de hora, kg, sin medida y fuera-de-catálogo.

4. Añadir un caso nuevo con bultos:

```ts
  it('incluye los bultos por lote cuando existen', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }, { id: 'l2', nombre: 'L2' }],
      bultosPorLote: { l1: 3, l2: 2.5 },
    })
    expect(filaCumplimiento(a, '15 jun', mapa)[9]).toBe('L1: 3, L2: 2.5')
  })
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: FAIL (columna faltante / longitud 9 vs 10 / `bultosPorLote` no existe en el tipo).

- [ ] **Step 3: Implementar (GREEN)**

En `src/dominio/cumplimiento-export.ts`:

1. Importar el helper (al inicio, junto al import de `./unidad`):

```ts
import { textoBultosPorLote, type BultosPorLote } from './bultos'
```

2. Agregar la columna a `COLUMNAS_CUMPLIMIENTO` (último elemento):

```ts
export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote',
] as const
```

3. Actualizar el tipo `ActividadExport`: `lotes` con `id` y nuevo `bultosPorLote`:

```ts
export type ActividadExport = {
  dia: number
  descripcion: string
  estado: string
  haRealizada: number | null
  responsable: { nombre: string }
  maquina: { nombre: string } | null
  lotes: { id: string; nombre: string }[]
  bultosPorLote: BultosPorLote | null
}
```

4. Agregar el valor de la columna al final del array que devuelve `filaCumplimiento` (después de la unidad):

```ts
    a.haRealizada == null ? '' : unidadAbreviada(unidad),
    textoBultosPorLote(a.lotes, a.bultosPorLote),
  ]
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: PASS.

- [ ] **Step 5: El route pasa lotes con id + bultos**

En `src/app/cumplimiento/exportar/route.ts`, el `for` que arma las filas ya pasa `a` a `filaCumplimiento`. Como `ActividadExport.lotes` ahora requiere `id` (los datos ya lo traen) y `bultosPorLote`, no hace falta cambiar la llamada si se pasa `a` completo. Verificar que la actividad pasada incluye `bultosPorLote`; si TypeScript se queja del tipo Json, castear al construir la fila. Reemplazar la línea de la fila por:

```ts
    ws.addRow(filaCumplimiento({ ...a, bultosPorLote: a.bultosPorLote as BultosPorLote | null }, fecha, unidadPorNombre))
```

Y agregar el import en el route:

```ts
import { COLUMNAS_CUMPLIMIENTO, filaCumplimiento, type ActividadExport } from '@/dominio/cumplimiento-export'
import type { BultosPorLote } from '@/dominio/bultos'
```

(Si `filaCumplimiento(a, ...)` ya compila sin el spread porque `a` satisface estructuralmente `ActividadExport`, basta con eso; el spread es el seguro si el tipo Json no calza.)

- [ ] **Step 6: Gate completo**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; suite verde.

- [ ] **Step 7: Commit**

```bash
git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts src/app/cumplimiento/exportar/route.ts
git commit -m "feat(cumplimiento): columna 'Bultos por lote' en el Excel"
```

---

## Fase de despliegue (después del plan)

1. `git push` (respaldo).
2. **Deploy manual por CLI:** `npx vercel --prod --yes --scope ayura-llanos`. El build corre `prisma migrate deploy && next build` → aplica `20260620170000_bultos_por_lote` (aditiva, sin pérdida de datos).
3. Verificación manual: crear tarea de FERTILIZACION GRANULADA con 2 lotes y bultos distintos; asignarla; ver los bultos en grilla, PDF, Cumplimiento y Excel.

---

## Self-Review (autor del plan)

**1. Cobertura de la spec:**
- Helper `usaBultos`/`textoBultosPorLote` + tests → Task 1. ✓
- `bultosPorLote Json?` en Tarea y Actividad + migración aditiva → Task 2. ✓
- Captura al crear la tarea (picker dedicado, 3 actividades, decimal/opcional, ENCALADORA con varios lotes) → Task 3. ✓
- Propagación al asignar (copia a la actividad) → Task 2 Step 5. ✓
- Visualización en grilla/PDF/Cumplimiento vía InfoLotes → Task 4. ✓
- Columna "Bultos por lote" en Excel → Task 5. ✓
- No Resumen / no solicitudes / no cambio de actividad → no tocados. ✓
- Prisma Json null (omitir campo) → Task 2 Steps 4-5 + constraints. ✓

**2. Placeholders:** sin "TBD"/"etc."; todo el código está completo. ✓

**3. Consistencia de tipos:**
- `BultosPorLote = Record<string, number>` definido en Task 1 y usado en Tasks 4 y 5. ✓
- `usaBultos` (Task 1) usado en Task 3; `textoBultosPorLote` (Task 1) usado en Task 5. ✓
- `crearTarea(..., bultosPorLote?)` definido en Task 2, consumido en Task 3. ✓
- `InfoLotes` prop `bultosPorLote` + lotes con `id` definido en Task 4 Step 1 y usado en Steps 2-3. ✓
- `COLUMNAS_CUMPLIMIENTO` (10 columnas) y `ActividadExport` (lotes con id + bultosPorLote) consistentes entre Task 5 def, test y route. ✓
- `Actividad.bultosPorLote` (Json) casteado a `Record<string,number>|null` / `BultosPorLote|null` en los consumidores (Tasks 4, 5). ✓

# Programación estándar con catálogo + lotes + medida por lote — Implementation Plan

> ✅ **COMPLETADO y desplegado a producción (2026-07-03, commit 9d99fdb, deploy cronograma-ayura-7x1r15a7v).** Verificado por la usuaria. Revisión final de rama: MERGE (0 Critical/Important; 185 tests, typecheck limpio). Incluye follow-up: desplegables de maquinaria (reemplazo / actividad realizada / editar solicitud) filtrados a solo-maquinaria.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la programación de un área estándar capture tareas con desplegable de actividades (catálogo separado), uno o varios lotes con su medida por lote, y una unidad — como ya hace maquinaria.

**Architecture:** Migración añade categoría al catálogo (`ActividadEstipulada.maquinaria`) y campos de medida/unidad a `Tarea`, e inserta las 16 actividades estándar. El repositorio guarda medida/unidad y hereda la unidad a la actividad al asignar. La UI: se generaliza el picker de lotes, se agrega un formulario estándar espejo del de maquinaria, y los desplegables filtran por categoría; Configuración deja elegir categoría.

**Tech Stack:** Next.js 16 (App Router, Server Actions, client components), Prisma + Neon Postgres, Vitest, Tailwind v4.

## Global Constraints

- Catálogo **separado**: `ActividadEstipulada.maquinaria Boolean @default(true)` (registros actuales quedan `true`). Las 16 estándar se insertan con `maquinaria=false`.
- Medida **por lote** (map loteId→valor) + **unidad** una por tarea, de la lista ampliada `Ha, Hora, Kg, Cantidad, Bultos, Jornales, Otro`(→texto).
- Los **mapas de unidad** (Excel/resumen) siguen leyendo todo el catálogo; solo los **desplegables** filtran por categoría.
- Maquinaria no se toca (su formulario/bultos/cumplimiento) salvo que su desplegable ahora recibe solo las de maquinaria.
- Typecheck fiable: `npx tsc --noEmit -p tsconfig.check.json` (NO `npx tsc --noEmit` a secas). Tests: `npx vitest run`. Tras cambiar el schema: `npx prisma generate`.
- Convenciones: `'use client'`/`'use server'`, español en UI y comentarios, paleta Tailwind (`bosque`, `arena`, `borde`, `marfil`, `tierra`, `tinta`).
- Lista estándar (16, verbatim): Apoyo fertilizacion; Fumigacion malezas; Fumigacion espartillo; Decepada de espartillo; Limpieza de cerca; Arreglo de cerca; Acarreo sal y concentrados; Acarreo sal; Orden y aseo; Arreglo fuga de agua; Mantenimiento bebederos; Limpieza bebederos; Limpieza arborizacion; Fumigacion arborizacion; Guadaña; Mantenimiento jardin.

---

### Task 1: Schema + migración + seed (categoría de catálogo + campos de Tarea + 16 estándar)

**Files:**
- Modify: `prisma/schema.prisma` (`ActividadEstipulada` línea 142-146; `Tarea` línea 113-140)
- Create: `prisma/migrations/20260702130000_estipulada_categoria_y_tarea_medida/migration.sql`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Produces: `ActividadEstipulada` gana `maquinaria: boolean`; `Tarea` gana `medidaPorLote: Json?` y `unidad: String?`. Estos campos quedan disponibles en el cliente Prisma para las tareas siguientes.

- [x] **Step 1: Editar el schema**

En `prisma/schema.prisma`, `model ActividadEstipulada` queda:

```prisma
model ActividadEstipulada {
  id     String @id @default(cuid())
  nombre String @unique
  unidad String @default("ha")
  maquinaria Boolean @default(true)
}
```

En `model Tarea`, tras la línea `bultosPorLote Json?` (línea 131) añadir dos campos:

```prisma
  bultosPorLote Json?
  medidaPorLote Json?
  unidad        String?
  detalle String?
```

- [x] **Step 2: Crear la migración SQL**

Crear `prisma/migrations/20260702130000_estipulada_categoria_y_tarea_medida/migration.sql` con:

```sql
-- Categoría estándar/maquinaria en el catálogo (registros actuales = maquinaria).
ALTER TABLE "ActividadEstipulada" ADD COLUMN "maquinaria" BOOLEAN NOT NULL DEFAULT true;

-- Medida planeada por lote (JSON loteId→valor) + unidad, en la tarea.
ALTER TABLE "Tarea" ADD COLUMN "medidaPorLote" JSONB;
ALTER TABLE "Tarea" ADD COLUMN "unidad" TEXT;

-- Actividades estándar (catálogo separado). ON CONFLICT: idempotente por nombre.
INSERT INTO "ActividadEstipulada" ("id", "nombre", "unidad", "maquinaria") VALUES
  (gen_random_uuid()::text, 'Apoyo fertilizacion', 'jornales', false),
  (gen_random_uuid()::text, 'Fumigacion malezas', 'jornales', false),
  (gen_random_uuid()::text, 'Fumigacion espartillo', 'jornales', false),
  (gen_random_uuid()::text, 'Decepada de espartillo', 'jornales', false),
  (gen_random_uuid()::text, 'Limpieza de cerca', 'jornales', false),
  (gen_random_uuid()::text, 'Arreglo de cerca', 'jornales', false),
  (gen_random_uuid()::text, 'Acarreo sal y concentrados', 'jornales', false),
  (gen_random_uuid()::text, 'Acarreo sal', 'jornales', false),
  (gen_random_uuid()::text, 'Orden y aseo', 'jornales', false),
  (gen_random_uuid()::text, 'Arreglo fuga de agua', 'jornales', false),
  (gen_random_uuid()::text, 'Mantenimiento bebederos', 'jornales', false),
  (gen_random_uuid()::text, 'Limpieza bebederos', 'jornales', false),
  (gen_random_uuid()::text, 'Limpieza arborizacion', 'jornales', false),
  (gen_random_uuid()::text, 'Fumigacion arborizacion', 'jornales', false),
  (gen_random_uuid()::text, 'Guadaña', 'jornales', false),
  (gen_random_uuid()::text, 'Mantenimiento jardin', 'jornales', false)
ON CONFLICT ("nombre") DO NOTHING;
```

- [x] **Step 3: Actualizar el seed (paridad dev)**

En `prisma/seed.ts`:

(a) En el loop de `ACTIVIDADES_ESTIPULADAS` (líneas 139-145), marcar las existentes como maquinaria:

```ts
  for (const a of ACTIVIDADES_ESTIPULADAS) {
    await prisma.actividadEstipulada.upsert({
      where: { nombre: a.nombre },
      update: { unidad: a.unidad, maquinaria: true },
      create: { nombre: a.nombre, unidad: a.unidad, maquinaria: true },
    })
  }
```

(b) Justo **después** de ese loop, añadir el catálogo estándar:

```ts
  const ACTIVIDADES_ESTANDAR: string[] = [
    'Apoyo fertilizacion', 'Fumigacion malezas', 'Fumigacion espartillo', 'Decepada de espartillo',
    'Limpieza de cerca', 'Arreglo de cerca', 'Acarreo sal y concentrados', 'Acarreo sal',
    'Orden y aseo', 'Arreglo fuga de agua', 'Mantenimiento bebederos', 'Limpieza bebederos',
    'Limpieza arborizacion', 'Fumigacion arborizacion', 'Guadaña', 'Mantenimiento jardin',
  ]
  for (const nombre of ACTIVIDADES_ESTANDAR) {
    await prisma.actividadEstipulada.upsert({
      where: { nombre },
      update: { maquinaria: false },
      create: { nombre, unidad: 'jornales', maquinaria: false },
    })
  }
```

- [x] **Step 4: Validar schema y regenerar el cliente**

Run: `npx prisma validate && npx prisma generate`
Expected: "The schema at prisma/schema.prisma is valid" y "Generated Prisma Client". (La migración SQL se aplica en el deploy con `prisma migrate deploy`; no requiere DB local ahora.)

- [x] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: 0 errores en `src/` (el cliente regenerado expone los campos nuevos; nada los usa aún).

- [x] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260702130000_estipulada_categoria_y_tarea_medida/migration.sql prisma/seed.ts
git commit -m "feat(catalogo): categoria estandar/maquinaria + medida/unidad en Tarea + seed 16 estandar"
```

---

### Task 2: Repositorio — categoría al crear, medida/unidad en crearTarea, herencia de unidad al asignar

**Files:**
- Modify: `src/datos/repositorio.ts` (`crearActividadEstipulada` :375; `crearTarea` :248-270; `asignarTarea` :344-360)

**Interfaces:**
- Consumes: campos nuevos del schema (Task 1).
- Produces:
  - `crearActividadEstipulada(nombre: string, unidad = 'ha', maquinaria = true)`.
  - `crearTarea(areaId, descripcion, loteIds, bultosPorLote = null, detalle = null, medidaPorLote: Record<string, number> | null = null, unidad: string | null = null)`.
  - `asignarTarea` copia `tarea.unidad` → `unidadRealizada` de cada Actividad creada.

Solo agrega parámetros opcionales / un campo en el create; los llamadores existentes siguen compilando.

- [x] **Step 1: `crearActividadEstipulada` con categoría**

En `src/datos/repositorio.ts`, reemplazar `crearActividadEstipulada` (línea 375-377) por:

```ts
export function crearActividadEstipulada(nombre: string, unidad: string = 'ha', maquinaria: boolean = true) {
  return prisma.actividadEstipulada.create({ data: { nombre, unidad, maquinaria } })
}
```

- [x] **Step 2: `crearTarea` con medidaPorLote + unidad**

Reemplazar `crearTarea` (línea 248-270) por:

```ts
export async function crearTarea(
  areaId: string,
  descripcion: string,
  loteIds: string[],
  bultosPorLote: Record<string, number> | null = null,
  detalle: string | null = null,
  medidaPorLote: Record<string, number> | null = null,
  unidad: string | null = null,
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
      detalle,
      lotes: { connect: loteIds.map((id) => ({ id })) },
      ...(bultosPorLote ? { bultosPorLote } : {}),
      ...(medidaPorLote ? { medidaPorLote } : {}),
      ...(unidad ? { unidad } : {}),
    },
  })
}
```

- [x] **Step 3: `asignarTarea` hereda la unidad**

En `src/datos/repositorio.ts`, en el `tx.actividad.create({ data: { ... } })` dentro de `asignarTarea` (línea 344-360), añadir la unidad heredada junto a `bultosPorLote`. La sección `data` queda:

```ts
          data: {
            anio,
            semana,
            dia,
            descripcion: tarea.descripcion,
            turno: esMaquinaria ? (turno.trim() || turnoPorDia(dia)) : '',
            vecesReprogramada: tarea.vecesReprogramada,
            areaId: tarea.areaId,
            fincaId,
            responsableId: rid,
            maquinaId: maquinaPorDia[dia] ?? null,
            tareaId: tarea.id,
            lotes: { connect: loteIds.map((id) => ({ id })) },
            ...(tarea.bultosPorLote != null ? { bultosPorLote: tarea.bultosPorLote as Prisma.InputJsonValue } : {}),
            ...(tarea.unidad ? { unidadRealizada: tarea.unidad } : {}),
          },
```

- [x] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: 0 errores en `src/`.

- [x] **Step 5: Tests (sin regresión)**

Run: `npx vitest run`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(repo): categoria al crear estipulada; medida/unidad en crearTarea; asignarTarea hereda unidad"
```

---

### Task 3: Picker generalizado + formulario estándar + acción + página de tareas

**Files:**
- Modify: `src/app/tareas/picker-lotes-bultos.tsx` (props `campo`/`placeholder`)
- Create: `src/app/tareas/form-nueva-tarea-estandar.tsx`
- Modify: `src/app/tareas/acciones.ts` (`crearTareaAccion` :31-47)
- Modify: `src/app/tareas/page.tsx` (import + filtros + render estándar + `FormSolicitar`/`FormNuevaTareaMaquinaria` + banco)
- Modify: `src/app/_componentes/info-lotes.tsx` (mostrar medida por lote)

**Interfaces:**
- Consumes: `crearTarea(..., medidaPorLote, unidad)` (Task 2); `ActividadEstipulada.maquinaria` (Task 1); `Tarea.medidaPorLote`/`unidad` (Task 1).
- Produces: `FormNuevaTareaEstandar({ areaId, estipuladas, lotes, accion })`; el picker emite `medida_<id>` cuando `campo="medida"`; `crearTareaAccion` lee `medida_<id>` y `unidad`/`unidadOtra`.

- [x] **Step 1: Generalizar `PickerLotesBultos`**

En `src/app/tareas/picker-lotes-bultos.tsx`, añadir props `campo`/`placeholder` y usarlas en el input visible y en el hidden. La firma y los dos usos cambian así:

Firma (línea 10):

```tsx
export function PickerLotesBultos({ lotes, seleccionInicial = {}, campo = 'bultos', placeholder = 'bultos' }: { lotes: Lote[]; seleccionInicial?: Record<string, string>; campo?: string; placeholder?: string }) {
```

Input numérico visible (línea 46-54): cambiar `placeholder="bultos"` por `placeholder={placeholder}`.

Hidden por lote (línea 64): cambiar

```tsx
          {sel[l.id] !== '' && <input type="hidden" name={`bultos_${l.id}`} value={sel[l.id]} />}
```

por

```tsx
          {sel[l.id] !== '' && <input type="hidden" name={`${campo}_${l.id}`} value={sel[l.id]} />}
```

- [x] **Step 2: Crear `FormNuevaTareaEstandar`**

Crear `src/app/tareas/form-nueva-tarea-estandar.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { PickerLotesBultos } from './picker-lotes-bultos'

const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro" (texto libre)
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string }

// Alta de tarea estándar (espejo del de maquinaria): actividad del catálogo estándar +
// "Otra…", unidad de la lista ampliada, y uno o varios lotes con su valor de medida.
export function FormNuevaTareaEstandar({
  areaId,
  estipuladas,
  lotes,
  accion,
}: {
  areaId: string
  estipuladas: Estipulada[]
  lotes: Lote[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [estipulada, setEstipulada] = useState('')
  const [unidadSel, setUnidadSel] = useState('Jornales')

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2 rounded-xl border border-borde p-4">
      <input type="hidden" name="areaId" value={areaId} />
      <label className="flex flex-col text-sm">
        Actividad (lista)
        <select
          name="estipulada"
          value={estipulada}
          onChange={(e) => setEstipulada(e.target.value)}
          className="rounded-lg border border-borde bg-marfil p-2 focus:outline-none focus:ring-2 focus:ring-bosque/40"
        >
          <option value="">— elegir —</option>
          {estipuladas.map((e) => (
            <option key={e.id} value={e.nombre}>{e.nombre}</option>
          ))}
          <option value="__otra__">Otra…</option>
        </select>
      </label>
      {estipulada === '__otra__' && (
        <label className="flex flex-1 flex-col text-sm">
          Otra (escribe la actividad)
          <input name="otra" placeholder="¿Qué actividad?" className="rounded-lg border border-borde bg-marfil p-2 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      <label className="flex flex-col text-sm">
        Unidad
        <select
          name="unidad"
          value={unidadSel === 'Otro' ? 'otro' : unidadSel.toLowerCase()}
          onChange={(e) => setUnidadSel(e.target.value === 'otro' ? 'Otro' : e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
          className="rounded-lg border border-borde bg-marfil p-2 focus:outline-none focus:ring-2 focus:ring-bosque/40"
        >
          {UNIDADES.map((u) => (<option key={u} value={u.toLowerCase()}>{u}</option>))}
          <option value="otro">Otro…</option>
        </select>
      </label>
      {unidadSel === 'Otro' && (
        <label className="flex flex-col text-sm">
          Unidad (texto)
          <input name="unidadOtra" placeholder="ej. viajes" className="w-28 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      <label className="flex flex-col text-sm">
        Lotes y medida por lote
        <PickerLotesBultos lotes={lotes} campo="medida" placeholder="medida" />
      </label>
      <label className="flex w-full flex-col text-sm">
        Detalle / instrucciones (opcional)
        <textarea name="detalle" rows={2} placeholder="Ej: 2 jornales por lote" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
      </label>
      <button className="rounded-lg bg-bosque px-4 py-2 text-sm font-semibold text-white">+ Agregar al banco</button>
    </form>
  )
}
```

- [x] **Step 3: `crearTareaAccion` lee medida + unidad**

En `src/app/tareas/acciones.ts`, reemplazar `crearTareaAccion` (línea 31-47) por (se añade un helper `unidadElegida` justo antes):

```ts
// Resuelve la unidad elegida en el formulario estándar: "otro"→texto libre; vacío→null.
function unidadElegida(form: FormData): string | null {
  const u = texto(form, 'unidad')
  if (!u) return null
  if (u === 'otro') return texto(form, 'unidadOtra') || 'otro'
  return u
}

export async function crearTareaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const est = textoOpcional(form, 'estipulada')
  const descripcion = est === '__otra__'
    ? textoOpcional(form, 'otra')
    : (est ?? textoOpcional(form, 'descripcion'))
  if (!areaId || !descripcion) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  const medida: Record<string, number> = {}
  for (const id of loteIds) {
    const b = numeroOpcional(form, `bultos_${id}`)
    if (b != null) bultos[id] = b
    const m = numeroOpcional(form, `medida_${id}`)
    if (m != null) medida[id] = m
  }
  const detalle = textoOpcional(form, 'detalle')
  const unidad = unidadElegida(form)
  await crearTarea(
    areaId,
    descripcion,
    loteIds,
    Object.keys(bultos).length > 0 ? bultos : null,
    detalle,
    Object.keys(medida).length > 0 ? medida : null,
    unidad,
  )
  revalidatePath('/tareas')
}
```

- [x] **Step 4: `InfoLotes` muestra la medida por lote**

En `src/app/_componentes/info-lotes.tsx`, añadir props `medidaPorLote`/`unidad` y usarlas en la etiqueta cuando no haya bultos. El componente queda:

```tsx
import type { BultosPorLote } from '@/dominio/bultos'

type LoteInfo = { id: string; nombre: string; hectareas: number | null }

export function InfoLotes({
  lotes,
  bultosPorLote,
  medidaPorLote,
  unidad,
  className = '',
  tamano = 'text-xs',
}: {
  lotes: LoteInfo[]
  bultosPorLote?: BultosPorLote | null
  medidaPorLote?: Record<string, number> | null
  unidad?: string | null
  className?: string
  tamano?: string
}) {
  if (lotes.length === 0) return null
  const ha = lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)
  const etiqueta = (l: LoteInfo) => {
    const b = bultosPorLote?.[l.id]
    if (typeof b === 'number') return `${l.nombre} (${b} bultos)`
    const m = medidaPorLote?.[l.id]
    if (typeof m === 'number') return `${l.nombre} (${m}${unidad ? ` ${unidad}` : ''})`
    return l.nombre
  }
  const nombres = lotes.map(etiqueta).join(', ')
  return (
    <div className={`${tamano} text-tierra ${className}`}>
      📍 {nombres}
      {ha > 0 ? <> · <b>{ha.toFixed(1)} ha</b></> : null}
    </div>
  )
}
```

- [x] **Step 5: `tareas/page.tsx` — filtros por categoría + formulario estándar + banco**

En `src/app/tareas/page.tsx`:

(a) Añadir el import (junto a los otros de `./`):

```tsx
import { FormNuevaTareaEstandar } from './form-nueva-tarea-estandar'
```

(b) Justo antes del `return`/JSX que usa `estipuladas` (después de que `estipuladas` esté disponible del `await Promise.all`), definir los dos subconjuntos:

```tsx
  const estipuladasMaq = estipuladas.filter((e) => e.maquinaria)
  const estipuladasEst = estipuladas.filter((e) => !e.maquinaria)
```

(c) Reemplazar el bloque `{esMaquinaria ? (<FormNuevaTareaMaquinaria .../>) : (<form action={crearTareaAccion}> … </form>)}` (líneas 93-108) por:

```tsx
          {esMaquinaria ? (
            <FormNuevaTareaMaquinaria areaId={areaId} estipuladas={estipuladasMaq} lotes={lotes} accion={crearTareaAccion} />
          ) : (
            <FormNuevaTareaEstandar areaId={areaId} estipuladas={estipuladasEst} lotes={lotes} accion={crearTareaAccion} />
          )}
```

(d) En `<FormSolicitar ... estipuladas={estipuladas} ... />` (línea 113), cambiar a `estipuladas={estipuladasMaq}` (el desplegable de solicitar solo aparece para ejecutores de maquinaria).

(e) En el banco (línea 143), pasar la medida planeada a `InfoLotes`:

```tsx
                    <InfoLotes lotes={t.lotes} bultosPorLote={t.bultosPorLote as Record<string, number> | null} medidaPorLote={t.medidaPorLote as Record<string, number> | null} unidad={t.unidad} />
```

- [x] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: 0 errores en `src/`.

- [x] **Step 7: Tests (sin regresión)**

Run: `npx vitest run`
Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/app/tareas/picker-lotes-bultos.tsx src/app/tareas/form-nueva-tarea-estandar.tsx src/app/tareas/acciones.ts src/app/tareas/page.tsx src/app/_componentes/info-lotes.tsx
git commit -m "feat(tareas): formulario estandar con catalogo, lotes y medida por lote; desplegables por categoria"
```

---

### Task 4: Configuración — elegir categoría al crear y mostrarla en la lista

**Files:**
- Modify: `src/app/configuracion/acciones.ts` (`crearActividadEstipuladaAccion` :117-122)
- Modify: `src/app/configuracion/page.tsx` (sección de estipuladas :175-211)

**Interfaces:**
- Consumes: `crearActividadEstipulada(nombre, unidad, maquinaria)` (Task 2); `ActividadEstipulada.maquinaria` (Task 1).

- [x] **Step 1: Acción de crear con categoría**

En `src/app/configuracion/acciones.ts`, reemplazar `crearActividadEstipuladaAccion` (línea 117-122) por:

```ts
export async function crearActividadEstipuladaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (!nombre) faltanDatos()
  const unidad = normalizarUnidad(texto(form, 'unidad'))
  const maquinaria = texto(form, 'categoria') !== 'estandar' // por defecto maquinaria
  await correr(() => crearActividadEstipulada(nombre, unidad, maquinaria), 'Actividad agregada.')
}
```

- [x] **Step 2: UI — etiqueta de categoría por fila + selector al crear**

En `src/app/configuracion/page.tsx`, en la sección de estipuladas:

(a) Encabezado (línea 177): cambiar a `Actividades (catálogo) ({estipuladas.length})` y el texto de ayuda (línea 178) a: `Estándar y maquinaria; cada área ve su categoría en el desplegable de Tareas.`

(b) En cada `<li>` (dentro del `.map`, tras el `<form>` de renombrar y antes del de unidad, línea 186-187), añadir una etiqueta de categoría:

```tsx
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.maquinaria ? 'bg-arena text-arcilla' : 'bg-bosque/15 text-bosque'}`}>
                  {e.maquinaria ? 'Maquinaria' : 'Estándar'}
                </span>
```

(c) En el formulario de crear (línea 201-210), añadir un `<select name="categoria">` antes del botón:

```tsx
            <select name="categoria" defaultValue="maquinaria" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="maquinaria">Maquinaria</option>
              <option value="estandar">Estándar</option>
            </select>
```

- [x] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: 0 errores en `src/`.

- [x] **Step 4: Tests (sin regresión)**

Run: `npx vitest run`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/configuracion/acciones.ts src/app/configuracion/page.tsx
git commit -m "feat(configuracion): elegir categoria (estandar/maquinaria) al crear actividad y mostrarla"
```

---

## Verificación manual (post-implementación, tras desplegar)

1. En un área **estándar**, "Agregar al banco": el desplegable muestra las 16 estándar + "Otra…"; elegir varios lotes con su valor; unidad (Jornales/Otro); detalle → la tarea queda en el banco mostrando la medida por lote y su unidad.
2. Asignar esa tarea en /programar → la actividad hereda la unidad como unidad por defecto en cumplimiento.
3. En **maquinaria**: el desplegable sigue mostrando solo las de maquinaria; bultos por lote sigue funcionando.
4. **Configuración**: crear una actividad estándar y una de maquinaria; cada una aparece con su etiqueta; cada área ve su categoría.
5. **Solicitar** a un área de maquinaria: el desplegable muestra las de maquinaria.

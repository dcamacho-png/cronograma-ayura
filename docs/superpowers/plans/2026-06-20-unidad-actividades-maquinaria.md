# Unidad por actividad de maquinaria (Ha / Hora / Kg) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada actividad de maquinaria se mide en su unidad (ha / hora / kg): el catálogo guarda la unidad, los formularios de cumplimiento la piden con la etiqueta correcta y el Resumen totaliza por unidad.

**Architecture:** Se agrega `ActividadEstipulada.unidad` (migración aditiva) sembrada desde la columna B del Excel. Un helper de dominio puro (`src/dominio/unidad.ts`) deriva la unidad por descripción y su etiqueta; otro (`medidasPorUnidad` en `resumen.ts`) totaliza. Configuración elige la unidad al crear; Cumplimiento (registro normal y actividad nueva) muestra la etiqueta correcta; el Resumen muestra tres totales y la unidad por actividad. La columna `Actividad.haRealizada` NO se renombra: se reinterpreta como "medida realizada en la unidad de la actividad".

**Tech Stack:** Next.js 16, Prisma 6 (Postgres/Neon), React 19, Tailwind v4, Vitest.

## Global Constraints

- Unidades válidas: **`ha` | `hora` | `kg`**. Default y fallback (descripción fuera del catálogo / texto libre): **`ha`**.
- La unidad vive solo en `ActividadEstipulada.unidad`. La unidad de una `Actividad` se **deriva por su `descripcion`** (no se guarda en `Actividad`).
- Etiquetas exactas del campo de medida: `ha → "Hectáreas realizadas"`, `hora → "Horas realizadas"`, `kg → "Kg cosechados"`.
- Unidad abreviada para listas/totales: `ha → "ha"`, `hora → "horas"`, `kg → "kg"`.
- NO renombrar la columna `Actividad.haRealizada` (migración aditiva, sin pérdida de datos).
- NO tocar el flujo de "cambio de actividad" (reemplazo), ni Programar, banco o login.
- Migración nueva: `prisma/migrations/20260620160000_estipulada_unidad/migration.sql`.
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` sin errores; donde haya tests, `npm test` verde (suite actual: 65). **NO** ejecutar la app, el seed ni el build en local (la base está en Neon).
- Spec: `docs/superpowers/specs/2026-06-20-unidad-actividades-maquinaria-design.md`.

## File Structure

- `prisma/schema.prisma` — `ActividadEstipulada.unidad String @default("ha")`.
- `prisma/migrations/20260620160000_estipulada_unidad/migration.sql` — NUEVO.
- `prisma/seed.ts` — `ACTIVIDADES_ESTIPULADAS` pasa a `{ nombre, unidad }[]`; upsert fija `unidad`.
- `src/datos/repositorio.ts` — `crearActividadEstipulada(nombre, unidad)`; `crearActividadRealizada(...)` recibe `medida`.
- `src/dominio/unidad.ts` — NUEVO: `Unidad`, `normalizarUnidad`, `unidadDe`, `etiquetaMedida`, `unidadAbreviada`.
- `src/dominio/unidad.test.ts` — NUEVO.
- `src/dominio/resumen.ts` — `medidasPorUnidad(...)`.
- `src/dominio/resumen.test.ts` — test de `medidasPorUnidad`.
- `src/app/configuracion/acciones.ts` — `crearActividadEstipuladaAccion` lee `unidad`.
- `src/app/configuracion/page.tsx` — `<select name="unidad">` + unidad en la lista.
- `src/app/cumplimiento/form-registrar.tsx` — prop `unidad`, etiqueta dinámica.
- `src/app/cumplimiento/form-actividad-realizada.tsx` — `estipuladas`, select de descripción + "Otra", campo `medida` reactivo.
- `src/app/cumplimiento/page.tsx` — traer estipuladas, armar mapa, pasar `unidad` y `estipuladas`.
- `src/app/cumplimiento/acciones.ts` — `agregarActividadRealizadaAccion` lee `medida` y resuelve la descripción "Otra".
- `src/app/resumen/resumen-area.tsx` — prop `unidadPorNombre`, tres totales, unidad por actividad.
- `src/app/resumen/page.tsx` y `src/app/resumen/exportar/page.tsx` — traer estipuladas y pasar `unidadPorNombre`.

---

## Task 1: Modelo `unidad` + migración + seed + repositorio

**Files:**
- Modify: `prisma/schema.prisma` (modelo `ActividadEstipulada`, ~líneas 127-130)
- Create: `prisma/migrations/20260620160000_estipulada_unidad/migration.sql`
- Modify: `prisma/seed.ts` (`ACTIVIDADES_ESTIPULADAS` ~49-58 y el upsert ~107-109)
- Modify: `src/datos/repositorio.ts` (`crearActividadEstipulada` ~307-309; `crearActividadRealizada` ~452-482)

**Interfaces:**
- Produces:
  - `ActividadEstipulada` ahora tiene `unidad: string` (default `'ha'`).
  - `crearActividadEstipulada(nombre: string, unidad?: string)` — default `'ha'`.
  - `crearActividadRealizada(datos: { areaId, anio, semana, dia, responsableId, descripcion, loteId: string|null, maquinaId: string|null, medida: number|null })` — `medida` se guarda en `haRealizada`.
  - `listarActividadesEstipuladas()` devuelve registros con `{ id, nombre, unidad }` (sin cambios de firma).

- [ ] **Step 1: Agregar el campo `unidad` al esquema**

En `prisma/schema.prisma`, reemplazar el modelo `ActividadEstipulada` (líneas 127-130):

```prisma
model ActividadEstipulada {
  id     String @id @default(cuid())
  nombre String @unique
  unidad String @default("ha")
}
```

- [ ] **Step 2: Crear la migración SQL**

Crear el archivo `prisma/migrations/20260620160000_estipulada_unidad/migration.sql`:

```sql
-- Unidad de medida por actividad de maquinaria (ha | hora | kg)
ALTER TABLE "ActividadEstipulada" ADD COLUMN "unidad" TEXT NOT NULL DEFAULT 'ha';
```

- [ ] **Step 3: Regenerar el cliente de Prisma**

Run: `npx prisma generate`
Expected: termina con "Generated Prisma Client ...". (Genera tipos; no toca la base.)

- [ ] **Step 4: Sembrar las unidades en el seed**

En `prisma/seed.ts`, reemplazar la constante `ACTIVIDADES_ESTIPULADAS` (líneas 49-58) por la lista con unidad (mapa de la columna B: 14 ha, 18 hora, 2 kg):

```ts
const ACTIVIDADES_ESTIPULADAS: { nombre: string; unidad: 'ha' | 'hora' | 'kg' }[] = [
  // ha (14)
  { nombre: 'ENCALADORA', unidad: 'ha' },
  { nombre: 'RENOVADOR', unidad: 'ha' },
  { nombre: 'FERTILIZACION GRANULADA', unidad: 'ha' },
  { nombre: 'FERTILIZACION POLLINAZA', unidad: 'ha' },
  { nombre: 'FUMIGACION CONTROL MALEZAS', unidad: 'ha' },
  { nombre: 'FUMIGACION CONTROL PLAGAS', unidad: 'ha' },
  { nombre: 'RASTRA SIEMBRA', unidad: 'ha' },
  { nombre: 'CINCEL SIEMBRA', unidad: 'ha' },
  { nombre: 'PULIDOR SIEMBRA', unidad: 'ha' },
  { nombre: 'PULIDOR SIEMBRA NEWMAN', unidad: 'ha' },
  { nombre: 'SIEMBRA PASTOS', unidad: 'ha' },
  { nombre: 'ROTOSPEED', unidad: 'ha' },
  { nombre: 'COSECHAR PASTOS', unidad: 'ha' },
  { nombre: 'COSECHA SILO', unidad: 'ha' },
  // hora (18)
  { nombre: 'REGAR COMPOST', unidad: 'hora' },
  { nombre: 'ESTERCOLERO', unidad: 'hora' },
  { nombre: 'MOVIMIENTOS MATERIALES Y INSUMOS', unidad: 'hora' },
  { nombre: 'MOVIVIMIENTOS RIEGO', unidad: 'hora' },
  { nombre: 'MOVIMIENTO CARRETE', unidad: 'hora' },
  { nombre: 'ROLO', unidad: 'hora' },
  { nombre: 'ESPARCIDOR', unidad: 'hora' },
  { nombre: 'TAIPA', unidad: 'hora' },
  { nombre: 'DESBROZADORA', unidad: 'hora' },
  { nombre: 'PALA', unidad: 'hora' },
  { nombre: 'SEMBRAR CON VOLEADORA', unidad: 'hora' },
  { nombre: 'SIEMBRA MAIZ', unidad: 'hora' },
  { nombre: 'ZANJADORA', unidad: 'hora' },
  { nombre: 'ALQUILER MAQUINAS CEBA ENTREMONTES', unidad: 'hora' },
  { nombre: 'ALQUILER MAQUINAS MAIZ', unidad: 'hora' },
  { nombre: 'RIEL', unidad: 'hora' },
  { nombre: 'BOLA', unidad: 'hora' },
  { nombre: 'CADENA', unidad: 'hora' },
  // kg (2)
  { nombre: 'GRANEL', unidad: 'kg' },
  { nombre: 'COSECHAR MAIZ', unidad: 'kg' },
]
```

- [ ] **Step 5: Actualizar el upsert del seed**

En `prisma/seed.ts`, reemplazar el bucle del upsert de estipuladas (líneas 107-109) para que fije la unidad al re-correr el seed:

```ts
  for (const a of ACTIVIDADES_ESTIPULADAS) {
    await prisma.actividadEstipulada.upsert({
      where: { nombre: a.nombre },
      update: { unidad: a.unidad },
      create: { nombre: a.nombre, unidad: a.unidad },
    })
  }
```

- [ ] **Step 6: `crearActividadEstipulada` acepta unidad**

En `src/datos/repositorio.ts`, reemplazar la función (líneas 307-309):

```ts
export function crearActividadEstipulada(nombre: string, unidad: string = 'ha') {
  return prisma.actividadEstipulada.create({ data: { nombre, unidad } })
}
```

- [ ] **Step 7: `crearActividadRealizada` guarda la medida**

En `src/datos/repositorio.ts`, modificar la firma de `crearActividadRealizada` (línea 452) agregando `medida` al objeto de datos:

```ts
export async function crearActividadRealizada(datos: {
  areaId: string
  anio: number
  semana: number
  dia: number
  responsableId: string
  descripcion: string
  loteId: string | null
  maquinaId: string | null
  medida: number | null
}) {
```

Y dentro del `prisma.actividad.create({ data: { ... } })`, agregar `haRealizada` después de `maquinaId: datos.maquinaId,` (línea 478):

```ts
      maquinaId: datos.maquinaId,
      haRealizada: datos.medida,
```

- [ ] **Step 8: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (Si `agregarActividadRealizadaAccion` falla por falta del nuevo `medida`, se corrige en la Task 4 — pero el tipo pide el campo, así que añadir `medida: null` provisional en `cumplimiento/acciones.ts` línea ~50 NO; mejor completar Task 4. Si el gate falla aquí solo por eso, continuar a la Task 4 y correr el gate al final de ambas.)

Nota: para mantener el gate verde tras la Task 1 de forma aislada, en `src/app/cumplimiento/acciones.ts` el objeto pasado a `crearActividadRealizada` (líneas 50-59) debe incluir `medida`. Añadir temporalmente `medida: numeroOpcional(form, 'medida'),` como última propiedad; la Task 4 termina de cablear el formulario que envía ese campo.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260620160000_estipulada_unidad/migration.sql prisma/seed.ts src/datos/repositorio.ts src/app/cumplimiento/acciones.ts
git commit -m "feat(maquinaria): ActividadEstipulada.unidad + seed por unidad + medida en crearActividadRealizada"
```

---

## Task 2: Helper de dominio `unidad` + `medidasPorUnidad` (TDD)

**Files:**
- Create: `src/dominio/unidad.ts`
- Create: `src/dominio/unidad.test.ts`
- Modify: `src/dominio/resumen.ts` (agregar `medidasPorUnidad`)
- Modify: `src/dominio/resumen.test.ts` (test de `medidasPorUnidad`)

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `type Unidad = 'ha' | 'hora' | 'kg'`
  - `normalizarUnidad(u: string | null | undefined): Unidad` — `'hora'`/`'kg'` se respetan; cualquier otra cosa → `'ha'`.
  - `unidadDe(unidadPorNombre: Record<string, string>, descripcion: string): Unidad`
  - `etiquetaMedida(unidad: Unidad): string` — `"Hectáreas realizadas" | "Horas realizadas" | "Kg cosechados"`.
  - `unidadAbreviada(unidad: Unidad): string` — `"ha" | "horas" | "kg"`.
  - `medidasPorUnidad(filas: { estado: string; haProgramada: number; haRealizada: number | null; unidad: Unidad }[]): Record<Unidad, number>` (en `resumen.ts`).

- [ ] **Step 1: Escribir el test del helper de unidad**

Crear `src/dominio/unidad.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizarUnidad, unidadDe, etiquetaMedida, unidadAbreviada } from './unidad'

describe('normalizarUnidad', () => {
  it('respeta hora y kg, y cae a ha en cualquier otro caso', () => {
    expect(normalizarUnidad('hora')).toBe('hora')
    expect(normalizarUnidad('kg')).toBe('kg')
    expect(normalizarUnidad('ha')).toBe('ha')
    expect(normalizarUnidad('')).toBe('ha')
    expect(normalizarUnidad(undefined)).toBe('ha')
    expect(normalizarUnidad('litros')).toBe('ha')
  })
})

describe('unidadDe', () => {
  const mapa = { ESTERCOLERO: 'hora', GRANEL: 'kg', ENCALADORA: 'ha' }
  it('busca por descripción y cae a ha si no está en el catálogo', () => {
    expect(unidadDe(mapa, 'ESTERCOLERO')).toBe('hora')
    expect(unidadDe(mapa, 'GRANEL')).toBe('kg')
    expect(unidadDe(mapa, 'ENCALADORA')).toBe('ha')
    expect(unidadDe(mapa, 'Texto libre')).toBe('ha')
  })
})

describe('etiquetaMedida', () => {
  it('da la etiqueta del campo según la unidad', () => {
    expect(etiquetaMedida('ha')).toBe('Hectáreas realizadas')
    expect(etiquetaMedida('hora')).toBe('Horas realizadas')
    expect(etiquetaMedida('kg')).toBe('Kg cosechados')
  })
})

describe('unidadAbreviada', () => {
  it('da la abreviatura para listas y totales', () => {
    expect(unidadAbreviada('ha')).toBe('ha')
    expect(unidadAbreviada('hora')).toBe('horas')
    expect(unidadAbreviada('kg')).toBe('kg')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/dominio/unidad.test.ts`
Expected: FAIL — "Cannot find module './unidad'" o "is not a function".

- [ ] **Step 3: Implementar el helper de unidad**

Crear `src/dominio/unidad.ts`:

```ts
export type Unidad = 'ha' | 'hora' | 'kg'

// Normaliza un valor de texto a una Unidad válida; cualquier cosa distinta de
// 'hora' o 'kg' (incluido undefined / vacío / texto libre) cae a 'ha'.
export function normalizarUnidad(u: string | null | undefined): Unidad {
  return u === 'hora' || u === 'kg' ? u : 'ha'
}

// Deriva la unidad de una actividad buscando su descripción en el catálogo.
export function unidadDe(unidadPorNombre: Record<string, string>, descripcion: string): Unidad {
  return normalizarUnidad(unidadPorNombre[descripcion])
}

// Etiqueta del campo de "medida realizada" según la unidad.
export function etiquetaMedida(unidad: Unidad): string {
  if (unidad === 'hora') return 'Horas realizadas'
  if (unidad === 'kg') return 'Kg cosechados'
  return 'Hectáreas realizadas'
}

// Abreviatura para listas y totales (ej. "6 horas").
export function unidadAbreviada(unidad: Unidad): string {
  if (unidad === 'hora') return 'horas'
  return unidad // 'ha' | 'kg'
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/dominio/unidad.test.ts`
Expected: PASS (4 describe verdes).

- [ ] **Step 5: Escribir el test de `medidasPorUnidad`**

En `src/dominio/resumen.test.ts`, agregar el import al inicio (junto a los existentes) y un bloque de test al final del archivo:

```ts
// añadir a la línea de import existente de './resumen':
//   import { colorPorcentaje, actividadesConCambio, medidasPorUnidad } from './resumen'

describe('medidasPorUnidad', () => {
  it('totaliza por unidad, ignora PENDIENTE y solo deriva de ha programada en ha CUMPLIDA', () => {
    const tot = medidasPorUnidad([
      { estado: 'CUMPLIDA', haProgramada: 3, haRealizada: null, unidad: 'ha' },   // 3 ha (derivada)
      { estado: 'CUMPLIDA', haProgramada: 3, haRealizada: 2, unidad: 'ha' },      // 2 ha (medida gana)
      { estado: 'CUMPLIDA', haProgramada: 5, haRealizada: 6, unidad: 'hora' },    // 6 horas
      { estado: 'CUMPLIDA', haProgramada: 5, haRealizada: null, unidad: 'hora' }, // 0 (no se deriva en hora)
      { estado: 'CUMPLIDA', haProgramada: 0, haRealizada: 100, unidad: 'kg' },    // 100 kg
      { estado: 'PENDIENTE', haProgramada: 9, haRealizada: 9, unidad: 'ha' },     // ignorada
      { estado: 'PARCIAL', haProgramada: 4, haRealizada: 1, unidad: 'ha' },       // 1 ha
    ])
    expect(tot).toEqual({ ha: 6, hora: 6, kg: 100 })
  })
})
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `npx vitest run src/dominio/resumen.test.ts`
Expected: FAIL — "medidasPorUnidad is not a function".

- [ ] **Step 7: Implementar `medidasPorUnidad`**

En `src/dominio/resumen.ts`, agregar el import de `Unidad` al inicio (junto al import de tipos):

```ts
import type { Unidad } from './unidad'
```

Y al final del archivo, después de `hectareasRealizadas` (reusa el `r1` ya definido en el módulo):

```ts
// Totaliza la medida realizada por unidad. La medida explícita (haRealizada)
// gana; si no hay, solo se deriva de la ha programada cuando la unidad es 'ha'
// y la actividad está CUMPLIDA. Las PENDIENTE se ignoran.
export function medidasPorUnidad(
  filas: { estado: string; haProgramada: number; haRealizada: number | null; unidad: Unidad }[],
): Record<Unidad, number> {
  const tot: Record<Unidad, number> = { ha: 0, hora: 0, kg: 0 }
  for (const f of filas) {
    if (f.estado === 'PENDIENTE') continue
    const medida = f.haRealizada ?? (f.unidad === 'ha' && f.estado === 'CUMPLIDA' ? f.haProgramada : 0)
    tot[f.unidad] += medida
  }
  return { ha: r1(tot.ha), hora: r1(tot.hora), kg: r1(tot.kg) }
}
```

- [ ] **Step 8: Correr toda la suite y verificar que pasa**

Run: `npm test`
Expected: PASS — la suite completa verde (incluye `unidad.test.ts` y el nuevo caso de `resumen.test.ts`).

- [ ] **Step 9: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add src/dominio/unidad.ts src/dominio/unidad.test.ts src/dominio/resumen.ts src/dominio/resumen.test.ts
git commit -m "feat(dominio): helpers de unidad (unidadDe/etiquetaMedida) y medidasPorUnidad"
```

---

## Task 3: Configuración — elegir y mostrar la unidad

**Files:**
- Modify: `src/app/configuracion/acciones.ts` (`crearActividadEstipuladaAccion` ~112-116)
- Modify: `src/app/configuracion/page.tsx` (lista de estipuladas ~162-178)

**Interfaces:**
- Consumes: `crearActividadEstipulada(nombre, unidad)` (Task 1).
- Produces: el formulario de "Actividades de maquinaria" envía `unidad`; la lista muestra `nombre · unidad`.

- [ ] **Step 1: La acción lee la unidad**

En `src/app/configuracion/acciones.ts`, reemplazar `crearActividadEstipuladaAccion` (líneas 112-116):

```ts
export async function crearActividadEstipuladaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (!nombre) faltanDatos()
  const unidadRaw = texto(form, 'unidad')
  const unidad = unidadRaw === 'hora' || unidadRaw === 'kg' ? unidadRaw : 'ha'
  await correr(() => crearActividadEstipulada(nombre, unidad), 'Actividad agregada.')
}
```

- [ ] **Step 2: Mostrar la unidad en la lista de estipuladas**

En `src/app/configuracion/page.tsx`, dentro del `<li>` de cada estipulada (líneas 163-172), agregar la unidad después del botón "guardar" del form de renombrar y antes del `FormEliminar`. Reemplazar el bloque del `<li>` (líneas 164-171) por:

```tsx
              <li key={e.id} className="flex items-center gap-2">
                <form action={renombrarActividadEstipuladaAccion} className="flex flex-1 items-center gap-1">
                  <input type="hidden" name="id" value={e.id} />
                  <input name="nombre" defaultValue={e.nombre} className="flex-1 rounded border p-1 text-sm" />
                  <button className="text-xs font-semibold text-[#11603a] hover:underline">guardar</button>
                </form>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{e.unidad}</span>
                <FormEliminar accion={eliminarActividadEstipuladaAccion} id={e.id} etiqueta={e.nombre} />
              </li>
```

- [ ] **Step 3: Agregar el select de unidad al formulario de crear**

En `src/app/configuracion/page.tsx`, reemplazar el `<form action={crearActividadEstipuladaAccion}>` (líneas 174-177):

```tsx
          <form action={crearActividadEstipuladaAccion} className="flex flex-wrap gap-2">
            <input name="nombre" required placeholder="Nueva actividad de maquinaria" className="flex-1 rounded border p-2 text-sm" />
            <select name="unidad" defaultValue="ha" className="rounded border p-2 text-sm">
              <option value="ha">Ha</option>
              <option value="hora">Hora</option>
              <option value="kg">Kg</option>
            </select>
            <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
```

- [ ] **Step 4: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/configuracion/acciones.ts src/app/configuracion/page.tsx
git commit -m "feat(configuracion): elegir y mostrar la unidad de cada actividad de maquinaria"
```

---

## Task 4: Cumplimiento — etiqueta por unidad y actividad nueva con catálogo

**Files:**
- Modify: `src/app/cumplimiento/form-registrar.tsx` (prop `unidad` + etiqueta dinámica)
- Modify: `src/app/cumplimiento/form-actividad-realizada.tsx` (select de descripción + "Otra" + campo medida reactivo)
- Modify: `src/app/cumplimiento/page.tsx` (traer estipuladas, armar mapa, pasar props)
- Modify: `src/app/cumplimiento/acciones.ts` (`agregarActividadRealizadaAccion` lee `medida` y resuelve descripción)

**Interfaces:**
- Consumes: `etiquetaMedida`, `unidadDe`, `type Unidad`, `normalizarUnidad` (Task 2); `crearActividadRealizada(... medida)` (Task 1); `listarActividadesEstipuladas()`.
- Produces: el registro normal muestra la etiqueta de la unidad de esa actividad; el form de actividad nueva (maquinaria) elige la descripción del catálogo (o "Otra") y pide la medida en la unidad elegida; la acción guarda `medida` y la descripción correcta.

- [ ] **Step 1: `FormRegistrar` recibe `unidad` y usa la etiqueta**

En `src/app/cumplimiento/form-registrar.tsx`:

1. Agregar el import al inicio (después de la línea 4):

```tsx
import { etiquetaMedida, type Unidad } from '@/dominio/unidad'
```

2. Agregar la prop `unidad` a la firma. Reemplazar el bloque de props (líneas 9-27):

```tsx
export function FormRegistrar({
  actividadId,
  esMaquinaria,
  unidad,
  motivos,
  motivoCambioId,
  lotes,
  maquinas,
  haProgramada,
  accion,
}: {
  actividadId: string
  esMaquinaria: boolean
  unidad: Unidad
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  haProgramada: number
  accion: (formData: FormData) => void | Promise<void>
}) {
```

3. Reemplazar la etiqueta del campo de medida (línea 73):

```tsx
          {etiquetaMedida(unidad)} (opcional)
```

- [ ] **Step 2: La página de cumplimiento trae estipuladas y pasa `unidad`**

En `src/app/cumplimiento/page.tsx`:

1. Agregar `listarActividadesEstipuladas` al import de repositorio (línea 4):

```tsx
import { listarAreas, listarMotivos, listarActividades, listarLotes, listarMaquinas, listarResponsablesPorArea, listarActividadesEstipuladas } from '@/datos/repositorio'
```

2. Agregar el import del helper (después de la línea 11):

```tsx
import { unidadDe } from '@/dominio/unidad'
```

3. Agregar `listarActividadesEstipuladas()` al `Promise.all` (líneas 61-67):

```tsx
  const [motivos, actividades, lotes, maquinas, responsablesTodos, estipuladas] = await Promise.all([
    listarMotivos(),
    listarActividades(areaId, anio, semana),
    listarLotes(),
    listarMaquinas(),
    listarResponsablesPorArea(areaId),
    listarActividadesEstipuladas(),
  ])
```

4. Después de `const motivoCambioId = ...` (línea 69), armar el mapa:

```tsx
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
```

5. Pasar `estipuladas` al `FormActividadRealizada` (en el bloque de líneas 142-151), agregando la prop:

```tsx
        <FormActividadRealizada
          areaId={areaId}
          anio={anio}
          semana={semana}
          esMaquinaria={esMaquinaria}
          responsables={responsables}
          lotes={lotes}
          maquinas={maquinas}
          estipuladas={estipuladas}
          accion={agregarActividadRealizadaAccion}
        />
```

6. Pasar `unidad` al `FormRegistrar` (bloque de líneas 180-189), agregando la prop después de `esMaquinaria`:

```tsx
                <FormRegistrar
                  actividadId={a.id}
                  esMaquinaria={esMaquinaria}
                  unidad={unidadDe(unidadPorNombre, a.descripcion)}
                  motivos={motivos}
                  motivoCambioId={motivoCambioId}
                  lotes={lotes}
                  maquinas={maquinas}
                  haProgramada={a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)}
                  accion={registrarAccion}
                />
```

- [ ] **Step 3: `FormActividadRealizada` — select de descripción + "Otra" + medida reactiva**

Reemplazar **todo** el archivo `src/app/cumplimiento/form-actividad-realizada.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { SelectFincaLote } from '../_componentes/select-finca-lote'
import { etiquetaMedida, normalizarUnidad, type Unidad } from '@/dominio/unidad'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

export function FormActividadRealizada({
  areaId,
  anio,
  semana,
  esMaquinaria,
  responsables,
  lotes,
  maquinas,
  estipuladas,
  accion,
}: {
  areaId: string
  anio: number
  semana: number
  esMaquinaria: boolean
  responsables: { id: string; nombre: string }[]
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  // Para maquinaria, la descripción se elige del catálogo (o "Otra").
  const [desc, setDesc] = useState('')
  const unidadPorNombre = new Map(estipuladas.map((e) => [e.nombre, normalizarUnidad(e.unidad)]))
  const esOtra = desc === '__otra__'
  const unidadSel: Unidad = esOtra || desc === '' ? 'ha' : unidadPorNombre.get(desc) ?? 'ha'

  return (
    <form action={accion} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <span className="w-full text-sm font-semibold text-blue-900">➕ Agregar actividad realizada (no programada)</span>
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <label className="flex flex-col text-xs">
        Responsable
        <select name="responsableId" required className="rounded border p-1 text-sm">
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs">
        Día
        <select name="dia" required defaultValue="" className="rounded border p-1 text-sm">
          <option value="" disabled>—</option>
          {DIAS.map((d, i) => (
            <option key={d} value={i + 1}>{d}</option>
          ))}
        </select>
      </label>
      {esMaquinaria ? (
        <>
          <label className="flex flex-1 flex-col text-xs">
            Actividad
            <select
              name="descripcion"
              required
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="rounded border p-1 text-sm"
            >
              <option value="" disabled>— elige —</option>
              {estipuladas.map((e) => (
                <option key={e.id} value={e.nombre}>{e.nombre}</option>
              ))}
              <option value="__otra__">Otra…</option>
            </select>
          </label>
          {esOtra && (
            <label className="flex flex-1 flex-col text-xs">
              Otra (texto libre)
              <input name="descripcionOtra" required placeholder="¿Qué se hizo?" className="rounded border p-1 text-sm" />
            </label>
          )}
        </>
      ) : (
        <label className="flex flex-1 flex-col text-xs">
          Descripción
          <input name="descripcion" required placeholder="¿Qué se hizo?" className="rounded border p-1 text-sm" />
        </label>
      )}
      <label className="flex flex-col text-xs">
        Finca y lote
        <SelectFincaLote lotes={lotes} name="loteId" />
      </label>
      {esMaquinaria && (
        <>
          <label className="flex flex-col text-xs">
            Máquina
            <select name="maquinaId" className="rounded border p-1 text-sm">
              <option value="">— sin máquina —</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            {etiquetaMedida(unidadSel)} (opcional)
            <input name="medida" type="number" step="0.1" min="0" className="w-28 rounded border p-1 text-sm" />
          </label>
        </>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Agregar</button>
    </form>
  )
}
```

- [ ] **Step 4: La acción resuelve la descripción "Otra" y lee la medida**

En `src/app/cumplimiento/acciones.ts`, reemplazar `agregarActividadRealizadaAccion` (líneas 42-61):

```ts
export async function agregarActividadRealizadaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  const dia = Number(texto(form, 'dia'))
  const responsableId = texto(form, 'responsableId')
  // Para maquinaria la descripción viene del catálogo; "__otra__" usa el texto libre.
  const descSelect = texto(form, 'descripcion')
  const descripcion = descSelect === '__otra__' ? texto(form, 'descripcionOtra') : descSelect
  if (!areaId || !Number.isInteger(anio) || !Number.isInteger(semana) || !(dia >= 1 && dia <= 7) || !responsableId || !descripcion) return
  await crearActividadRealizada({
    areaId,
    anio,
    semana,
    dia,
    responsableId,
    descripcion,
    loteId: textoOpcional(form, 'loteId'),
    maquinaId: textoOpcional(form, 'maquinaId'),
    medida: numeroOpcional(form, 'medida'),
  })
  revalidatePath('/cumplimiento')
}
```

(Si en la Task 1 Step 8 se añadió `medida` provisional aquí, este reemplazo lo deja en su forma final — verificar que no quede duplicado.)

- [ ] **Step 5: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Verificación manual (diferida al despliegue)**

No se ejecuta en local (base en Neon). Tras desplegar: en Cumplimiento de Maquinaria, una actividad cuyo nombre sea de la lista "hora" (ej. ESTERCOLERO) pide "Horas realizadas"; una de "kg" (GRANEL) pide "Kg cosechados". Al "Agregar actividad realizada" en Maquinaria, la descripción se elige del catálogo y el campo de medida cambia su etiqueta según la unidad; "Otra…" muestra texto libre y pide hectáreas.

- [ ] **Step 7: Commit**

```bash
git add src/app/cumplimiento/form-registrar.tsx src/app/cumplimiento/form-actividad-realizada.tsx src/app/cumplimiento/page.tsx src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): etiqueta de medida por unidad y actividad nueva desde el catálogo"
```

---

## Task 5: Resumen — tres totales por unidad y unidad por actividad

**Files:**
- Modify: `src/app/resumen/resumen-area.tsx` (prop `unidadPorNombre`, totales, lista por actividad)
- Modify: `src/app/resumen/page.tsx` (traer estipuladas, pasar mapa)
- Modify: `src/app/resumen/exportar/page.tsx` (traer estipuladas, pasar mapa en ambos modos)

**Interfaces:**
- Consumes: `medidasPorUnidad`, `unidadDe`, `unidadAbreviada`, `type Unidad` (Task 2); `listarActividadesEstipuladas()`.
- Produces: `ResumenArea` recibe `unidadPorNombre: Record<string, string>`; la tarjeta de maquinaria muestra `X ha · Y horas · Z kg`; la lista por actividad muestra la unidad de cada una.

- [ ] **Step 1: `ResumenArea` calcula y muestra los totales por unidad**

En `src/app/resumen/resumen-area.tsx`:

1. Reemplazar el import de `@/dominio/resumen` (líneas 2-8) — quitar `hectareasRealizadas`, agregar `medidasPorUnidad`:

```tsx
import {
  colorPorcentaje,
  actividadesConCambio,
  extremosFinalizadas,
  conteoPorEstado,
  medidasPorUnidad,
} from '@/dominio/resumen'
```

2. Agregar el import del helper de unidad (después de la línea 9, tras el import de tipos):

```tsx
import { unidadDe, unidadAbreviada, type Unidad } from '@/dominio/unidad'
```

3. Agregar la prop `unidadPorNombre`. En la firma de `ResumenArea` (líneas 42-58), agregar `unidadPorNombre` a la desestructuración (después de `esMaquinaria`) y al tipo:

```tsx
export function ResumenArea({
  areaNombre,
  semana,
  anio,
  esMaquinaria,
  unidadPorNombre,
  actividades,
  responsables,
  motivos,
}: {
  areaNombre: string
  semana: number
  anio: number
  esMaquinaria: boolean
  unidadPorNombre: Record<string, string>
  actividades: ActividadResumen[]
  responsables: { id: string; nombre: string }[]
  motivos: { id: string; nombre: string }[]
}) {
```

4. Reemplazar el cálculo de `realizadas` y el de `haPorActividad` (líneas 72-83) por el cálculo por unidad:

```tsx
  const haActividad = (a: ActividadResumen) => a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)
  const totales = medidasPorUnidad(
    actividades.map((a) => ({
      estado: a.estado,
      haProgramada: haActividad(a),
      haRealizada: a.haRealizada ?? null,
      unidad: unidadDe(unidadPorNombre, a.descripcion),
    })),
  )
  const totalUnidades = (['ha', 'hora', 'kg'] as Unidad[])
    .filter((u) => totales[u] > 0)
    .map((u) => `${totales[u]} ${unidadAbreviada(u)}`)
    .join(' · ')

  // Lista "realizado por actividad": valor + unidad de cada descripción.
  const medidaPorActividad = new Map<string, { valor: number; unidad: Unidad }>()
  for (const a of actividades) {
    if (a.estado === 'PENDIENTE') continue
    const unidad = unidadDe(unidadPorNombre, a.descripcion)
    const realizada = a.haRealizada ?? (unidad === 'ha' && a.estado === 'CUMPLIDA' ? haActividad(a) : 0)
    const prev = medidaPorActividad.get(a.descripcion)
    medidaPorActividad.set(a.descripcion, {
      valor: (prev?.valor ?? 0) + realizada,
      unidad,
    })
  }
  const medidaActividadLista = [...medidaPorActividad.entries()].sort((a, b) => b[1].valor - a[1].valor)
```

5. Reemplazar la tarjeta de "Hectáreas" (líneas 110-115) por la de tres totales:

```tsx
        {esMaquinaria && (
          <div className="rounded-2xl border p-5">
            <div className="mb-1 text-sm text-gray-500">Realizado</div>
            <div className="text-2xl font-extrabold text-[#2e9e5b]">{totalUnidades || '—'}</div>
          </div>
        )}
```

6. Reemplazar la sección "🚜 Hectáreas realizadas por actividad" (líneas 200-212) por la versión con unidad por actividad:

```tsx
      {esMaquinaria && medidaActividadLista.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">🚜 Realizado por actividad</h2>
          <ul className="space-y-1 text-sm">
            {medidaActividadLista.map(([desc, { valor, unidad }]) => (
              <li key={desc} className="flex justify-between rounded border px-3 py-1">
                <span>{desc}</span>
                <b>{Math.round(valor * 10) / 10} {unidadAbreviada(unidad)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
```

- [ ] **Step 2: `resumen/page.tsx` trae estipuladas y pasa el mapa**

En `src/app/resumen/page.tsx`:

1. Agregar `listarActividadesEstipuladas` al import de repositorio (línea 4):

```tsx
import { listarAreas, listarResponsablesPorArea, listarMotivos, listarActividades, listarActividadesEstipuladas } from '@/datos/repositorio'
```

2. Agregar `listarActividadesEstipuladas()` al `Promise.all` (líneas ~39-43):

```tsx
  const [responsables, motivos, actividades, estipuladas] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarMotivos(),
    listarActividades(areaId, anio, semana),
    listarActividadesEstipuladas(),
  ])
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
```

3. Pasar `unidadPorNombre` al `<ResumenArea>` (bloque final), después de `esMaquinaria`:

```tsx
      <ResumenArea
        areaNombre={areaActual.nombre}
        semana={semana}
        anio={anio}
        esMaquinaria={esMaquinaria}
        unidadPorNombre={unidadPorNombre}
        actividades={actividades}
        responsables={responsables}
        motivos={motivos}
      />
```

- [ ] **Step 3: `resumen/exportar/page.tsx` trae estipuladas y pasa el mapa en ambos modos**

En `src/app/resumen/exportar/page.tsx`:

1. Agregar `listarActividadesEstipuladas` al import de repositorio (línea 3):

```tsx
import { listarAreas, listarResponsablesPorArea, listarMotivos, listarActividades, listarActividadesEstipuladas } from '@/datos/repositorio'
```

2. Después de `const areas = await listarAreas()` (línea ~27), traer las estipuladas una sola vez (sirven para todas las áreas):

```tsx
  const estipuladas = await listarActividadesEstipuladas()
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
```

3. En el modo "todas las áreas", pasar `unidadPorNombre` al `<ResumenArea>` (después de `esMaquinaria={esMaquinaria(area.nombre)}`):

```tsx
              <ResumenArea
                areaNombre={area.nombre}
                semana={semana}
                anio={anio}
                esMaquinaria={esMaquinaria(area.nombre)}
                unidadPorNombre={unidadPorNombre}
                actividades={actividades}
                responsables={responsables}
                motivos={motivos}
              />
```

4. En el modo "un área", pasar `unidadPorNombre` al `<ResumenArea>` final igual:

```tsx
      <ResumenArea
        areaNombre={area.nombre}
        semana={semana}
        anio={anio}
        esMaquinaria={esMaquinaria(area.nombre)}
        unidadPorNombre={unidadPorNombre}
        actividades={actividades}
        responsables={responsables}
        motivos={motivos}
      />
```

- [ ] **Step 4: Verificar typecheck, lint y suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; suite verde.

- [ ] **Step 5: Commit**

```bash
git add src/app/resumen/resumen-area.tsx src/app/resumen/page.tsx src/app/resumen/exportar/page.tsx
git commit -m "feat(resumen): tres totales por unidad (ha/horas/kg) y unidad por actividad"
```

---

## Fase de despliegue (después del plan)

1. `git push` y `vercel deploy --prod` (scope `ayura-llanos`). El build corre `prisma migrate deploy`, que aplica `20260620160000_estipulada_unidad`.
2. Re-correr el seed contra Neon para fijar las unidades de las estipuladas existentes (upsert idempotente): `npm run db:seed` con `DATABASE_URL` apuntando a Neon (o ajustar unidades una a una en Configuración).
3. Verificación manual según Task 4 Step 6 y la tarjeta de tres totales en Resumen.

---

## Self-Review (autor del plan)

**1. Cobertura de la spec:**
- Unidades ha/hora/kg + default ha → Task 1 (schema/seed), Task 2 (`normalizarUnidad`). ✓
- Unidad en el catálogo, sembrada desde columna B → Task 1 (Steps 4-5). ✓
- Unidad derivada por descripción → Task 2 (`unidadDe`). ✓
- Registro normal con etiqueta por unidad → Task 4 (Steps 1-2). ✓
- Actividad nueva no programada: select del catálogo + "Otra" + medida reactiva → Task 4 (Steps 3-4). ✓
- Resumen: tres totales + lista por actividad con unidad → Task 5. ✓
- Configuración: elegir y mostrar unidad → Task 3. ✓
- Helper `etiquetaMedida`/`unidadDe` puros con test → Task 2. ✓
- Migración aditiva, sin renombrar `haRealizada` → Task 1 (Step 2), constraints. ✓
- Qué NO cambia (cambio de actividad, Programar, login) → no tocados. ✓

**2. Placeholders:** No hay "TBD"/"etc."/"manejar casos". Todo el código está completo. ✓

**3. Consistencia de tipos:**
- `Unidad = 'ha'|'hora'|'kg'` usado igual en `unidad.ts`, `resumen.ts` (`medidasPorUnidad`), `form-registrar.tsx`, `form-actividad-realizada.tsx`, `resumen-area.tsx`. ✓
- `unidadPorNombre: Record<string, string>` consistente en páginas y `unidadDe`/`ResumenArea`. ✓
- `crearActividadRealizada(... medida: number|null)` definido en Task 1 y consumido en Task 4. ✓
- `crearActividadEstipulada(nombre, unidad)` definido en Task 1, consumido en Task 3. ✓
- `etiquetaMedida` / `unidadAbreviada` mismos nombres en definición (Task 2) y uso (Tasks 4-5). ✓

**Nota de orden:** la Task 1 Step 8 deja `cumplimiento/acciones.ts` con `medida` provisional para que su gate quede verde de forma aislada; la Task 4 Step 4 lo formaliza. Si se ejecuta Task 1 y Task 4 sin gate intermedio, omitir el provisional y cablear directo en Task 4.

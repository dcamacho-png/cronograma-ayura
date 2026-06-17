# Cronograma — Plan 2: Catálogos + Pantalla "Programar Semana"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sembrar los catálogos con datos reales, exponer una capa de datos sobre Prisma, y construir la primera pantalla usable: "Programar Semana", donde un coordinador elige su área y una semana, ve las actividades en una grilla (responsables × días), agrega y elimina actividades, y duplica la semana anterior.

**Architecture:** Next.js 16 App Router con Server Components (lectura) y Server Actions (escritura). La lógica de negocio sigue siendo pura en `src/dominio/` (testeable con Vitest). El acceso a datos se concentra en `src/datos/` (cliente Prisma + repositorio). La aritmética de semanas ISO y la duplicación de actividades son funciones puras con tests; la pantalla y el repositorio se verifican corriendo la app.

**Tech Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind v4 · Prisma 7 + SQLite · Vitest · tsx (para el seed).

**Estrategia de pruebas (explícita):** Se prueban con Vitest SOLO las funciones puras (aritmética de semanas, `duplicarActividades`). El repositorio Prisma y los componentes de UI NO llevan tests unitarios en este plan (requerirían una base de datos de pruebas y/o render de React); se verifican compilando (`npm run build`) y corriendo la app. Esto es una decisión consciente de alcance, no un olvido.

---

## Estructura de archivos (Plan 2)

- Create: `src/datos/prisma.ts` — cliente Prisma único (singleton).
- Create: `prisma/seed.ts` — siembra catálogos con datos reales.
- Create: `src/dominio/semana.ts` — aritmética de semanas ISO (puro).
- Create: `src/dominio/semana.test.ts` — tests.
- Create: `src/dominio/programacion.ts` — `duplicarActividades` (puro).
- Create: `src/dominio/programacion.test.ts` — tests.
- Create: `src/datos/repositorio.ts` — funciones de lectura/escritura sobre Prisma.
- Create: `src/app/programar/page.tsx` — pantalla "Programar Semana".
- Create: `src/app/programar/acciones.ts` — Server Actions (crear/eliminar/duplicar).
- Modify: `src/app/page.tsx` — redirige o enlaza a `/programar`.
- Modify: `package.json` — script `db:seed`.

---

## Task 1: Cliente Prisma único

**Files:**
- Create: `src/datos/prisma.ts`

- [ ] **Step 1: Crear el singleton**

En desarrollo, Next.js recarga módulos y se crearían muchas conexiones; el patrón estándar guarda el cliente en `globalThis`.

```typescript
import { PrismaClient } from '@prisma/client'

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalParaPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalParaPrisma.prisma = prisma
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores. (Si `@prisma/client` no está generado, corre `npx prisma generate` y vuelve a intentar.)

- [ ] **Step 3: Commit**

```bash
git add src/datos/prisma.ts
git commit -m "feat: cliente Prisma único"
```

---

## Task 2: Seed de catálogos con datos reales

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (script `db:seed`)

- [ ] **Step 1: Instalar tsx y dotenv**

Run: `npm install -D tsx dotenv`
Expected: `tsx` y `dotenv` en devDependencies. (Pueden ya estar instalados; el comando es idempotente.)

> Nota: el seed corre con `tsx`, que NO carga `.env` automáticamente (eso lo hace la CLI de Prisma). Por eso el script empieza con `import 'dotenv/config'`. La app Next sí carga `.env` sola, así que `src/datos/prisma.ts` no lo necesita.

- [ ] **Step 2: Agregar el script en `package.json`**

En `"scripts"`, agregar:
```json
"db:seed": "tsx prisma/seed.ts"
```

- [ ] **Step 3: Crear `prisma/seed.ts`**

Datos tomados del Excel real del cliente. Catálogos con nombre único se hacen con `upsert` (idempotente); responsables y máquinas solo se crean si aún no hay ninguno.

```typescript
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const AREAS = ['Maíz', 'Riego', 'Maquinaria', 'Ganadería ceba', 'Nelore']
const FINCAS = ['Entremontes', 'Acajure', 'Normandia']
const MOTIVOS = [
  'Clima',
  'Daño de máquina',
  'Falta de personal',
  'Falta de insumos',
  'Cambio de prioridad',
  'Otro',
]

// Responsables por nombre de área (del Excel).
const RESPONSABLES: Record<string, string[]> = {
  'Ganadería ceba': [
    'David Zuleta',
    'Duván Peña',
    'Raúl Piñeros',
    'Guillermo Bravo',
    'Alirio Bravo',
    'Jhones Andrés',
  ],
  Maquinaria: [
    'Andrés Mosquera',
    'José Losada',
    'Carlos Botiva',
    'Daveis Ramírez',
    'Jairo Leal',
    'Luis Olaya',
    'Santos Bastos',
  ],
  'Maíz': ['Diego (Zetor)'],
  Riego: [],
  Nelore: [],
}

// Máquinas del Excel (placa/identificador + operario oficial).
const MAQUINAS: { nombre: string; operario: string | null }[] = [
  { nombre: '5403', operario: 'Duván' },
  { nombre: '4299', operario: 'Jairo' },
  { nombre: '5075 E', operario: 'Daveis Ramírez' },
  { nombre: '5090 E', operario: null },
  { nombre: '6603', operario: 'Carlos Botiva' },
  { nombre: 'SAME 55', operario: 'Luis Olaya' },
  { nombre: '8030', operario: 'Santos' },
  { nombre: '108', operario: 'Duván' },
  { nombre: 'ZETOR', operario: 'Diego' },
]

async function main() {
  // Catálogos con nombre único: idempotentes.
  for (const nombre of AREAS) {
    await prisma.area.upsert({ where: { nombre }, update: {}, create: { nombre } })
  }
  for (const nombre of FINCAS) {
    await prisma.finca.upsert({ where: { nombre }, update: {}, create: { nombre } })
  }
  for (const nombre of MOTIVOS) {
    await prisma.motivo.upsert({ where: { nombre }, update: {}, create: { nombre } })
  }

  // Responsables: solo si no hay ninguno (no tienen nombre único).
  const totalResponsables = await prisma.responsable.count()
  if (totalResponsables === 0) {
    for (const [nombreArea, nombres] of Object.entries(RESPONSABLES)) {
      const area = await prisma.area.findUnique({ where: { nombre: nombreArea } })
      if (!area) continue
      for (const nombre of nombres) {
        await prisma.responsable.create({ data: { nombre, areaId: area.id } })
      }
    }
  }

  // Máquinas: solo si no hay ninguna.
  const totalMaquinas = await prisma.maquina.count()
  if (totalMaquinas === 0) {
    for (const m of MAQUINAS) {
      await prisma.maquina.create({ data: { nombre: m.nombre, operario: m.operario } })
    }
  }

  const [areas, fincas, motivos, responsables, maquinas] = await Promise.all([
    prisma.area.count(),
    prisma.finca.count(),
    prisma.motivo.count(),
    prisma.responsable.count(),
    prisma.maquina.count(),
  ])
  console.log(
    `Seed listo: ${areas} áreas, ${fincas} fincas, ${motivos} motivos, ${responsables} responsables, ${maquinas} máquinas.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 4: Ejecutar el seed**

Run: `npm run db:seed`
Expected: imprime "Seed listo: 5 áreas, 3 fincas, 6 motivos, 13 responsables, 9 máquinas."

- [ ] **Step 5: Ejecutarlo otra vez para confirmar idempotencia**

Run: `npm run db:seed`
Expected: imprime los MISMOS conteos (no se duplican). Si los responsables se duplicaran, es un error.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts package.json package-lock.json
git commit -m "feat: seed de catálogos con datos reales del Excel"
```

---

## Task 3: Aritmética de semanas ISO (puro, TDD)

**Files:**
- Create: `src/dominio/semana.ts`
- Create: `src/dominio/semana.test.ts`

Las semanas son ISO 8601. 2026 empieza en jueves, así que **2026 tiene 53 semanas**. Implementamos pasando por fechas para que los saltos de año sean correctos.

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/dominio/semana.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { isoSemanaDeFecha, siguienteSemana, semanaAnterior } from './semana'

describe('isoSemanaDeFecha', () => {
  it('calcula la semana ISO de una fecha conocida', () => {
    // 2026-06-15 (lunes) es la semana 25 de 2026.
    expect(isoSemanaDeFecha(new Date(Date.UTC(2026, 5, 15)))).toEqual({ anio: 2026, semana: 25 })
    // 1 de enero de 2026 (jueves) es semana 1 de 2026.
    expect(isoSemanaDeFecha(new Date(Date.UTC(2026, 0, 1)))).toEqual({ anio: 2026, semana: 1 })
  })
})

describe('siguienteSemana', () => {
  it('avanza una semana', () => {
    expect(siguienteSemana(2026, 25)).toEqual({ anio: 2026, semana: 26 })
  })
  it('2026 tiene 53 semanas', () => {
    expect(siguienteSemana(2026, 52)).toEqual({ anio: 2026, semana: 53 })
  })
  it('cruza el cambio de año (2026 s53 -> 2027 s1)', () => {
    expect(siguienteSemana(2026, 53)).toEqual({ anio: 2027, semana: 1 })
  })
})

describe('semanaAnterior', () => {
  it('retrocede una semana', () => {
    expect(semanaAnterior(2026, 26)).toEqual({ anio: 2026, semana: 25 })
  })
  it('cruza el cambio de año (2027 s1 -> 2026 s53)', () => {
    expect(semanaAnterior(2027, 1)).toEqual({ anio: 2026, semana: 53 })
  })
})
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL (no se exporta `isoSemanaDeFecha`).

- [ ] **Step 3: Implementar**

Create `src/dominio/semana.ts`:
```typescript
export interface Semana {
  anio: number
  semana: number
}

const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000

// Semana ISO 8601 de una fecha (en UTC).
export function isoSemanaDeFecha(fecha: Date): Semana {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()))
  // Día de la semana con lunes = 0 ... domingo = 6.
  const diaLunes0 = (d.getUTCDay() + 6) % 7
  // Mover al jueves de esta semana (el jueves define el año ISO).
  d.setUTCDate(d.getUTCDate() - diaLunes0 + 3)
  const jueves = d.getTime()
  // Primer jueves del año ISO al que pertenece este jueves.
  const primerEnero = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const diaLunes0Ene = (primerEnero.getUTCDay() + 6) % 7
  primerEnero.setUTCDate(primerEnero.getUTCDate() - diaLunes0Ene + 3)
  const semana = 1 + Math.round((jueves - primerEnero.getTime()) / MS_POR_SEMANA)
  return { anio: d.getUTCFullYear(), semana }
}

// Lunes (fecha UTC) de una semana ISO dada.
function lunesDeIsoSemana(anio: number, semana: number): Date {
  const cuatroEnero = new Date(Date.UTC(anio, 0, 4))
  const diaLunes0 = (cuatroEnero.getUTCDay() + 6) % 7
  const lunesSemana1 = new Date(cuatroEnero)
  lunesSemana1.setUTCDate(cuatroEnero.getUTCDate() - diaLunes0)
  const lunes = new Date(lunesSemana1)
  lunes.setUTCDate(lunesSemana1.getUTCDate() + (semana - 1) * 7)
  return lunes
}

export function siguienteSemana(anio: number, semana: number): Semana {
  const lunes = lunesDeIsoSemana(anio, semana)
  lunes.setUTCDate(lunes.getUTCDate() + 7)
  return isoSemanaDeFecha(lunes)
}

export function semanaAnterior(anio: number, semana: number): Semana {
  const lunes = lunesDeIsoSemana(anio, semana)
  lunes.setUTCDate(lunes.getUTCDate() - 7)
  return isoSemanaDeFecha(lunes)
}

// Semana ISO actual (usa la fecha del sistema; no es determinista, por eso no se prueba).
export function semanaActual(): Semana {
  return isoSemanaDeFecha(new Date())
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `npm test`
Expected: PASS (todos los tests de semana, más los 16 anteriores de métricas).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/semana.ts src/dominio/semana.test.ts
git commit -m "feat: aritmética de semanas ISO (TDD)"
```

---

## Task 4: `duplicarActividades` (puro, TDD)

**Files:**
- Create: `src/dominio/programacion.ts`
- Create: `src/dominio/programacion.test.ts`

Regla: duplicar conserva la PLANEACIÓN (día, turno, descripción, área, finca, responsable y campos de maquinaria) y reinicia el SEGUIMIENTO. El borrador resultante no incluye estado/motivo/nota/reprogramación porque al crearse toman sus valores por defecto (PENDIENTE, etc.).

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/dominio/programacion.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { duplicarActividades } from './programacion'
import type { Actividad } from './tipos'

function act(parcial: Partial<Actividad>): Actividad {
  return {
    id: 'x', anio: 2026, semana: 25, dia: 1,
    areaId: 'a', fincaId: 'f', responsableId: 'r',
    descripcion: 'Siembra', turno: '7am-4pm', estado: 'CUMPLIDA',
    motivoId: 'm1', nota: 'ok', vecesReprogramada: 2, origenId: 'viejo',
    maquinaId: null, areaTareaId: null, horas: null, hectareas: null, planB: null,
    ...parcial,
  }
}

describe('duplicarActividades', () => {
  it('copia la planeación a la semana destino y reinicia el seguimiento', () => {
    const origen = [act({ id: '1', descripcion: 'Siembra', dia: 2, turno: '7am-4pm' })]
    const [b] = duplicarActividades(origen, 2026, 26)
    expect(b).toEqual({
      anio: 2026,
      semana: 26,
      dia: 2,
      areaId: 'a',
      fincaId: 'f',
      responsableId: 'r',
      descripcion: 'Siembra',
      turno: '7am-4pm',
      maquinaId: null,
      areaTareaId: null,
      horas: null,
      hectareas: null,
      planB: null,
    })
  })

  it('conserva los campos de maquinaria', () => {
    const origen = [
      act({ maquinaId: 'maq1', areaTareaId: 'maiz', horas: 8, hectareas: 10, planB: 'Estercolero' }),
    ]
    const [b] = duplicarActividades(origen, 2027, 1)
    expect(b.maquinaId).toBe('maq1')
    expect(b.areaTareaId).toBe('maiz')
    expect(b.horas).toBe(8)
    expect(b.hectareas).toBe(10)
    expect(b.planB).toBe('Estercolero')
    expect(b.anio).toBe(2027)
    expect(b.semana).toBe(1)
  })

  it('duplica todas las actividades de la lista', () => {
    const origen = [act({ id: '1' }), act({ id: '2' }), act({ id: '3' })]
    expect(duplicarActividades(origen, 2026, 26)).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL (no se exporta `duplicarActividades`).

- [ ] **Step 3: Implementar**

Create `src/dominio/programacion.ts`:
```typescript
import type { Actividad } from './tipos'

// Datos necesarios para crear una actividad nueva (sin seguimiento ni id).
export interface BorradorActividad {
  anio: number
  semana: number
  dia: number
  areaId: string
  fincaId: string
  responsableId: string
  descripcion: string
  turno: string
  maquinaId: string | null
  areaTareaId: string | null
  horas: number | null
  hectareas: number | null
  planB: string | null
}

// Crea borradores para una semana destino a partir de actividades existentes.
// Conserva la planeación; el seguimiento (estado, motivo, nota, reprogramación)
// se reinicia al crear (toma los valores por defecto).
export function duplicarActividades(
  actividades: Actividad[],
  anioDestino: number,
  semanaDestino: number,
): BorradorActividad[] {
  return actividades.map((a) => ({
    anio: anioDestino,
    semana: semanaDestino,
    dia: a.dia,
    areaId: a.areaId,
    fincaId: a.fincaId,
    responsableId: a.responsableId,
    descripcion: a.descripcion,
    turno: a.turno,
    maquinaId: a.maquinaId ?? null,
    areaTareaId: a.areaTareaId ?? null,
    horas: a.horas ?? null,
    hectareas: a.hectareas ?? null,
    planB: a.planB ?? null,
  }))
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/programacion.ts src/dominio/programacion.test.ts
git commit -m "feat: duplicarActividades (TDD)"
```

---

## Task 5: Repositorio de datos

**Files:**
- Create: `src/datos/repositorio.ts`

Funciones finas sobre Prisma. No llevan tests unitarios (ver estrategia de pruebas); se verifican corriendo la app.

- [ ] **Step 1: Implementar el repositorio**

```typescript
import { prisma } from './prisma'
import { duplicarActividades } from '@/dominio/programacion'
import type { BorradorActividad } from '@/dominio/programacion'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'

export function listarAreas() {
  return prisma.area.findMany({ orderBy: { nombre: 'asc' } })
}

export function listarFincas() {
  return prisma.finca.findMany({ orderBy: { nombre: 'asc' } })
}

export function listarMotivos() {
  return prisma.motivo.findMany({ orderBy: { nombre: 'asc' } })
}

export function listarMaquinas() {
  return prisma.maquina.findMany({ orderBy: { nombre: 'asc' } })
}

export function listarResponsablesPorArea(areaId: string) {
  return prisma.responsable.findMany({ where: { areaId }, orderBy: { nombre: 'asc' } })
}

export function listarActividades(areaId: string, anio: number, semana: number) {
  return prisma.actividad.findMany({
    where: { areaId, anio, semana },
    include: { responsable: true, finca: true, motivo: true, maquina: true, areaTarea: true },
    orderBy: [{ dia: 'asc' }],
  })
}

export function crearActividad(datos: BorradorActividad) {
  return prisma.actividad.create({ data: datos })
}

export function eliminarActividad(id: string) {
  return prisma.actividad.delete({ where: { id } })
}

// Duplica las actividades de una semana origen hacia la semana destino del mismo área.
export async function duplicarSemana(
  areaId: string,
  anioOrigen: number,
  semanaOrigen: number,
  anioDestino: number,
  semanaDestino: number,
): Promise<number> {
  const origen = await prisma.actividad.findMany({ where: { areaId, anio: anioOrigen, semana: semanaOrigen } })
  const borradores = duplicarActividades(origen as unknown as ActividadDominio[], anioDestino, semanaDestino)
  if (borradores.length === 0) return 0
  await prisma.$transaction(borradores.map((b) => prisma.actividad.create({ data: b })))
  return borradores.length
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat: repositorio de datos (catálogos y actividades)"
```

---

## Task 6: Pantalla "Programar Semana"

**Files:**
- Create: `src/app/programar/acciones.ts`
- Create: `src/app/programar/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Crear las Server Actions**

Create `src/app/programar/acciones.ts`:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { crearActividad, eliminarActividad, duplicarSemana } from '@/datos/repositorio'
import { semanaAnterior } from '@/dominio/semana'

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}
function numeroOpcional(form: FormData, clave: string): number | null {
  const v = texto(form, clave)
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function textoOpcional(form: FormData, clave: string): string | null {
  const v = texto(form, clave)
  return v === '' ? null : v
}

export async function crearActividadAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  await crearActividad({
    areaId,
    anio,
    semana,
    dia: Number(texto(form, 'dia')),
    fincaId: texto(form, 'fincaId'),
    responsableId: texto(form, 'responsableId'),
    descripcion: texto(form, 'descripcion'),
    turno: texto(form, 'turno'),
    maquinaId: textoOpcional(form, 'maquinaId'),
    areaTareaId: textoOpcional(form, 'areaTareaId'),
    horas: numeroOpcional(form, 'horas'),
    hectareas: numeroOpcional(form, 'hectareas'),
    planB: textoOpcional(form, 'planB'),
  })
  revalidatePath('/programar')
}

export async function eliminarActividadAccion(form: FormData) {
  await eliminarActividad(texto(form, 'id'))
  revalidatePath('/programar')
}

export async function duplicarSemanaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  const previa = semanaAnterior(anio, semana)
  await duplicarSemana(areaId, previa.anio, previa.semana, anio, semana)
  revalidatePath('/programar')
}
```

- [ ] **Step 2: Crear la página**

Create `src/app/programar/page.tsx`:
```tsx
import Link from 'next/link'
import {
  listarAreas,
  listarFincas,
  listarMaquinas,
  listarResponsablesPorArea,
  listarActividades,
} from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual } from '@/dominio/semana'
import { crearActividadAccion, eliminarActividadAccion, duplicarSemanaAccion } from './acciones'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default async function ProgramarPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; anio?: string; semana?: string }>
}) {
  const sp = await searchParams
  const areas = await listarAreas()
  if (areas.length === 0) {
    return (
      <main className="p-8">
        <p className="text-gray-600">No hay áreas. Corre <code>npm run db:seed</code> para sembrar los catálogos.</p>
      </main>
    )
  }

  const areaId = sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id
  const areaActual = areas.find((a) => a.id === areaId)!
  const hoy = semanaActual()
  const anio = sp.anio ? Number(sp.anio) : hoy.anio
  const semana = sp.semana ? Number(sp.semana) : hoy.semana

  const [responsables, fincas, maquinas, actividades] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarFincas(),
    listarMaquinas(),
    listarActividades(areaId, anio, semana),
  ])

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/programar?area=${a}&anio=${an}&semana=${se}`
  const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Programar semana</h1>

      {/* Selector de área */}
      <div className="mb-3 flex flex-wrap gap-2">
        {areas.map((a) => (
          <Link
            key={a.id}
            href={url(a.id, anio, semana)}
            className={`rounded-full px-3 py-1 text-sm ${
              a.id === areaId ? 'bg-[#11603a] text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {a.nombre}
          </Link>
        ))}
      </div>

      {/* Navegación de semana */}
      <div className="mb-5 flex items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">
          ← Semana {previa.semana}
        </Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">
          Semana {proxima.semana} →
        </Link>
        <form action={duplicarSemanaAccion} className="ml-auto">
          <input type="hidden" name="areaId" value={areaId} />
          <input type="hidden" name="anio" value={anio} />
          <input type="hidden" name="semana" value={semana} />
          <button className="rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200">
            ⧉ Duplicar semana anterior
          </button>
        </form>
      </div>

      {/* Grilla: responsables × días */}
      {responsables.length === 0 ? (
        <p className="mb-6 text-sm text-gray-500">Esta área no tiene responsables. Las actividades se listan abajo.</p>
      ) : (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-gray-50 p-2 text-left">Responsable</th>
                {DIAS.map((d) => (
                  <th key={d} className="border bg-gray-50 p-2 text-left">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {responsables.map((r) => (
                <tr key={r.id}>
                  <td className="border p-2 font-medium">{r.nombre}</td>
                  {DIAS.map((_, i) => {
                    const dia = i + 1
                    const celdas = actividades.filter((a) => a.responsableId === r.id && a.dia === dia)
                    return (
                      <td key={dia} className="border p-2 align-top">
                        {celdas.map((a) => (
                          <div key={a.id} className="mb-1 rounded bg-green-50 p-1">
                            <div>{a.descripcion}</div>
                            {a.turno && <div className="text-xs text-gray-500">{a.turno}</div>}
                            <form action={eliminarActividadAccion} className="inline">
                              <input type="hidden" name="id" value={a.id} />
                              <button className="text-xs text-red-600 hover:underline">eliminar</button>
                            </form>
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulario para agregar actividad */}
      <h2 className="mb-2 text-lg font-semibold">Agregar actividad</h2>
      <form action={crearActividadAccion} className="grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3">
        <input type="hidden" name="areaId" value={areaId} />
        <input type="hidden" name="anio" value={anio} />
        <input type="hidden" name="semana" value={semana} />

        <label className="flex flex-col text-sm">
          Responsable
          <select name="responsableId" required className="rounded border p-2">
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          Día
          <select name="dia" required className="rounded border p-2">
            {DIAS.map((d, i) => (
              <option key={d} value={i + 1}>{d}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          Finca
          <select name="fincaId" required className="rounded border p-2">
            {fincas.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </select>
        </label>

        <label className="col-span-2 flex flex-col text-sm md:col-span-2">
          Actividad
          <input name="descripcion" required className="rounded border p-2" placeholder="Ej: Siembra de pasto" />
        </label>

        <label className="flex flex-col text-sm">
          Turno
          <input name="turno" className="rounded border p-2" placeholder="7am-4pm" />
        </label>

        {esMaquinaria && (
          <>
            <label className="flex flex-col text-sm">
              Máquina
              <select name="maquinaId" className="rounded border p-2">
                <option value="">—</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}{m.operario ? ` (${m.operario})` : ''}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              Área de la tarea
              <select name="areaTareaId" className="rounded border p-2">
                <option value="">—</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              Horas (H.R)
              <input name="horas" type="number" step="0.1" className="rounded border p-2" />
            </label>
            <label className="flex flex-col text-sm">
              Hectáreas (ha)
              <input name="hectareas" type="number" step="0.1" className="rounded border p-2" />
            </label>
            <label className="flex flex-col text-sm">
              Plan B
              <input name="planB" className="rounded border p-2" />
            </label>
          </>
        )}

        <div className="col-span-2 md:col-span-3">
          <button className="rounded bg-[#11603a] px-4 py-2 text-sm font-semibold text-white">
            + Agregar
          </button>
        </div>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Enlazar desde la página de inicio**

Replace the entire content of `src/app/page.tsx` with:
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/programar')
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: "Compiled successfully" sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/app/programar/acciones.ts src/app/programar/page.tsx src/app/page.tsx
git commit -m "feat: pantalla Programar Semana (grilla, agregar, eliminar, duplicar)"
```

---

## Task 7: Verificación funcional

**Files:** (ninguno — solo verificación)

- [ ] **Step 1: Asegurar datos sembrados**

Run: `npm run db:seed`
Expected: conteos de catálogos (no error).

- [ ] **Step 2: Tests puros**

Run: `npm test`
Expected: PASS — métricas (16) + semana + programacion.

- [ ] **Step 3: Build limpio**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 4: Levantar el servidor y probar la página**

Run (en segundo plano): `npm run dev`
Luego verificar con: `curl -s "http://localhost:3000/programar" | grep -i "Programar semana"`
Expected: la respuesta contiene "Programar semana". Detener el servidor al terminar.

> Nota: la prueba real de agregar/eliminar/duplicar se hace en el navegador con la skill `verify`/`run` después del plan; este paso solo confirma que la página responde.

---

## Verificación final del Plan 2

- [ ] `npm test` → PASS (métricas + semana + programacion).
- [ ] `npm run build` → "Compiled successfully".
- [ ] `npm run db:seed` → catálogos sembrados (idempotente).
- [ ] `/programar` responde y muestra el selector de área, la navegación de semana, la grilla y el formulario.

Al terminar este plan: un coordinador puede entrar a `/programar`, elegir su área, navegar semanas, ver la grilla de responsables × días, agregar y eliminar actividades, y duplicar la semana anterior. El Plan 3 agrega el registro de cumplimiento y el flujo de reprogramación.

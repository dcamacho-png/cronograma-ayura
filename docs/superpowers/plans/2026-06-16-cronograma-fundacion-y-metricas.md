# Cronograma — Plan 1: Fundación + Motor de Métricas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar corriendo el esqueleto de la app web (Next.js + TypeScript) y construir, con TDD, el módulo de dominio que calcula todas las métricas del cronograma (% de cumplimiento, ranking de responsables, % de reprogramadas, color de semáforo y tendencia semanal), más el esquema de base de datos.

**Architecture:** App Next.js (App Router, carpeta `src/`). La lógica de negocio vive en un módulo de dominio **puro** (`src/dominio/`) sin dependencias de UI ni de base de datos, para poder probarlo de forma aislada. La persistencia se define con Prisma sobre SQLite en desarrollo (migrable a Postgres/Supabase en el Plan 6).

**Tech Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Vitest (tests) · Prisma + SQLite.

---

## Estructura de archivos (Plan 1)

- Create: `src/dominio/tipos.ts` — tipos del dominio (Estado, Actividad, etc.). Sin lógica.
- Create: `src/dominio/metricas.ts` — funciones puras de cálculo. Una responsabilidad: calcular.
- Create: `src/dominio/metricas.test.ts` — tests de las funciones puras.
- Create: `prisma/schema.prisma` — esquema de datos (catálogos + actividades).
- Modify: `package.json` — script de tests.
- (Generados por el andamiaje) `src/app/`, `tailwind.config.ts`, `tsconfig.json`, etc.

> **Convención:** todo el código (nombres de tipos, funciones, variables) va en **español**, para que sea legible por el equipo.

---

## Task 1: Andamiaje del proyecto Next.js

**Files:**
- Create: árbol de Next.js en la raíz del repo.

- [ ] **Step 1: Resguardar carpetas existentes para que el andamiaje no falle**

`create-next-app` aborta si la carpeta tiene archivos que no reconoce (`docs/`, `mockups/`).

Run:
```bash
mkdir -p .hold && mv docs mockups .hold/
```
Expected: `docs/` y `mockups/` quedan dentro de `.hold/`.

- [ ] **Step 2: Crear la app Next.js en la carpeta actual**

Run:
```bash
npx create-next-app@latest . --yes --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```
Expected: termina con "Success! Created ..."; aparecen `package.json`, `src/app/`, `tailwind.config.*`, `tsconfig.json`.

- [ ] **Step 3: Restaurar las carpetas resguardadas**

Run:
```bash
mv .hold/docs .hold/mockups . && rmdir .hold
```
Expected: `docs/` y `mockups/` vuelven a la raíz.

- [ ] **Step 4: Verificar que la app arranca**

Run:
```bash
npm run build
```
Expected: build termina sin errores ("Compiled successfully").

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: andamiaje inicial Next.js + TypeScript + Tailwind"
```

---

## Task 2: Configurar Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (script `test`)

- [ ] **Step 1: Instalar Vitest**

Run:
```bash
npm install -D vitest
```
Expected: `vitest` aparece en `devDependencies`.

- [ ] **Step 2: Crear `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Agregar el script de test en `package.json`**

En la sección `"scripts"`, agregar:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Crear un test temporal para verificar la configuración**

Create `src/dominio/sanity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

describe('configuración', () => {
  it('suma', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Ejecutar los tests**

Run: `npm test`
Expected: PASS, 1 test pasa.

- [ ] **Step 6: Borrar el test temporal y commit**

```bash
rm src/dominio/sanity.test.ts
git add -A
git commit -m "chore: configurar Vitest"
```

---

## Task 3: Tipos del dominio

**Files:**
- Create: `src/dominio/tipos.ts`

- [ ] **Step 1: Escribir los tipos**

```typescript
// Estados posibles de una actividad.
export type Estado =
  | 'PENDIENTE'
  | 'CUMPLIDA'
  | 'PARCIAL'
  | 'NO_CUMPLIDA'
  | 'REPROGRAMADA'

// Una actividad del cronograma.
export interface Actividad {
  id: string
  anio: number
  semana: number          // número de semana del año (1..53)
  dia: number             // 1 = lunes ... 7 = domingo
  areaId: string          // área a la que pertenece la programación
  fincaId: string         // etiqueta de ubicación
  responsableId: string
  descripcion: string
  turno: string
  estado: Estado
  motivoId: string | null
  nota: string | null
  vecesReprogramada: number   // 0 si nunca se ha arrastrado
  origenId: string | null     // id de la actividad de la que proviene (reprogramación)

  // Campos específicos de maquinaria (opcionales en otras áreas):
  maquinaId?: string | null
  areaTareaId?: string | null // a qué área de producción le sirve la tarea
  horas?: number | null
  hectareas?: number | null
  planB?: string | null
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/dominio/tipos.ts
git commit -m "feat: tipos del dominio (Estado, Actividad)"
```

---

## Task 4: `pesoEstado` y `porcentajeCumplimiento`

**Files:**
- Create: `src/dominio/metricas.ts`
- Create: `src/dominio/metricas.test.ts`

Regla (spec §6): Cumplida = 1, Parcial = 0.5, No cumplida = 0. Pendiente y Reprogramada **no se evalúan** (se excluyen del cálculo). El porcentaje es el promedio de los pesos de las actividades evaluadas, redondeado a entero. Si no hay actividades evaluadas, devuelve `null`.

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/dominio/metricas.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { pesoEstado, porcentajeCumplimiento } from './metricas'
import type { Actividad } from './tipos'

// Ayuda para crear actividades de prueba con valores por defecto.
function act(parcial: Partial<Actividad>): Actividad {
  return {
    id: 'x', anio: 2026, semana: 25, dia: 1,
    areaId: 'a', fincaId: 'f', responsableId: 'r',
    descripcion: '', turno: '', estado: 'PENDIENTE',
    motivoId: null, nota: null, vecesReprogramada: 0, origenId: null,
    ...parcial,
  }
}

describe('pesoEstado', () => {
  it('asigna 1 a CUMPLIDA, 0.5 a PARCIAL, 0 a NO_CUMPLIDA', () => {
    expect(pesoEstado('CUMPLIDA')).toBe(1)
    expect(pesoEstado('PARCIAL')).toBe(0.5)
    expect(pesoEstado('NO_CUMPLIDA')).toBe(0)
  })
  it('devuelve null para PENDIENTE y REPROGRAMADA (no se evalúan)', () => {
    expect(pesoEstado('PENDIENTE')).toBeNull()
    expect(pesoEstado('REPROGRAMADA')).toBeNull()
  })
})

describe('porcentajeCumplimiento', () => {
  it('promedia los pesos de las actividades evaluadas', () => {
    const acts = [
      act({ estado: 'CUMPLIDA' }),
      act({ estado: 'PARCIAL' }),
      act({ estado: 'NO_CUMPLIDA' }),
    ]
    // (1 + 0.5 + 0) / 3 = 0.5 -> 50
    expect(porcentajeCumplimiento(acts)).toBe(50)
  })
  it('excluye PENDIENTE y REPROGRAMADA del cálculo', () => {
    const acts = [
      act({ estado: 'CUMPLIDA' }),
      act({ estado: 'PENDIENTE' }),
      act({ estado: 'REPROGRAMADA' }),
    ]
    // solo cuenta la CUMPLIDA -> 100
    expect(porcentajeCumplimiento(acts)).toBe(100)
  })
  it('devuelve null cuando no hay actividades evaluadas', () => {
    expect(porcentajeCumplimiento([act({ estado: 'PENDIENTE' })])).toBeNull()
    expect(porcentajeCumplimiento([])).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL ("does not provide an export named 'pesoEstado'").

- [ ] **Step 3: Implementar**

Create `src/dominio/metricas.ts`:
```typescript
import type { Actividad, Estado } from './tipos'

// Peso de un estado para el cálculo de cumplimiento.
// null = el estado no se evalúa (PENDIENTE, REPROGRAMADA).
export function pesoEstado(estado: Estado): number | null {
  switch (estado) {
    case 'CUMPLIDA': return 1
    case 'PARCIAL': return 0.5
    case 'NO_CUMPLIDA': return 0
    default: return null
  }
}

// % de cumplimiento (0..100) sobre las actividades evaluadas.
// Devuelve null si no hay ninguna actividad evaluada.
export function porcentajeCumplimiento(actividades: Actividad[]): number | null {
  const pesos = actividades
    .map((a) => pesoEstado(a.estado))
    .filter((p): p is number => p !== null)
  if (pesos.length === 0) return null
  const suma = pesos.reduce((acc, p) => acc + p, 0)
  return Math.round((suma / pesos.length) * 100)
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `npm test`
Expected: PASS (todos los tests de `pesoEstado` y `porcentajeCumplimiento`).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts
git commit -m "feat: pesoEstado y porcentajeCumplimiento (TDD)"
```

---

## Task 5: `estrellas` y `rankingResponsables`

**Files:**
- Modify: `src/dominio/metricas.ts`
- Modify: `src/dominio/metricas.test.ts`

Regla: las estrellas (1..5) traducen el % a escala visual: ≥90→5, ≥75→4, ≥60→3, ≥40→2, resto→1. El ranking agrupa por responsable, calcula su % (excluyendo a quien no tenga actividades evaluadas), ordena de mayor a menor, y devuelve los 3 mejores (`top`) y los 3 más bajos (`bajos`, en orden de mayor a menor % dentro de ese grupo).

- [ ] **Step 1: Agregar los tests que fallan**

Agregar al final de `src/dominio/metricas.test.ts`:
```typescript
import { estrellas, rankingResponsables } from './metricas'

describe('estrellas', () => {
  it('traduce el % a escala de 1 a 5', () => {
    expect(estrellas(100)).toBe(5)
    expect(estrellas(90)).toBe(5)
    expect(estrellas(80)).toBe(4)
    expect(estrellas(60)).toBe(3)
    expect(estrellas(45)).toBe(2)
    expect(estrellas(10)).toBe(1)
  })
})

describe('rankingResponsables', () => {
  it('agrupa por responsable, ordena y separa top 3 y 3 más bajos', () => {
    const acts: Actividad[] = [
      act({ responsableId: 'A', estado: 'CUMPLIDA' }),   // A = 100
      act({ responsableId: 'B', estado: 'CUMPLIDA' }),
      act({ responsableId: 'B', estado: 'NO_CUMPLIDA' }), // B = 50
      act({ responsableId: 'C', estado: 'NO_CUMPLIDA' }), // C = 0
      act({ responsableId: 'D', estado: 'PARCIAL' }),     // D = 50
    ]
    const { top, bajos } = rankingResponsables(acts)
    expect(top.map((f) => f.responsableId)).toEqual(['A', 'B', 'D'])
    expect(top[0]).toEqual({ responsableId: 'A', porcentaje: 100, estrellas: 5 })
    // los 3 más bajos en orden de mayor a menor %
    expect(bajos.map((f) => f.responsableId)).toEqual(['B', 'D', 'C'])
    expect(bajos[2]).toEqual({ responsableId: 'C', porcentaje: 0, estrellas: 1 })
  })

  it('ignora responsables sin actividades evaluadas', () => {
    const acts: Actividad[] = [
      act({ responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ responsableId: 'Z', estado: 'PENDIENTE' }),
    ]
    const { top } = rankingResponsables(acts)
    expect(top.map((f) => f.responsableId)).toEqual(['A'])
  })
})
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL ("does not provide an export named 'estrellas'").

- [ ] **Step 3: Implementar**

Agregar al final de `src/dominio/metricas.ts`:
```typescript
// Traduce un % (0..100) a estrellas (1..5).
export function estrellas(porcentaje: number): number {
  if (porcentaje >= 90) return 5
  if (porcentaje >= 75) return 4
  if (porcentaje >= 60) return 3
  if (porcentaje >= 40) return 2
  return 1
}

export interface FilaRanking {
  responsableId: string
  porcentaje: number
  estrellas: number
}

// Ranking de responsables por % de cumplimiento.
// Devuelve los 3 mejores y los 3 más bajos (mayor a menor % en cada grupo).
export function rankingResponsables(
  actividades: Actividad[],
): { top: FilaRanking[]; bajos: FilaRanking[] } {
  const porResp = new Map<string, Actividad[]>()
  for (const a of actividades) {
    const lista = porResp.get(a.responsableId) ?? []
    lista.push(a)
    porResp.set(a.responsableId, lista)
  }

  const filas: FilaRanking[] = []
  for (const [responsableId, acts] of porResp) {
    const pct = porcentajeCumplimiento(acts)
    if (pct === null) continue
    filas.push({ responsableId, porcentaje: pct, estrellas: estrellas(pct) })
  }

  filas.sort((a, b) => b.porcentaje - a.porcentaje)
  return {
    top: filas.slice(0, 3),
    bajos: filas.slice(-3),
  }
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `npm test`
Expected: PASS (todos los tests).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts
git commit -m "feat: estrellas y rankingResponsables (TDD)"
```

---

## Task 6: `porcentajeReprogramadas` y `colorSemaforo`

**Files:**
- Modify: `src/dominio/metricas.ts`
- Modify: `src/dominio/metricas.test.ts`

Regla (spec §6): % de reprogramadas = (actividades con `vecesReprogramada > 0`) / total, redondeado. Color por veces reprogramada: 0→`ninguno`, 1→`verde`, 2→`amarillo`, 3→`naranja`, 4 o más→`rojo`.

- [ ] **Step 1: Agregar los tests que fallan**

Agregar al final de `src/dominio/metricas.test.ts`:
```typescript
import { porcentajeReprogramadas, colorSemaforo } from './metricas'

describe('porcentajeReprogramadas', () => {
  it('calcula el % de actividades con vecesReprogramada > 0', () => {
    const acts = [
      act({ vecesReprogramada: 0 }),
      act({ vecesReprogramada: 1 }),
      act({ vecesReprogramada: 3 }),
      act({ vecesReprogramada: 0 }),
    ]
    // 2 de 4 -> 50
    expect(porcentajeReprogramadas(acts)).toBe(50)
  })
  it('devuelve 0 con lista vacía', () => {
    expect(porcentajeReprogramadas([])).toBe(0)
  })
})

describe('colorSemaforo', () => {
  it('asigna color según las veces reprogramada', () => {
    expect(colorSemaforo(0)).toBe('ninguno')
    expect(colorSemaforo(1)).toBe('verde')
    expect(colorSemaforo(2)).toBe('amarillo')
    expect(colorSemaforo(3)).toBe('naranja')
    expect(colorSemaforo(4)).toBe('rojo')
    expect(colorSemaforo(7)).toBe('rojo')
  })
})
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL ("does not provide an export named 'porcentajeReprogramadas'").

- [ ] **Step 3: Implementar**

Agregar al final de `src/dominio/metricas.ts`:
```typescript
// % de actividades que son reprogramaciones (vecesReprogramada > 0).
export function porcentajeReprogramadas(actividades: Actividad[]): number {
  if (actividades.length === 0) return 0
  const reprog = actividades.filter((a) => a.vecesReprogramada > 0).length
  return Math.round((reprog / actividades.length) * 100)
}

export type ColorSemaforo = 'ninguno' | 'verde' | 'amarillo' | 'naranja' | 'rojo'

// Color de alerta según cuántas veces se ha reprogramado la actividad.
export function colorSemaforo(veces: number): ColorSemaforo {
  if (veces <= 0) return 'ninguno'
  if (veces === 1) return 'verde'
  if (veces === 2) return 'amarillo'
  if (veces === 3) return 'naranja'
  return 'rojo'
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts
git commit -m "feat: porcentajeReprogramadas y colorSemaforo (TDD)"
```

---

## Task 7: `cumplimientoPorArea` y `tendenciaSemanal`

**Files:**
- Modify: `src/dominio/metricas.ts`
- Modify: `src/dominio/metricas.test.ts`

Regla: `cumplimientoPorArea` agrupa por `areaId` y calcula el % de cada área. `tendenciaSemanal` agrupa por (`anio`,`semana`), calcula el % de cada semana y devuelve los puntos ordenados cronológicamente.

- [ ] **Step 1: Agregar los tests que fallan**

Agregar al final de `src/dominio/metricas.test.ts`:
```typescript
import { cumplimientoPorArea, tendenciaSemanal } from './metricas'

describe('cumplimientoPorArea', () => {
  it('calcula el % por cada área', () => {
    const acts = [
      act({ areaId: 'maiz', estado: 'CUMPLIDA' }),
      act({ areaId: 'maiz', estado: 'NO_CUMPLIDA' }),  // maiz = 50
      act({ areaId: 'riego', estado: 'CUMPLIDA' }),    // riego = 100
    ]
    const filas = cumplimientoPorArea(acts)
    expect(filas).toContainEqual({ areaId: 'maiz', porcentaje: 50 })
    expect(filas).toContainEqual({ areaId: 'riego', porcentaje: 100 })
  })
})

describe('tendenciaSemanal', () => {
  it('calcula el % por semana, ordenado cronológicamente', () => {
    const acts = [
      act({ anio: 2026, semana: 24, estado: 'CUMPLIDA' }),
      act({ anio: 2026, semana: 24, estado: 'NO_CUMPLIDA' }), // S24 = 50
      act({ anio: 2026, semana: 25, estado: 'CUMPLIDA' }),    // S25 = 100
    ]
    const puntos = tendenciaSemanal(acts)
    expect(puntos).toEqual([
      { anio: 2026, semana: 24, porcentaje: 50 },
      { anio: 2026, semana: 25, porcentaje: 100 },
    ])
  })
})
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL ("does not provide an export named 'cumplimientoPorArea'").

- [ ] **Step 3: Implementar**

Agregar al final de `src/dominio/metricas.ts`:
```typescript
export interface FilaArea {
  areaId: string
  porcentaje: number | null
}

// % de cumplimiento agrupado por área.
export function cumplimientoPorArea(actividades: Actividad[]): FilaArea[] {
  const porArea = new Map<string, Actividad[]>()
  for (const a of actividades) {
    const lista = porArea.get(a.areaId) ?? []
    lista.push(a)
    porArea.set(a.areaId, lista)
  }
  const filas: FilaArea[] = []
  for (const [areaId, acts] of porArea) {
    filas.push({ areaId, porcentaje: porcentajeCumplimiento(acts) })
  }
  return filas
}

export interface PuntoTendencia {
  anio: number
  semana: number
  porcentaje: number | null
}

// % de cumplimiento por semana, ordenado cronológicamente.
export function tendenciaSemanal(actividades: Actividad[]): PuntoTendencia[] {
  const porSemana = new Map<string, Actividad[]>()
  for (const a of actividades) {
    const clave = `${a.anio}-${a.semana}`
    const lista = porSemana.get(clave) ?? []
    lista.push(a)
    porSemana.set(clave, lista)
  }
  const puntos: PuntoTendencia[] = []
  for (const acts of porSemana.values()) {
    puntos.push({
      anio: acts[0].anio,
      semana: acts[0].semana,
      porcentaje: porcentajeCumplimiento(acts),
    })
  }
  puntos.sort((a, b) => a.anio - b.anio || a.semana - b.semana)
  return puntos
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `npm test`
Expected: PASS (toda la suite de métricas).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts
git commit -m "feat: cumplimientoPorArea y tendenciaSemanal (TDD)"
```

---

## Task 8: Esquema de base de datos (Prisma + SQLite)

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `.env` (cadena de conexión a SQLite)

- [ ] **Step 1: Instalar Prisma**

Run:
```bash
npm install -D prisma && npm install @prisma/client
```
Expected: `prisma` en devDependencies y `@prisma/client` en dependencies.

- [ ] **Step 2: Crear `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Area {
  id            String        @id @default(cuid())
  nombre        String        @unique
  actividades   Actividad[]   @relation("AreaDeActividad")
  tareasMaquina Actividad[]   @relation("AreaDeTarea")
  responsables  Responsable[]
}

model Finca {
  id          String      @id @default(cuid())
  nombre      String      @unique
  actividades Actividad[]
}

model Responsable {
  id          String      @id @default(cuid())
  nombre      String
  areaId      String
  area        Area        @relation(fields: [areaId], references: [id])
  actividades Actividad[]
}

model Maquina {
  id          String      @id @default(cuid())
  nombre      String
  operario    String?
  actividades Actividad[]
}

model Motivo {
  id          String      @id @default(cuid())
  nombre      String      @unique
  actividades Actividad[]
}

model Actividad {
  id                String   @id @default(cuid())
  anio              Int
  semana            Int
  dia               Int      // 1=lunes ... 7=domingo
  descripcion       String
  turno             String   @default("")
  estado            String   @default("PENDIENTE")
  nota              String?
  vecesReprogramada Int      @default(0)

  areaId        String
  area          Area    @relation("AreaDeActividad", fields: [areaId], references: [id])
  fincaId       String
  finca         Finca   @relation(fields: [fincaId], references: [id])
  responsableId String
  responsable   Responsable @relation(fields: [responsableId], references: [id])
  motivoId      String?
  motivo        Motivo?  @relation(fields: [motivoId], references: [id])

  // Reprogramación: relación a sí misma (la actividad de origen).
  origenId String?
  origen   Actividad?  @relation("Reprogramacion", fields: [origenId], references: [id])
  derivadas Actividad[] @relation("Reprogramacion")

  // Campos de maquinaria (opcionales).
  maquinaId  String?
  maquina    Maquina? @relation(fields: [maquinaId], references: [id])
  areaTareaId String?
  areaTarea   Area?   @relation("AreaDeTarea", fields: [areaTareaId], references: [id])
  horas      Float?
  hectareas  Float?
  planB      String?

  @@index([anio, semana, areaId])
}
```

- [ ] **Step 3: Configurar la cadena de conexión**

Crear/editar `.env` y agregar:
```
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 4: Generar la base de datos y el cliente**

Run:
```bash
npx prisma migrate dev --name inicial
```
Expected: crea `prisma/migrations/`, el archivo `prisma/dev.db`, y "Generated Prisma Client".

- [ ] **Step 5: Verificar que el esquema es válido**

Run:
```bash
npx prisma validate
```
Expected: "The schema is valid".

- [ ] **Step 6: Ignorar artefactos locales y commit**

Asegurar que `.gitignore` contiene `*.db`, `.env` y `/prisma/dev.db` (agregar las líneas que falten). Luego:
```bash
git add -A
git commit -m "feat: esquema de base de datos (Prisma + SQLite)"
```

---

## Verificación final del Plan 1

- [ ] **Tests del dominio pasan**

Run: `npm test`
Expected: PASS — todas las funciones de `metricas.ts` (pesoEstado, porcentajeCumplimiento, estrellas, rankingResponsables, porcentajeReprogramadas, colorSemaforo, cumplimientoPorArea, tendenciaSemanal).

- [ ] **El proyecto compila**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **El esquema es válido**

Run: `npx prisma validate`
Expected: "The schema is valid".

Al terminar este plan tendrás: la app Next.js corriendo, el motor de métricas completamente probado, y el modelo de datos listo para que el Plan 2 (catálogos + programación) construya las pantallas encima.

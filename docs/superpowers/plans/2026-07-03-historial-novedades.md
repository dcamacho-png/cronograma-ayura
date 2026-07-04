# Historial de novedades (log) — Implementation Plan (Entrega B, tanda 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir registrar VARIAS novedades (razón: día + motivo + observación) en una actividad, que se acumulan en un log visible en la tarjeta y se pueden borrar; sin cambiar el estado.

**Architecture:** Nuevo campo JSON aditivo `novedades` en `Actividad` (patrón como `avancePorLote`). Helpers puros para agregar/eliminar/normalizar; funciones de repo por grupo que escriben el log en las filas abiertas y espejan la última entrada en `motivoId`/`nota` (para no romper /resumen ni Excel); dos server actions; y un componente cliente que muestra el log con "+ Novedad" y ×.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Prisma/Postgres, Vitest, TypeScript.

**Alcance:** SOLO el historial de novedades. El rework de cierre/estados y el merge de reportes "No se hizo" son la tanda 2 (plan aparte). No se toca el flujo de estados aquí.

## Global Constraints

- Esta versión de Next.js difiere del conocimiento previo; ante dudas de API leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json`.
- Build (cuando el paso lo pida): `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully` y `Finished TypeScript`.
- Migraciones: carpeta timestamp en `prisma/migrations/` con `migration.sql` manual (patrón existente); NO correr `prisma migrate dev` (la DATABASE_URL local está vacía y no debe tocarse prod). `npx prisma generate` actualiza los tipos del cliente sin DB.
- El log NO cambia el estado de la actividad.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Esquema — campo `novedades` + migración aditiva

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260703120000_actividad_novedades/migration.sql`

**Interfaces:**
- Produces: `Actividad.novedades: Json?` disponible en el cliente Prisma.

- [ ] **Step 1: Añadir el campo al modelo**

En `prisma/schema.prisma`, dentro de `model Actividad`, junto a `avancePorLote Json?`, añadir:
```prisma
  novedades    Json?
```

- [ ] **Step 2: Crear la migración**

Crear `prisma/migrations/20260703120000_actividad_novedades/migration.sql` con:
```sql
-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN "novedades" JSONB;
```

- [ ] **Step 3: Regenerar el cliente y typecheck**

Run: `npx prisma generate`
Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores (el cliente ahora conoce `novedades`).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260703120000_actividad_novedades/
git commit -m "feat(db): campo aditivo Actividad.novedades (log de novedades)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Dominio — helpers de novedades + tests

**Files:**
- Create: `src/dominio/novedades.ts`
- Test: `src/dominio/novedades.test.ts`

**Interfaces:**
- Produces:
  - `type NovedadEntrada = { dia: number; motivoId: string | null; observacion: string | null }`
  - `normalizarNovedades(raw: unknown): NovedadEntrada[]`
  - `agregarNovedad(lista: NovedadEntrada[], entrada: NovedadEntrada): NovedadEntrada[]`
  - `eliminarNovedad(lista: NovedadEntrada[], index: number): NovedadEntrada[]`

- [ ] **Step 1: Write the failing tests**

Crear `src/dominio/novedades.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { normalizarNovedades, agregarNovedad, eliminarNovedad, type NovedadEntrada } from './novedades'

describe('normalizarNovedades', () => {
  it('null/no-array → []', () => {
    expect(normalizarNovedades(null)).toEqual([])
    expect(normalizarNovedades(undefined)).toEqual([])
    expect(normalizarNovedades({})).toEqual([])
  })
  it('filtra entradas mal formadas y conserva las válidas', () => {
    const raw = [{ dia: 2, motivoId: 'm1', observacion: 'x' }, { foo: 1 }]
    expect(normalizarNovedades(raw)).toEqual([{ dia: 2, motivoId: 'm1', observacion: 'x' }])
  })
})

describe('agregarNovedad', () => {
  it('agrega al final sin mutar', () => {
    const base: NovedadEntrada[] = [{ dia: 1, motivoId: null, observacion: 'a' }]
    const out = agregarNovedad(base, { dia: 2, motivoId: 'm1', observacion: 'b' })
    expect(out).toHaveLength(2)
    expect(out[1]).toEqual({ dia: 2, motivoId: 'm1', observacion: 'b' })
    expect(base).toHaveLength(1)
  })
})

describe('eliminarNovedad', () => {
  it('quita el índice indicado', () => {
    const base: NovedadEntrada[] = [
      { dia: 1, motivoId: null, observacion: 'a' },
      { dia: 2, motivoId: 'm1', observacion: 'b' },
    ]
    expect(eliminarNovedad(base, 0)).toEqual([{ dia: 2, motivoId: 'm1', observacion: 'b' }])
  })
  it('índice fuera de rango → sin cambios', () => {
    const base: NovedadEntrada[] = [{ dia: 1, motivoId: null, observacion: 'a' }]
    expect(eliminarNovedad(base, 5)).toBe(base)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/dominio/novedades.test.ts`
Expected: FAIL — módulo/exports no existen.

- [ ] **Step 3: Implement**

Crear `src/dominio/novedades.ts`:
```typescript
// Una novedad = una razón registrada en un día (motivo + observación). Se acumulan
// en una lista (log) por actividad. No cambian el estado.
export type NovedadEntrada = { dia: number; motivoId: string | null; observacion: string | null }

// Coerción del JSON guardado a una lista de novedades válidas (descarta lo mal formado).
export function normalizarNovedades(raw: unknown): NovedadEntrada[] {
  if (!Array.isArray(raw)) return []
  const out: NovedadEntrada[] = []
  for (const e of raw) {
    if (e && typeof e === 'object' && typeof (e as { dia?: unknown }).dia === 'number') {
      const x = e as { dia: number; motivoId?: unknown; observacion?: unknown }
      out.push({
        dia: x.dia,
        motivoId: typeof x.motivoId === 'string' ? x.motivoId : null,
        observacion: typeof x.observacion === 'string' ? x.observacion : null,
      })
    }
  }
  return out
}

export function agregarNovedad(lista: NovedadEntrada[], entrada: NovedadEntrada): NovedadEntrada[] {
  return [...lista, entrada]
}

export function eliminarNovedad(lista: NovedadEntrada[], index: number): NovedadEntrada[] {
  if (index < 0 || index >= lista.length) return lista
  return lista.filter((_, i) => i !== index)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dominio/novedades.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/novedades.ts src/dominio/novedades.test.ts
git commit -m "feat(dominio): helpers de novedades (normalizar/agregar/eliminar)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Repo — `agregarNovedadGrupo` y `eliminarNovedadGrupo`

**Files:**
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Consumes: `normalizarNovedades`, `agregarNovedad`, `eliminarNovedad`, `NovedadEntrada` (Task 2); `filasHermanas`, `prisma`, `Prisma`.
- Produces:
  - `agregarNovedadGrupo(id: string, entrada: { dia: number; motivoId: string | null; observacion: string | null }): Promise<true | null>`
  - `eliminarNovedadGrupo(id: string, index: number): Promise<true | null>`

- [ ] **Step 1: Add import**

En `src/datos/repositorio.ts`, añadir el import:
```typescript
import { normalizarNovedades, agregarNovedad, eliminarNovedad } from '@/dominio/novedades'
```

- [ ] **Step 2: Add the functions**

Insertar (p. ej. tras `eliminarAvanceEntradaGrupo`) en `src/datos/repositorio.ts`:
```typescript
// Agrega una novedad (razón) al log del grupo y la espeja como última en motivoId/nota
// (para que /resumen y el Excel sigan reflejando la novedad vigente). No cambia el estado.
export async function agregarNovedadGrupo(
  id: string,
  entrada: { dia: number; motivoId: string | null; observacion: string | null },
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const lista = agregarNovedad(normalizarNovedades(g.base.novedades), entrada)
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({
        where: { id: f.id },
        data: {
          novedades: lista as unknown as Prisma.InputJsonValue,
          motivoId: entrada.motivoId,
          nota: entrada.observacion,
        },
      })),
  )
  return true
}

// Elimina una novedad del log por índice y re-espeja la última restante en motivoId/nota
// (o las limpia si el log queda vacío).
export async function eliminarNovedadGrupo(id: string, index: number) {
  const g = await filasHermanas(id)
  if (!g) return null
  const lista = eliminarNovedad(normalizarNovedades(g.base.novedades), index)
  const ultima = lista[lista.length - 1] ?? null
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({
        where: { id: f.id },
        data: {
          novedades: lista as unknown as Prisma.InputJsonValue,
          motivoId: ultima?.motivoId ?? null,
          nota: ultima?.observacion ?? null,
        },
      })),
  )
  return true
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(repo): agregar/eliminar novedad del log por grupo (espeja la última en motivoId/nota)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Acciones — `agregarNovedadAccion` y `eliminarNovedadAccion`

**Files:**
- Modify: `src/app/cumplimiento/acciones.ts`

**Interfaces:**
- Consumes: `agregarNovedadGrupo`, `eliminarNovedadGrupo` (Task 3); helpers `texto`, `textoOpcional`, `bloqueadoPorPlazoActividad`, `revalidatePath`.
- Produces: `agregarNovedadAccion(form: FormData): Promise<void>`, `eliminarNovedadAccion(form: FormData): Promise<void>`.

- [ ] **Step 1: Add to the repo import**

Añadir `agregarNovedadGrupo` y `eliminarNovedadGrupo` al import existente de `@/datos/repositorio`.

- [ ] **Step 2: Add the actions**

Añadir (p. ej. tras `eliminarAvanceAccion`):
```typescript
export async function agregarNovedadAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  if (!id || !(dia >= 1 && dia <= 7)) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const motivoId = textoOpcional(form, 'motivoId')
  const observacion = textoOpcional(form, 'observacion')
  if (!motivoId && !observacion) return
  await agregarNovedadGrupo(id, { dia, motivoId, observacion })
  revalidatePath('/cumplimiento')
}

export async function eliminarNovedadAccion(form: FormData) {
  const id = texto(form, 'id')
  const index = Number(texto(form, 'index'))
  if (!id || !Number.isInteger(index) || index < 0) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await eliminarNovedadGrupo(id, index)
  revalidatePath('/cumplimiento')
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): acciones agregar/eliminar novedad

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: UI — componente `NovedadesLista` + wiring en `page.tsx`

**Files:**
- Create: `src/app/cumplimiento/novedades-lista.tsx`
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `agregarNovedadAccion`, `eliminarNovedadAccion` (Task 4); `normalizarNovedades` (Task 2); variables `cab`, `interactivo`, `bloqueado`, `motivos`, `DIAS`, `etiquetaDia` (en scope en `page.tsx`).
- Produces: `NovedadesLista` con props `{ actividadId: string; entradas: { index: number; dia: number; motivo: string; observacion: string }[]; editable: boolean; motivos: { id: string; nombre: string }[]; diaLabels: string[]; agregar: (f: FormData) => void | Promise<void>; eliminar: (f: FormData) => void | Promise<void> }`.

- [ ] **Step 1: Create the component**

Crear `src/app/cumplimiento/novedades-lista.tsx`:
```tsx
'use client'

import { useState } from 'react'

type Entrada = { index: number; dia: number; motivo: string; observacion: string }

// Log de novedades (razones) de una actividad. Muestra la lista con × para borrar y,
// si es editable, un "+ Novedad" que abre un mini-form (día + motivo + observación).
// Agregar una novedad NO cambia el estado de la actividad.
export function NovedadesLista({
  actividadId,
  entradas,
  editable,
  motivos,
  diaLabels,
  agregar,
  eliminar,
}: {
  actividadId: string
  entradas: Entrada[]
  editable: boolean
  motivos: { id: string; nombre: string }[]
  diaLabels: string[]
  agregar: (f: FormData) => void | Promise<void>
  eliminar: (f: FormData) => void | Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  if (entradas.length === 0 && !editable) return null

  return (
    <div className="flex flex-col gap-1 text-xs">
      {entradas.length > 0 && <span className="text-tierra">Novedades:</span>}
      {entradas.map((e) => (
        <div key={e.index} className="flex flex-wrap items-center gap-2">
          <span>{diaLabels[e.dia] ?? ''} · {e.motivo}{e.observacion ? ` — ${e.observacion}` : ''}</span>
          {editable && (
            <form action={eliminar} className="inline">
              <input type="hidden" name="id" value={actividadId} />
              <input type="hidden" name="index" value={e.index} />
              <button className="text-tierra hover:text-rose-700" title="borrar novedad">×</button>
            </form>
          )}
        </div>
      ))}
      {editable && (
        abierto ? (
          <form action={agregar} onSubmit={() => setAbierto(false)} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={actividadId} />
            <label className="flex flex-col">
              Día
              <select name="dia" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{diaLabels[d]}</option>))}
              </select>
            </label>
            <label className="flex flex-col">
              Motivo
              <select name="motivoId" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                <option value="">—</option>
                {motivos.map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
              </select>
            </label>
            <label className="flex flex-1 flex-col">
              Observación
              <input name="observacion" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
            <button className="rounded-lg border border-bosque px-2 py-1 font-semibold text-bosque hover:bg-arena/40">Agregar</button>
            <button type="button" onClick={() => setAbierto(false)} className="text-tierra underline">cancelar</button>
          </form>
        ) : (
          <button type="button" onClick={() => setAbierto(true)} className="self-start text-tierra underline">+ Novedad</button>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire in `page.tsx`**

En `src/app/cumplimiento/page.tsx`:
1. Imports: añadir `agregarNovedadAccion, eliminarNovedadAccion` al import de `./acciones`; `import { NovedadesLista } from './novedades-lista'`; y `normalizarNovedades` al import de `@/dominio/novedades` (o crear el import).
2. Dentro del IIFE (junto a `avances`, `etiquetaDia`, `interactivo`), añadir el resolutor de novedades a nombres de motivo:
```tsx
                  const mapaMotivos = new Map(motivos.map((m) => [m.id, m.nombre]))
                  const entradasNovedad = normalizarNovedades(cab.novedades).map((n, index) => ({
                    index,
                    dia: n.dia,
                    motivo: n.motivoId ? (mapaMotivos.get(n.motivoId) ?? '') : '',
                    observacion: n.observacion ?? '',
                  }))
```
3. Renderizar el componente dentro de la tarjeta (p. ej. tras el bloque de estado/resumen, antes de los controles interactivos):
```tsx
                      <NovedadesLista
                        actividadId={cab.id}
                        entradas={entradasNovedad}
                        editable={interactivo && !bloqueado}
                        motivos={motivos}
                        diaLabels={DIAS}
                        agregar={agregarNovedadAccion}
                        eliminar={eliminarNovedadAccion}
                      />
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/novedades-lista.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): historial de novedades en la tarjeta (+ Novedad / borrar)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras todas las tareas)

Desplegar preview (`npx vercel@latest deploy --yes`; el build corre `prisma migrate deploy` y aplica la columna `novedades`) y comprobar:
1. En una actividad abierta (Pendiente/Parcial), "+ Novedad" abre el mini-form (día + motivo + observación); al agregar, aparece en la lista "Novedades:" sin cambiar el estado.
2. Se pueden agregar varias; cada una tiene × para borrar.
3. Una actividad cerrada/terminal muestra el log en solo lectura (sin +Novedad ni ×).

Limpiar en Neon los datos de prueba creados.

## Nota

La tanda 2 (plan aparte) hará: cierre con elección que bloquea (campo `cerrada`), unificación visual "No se hizo" en reportes, y Parcial solo desde avances. Este plan deja el log listo para que el cierre también registre su razón ahí.

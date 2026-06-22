# Programar/editar turno solo en semanas futuras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir programar actividades (asignar y earmarcar en el banco) y editar el turno en la grilla SOLO para semanas futuras (antes de su lunes de inicio); la semana presente y las pasadas quedan en solo-lectura para esas acciones.

**Architecture:** Un helper `esSemanaFutura` (umbral único). En Programar el gate de "asignar" pasa a `futura` y la grilla recibe `turnoEditable`. En el banco el selector ofrece solo semanas futuras + guard en la acción. Sin migración.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 6, React 19, Tailwind v4, Vitest.

## Global Constraints

- Umbral: **semana futura** = estrictamente posterior a la semana ISO actual. Presente y pasadas → bloqueadas para programar/earmarcar/editar-turno.
- `esSemanaFutura(anio, semana, referencia)` = `anio > ref.anio || (anio === ref.anio && semana > ref.semana)`.
- Programar: la sección "📌 Tareas por asignar" se muestra solo si la semana es futura; si no, banner "🔒 Esta semana ya empezó — solo lectura. La programación se hace antes del lunes de inicio de la semana."
- Banco: el selector "Programar para" ofrece **8 semanas futuras** (desde la próxima), sin la etiqueta "(esta)". `programarTareaAccion` rechaza semanas no futuras.
- Grilla: `GrillaSemana` gana prop `turnoEditable` (default **false**). Si true → turno como mini-formulario inline (`actualizarActividadAccion`, conserva la descripción vía hidden, solo cambia el turno). Si false (PDF, presente/pasada) → turno como texto.
- `actualizarActividadAccion` YA existe (sin uso en UI); se reutiliza tal cual.
- Cumplimiento, Resumen, Tablero y otras áreas: sin cambios. Sin migración.
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` (y `npm test` en Task 1). NO ejecutar app/seed/build local (base en Neon).
- AGENTS.md: `GrillaSemana` es server component; el `<form>` inline con server action funciona sin `'use client'`.
- Spec: `docs/superpowers/specs/2026-06-21-bloqueo-semana-futura-y-editar-turno-design.md`.

## File Structure

- `src/dominio/semana.ts` (+`.test.ts`) — `esSemanaFutura`.
- `src/app/programar/page.tsx` — gate `futura` (banner + asignar) + `turnoEditable`.
- `src/app/programar/grilla-semana.tsx` — turno editable.
- `src/app/tareas/page.tsx` — selector de semanas solo futuras.
- `src/app/tareas/acciones.ts` — guard futura en `programarTareaAccion`.

---

## Task 1: Helper `esSemanaFutura` (TDD)

**Files:**
- Modify: `src/dominio/semana.ts`
- Modify: `src/dominio/semana.test.ts`

**Interfaces:**
- Produces: `esSemanaFutura(anio: number, semana: number, referencia: { anio: number; semana: number }): boolean`.

- [ ] **Step 1: Escribir el test (RED)**

En `src/dominio/semana.test.ts`, asegurar que `esSemanaFutura` esté en el import desde `./semana`, y agregar:

```ts
describe('esSemanaFutura', () => {
  const ref = { anio: 2026, semana: 25 }
  it('semana posterior del mismo año es futura', () => {
    expect(esSemanaFutura(2026, 26, ref)).toBe(true)
  })
  it('la misma semana NO es futura', () => {
    expect(esSemanaFutura(2026, 25, ref)).toBe(false)
  })
  it('semana anterior NO es futura', () => {
    expect(esSemanaFutura(2026, 24, ref)).toBe(false)
  })
  it('año siguiente es futura', () => {
    expect(esSemanaFutura(2027, 1, ref)).toBe(true)
  })
  it('año anterior NO es futura', () => {
    expect(esSemanaFutura(2025, 52, ref)).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/dominio/semana.test.ts`
Expected: FAIL — `esSemanaFutura` no exportado.

- [ ] **Step 3: Implementar (GREEN)**

En `src/dominio/semana.ts`, junto a `esSemanaPasada`, agregar:

```ts
// ¿La semana (anio, semana) es estrictamente posterior a la de referencia?
export function esSemanaFutura(anio: number, semana: number, referencia: Semana): boolean {
  return anio > referencia.anio || (anio === referencia.anio && semana > referencia.semana)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/dominio/semana.test.ts`
Expected: PASS (5 casos nuevos).

- [ ] **Step 5: Suite + gate**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: suite verde (+5 casos), sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/dominio/semana.ts src/dominio/semana.test.ts
git commit -m "feat(dominio): helper esSemanaFutura"
```

---

## Task 2: Programar — asignar y turno editable solo en semanas futuras

**Files:**
- Modify: `src/app/programar/grilla-semana.tsx`
- Modify: `src/app/programar/page.tsx`

**Interfaces:**
- Consumes: `esSemanaFutura` (Task 1); `actualizarActividadAccion` (ya existe en `src/app/programar/acciones.ts`).
- Produces: `GrillaSemana` con prop `turnoEditable?: boolean` (default false).

- [ ] **Step 1: `GrillaSemana` — turno editable**

En `src/app/programar/grilla-semana.tsx`:

1. Agregar el import (tras el de `InfoLotes`):

```tsx
import { actualizarActividadAccion } from './acciones'
```

2. Agregar la prop al destructure y al tipo del componente:

```tsx
export function GrillaSemana({
  areaNombre,
  semana,
  fechas,
  responsables,
  actividades,
  turnoEditable = false,
}: {
  areaNombre: string
  semana: number
  fechas: Date[]
  responsables: { id: string; nombre: string }[]
  actividades: ActividadGrilla[]
  turnoEditable?: boolean
}) {
```

3. Reemplazar la línea del turno `{a.turno && <div className="text-xs text-gray-500">{a.turno}</div>}` por:

```tsx
                            {turnoEditable ? (
                              <form action={actualizarActividadAccion} className="mt-0.5 flex items-center gap-1">
                                <input type="hidden" name="id" value={a.id} />
                                <input type="hidden" name="descripcion" value={a.descripcion} />
                                <input name="turno" defaultValue={a.turno} className="w-20 rounded border p-0.5 text-xs" />
                                <button className="rounded bg-[#11603a] px-1.5 text-xs font-semibold text-white">✓</button>
                              </form>
                            ) : (
                              a.turno && <div className="text-xs text-gray-500">{a.turno}</div>
                            )}
```

- [ ] **Step 2: `programar/page.tsx` — gate futura**

En `src/app/programar/page.tsx`:

1. En el import de `@/dominio/semana`, cambiar `esSemanaPasada` por `esSemanaFutura` (mantener `siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana, diaActual, esDiaPasado`):

```tsx
import { siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana, esSemanaFutura, diaActual, esDiaPasado } from '@/dominio/semana'
```

2. Reemplazar `const pasada = esSemanaPasada(anio, semana, hoy)` por:

```tsx
  const futura = esSemanaFutura(anio, semana, hoy)
```

3. Reemplazar el bloque del banner `{pasada && ( … Semana cerrada … )}` por:

```tsx
      {!futura && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          🔒 Esta semana ya empezó — solo lectura. La programación se hace antes del lunes de inicio de la semana.
        </div>
      )}
```

4. Reemplazar `{!pasada && porAsignar.length > 0 && (` por:

```tsx
      {futura && porAsignar.length > 0 && (
```

5. En el uso de `<GrillaSemana … />`, agregar la prop `turnoEditable={futura}`:

```tsx
        <GrillaSemana
          areaNombre={areaActual.nombre}
          semana={semana}
          fechas={fechas}
          responsables={responsablesActivos}
          actividades={actividadesCronograma}
          turnoEditable={futura}
        />
```

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (Si `lint` marca `esSemanaPasada` como import sin uso en otro archivo, NO aplica aquí; en `page.tsx` ya se quitó.)

- [ ] **Step 4: Commit**

```bash
git add src/app/programar/grilla-semana.tsx src/app/programar/page.tsx
git commit -m "feat(programar): asignar y editar turno solo en semanas futuras"
```

---

## Task 3: Banco — "Programar para" solo semanas futuras

**Files:**
- Modify: `src/app/tareas/page.tsx`
- Modify: `src/app/tareas/acciones.ts`

**Interfaces:**
- Consumes: `esSemanaFutura`, `semanaActual`, `siguienteSemana` (dominio).

- [ ] **Step 1: Selector de semanas solo futuras**

En `src/app/tareas/page.tsx`:

1. Reemplazar la construcción de `semanas` (empieza en la semana actual) por solo futuras:

```tsx
  const semanas: { anio: number; semana: number }[] = []
  let w = siguienteSemana(semanaActual().anio, semanaActual().semana)
  for (let i = 0; i < 8; i++) {
    semanas.push(w)
    w = siguienteSemana(w.anio, w.semana)
  }
```

(`siguienteSemana` y `semanaActual` ya están importados en este archivo.)

2. En la `<option>` del selector "Programar para", quitar el sufijo "(esta)":

```tsx
                          <option key={`${s.anio}-${s.semana}`} value={`${s.anio}-${s.semana}`}>
                            Semana {s.semana} · {s.anio}
                          </option>
```

(Se conserva la lógica `opciones.unshift(...)` que mantiene visible la semana ya seleccionada de una tarea.)

- [ ] **Step 2: Guard futura en `programarTareaAccion`**

En `src/app/tareas/acciones.ts`:

1. Agregar `esSemanaFutura` al import desde `@/dominio/semana` (junto a `esSemanaPasada, semanaActual`):

```ts
import { esSemanaPasada, esSemanaFutura, semanaActual } from '@/dominio/semana'
```

2. En `programarTareaAccion`, dentro del `else` que programa, agregar el guard:

```ts
    if (Number.isInteger(anio) && Number.isInteger(semana)) {
      if (!esSemanaFutura(anio, semana, semanaActual())) return
      await seleccionarTarea(id, anio, semana)
    }
```

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (Si `esSemanaPasada` quedara sin uso en `acciones.ts` tras el cambio, NO se quita salvo que lint lo marque: sigue usándose en `seleccionarTareaAccion`.)

- [ ] **Step 4: Commit**

```bash
git add src/app/tareas/page.tsx src/app/tareas/acciones.ts
git commit -m "feat(tareas): el banco solo permite programar para semanas futuras"
```

---

## Fase de despliegue (después del plan)

1. `git push` (respaldo).
2. **Deploy manual por CLI:** `npx vercel --prod --yes --scope ayura-llanos` (sin migración; solo build).
3. Verificación manual: en una semana futura, programar una tarea desde el banco, asignarla, y editar el turno en la grilla (✓). En la semana presente: ver "🔒 solo lectura", el banco sin esa semana, y el turno como texto en la grilla.

---

## Self-Review (autor del plan)

**1. Cobertura de la spec:**
- Helper `esSemanaFutura` + test → Task 1. ✓
- Programar: asignar solo futura + banner → Task 2 Step 2. ✓
- Grilla: turno editable (prop, default false) → Task 2 Step 1 + paso de `turnoEditable={futura}` en Step 2. ✓
- Banco: selector solo futuras + sin "(esta)" → Task 3 Step 1; guard en acción → Task 3 Step 2. ✓
- PDF/export sin cambios (default false) → no se toca exportar/page.tsx. ✓
- Sin migración; cumplimiento intacto. ✓

**2. Placeholders:** sin "TBD"/"etc."; código completo. ✓

**3. Consistencia de tipos:**
- `esSemanaFutura(anio, semana, ref)` definido en Task 1; usado en `programar/page.tsx` (Task 2) y `tareas/acciones.ts` (Task 3). ✓
- `GrillaSemana` prop `turnoEditable?: boolean` (Task 2 Step 1) ↔ `turnoEditable={futura}` (Task 2 Step 2). ✓
- `actualizarActividadAccion` (existente) usado en grilla con `id`/`descripcion`/`turno` (los campos que lee). ✓
- `semanas` futuras (Task 3 Step 1) coherente con la opción sin "(esta)" y con `opciones.unshift`. ✓
- `programarTareaAccion` guard usa `esSemanaFutura` + `semanaActual` (Task 3 Step 2). ✓

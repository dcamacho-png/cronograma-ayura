# Ordenar la hoja de cumplimiento por estado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la pantalla `/cumplimiento`, ordenar las tarjetas por estado (Pendientes → Parciales → No se hizo/Reprogramadas → Cumplidas) y, como desempate, por día; el Excel no cambia.

**Architecture:** Una función de dominio pura y testeable `ordenEstadoCumplimiento(estado)` en `src/dominio/metricas.ts` que mapea cada `Estado` a un rango numérico; `cumplimiento/page.tsx` la usa para cambiar el `.sort` final de los grupos (por rango de estado, luego por día). Sin cambios de esquema ni al Excel.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest.

## Global Constraints

- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json` (el tsc normal da falso-verde).
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
- Vitest: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run`.
- `Estado` = `'PENDIENTE' | 'CUMPLIDA' | 'PARCIAL' | 'NO_CUMPLIDA' | 'REPROGRAMADA'` (`@/dominio/tipos`).
- Orden por estado (rango): `PENDIENTE 0`, `PARCIAL 1`, `NO_CUMPLIDA 2`, `REPROGRAMADA 2`, `CUMPLIDA 3`. Desempate: primer día del grupo.
- Solo la PANTALLA `/cumplimiento`. NO tocar `cumplimiento/exportar` (Excel sigue por fecha) ni el esquema.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Orden por estado en `/cumplimiento`

**Files:**
- Modify: `src/dominio/metricas.ts`
- Test: `src/dominio/metricas.test.ts`
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `Estado` (`@/dominio/tipos`, ya usado en metricas.ts); `estadoActividad` (ya en `@/dominio/metricas`, ya importado en `page.tsx`).
- Produces: `ordenEstadoCumplimiento(estado: Estado): number`.

- [ ] **Step 1: Escribir los tests (fallan)**

Añadir al final de `src/dominio/metricas.test.ts`:
```ts
import { ordenEstadoCumplimiento } from './metricas'

describe('ordenEstadoCumplimiento', () => {
  it('rango por estado: Pendiente<Parcial<(NoCumplida=Reprogramada)<Cumplida', () => {
    expect(ordenEstadoCumplimiento('PENDIENTE')).toBe(0)
    expect(ordenEstadoCumplimiento('PARCIAL')).toBe(1)
    expect(ordenEstadoCumplimiento('NO_CUMPLIDA')).toBe(2)
    expect(ordenEstadoCumplimiento('REPROGRAMADA')).toBe(2)
    expect(ordenEstadoCumplimiento('CUMPLIDA')).toBe(3)
  })

  it('ordena una lista de estados de menos a más resuelto', () => {
    const estados = ['CUMPLIDA', 'PENDIENTE', 'REPROGRAMADA', 'PARCIAL', 'NO_CUMPLIDA'] as const
    const ordenados = [...estados].sort((a, b) => ordenEstadoCumplimiento(a) - ordenEstadoCumplimiento(b))
    expect(ordenados).toEqual(['PENDIENTE', 'PARCIAL', 'REPROGRAMADA', 'NO_CUMPLIDA', 'CUMPLIDA'])
  })
})
```
(Nota: en el segundo test, `REPROGRAMADA` y `NO_CUMPLIDA` comparten rango 2; `Array.prototype.sort` es estable, así que conservan su orden relativo de entrada — por eso el esperado los lista en ese orden.)

- [ ] **Step 2: Correr los tests → fallan**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run src/dominio/metricas.test.ts`
Expected: FAIL (`ordenEstadoCumplimiento` no existe).

- [ ] **Step 3: Implementar en `metricas.ts`**

Añadir al final de `src/dominio/metricas.ts` (el tipo `Estado` ya está importado en el archivo; si no lo estuviera, importarlo de `@/dominio/tipos`):
```ts
// Orden de las tarjetas en la hoja de cumplimiento: primero lo que requiere atención
// (sin avance), luego parciales, luego lo ya resuelto (No se hizo/Reprogramada) y al final
// las cumplidas. Menor número = más arriba.
export function ordenEstadoCumplimiento(estado: Estado): number {
  switch (estado) {
    case 'PENDIENTE':
      return 0
    case 'PARCIAL':
      return 1
    case 'NO_CUMPLIDA':
    case 'REPROGRAMADA':
      return 2
    case 'CUMPLIDA':
      return 3
  }
}
```

- [ ] **Step 4: Correr los tests → pasan**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run src/dominio/metricas.test.ts`
Expected: PASS (todos, incluidos los previos).

- [ ] **Step 5: Usar el orden en `page.tsx`**

En `src/app/cumplimiento/page.tsx`:
1. Añadir `ordenEstadoCumplimiento` al import de `@/dominio/metricas` (que hoy trae, entre otros, `estadoActividad`):
```ts
import { porcentajeCumplimiento, colorSemaforo, agruparPorActividad, diasDistintos, conteoEstadoActividades, tieneDiaPendiente, estadoActividad, etiquetaEstado, ordenEstadoCumplimiento } from '@/dominio/metricas'
```
2. Reemplazar el bloque de orden de `gruposActividad` (hoy):
```ts
  const gruposActividad = [...agruparPorActividad(actividades).values()]
    .map((dias) => [...dias].sort((a, b) => a.dia - b.dia))
    .sort((g1, g2) => g1[0].dia - g2[0].dia)
```
por (ordena primero por rango de estado del grupo y, en empate, por el primer día — conservando el `.map` interno que ordena los días de cada grupo):
```ts
  const gruposActividad = [...agruparPorActividad(actividades).values()]
    .map((dias) => [...dias].sort((a, b) => a.dia - b.dia))
    .sort((g1, g2) => {
      const rango =
        ordenEstadoCumplimiento(estadoActividad(g1 as unknown as { estado: Estado }[])) -
        ordenEstadoCumplimiento(estadoActividad(g2 as unknown as { estado: Estado }[]))
      return rango !== 0 ? rango : g1[0].dia - g2[0].dia
    })
```
   El cast `as unknown as { estado: Estado }[]` es el mismo patrón que ya usa `page.tsx` al llamar `estadoActividad` en el render (busca `estadoActividad(dias as unknown as`). Verificá que `Estado` esté importado en `page.tsx`; si no, añadir `import type { Estado } from '@/dominio/tipos'` (o reutilizar el import de tipos existente).

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 7: Vitest (regresión) + commit**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run` → todo verde.
```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): ordenar tarjetas por estado (pendiente→parcial→no se hizo/reprog→cumplida)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras la tarea)

Server local (`next dev`) + cookie firmada (ADMIN; ver memoria `verificacion-navegador`). SOLO LECTURA:

1. En `/cumplimiento` de un área con estados variados (p. ej. Ganadería ceba S27), las tarjetas quedan agrupadas de arriba a abajo: **Pendientes → Parciales → No se hizo/Reprogramadas → Cumplidas**; dentro de cada bloque, por día.
2. El Excel de `cumplimiento/exportar` sigue **por fecha** (sin cambios).

## Nota

Sin cambios de esquema ni de datos. Solo la pantalla; el Excel no se toca.

# Escala de actividades recurrentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en el Tablero mensual (`/tablero`) una sección con las actividades que se han arrastrado (reprogramadas/parciales), una por (descripción+área), ordenadas por nº de arrastres (`vecesReprogramada`) con color de severidad. `/resumen` no cambia (ya ordena por veces).

**Architecture:** Una función de dominio pura y testeable `actividadesRecurrentes` en `src/dominio/resumen.ts` (dedup por descripción+área tomando el máximo `vecesReprogramada`, veces>0, orden desc); `/tablero/page.tsx` la consume con los datos ya cargados (`listarActividadesDeSemanas`) y renderiza la sección con `colorSemaforo`. Sin cambios de esquema.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Vitest.

## Global Constraints

- Ante dudas de API de Next, leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
- Vitest: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run`.
- SIN cambios de esquema. NO tocar `/resumen` (ya ordena por `vecesReprogramada` desc via `actividadesConCambio`).
- Métrica = `vecesReprogramada`. Severidad con `colorSemaforo` (verde/amarillo/naranja/rojo). Dedup por (descripción + área), tomando el mayor nº de arrastres; solo veces>0; orden desc.
- Reutilizar estilos Tailwind existentes.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Dominio — `actividadesRecurrentes`

**Files:**
- Modify: `src/dominio/resumen.ts`
- Test: `src/dominio/resumen.test.ts`

**Interfaces:**
- Produces: `actividadesRecurrentes(filas: { descripcion: string; areaNombre: string; vecesReprogramada: number }[]): { descripcion: string; areaNombre: string; veces: number }[]`.

- [ ] **Step 1: Escribir los tests (fallan)**

Añadir al final de `src/dominio/resumen.test.ts`:

```ts
import { actividadesRecurrentes } from './resumen'

describe('actividadesRecurrentes', () => {
  it('dedup por (descripción+área) tomando el mayor nº de arrastres', () => {
    expect(actividadesRecurrentes([
      { descripcion: 'Fumigar', areaNombre: 'Nelore', vecesReprogramada: 1 },
      { descripcion: 'Fumigar', areaNombre: 'Nelore', vecesReprogramada: 3 },
    ])).toEqual([{ descripcion: 'Fumigar', areaNombre: 'Nelore', veces: 3 }])
  })
  it('ignora las que nunca se arrastraron (veces=0)', () => {
    expect(actividadesRecurrentes([
      { descripcion: 'Regar', areaNombre: 'Maiz', vecesReprogramada: 0 },
    ])).toEqual([])
  })
  it('misma descripción en distinta área son filas separadas', () => {
    const r = actividadesRecurrentes([
      { descripcion: 'Fumigar', areaNombre: 'Nelore', vecesReprogramada: 2 },
      { descripcion: 'Fumigar', areaNombre: 'Maiz', vecesReprogramada: 1 },
    ])
    expect(r).toEqual([
      { descripcion: 'Fumigar', areaNombre: 'Nelore', veces: 2 },
      { descripcion: 'Fumigar', areaNombre: 'Maiz', veces: 1 },
    ])
  })
  it('ordena por veces desc y luego descripción asc', () => {
    const r = actividadesRecurrentes([
      { descripcion: 'Bbb', areaNombre: 'A', vecesReprogramada: 2 },
      { descripcion: 'Aaa', areaNombre: 'A', vecesReprogramada: 2 },
      { descripcion: 'Ccc', areaNombre: 'A', vecesReprogramada: 5 },
    ])
    expect(r.map((x) => x.descripcion)).toEqual(['Ccc', 'Aaa', 'Bbb'])
  })
})
```

- [ ] **Step 2: Correr los tests → fallan**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run src/dominio/resumen.test.ts`
Expected: FAIL (no existe `actividadesRecurrentes`).

- [ ] **Step 3: Implementar en `resumen.ts`**

Añadir al final de `src/dominio/resumen.ts`:

```ts
// Escala de actividades que se han arrastrado (reprogramadas/parciales devueltas al banco).
// Recibe filas (una por instancia semanal); deduplica por (descripción + área) tomando el
// MAYOR vecesReprogramada, descarta las que nunca se arrastraron (veces=0) y ordena de más
// a menos arrastrada.
export function actividadesRecurrentes(
  filas: { descripcion: string; areaNombre: string; vecesReprogramada: number }[],
): { descripcion: string; areaNombre: string; veces: number }[] {
  const max = new Map<string, { descripcion: string; areaNombre: string; veces: number }>()
  for (const f of filas) {
    if (f.vecesReprogramada <= 0) continue
    const clave = `${f.descripcion}|${f.areaNombre}`
    const prev = max.get(clave)
    if (!prev || f.vecesReprogramada > prev.veces) {
      max.set(clave, { descripcion: f.descripcion, areaNombre: f.areaNombre, veces: f.vecesReprogramada })
    }
  }
  return [...max.values()].sort((a, b) => b.veces - a.veces || a.descripcion.localeCompare(b.descripcion))
}
```

- [ ] **Step 4: Correr los tests → pasan**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run src/dominio/resumen.test.ts`
Expected: PASS (todos, incluidos los previos).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.

```bash
git add src/dominio/resumen.ts src/dominio/resumen.test.ts
git commit -m "feat(dominio): actividadesRecurrentes (escala por vecesReprogramada)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `/tablero` — sección "Actividades recurrentes del mes"

**Files:**
- Modify: `src/app/tablero/page.tsx`

**Interfaces:**
- Consumes: `actividadesRecurrentes` (Task 1); `colorSemaforo` (`@/dominio/metricas`); `COLOR_HEX` y `actividades` ya presentes en la página.

- [ ] **Step 1: Imports**

En `src/app/tablero/page.tsx`:
- Añadir `colorSemaforo` al import de `@/dominio/metricas` (que ya trae `porcentajeCumplimiento, porcentajeReprogramadas, cumplimientoPorArea, tendenciaSemanal, motivosFrecuentes`):
```ts
import {
  porcentajeCumplimiento,
  porcentajeReprogramadas,
  cumplimientoPorArea,
  tendenciaSemanal,
  motivosFrecuentes,
  colorSemaforo,
} from '@/dominio/metricas'
```
- Añadir `actividadesRecurrentes` al import de `@/dominio/resumen` (hoy: `import { colorPorcentaje } from '@/dominio/resumen'`):
```ts
import { colorPorcentaje, actividadesRecurrentes } from '@/dominio/resumen'
```

- [ ] **Step 2: Calcular `recurrentes`**

Tras las métricas ya calculadas (después de `const motivosTop = motivosFrecuentes(dominio)`), añadir:
```ts
  const recurrentes = actividadesRecurrentes(
    actividades.map((a) => ({ descripcion: a.descripcion, areaNombre: a.area.nombre, vecesReprogramada: a.vecesReprogramada })),
  )
```

- [ ] **Step 3: Renderizar la sección**

Insertar, justo DESPUÉS del bloque de "📈 Tendencia semana a semana" (el que termina en `)}` antes del `<h2>` de "⚠️ Motivos más frecuentes") y ANTES de ese `<h2>` de Motivos:
```tsx
      <h2 className="mb-3 text-lg font-semibold text-tinta">🔁 Actividades recurrentes del mes</h2>
      {recurrentes.length === 0 ? (
        <p className="mb-8 text-sm text-tierra">Ninguna actividad se arrastró este mes. 🎉</p>
      ) : (
        <ul className="mb-8 space-y-2">
          {recurrentes.map((r, i) => (
            <li key={i} className="flex items-center gap-3 tarjeta p-3 text-sm">
              <span className="flex-1">
                {r.descripcion}
                <span className="text-tierra"> · {r.areaNombre}</span>
              </span>
              <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: COLOR_HEX[colorSemaforo(r.veces)] }}>
                ×{r.veces}
              </span>
            </li>
          ))}
        </ul>
      )}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 5: Vitest (regresión) + commit**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run` → todo verde.

```bash
git add src/app/tablero/page.tsx
git commit -m "feat(tablero): sección Actividades recurrentes del mes (escala por arrastres)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras las tareas)

Server local (`next dev`) + cookie de sesión firmada (ADMIN; ver memoria `verificacion-navegador`). SOLO LECTURA:

1. En un mes con reprogramaciones, `/tablero` muestra la sección **"🔁 Actividades recurrentes del mes"**: una fila por (descripción+área), ordenadas de más a menos arrastradas, con badge `×N` coloreado (verde/amarillo/naranja/rojo según severidad).
2. Una actividad arrastrada varias semanas del mes aparece **una sola vez** (con su mayor `×N`).
3. Un mes sin arrastres muestra "Ninguna actividad se arrastró este mes. 🎉".
4. `/resumen` semanal sigue igual (sin cambios).

## Nota

Sin cambios de esquema. `/resumen` no se toca (su sección "Cambiadas o reprogramadas" ya está ordenada por `vecesReprogramada` desc). El Excel no se toca.

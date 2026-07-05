# "Actividades recurrentes del mes" en /resumen (por área) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a `/resumen` (por área) una sección colapsable "🔁 Actividades recurrentes del mes" con las actividades de esa área, a lo largo del mes de la semana elegida, que se han arrastrado (`vecesReprogramada`), con su ×N y color de severidad.

**Architecture:** `resumen/page.tsx` deriva el mes de la semana (jueves ISO), carga las actividades del mes (`listarActividadesDeSemanas`), las filtra al área y calcula la lista con `actividadesRecurrentes` (dominio, ya existe); `resumen-area.tsx` gana un prop y una sección `<details>`. Sin cambios de esquema ni de dominio.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4.

## Global Constraints

- Ante dudas de API de Next, leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
- Vitest: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run`.
- SIN cambios de esquema. NO función de dominio nueva (reusar `actividadesRecurrentes`). NO tocar `/tablero` ni el export PDF de `/resumen`.
- Métrica = `vecesReprogramada`; severidad con `colorSemaforo`. Periodo = mes de la semana elegida (jueves ISO). Solo el área seleccionada. Sección colapsable (`<details>`), consistente con la estructura por-sección.
- Reutilizar estilos Tailwind existentes.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Sección "Actividades recurrentes del mes" por área en /resumen

**Files:**
- Modify: `src/app/resumen/page.tsx`
- Modify: `src/app/resumen/resumen-area.tsx`

**Interfaces:**
- Consumes: `actividadesRecurrentes` (`@/dominio/resumen`), `listarActividadesDeSemanas` (`@/datos/repositorio`), `fechasDeSemana`/`semanasDelMes` (`@/dominio/semana`), `colorSemaforo`/`COLOR_HEX` (ya presentes en `resumen-area.tsx`).
- Produces: `ResumenArea` gana el prop `recurrentesMes: { descripcion: string; areaNombre: string; veces: number }[]`.

- [ ] **Step 1: `page.tsx` — imports**

En `src/app/resumen/page.tsx`:
1. Reemplazar la línea de import de repositorio (5) por (añade `listarActividadesDeSemanas`):
```ts
import { listarAreas, listarResponsablesPorArea, listarMotivos, listarActividades, listarActividadesDeSemanas, listarActividadesEstipuladas } from '@/datos/repositorio'
```
2. Reemplazar la línea de import de semana (6) por (añade `fechasDeSemana`, `semanasDelMes`):
```ts
import { siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana, semanasDelMes } from '@/dominio/semana'
```
3. Añadir tras el import de `ResumenArea` (línea 8):
```ts
import { actividadesRecurrentes } from '@/dominio/resumen'
```

- [ ] **Step 2: `page.tsx` — derivar mes, cargar y calcular `recurrentesMes`**

En `page.tsx`, justo DESPUÉS de `const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana` (línea 39), añadir:
```ts
  // Mes de la semana seleccionada (por el jueves ISO), para la escala mensual de recurrentes.
  const jueves = fechasDeSemana(anio, semana)[3]
  const semanasMes = semanasDelMes(jueves.getUTCFullYear(), jueves.getUTCMonth() + 1)
```

Reemplazar el `Promise.all` (líneas 41-46) por (añade `actividadesMes`):
```ts
  const [responsables, motivos, actividades, estipuladas, actividadesMes] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarMotivos(),
    listarActividades(areaId, anio, semana),
    listarActividadesEstipuladas(),
    listarActividadesDeSemanas(semanasMes),
  ])
```

Tras `const unidadPorNombre = ...` (línea 47), añadir:
```ts
  const recurrentesMes = actividadesRecurrentes(
    actividadesMes
      .filter((a) => a.areaId === areaId)
      .map((a) => ({ descripcion: a.descripcion, areaNombre: areaActual.nombre, vecesReprogramada: a.vecesReprogramada })),
  )
```

- [ ] **Step 3: `page.tsx` — pasar el prop**

En el render de `<ResumenArea …>`, añadir el prop (junto a los existentes, p. ej. tras `motivos={motivos}`):
```tsx
        recurrentesMes={recurrentesMes}
```

- [ ] **Step 4: `resumen-area.tsx` — prop nuevo**

En `src/app/resumen/resumen-area.tsx`:
1. En el destructuring de props de `ResumenArea`, añadir `recurrentesMes,` tras `motivos,`.
2. En el tipo de props, añadir tras `motivos: { id: string; nombre: string }[]`:
```ts
  recurrentesMes: { descripcion: string; areaNombre: string; veces: number }[]
```

- [ ] **Step 5: `resumen-area.tsx` — sección colapsable**

Insertar, dentro del bloque de secciones colapsables (`<div className="mb-8 space-y-2">`), **justo ANTES** del `<details>` de "🔄 Actividades cambiadas o reprogramadas" (el `<details className="tarjeta p-3">` cuyo `<summary>` contiene "🔄 Actividades cambiadas o reprogramadas"):
```tsx
        <details className="tarjeta p-3">
          <summary className="cursor-pointer select-none text-sm font-semibold text-tinta">🔁 Actividades recurrentes del mes ({recurrentesMes.length})</summary>
          {recurrentesMes.length === 0 ? (
            <p className="mt-2 text-sm text-tierra">Ninguna actividad recurrente este mes.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {recurrentesMes.map((r, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-borde bg-marfil p-3 text-sm">
                  <span className="flex-1">{r.descripcion}</span>
                  <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: COLOR_HEX[colorSemaforo(r.veces)] }}>×{r.veces}</span>
                </li>
              ))}
            </ul>
          )}
        </details>
```
(`colorSemaforo` y `COLOR_HEX` ya están importados/definidos en el archivo — se usan en la sección de cambios.)

- [ ] **Step 6: Typecheck + build + vitest**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
Run: `DATABASE_URL="$DB" npx vitest run` → todo verde.

- [ ] **Step 7: Commit**

```bash
git add src/app/resumen/page.tsx src/app/resumen/resumen-area.tsx
git commit -m "feat(resumen): sección Actividades recurrentes del mes por área

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras la tarea)

Server local (`next dev`) + cookie firmada (ADMIN; ver memoria `verificacion-navegador`). SOLO LECTURA:

1. En `/resumen` de un área con reprogramaciones en el mes, aparece la sección colapsable "🔁 Actividades recurrentes del mes (N)"; al abrirla, lista las actividades de ESA área que se arrastraron en el mes, una vez cada una (mayor ×N), con badge coloreado.
2. Cambiar a una semana de otro mes cambia el conjunto (recurrentes del mes correspondiente).
3. Un área/mes sin arrastres: "Ninguna actividad recurrente este mes."
4. El resto de `/resumen` (cuadros, medidas, chips, demás secciones) y `/tablero` quedan intactos.

## Nota

Sin cambios de esquema ni de dominio (reusa `actividadesRecurrentes`, ya testeada). No se toca `/tablero` ni el export PDF de `/resumen`.

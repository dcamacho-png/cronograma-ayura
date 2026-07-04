# Observación del banco (`detalle`) en grilla, tarjeta y Excel — Implementation Plan (Entrega A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar `Tarea.detalle` (la observación del banco) en la grilla del cronograma, en la tarjeta de /cumplimiento y como columna del Excel de cumplimiento.

**Architecture:** Se lee `Tarea.detalle` por la relación `Actividad.tarea` (se añade al `include` de las queries que ya usan ambas pantallas y el export). El dominio del Excel gana una columna y un campo; la grilla y la tarjeta pintan `📝 {detalle}`.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma/Postgres, ExcelJS, Vitest, TypeScript, Tailwind v4.

## Global Constraints

- Esta versión de Next.js difiere del conocimiento previo; ante dudas de API leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json` (el `tsc` normal da falso-verde por `.next`).
- Build (cuando el paso lo pida): `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully` y `Finished TypeScript`.
- Reutilizar clases Tailwind existentes; el detalle en pantalla va como `📝 {detalle}` con `text-tierra`.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Excel — columna "Detalle (banco)" en el export

**Files:**
- Modify: `src/dominio/cumplimiento-export.ts`
- Test: `src/dominio/cumplimiento-export.test.ts`

**Interfaces:**
- Produces: `COLUMNAS_CUMPLIMIENTO` con 16 columnas (última `'Detalle (banco)'`); `ActividadExport` con `detalle?: string | null`; `filasCumplimiento` emite `a.detalle ?? ''` como última celda de cada fila.

- [ ] **Step 1: Write/adjust the failing test**

En `src/dominio/cumplimiento-export.test.ts`, añadir un caso (y ajustar cualquier aserción existente que dependa de la cantidad de columnas o de la última celda, ahora son 16 columnas terminando en el detalle):

```typescript
it('incluye el detalle del banco como última columna', () => {
  const base = {
    dia: 1, descripcion: 'Fertilización', estado: 'CUMPLIDA', haRealizada: 5,
    responsable: { nombre: 'Ana' }, maquina: null, lotes: [{ id: 'l1', nombre: 'L1' }],
    bultosPorLote: null, centroCosto: null, lotesHechos: null, avancePorLote: null,
    finca: null, nota: 'obs',
  }
  const ctx = { fechaDeDia: () => '01/07', nombreMaquina: () => '' }
  const conDetalle = filasCumplimiento({ ...base, detalle: 'aplicar urea' }, '01/07', {}, ctx)
  expect(conDetalle[0][conDetalle[0].length - 1]).toBe('aplicar urea')
  const sinDetalle = filasCumplimiento(base, '01/07', {}, ctx)
  expect(sinDetalle[0][sinDetalle[0].length - 1]).toBe('')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: FAIL (la última celda hoy es la observación, no el detalle; y `detalle` no existe en el tipo).

- [ ] **Step 3: Implement**

En `src/dominio/cumplimiento-export.ts`:

1. Añadir la columna al final de `COLUMNAS_CUMPLIMIENTO`:
```typescript
export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Finca', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados', 'Ejecutada por', 'Observación', 'Detalle (banco)',
] as const
```

2. Añadir el campo a `ActividadExport` (junto a `unidadRealizada?`):
```typescript
  unidadRealizada?: string | null
  detalle?: string | null
```

3. En `filasCumplimiento`, tras `const centro = a.centroCosto ?? ''` añadir:
```typescript
  const detalle = a.detalle ?? ''
```
y agregar `detalle` como ÚLTIMO elemento de las dos filas que se construyen:
- en el `filas.push([ … e.observacion ?? a.nota ?? '' ])` → añadir `, detalle` tras esa última celda.
- en el `return [[ … a.nota ?? '' ]]` (fila sin avances) → añadir `, detalle` tras esa última celda.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: PASS (todas).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts
git commit -m "feat(export): columna Detalle (banco) en el Excel de cumplimiento

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Datos — incluir `tarea.detalle` en las queries y en el mapper del export

**Files:**
- Modify: `src/datos/repositorio.ts`
- Modify: `src/app/cumplimiento/exportar/route.ts`

**Interfaces:**
- Consumes: `ActividadExport.detalle` (Task 1).
- Produces: las actividades de `listarActividades`/`listarActividadesSolicitadas` traen `tarea: { detalle }`; el Excel puebla la columna nueva.

- [ ] **Step 1: Repo — añadir `tarea.detalle` a ambos includes**

En `src/datos/repositorio.ts`, en `listarActividades` (≈l.42) y en `listarActividadesSolicitadas` (≈l.65), añadir dentro del objeto `include`:
```typescript
      tarea: { select: { detalle: true } },
```
(en `listarActividadesSolicitadas`, junto a los demás includes; deja el resto igual).

- [ ] **Step 2: Export route — pasar `detalle` en `aExport`**

En `src/app/cumplimiento/exportar/route.ts`, el mapper `aExport` (≈l.61) hace `{ ...a, … }`. Añadir la línea:
```typescript
    detalle: a.tarea?.detalle ?? null,
```
dentro del objeto que retorna `aExport` (junto a `bultosPorLote`/`lotesHechos`/`avancePorLote`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/datos/repositorio.ts src/app/cumplimiento/exportar/route.ts
git commit -m "feat(cumplimiento): incluir tarea.detalle en queries y poblar columna del Excel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: UI — `📝 detalle` en la grilla y en la tarjeta de cumplimiento

**Files:**
- Modify: `src/app/programar/grilla-semana.tsx`
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `a.tarea?.detalle` / `cab.tarea?.detalle` (disponible tras Task 2).

- [ ] **Step 1: GrillaSemana — tipo y render**

En `src/app/programar/grilla-semana.tsx`:
1. En el tipo local `Actividad` (≈l.10-14), añadir:
```typescript
  tarea?: { detalle: string | null } | null
```
2. En la celda, tras la línea de `🏠 a.finca.nombre` (≈l.99) y antes/junto a `<InfoLotes …>`, añadir:
```tsx
                              {a.tarea?.detalle && <div className={`whitespace-pre-line text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>📝 {a.tarea.detalle}</div>}
```

- [ ] **Step 2: Tarjeta de /cumplimiento**

En `src/app/cumplimiento/page.tsx`, justo después de `<InfoLotes lotes={cab.lotes} bultosPorLote={…} className="mb-2" />` (≈l.217), añadir:
```tsx
                {cab.tarea?.detalle && (
                  <div className="mb-2 whitespace-pre-line text-xs text-tierra">📝 {cab.tarea.detalle}</div>
                )}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`, `Finished TypeScript`.

- [ ] **Step 4: Commit**

```bash
git add src/app/programar/grilla-semana.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): mostrar detalle del banco en grilla y tarjeta

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras todas las tareas)

Desplegar preview (`npx vercel@latest deploy --yes`) y comprobar:
1. Crear una tarea con detalle → programarla → en la **grilla** de esa semana la celda muestra `📝 {detalle}`.
2. En **/cumplimiento**, la tarjeta de esa actividad muestra `📝 {detalle}`.
3. Descargar el **Excel**: la columna "Detalle (banco)" trae el detalle en las filas de esa actividad; en actividades sin tarea/detalle, va vacía.

Limpiar en Neon los datos de prueba creados.

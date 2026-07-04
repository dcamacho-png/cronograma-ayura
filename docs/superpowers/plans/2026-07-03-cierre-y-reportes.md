# Cierre que bloquea + reportes "No se hizo" + editar novedad — Implementation Plan (Entrega B, tanda 2a: núcleo)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar el núcleo del rework de estados: campo `cerrada` (bloqueo de cierre), funciones de repo de cierre, editar una novedad del log, y unificar la vista de reportes en un solo bucket "No se hizo".

**Architecture:** Campo aditivo `Actividad.cerrada`. Helper de dominio `etiquetaEstado` (une NO_CUMPLIDA/REPROGRAMADA → "No se hizo") y `editarNovedad`. Repo: funciones de cierre que fijan `cerrada=true` (y solo REPROGRAMADA devuelve al banco), más reabrir-cierre y editar-novedad por grupo. Los reportes (contador, tarjeta, /resumen, /tablero, Excel) muestran el bucket unificado vía `etiquetaEstado`; `interactivo` pasa a `!cerrada && (PENDIENTE||PARCIAL)`.

**Tech Stack:** Next.js 16, React 19, Prisma/Postgres, Vitest, TypeScript.

**Alcance:** SOLO el núcleo + reportes. La UI interactiva del cierre (botón "Cerrar actividad" con elección/confirmación/reprogramar y el sub-flujo de cambio) y el editar/unificar de la novedad en pantalla son la tanda 2b (plan aparte). Este plan deja las funciones de repo y acciones listas para que 2b las cablee. Como nada aún fija `cerrada=true`, el bloqueo es inerte hasta 2b (no hay regresión visible).

## Global Constraints

- Ante dudas de API de Next, leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully` y `Finished TypeScript`.
- Migraciones: carpeta timestamp con `migration.sql` manual; NO correr `prisma migrate dev`. `npx prisma generate` actualiza tipos sin DB.
- Estados internos (5 valores) NO cambian. En pantalla/reportes NO_CUMPLIDA y REPROGRAMADA se muestran juntas como "No se hizo".
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Esquema — campo `cerrada` + migración aditiva

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260703130000_actividad_cerrada/migration.sql`

**Interfaces:**
- Produces: `Actividad.cerrada: boolean` (default false) en el cliente Prisma.

- [ ] **Step 1: Añadir el campo**

En `model Actividad` (junto a `noProgramada Boolean @default(false)`), añadir:
```prisma
  cerrada      Boolean @default(false)
```

- [ ] **Step 2: Crear la migración**

Crear `prisma/migrations/20260703130000_actividad_cerrada/migration.sql`:
```sql
-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN "cerrada" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Regenerar + typecheck**

Run: `npx prisma generate`
Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260703130000_actividad_cerrada/
git commit -m "feat(db): campo aditivo Actividad.cerrada (bloqueo de cierre)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Dominio — `etiquetaEstado` + `editarNovedad` + tests

**Files:**
- Modify: `src/dominio/metricas.ts`
- Modify: `src/dominio/novedades.ts`
- Test: `src/dominio/metricas.test.ts`, `src/dominio/novedades.test.ts`

**Interfaces:**
- Consumes: `Estado` (tipos), `NovedadEntrada` (novedades).
- Produces:
  - `etiquetaEstado(estado: Estado): string` — 'Pendiente'|'Cumplida'|'Parcial'; 'No se hizo' para NO_CUMPLIDA y REPROGRAMADA.
  - `editarNovedad(lista: NovedadEntrada[], index: number, cambios: { dia?: number; motivoId?: string | null; observacion?: string | null }): NovedadEntrada[]`

- [ ] **Step 1: Write the failing tests**

Añadir a `src/dominio/metricas.test.ts`:
```typescript
import { etiquetaEstado } from './metricas'

describe('etiquetaEstado', () => {
  it('une No cumplida y Reprogramada en "No se hizo"', () => {
    expect(etiquetaEstado('NO_CUMPLIDA')).toBe('No se hizo')
    expect(etiquetaEstado('REPROGRAMADA')).toBe('No se hizo')
  })
  it('el resto de estados', () => {
    expect(etiquetaEstado('PENDIENTE')).toBe('Pendiente')
    expect(etiquetaEstado('CUMPLIDA')).toBe('Cumplida')
    expect(etiquetaEstado('PARCIAL')).toBe('Parcial')
  })
})
```

Añadir a `src/dominio/novedades.test.ts`:
```typescript
import { editarNovedad } from './novedades'

describe('editarNovedad', () => {
  const base = () => [
    { dia: 1, motivoId: 'm1', observacion: 'a' },
    { dia: 2, motivoId: null, observacion: 'b' },
  ]
  it('cambia solo los campos dados de la entrada', () => {
    const out = editarNovedad(base(), 0, { dia: 5, observacion: 'z' })
    expect(out[0]).toEqual({ dia: 5, motivoId: 'm1', observacion: 'z' })
    expect(out[1]).toEqual({ dia: 2, motivoId: null, observacion: 'b' })
  })
  it('no muta el original', () => {
    const orig = base()
    editarNovedad(orig, 0, { dia: 9 })
    expect(orig[0].dia).toBe(1)
  })
  it('índice fuera de rango → sin cambios', () => {
    const orig = base()
    expect(editarNovedad(orig, 9, { dia: 1 })).toBe(orig)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/dominio/metricas.test.ts src/dominio/novedades.test.ts`
Expected: FAIL — `etiquetaEstado`/`editarNovedad` no existen.

- [ ] **Step 3: Implement**

En `src/dominio/metricas.ts` (junto a `pesoEstado`), añadir:
```typescript
// Etiqueta de display del estado. NO_CUMPLIDA y REPROGRAMADA se muestran juntas
// como "No se hizo" (un solo bucket en pantalla y reportes).
export function etiquetaEstado(estado: Estado): string {
  switch (estado) {
    case 'PENDIENTE': return 'Pendiente'
    case 'CUMPLIDA': return 'Cumplida'
    case 'PARCIAL': return 'Parcial'
    case 'NO_CUMPLIDA':
    case 'REPROGRAMADA':
      return 'No se hizo'
  }
}
```

En `src/dominio/novedades.ts`, añadir:
```typescript
// Devuelve una copia de la lista con la entrada `index` modificada en los campos dados.
// Fuera de rango ⇒ devuelve la misma lista.
export function editarNovedad(
  lista: NovedadEntrada[],
  index: number,
  cambios: { dia?: number; motivoId?: string | null; observacion?: string | null },
): NovedadEntrada[] {
  if (index < 0 || index >= lista.length) return lista
  return lista.map((e, i) => (i === index ? {
    dia: cambios.dia ?? e.dia,
    motivoId: cambios.motivoId !== undefined ? cambios.motivoId : e.motivoId,
    observacion: cambios.observacion !== undefined ? cambios.observacion : e.observacion,
  } : e))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dominio/metricas.test.ts src/dominio/novedades.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/novedades.ts src/dominio/metricas.test.ts src/dominio/novedades.test.ts
git commit -m "feat(dominio): etiquetaEstado (bucket No se hizo) + editarNovedad

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Repo — cierre (`cerrada`), solo-reprogramada-al-banco, reabrir-cierre, editar novedad

**Files:**
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Consumes: `editarNovedad`, `normalizarNovedades` (ya importado de tanda 1); `filasHermanas`, `prisma`, `Prisma`.
- Produces:
  - `cerrarParcialGrupo(id: string): Promise<true | null>` — estado PARCIAL + `cerrada=true` en filas abiertas.
  - `reabrirCierreGrupo(id: string): Promise<true | null>` — `cerrada=false` conservando estado/avances/novedades.
  - `editarNovedadGrupo(id: string, index: number, cambios: { dia?: number; motivoId?: string | null; observacion?: string | null }): Promise<true | null>`
  - `marcarCumplidaGrupo` ahora también fija `cerrada=true`.
  - `registrarNovedadGrupo`: solo REPROGRAMADA devuelve al banco; fija `cerrada=true` en las filas.

- [ ] **Step 1: `marcarCumplidaGrupo` — fijar cerrada**

En `marcarCumplidaGrupo` (≈l.700), en el `data` del update, añadir `cerrada: true`:
```typescript
          data: { estado: 'CUMPLIDA', cerrada: true, ...(tieneLotes ? { haRealizada: total } : {}) },
```

- [ ] **Step 2: `registrarNovedadGrupo` — solo REPROGRAMADA al banco + cerrada**

En `registrarNovedadGrupo`:
1. En el `tx.actividad.update` de cada fila (donde se fija `estado, motivoId, nota`), añadir `cerrada: true,`.
2. En la condición de devolución al banco, cambiar:
```typescript
    if ((estado === 'NO_CUMPLIDA' || estado === 'REPROGRAMADA') && g.base.tareaId) {
```
por:
```typescript
    if (estado === 'REPROGRAMADA' && g.base.tareaId) {
```

- [ ] **Step 3: Añadir `cerrarParcialGrupo`, `reabrirCierreGrupo`, `editarNovedadGrupo`**

Insertar (tras `eliminarNovedadGrupo`):
```typescript
// Cierra una actividad como PARCIAL (bloqueada) sin tocar avances/novedades.
export async function cerrarParcialGrupo(id: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({ where: { id: f.id }, data: { estado: 'PARCIAL', cerrada: true } })),
  )
  return true
}

// Quita el bloqueo de cierre conservando estado/avances/novedades (para corregir un cierre).
export async function reabrirCierreGrupo(id: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas.map((f) => prisma.actividad.update({ where: { id: f.id }, data: { cerrada: false } })),
  )
  return true
}

// Edita una novedad del log por índice (día/motivo/observación) en las filas abiertas.
export async function editarNovedadGrupo(
  id: string,
  index: number,
  cambios: { dia?: number; motivoId?: string | null; observacion?: string | null },
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const lista = editarNovedad(normalizarNovedades(g.base.novedades), index, cambios)
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({ where: { id: f.id }, data: { novedades: lista as unknown as Prisma.InputJsonValue } })),
  )
  return true
}
```

En el import de `@/dominio/novedades`, añadir `editarNovedad`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(repo): cierre con cerrada (solo reprogramada al banco) + reabrir-cierre + editar novedad

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Acciones — cierre + editar novedad

**Files:**
- Modify: `src/app/cumplimiento/acciones.ts`

**Interfaces:**
- Consumes: `cerrarParcialGrupo`, `reabrirCierreGrupo`, `editarNovedadGrupo` (Task 3); helpers `texto`, `textoOpcional`, `numeroOpcional`, `bloqueadoPorPlazoActividad`, `revalidatePath`.
- Produces: `cerrarParcialAccion`, `reabrirCierreAccion`, `editarNovedadAccion` (server actions). (Cumplida y No se hizo reutilizan `marcarCumplidaActividadAccion` y `registrarNovedadActividadAccion`, que ya fijan `cerrada` vía Task 3.)

- [ ] **Step 1: Add to the repo import**

Añadir `cerrarParcialGrupo, reabrirCierreGrupo, editarNovedadGrupo` al import existente de `@/datos/repositorio`.

- [ ] **Step 2: Add the actions**

Añadir:
```typescript
export async function cerrarParcialAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await cerrarParcialGrupo(id)
  revalidatePath('/cumplimiento')
}

export async function reabrirCierreAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await reabrirCierreGrupo(id)
  revalidatePath('/cumplimiento')
}

export async function editarNovedadAccion(form: FormData) {
  const id = texto(form, 'id')
  const index = Number(texto(form, 'index'))
  if (!id || !Number.isInteger(index) || index < 0) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const dia = Number(texto(form, 'dia'))
  await editarNovedadGrupo(id, index, {
    ...(dia >= 1 && dia <= 7 ? { dia } : {}),
    motivoId: textoOpcional(form, 'motivoId'),
    observacion: textoOpcional(form, 'observacion'),
  })
  revalidatePath('/cumplimiento')
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): acciones cerrar parcial / reabrir cierre / editar novedad

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Reportes — un solo bucket "No se hizo" + `interactivo=!cerrada`

**Files:**
- Modify: `src/app/cumplimiento/page.tsx`
- Modify: `src/dominio/cumplimiento-export.ts`
- Modify: `src/app/resumen/resumen-area.tsx`
- Modify: `src/app/tablero/page.tsx`

**Interfaces:**
- Consumes: `etiquetaEstado` (Task 2), `cab.cerrada` (Task 1).

- [ ] **Step 1: `page.tsx` — contador, etiqueta de tarjeta, interactivo**

En `src/app/cumplimiento/page.tsx`:
1. Importar `etiquetaEstado` de `@/dominio/metricas`.
2. Contador superior (≈l.152-154): reemplazar los dos chips 🔴/🔄 por uno solo:
```tsx
          ✅ <b>{conteoEstado.CUMPLIDA}</b> · 🟡 <b>{conteoEstado.PARCIAL}</b> · 🔴 <b>{conteoEstado.NO_CUMPLIDA + conteoEstado.REPROGRAMADA}</b> No se hizo{' '}
          <span className="text-tierra">de {totalActividades}</span>
```
3. Etiqueta de estado de la tarjeta: donde hoy usa `ESTADOS.find((e) => e.valor === estadoGrupo)?.etiqueta ?? estadoGrupo`, usar `etiquetaEstado(estadoGrupo)`.
4. `interactivo`: cambiar `const interactivo = estadoGrupo === 'PENDIENTE' || estadoGrupo === 'PARCIAL'` por:
```tsx
                  const interactivo = !cab.cerrada && (estadoGrupo === 'PENDIENTE' || estadoGrupo === 'PARCIAL')
```

- [ ] **Step 2: Excel — `ESTADO_TXT`**

En `src/dominio/cumplimiento-export.ts`, en `ESTADO_TXT`, cambiar los valores de `NO_CUMPLIDA` y `REPROGRAMADA` a `'No se hizo'`:
```typescript
  NO_CUMPLIDA: 'No se hizo',
  REPROGRAMADA: 'No se hizo',
```

- [ ] **Step 3: /resumen — desglose por estado**

En `src/app/resumen/resumen-area.tsx`, donde se muestran los conteos por estado (No cumplida / Reprogramada), unirlos en un solo "No se hizo" = suma de ambos (mismo patrón que el contador de `page.tsx`). Buscar los usos de `NO_CUMPLIDA`/`REPROGRAMADA` en el render y reemplazar por una sola línea "🔴 No se hizo: {n}" con `n = conteo.NO_CUMPLIDA + conteo.REPROGRAMADA`.

- [ ] **Step 4: /tablero — conteo mostrado**

En `src/app/tablero/page.tsx`, donde se muestren conteos por estado separando No cumplida/Reprogramada, unirlos igual (suma NO_CUMPLIDA + REPROGRAMADA como "No se hizo"). Si el tablero no separa esos dos, no hay cambio (dejar constancia en el reporte).

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add src/app/cumplimiento/page.tsx src/dominio/cumplimiento-export.ts src/app/resumen/resumen-area.tsx src/app/tablero/page.tsx
git commit -m "feat(reportes): un solo bucket 'No se hizo' + interactivo respeta cerrada

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación (tras todas las tareas)

- Typecheck + build verdes.
- `npx vitest run` — todo verde (dominio: etiquetaEstado, editarNovedad, y los previos).
- No se despliega aún: la UI del cierre (tanda 2b) es la que hará visible/usable el bloqueo. Este plan deja el núcleo listo y los reportes ya unificados (No se hizo). Verificación en vivo al terminar 2b.

## Nota

La tanda 2b (plan aparte) cablea la UI: botón "Cerrar actividad" (Cumplida con confirmación suave / Parcial / No se hizo + ¿reprogramar?) usando estas funciones; edición en línea de novedad + formulario completo; y elimina el viejo botón "registrar/editar novedad" moviendo el cambio/reemplazo al cierre "No se hizo".

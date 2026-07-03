# Editar/borrar avances · quitar % por actividad · día en el reemplazo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir corregir/borrar avances ya registrados, quitar el % por actividad de la hoja de cumplimiento, y pedir el día al registrar la actividad de reemplazo (cambio).

**Architecture:** Dos helpers puros para editar/eliminar una entrada de `avancePorLote`; dos funciones de repo por grupo que las aplican y reescriben el JSON en las filas abiertas; dos server actions; un componente cliente `AvancesEditables` que reemplaza el texto plano de avances por una lista con ✏️/×. Aparte, se quita el `pctAct` de la tarjeta en `page.tsx`, y se agrega un selector de día al bloque de reemplazo (FormRegistrar → acciones → repositorio).

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Prisma/Postgres, Vitest, TypeScript, Tailwind v4.

## Global Constraints

- Esta versión de Next.js difiere del conocimiento previo; ante dudas de API leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json` (el `tsc` normal da falso-verde por `.next`).
- Build (cuando el paso lo pida): `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → esperar `✓ Compiled successfully` y `Finished TypeScript`.
- Reutilizar clases Tailwind existentes (`rounded-lg border border-borde bg-marfil …`, `text-tierra`, `bg-bosque`, etc.).
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Las entradas de avance se ubican por `loteId` + índice (posición en el arreglo del lote).

---

### Task 1: Helpers `editarAvanceEntrada` y `eliminarAvanceEntrada`

**Files:**
- Modify: `src/dominio/avance-lote.ts`
- Test: `src/dominio/avance-lote.test.ts`

**Interfaces:**
- Consumes: tipos `AvanceEntrada`, `AvancePorLote` (ya en el archivo).
- Produces:
  - `editarAvanceEntrada(avance: AvancePorLote, loteId: string, index: number, cambios: { cantidad?: number; dia?: number; observacion?: string | null }): AvancePorLote`
  - `eliminarAvanceEntrada(avance: AvancePorLote, loteId: string, index: number): AvancePorLote`

- [ ] **Step 1: Write the failing tests**

Añadir al final de `src/dominio/avance-lote.test.ts`:

```typescript
import { editarAvanceEntrada, eliminarAvanceEntrada } from './avance-lote'

describe('editarAvanceEntrada', () => {
  const base = () => ({ a: [{ dia: 1, maquinaId: null, cantidad: 5 }, { dia: 2, maquinaId: null, cantidad: 3, observacion: 'x' }] })

  it('cambia solo los campos dados de la entrada indicada', () => {
    const out = editarAvanceEntrada(base(), 'a', 0, { cantidad: 8, dia: 4 })
    expect(out.a[0]).toEqual({ dia: 4, maquinaId: null, cantidad: 8 })
    expect(out.a[1]).toEqual({ dia: 2, maquinaId: null, cantidad: 3, observacion: 'x' })
  })

  it('observación vacía elimina el campo', () => {
    const out = editarAvanceEntrada(base(), 'a', 1, { observacion: '' })
    expect('observacion' in out.a[1]).toBe(false)
  })

  it('no muta el original', () => {
    const orig = base()
    editarAvanceEntrada(orig, 'a', 0, { cantidad: 99 })
    expect(orig.a[0].cantidad).toBe(5)
  })

  it('índice fuera de rango o lote inexistente: sin cambios', () => {
    const orig = base()
    expect(editarAvanceEntrada(orig, 'a', 9, { cantidad: 1 })).toBe(orig)
    expect(editarAvanceEntrada(orig, 'z', 0, { cantidad: 1 })).toBe(orig)
  })
})

describe('eliminarAvanceEntrada', () => {
  const base = () => ({ a: [{ dia: 1, maquinaId: null, cantidad: 5 }, { dia: 2, maquinaId: null, cantidad: 3 }], b: [{ dia: 1, maquinaId: null, cantidad: 2 }] })

  it('quita la entrada indicada', () => {
    const out = eliminarAvanceEntrada(base(), 'a', 0)
    expect(out.a).toEqual([{ dia: 2, maquinaId: null, cantidad: 3 }])
  })

  it('si el lote queda vacío, borra la clave', () => {
    const out = eliminarAvanceEntrada(base(), 'b', 0)
    expect('b' in out).toBe(false)
  })

  it('índice fuera de rango: sin cambios', () => {
    const orig = base()
    expect(eliminarAvanceEntrada(orig, 'a', 9)).toBe(orig)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/dominio/avance-lote.test.ts`
Expected: FAIL — `editarAvanceEntrada`/`eliminarAvanceEntrada` no exportados.

- [ ] **Step 3: Write the implementation**

Añadir a `src/dominio/avance-lote.ts` (después de `agregarAvances`):

```typescript
// Devuelve una copia de `avance` con la entrada (loteId, index) modificada en los campos
// dados. `observacion` vacía elimina el campo. Fuera de rango ⇒ devuelve el mismo objeto.
export function editarAvanceEntrada(
  avance: AvancePorLote,
  loteId: string,
  index: number,
  cambios: { cantidad?: number; dia?: number; observacion?: string | null },
): AvancePorLote {
  const lista = avance[loteId]
  if (!lista || index < 0 || index >= lista.length) return avance
  const siguiente: AvanceEntrada = { ...lista[index] }
  if (cambios.cantidad !== undefined) siguiente.cantidad = cambios.cantidad
  if (cambios.dia !== undefined) siguiente.dia = cambios.dia
  if (cambios.observacion !== undefined) {
    if (cambios.observacion) siguiente.observacion = cambios.observacion
    else delete siguiente.observacion
  }
  return { ...avance, [loteId]: lista.map((e, i) => (i === index ? siguiente : e)) }
}

// Devuelve una copia de `avance` sin la entrada (loteId, index). Si el lote queda sin
// entradas, se elimina la clave. Fuera de rango ⇒ devuelve el mismo objeto.
export function eliminarAvanceEntrada(avance: AvancePorLote, loteId: string, index: number): AvancePorLote {
  const lista = avance[loteId]
  if (!lista || index < 0 || index >= lista.length) return avance
  const restante = lista.filter((_, i) => i !== index)
  const out = { ...avance }
  if (restante.length) out[loteId] = restante
  else delete out[loteId]
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dominio/avance-lote.test.ts`
Expected: PASS (todas).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/avance-lote.ts src/dominio/avance-lote.test.ts
git commit -m "feat(dominio): editar y eliminar una entrada de avancePorLote

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Repo `editarAvanceEntradaGrupo` y `eliminarAvanceEntradaGrupo`

**Files:**
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Consumes: `editarAvanceEntrada`, `eliminarAvanceEntrada` (Task 1); `normalizarAvancePorLote`, `AvanceEntrada` (ya importados); `filasHermanas`, `prisma`, `Prisma`.
- Produces:
  - `editarAvanceEntradaGrupo(id: string, loteId: string, index: number, cambios: { cantidad?: number; dia?: number; observacion?: string | null }): Promise<true | null>`
  - `eliminarAvanceEntradaGrupo(id: string, loteId: string, index: number): Promise<true | null>`

- [ ] **Step 1: Add imports**

En `src/datos/repositorio.ts`, añadir `editarAvanceEntrada` y `eliminarAvanceEntrada` al import existente de `@/dominio/avance-lote` (donde ya están `normalizarAvancePorLote`, `AvanceEntrada`, `agregarAvances`, `totalAvanceLotes`, `lotesPendientes`).

- [ ] **Step 2: Add the functions**

Insertar después de `registrarAvanceLoteGrupo` (≈l.684) en `src/datos/repositorio.ts`:

```typescript
// Edita una entrada de avance (loteId, index) del grupo y reescribe el JSON en todas las
// filas abiertas. No cambia estado ni haRealizada. null si el grupo no existe.
export async function editarAvanceEntradaGrupo(
  id: string,
  loteId: string,
  index: number,
  cambios: { cantidad?: number; dia?: number; observacion?: string | null },
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const actual = editarAvanceEntrada(
    normalizarAvancePorLote(g.base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
    loteId,
    index,
    cambios,
  )
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({ where: { id: f.id }, data: { avancePorLote: actual as Prisma.InputJsonValue } })),
  )
  return true
}

// Elimina una entrada de avance (loteId, index) del grupo y reescribe el JSON en todas las
// filas abiertas. No cambia estado. null si el grupo no existe.
export async function eliminarAvanceEntradaGrupo(id: string, loteId: string, index: number) {
  const g = await filasHermanas(id)
  if (!g) return null
  const actual = eliminarAvanceEntrada(
    normalizarAvancePorLote(g.base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
    loteId,
    index,
  )
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({ where: { id: f.id }, data: { avancePorLote: actual as Prisma.InputJsonValue } })),
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
git commit -m "feat(repo): editar/eliminar entrada de avance por grupo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Acciones `editarAvanceAccion` y `eliminarAvanceAccion`

**Files:**
- Modify: `src/app/cumplimiento/acciones.ts`

**Interfaces:**
- Consumes: `editarAvanceEntradaGrupo`, `eliminarAvanceEntradaGrupo` (Task 2); helpers `texto`, `numeroOpcional`, `textoOpcional`, `bloqueadoPorPlazoActividad`, `revalidatePath`.
- Produces: `editarAvanceAccion(form: FormData): Promise<void>`, `eliminarAvanceAccion(form: FormData): Promise<void>`.

- [ ] **Step 1: Add to the repo import**

Añadir `editarAvanceEntradaGrupo` y `eliminarAvanceEntradaGrupo` al import existente de `@/datos/repositorio`.

- [ ] **Step 2: Add the actions**

Añadir (p. ej. después de `registrarAvanceAccion`):

```typescript
export async function editarAvanceAccion(form: FormData) {
  const id = texto(form, 'id')
  const loteId = texto(form, 'loteId')
  const index = Number(texto(form, 'index'))
  if (!id || !loteId || !Number.isInteger(index) || index < 0) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const cantidad = numeroOpcional(form, 'cantidad') ?? 0
  const dia = Number(texto(form, 'dia'))
  const observacion = textoOpcional(form, 'observacion')
  await editarAvanceEntradaGrupo(id, loteId, index, {
    cantidad,
    ...(dia >= 1 && dia <= 7 ? { dia } : {}),
    observacion,
  })
  revalidatePath('/cumplimiento')
}

export async function eliminarAvanceAccion(form: FormData) {
  const id = texto(form, 'id')
  const loteId = texto(form, 'loteId')
  const index = Number(texto(form, 'index'))
  if (!id || !loteId || !Number.isInteger(index) || index < 0) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await eliminarAvanceEntradaGrupo(id, loteId, index)
  revalidatePath('/cumplimiento')
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): acciones editar/eliminar avance

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Componente cliente `AvancesEditables`

**Files:**
- Create: `src/app/cumplimiento/avances-editables.tsx`

**Interfaces:**
- Produces: `AvancesEditables` con props:
  `{ actividadId: string; entradas: { loteId: string; loteNombre: string; index: number; dia: number; cantidad: number; observacion: string }[]; unidad: string; etiquetaPorDia: string[]; diaLabels: string[]; editar: (f: FormData) => void | Promise<void>; eliminar: (f: FormData) => void | Promise<void> }`

- [ ] **Step 1: Create the component**

Crear `src/app/cumplimiento/avances-editables.tsx`:

```tsx
'use client'

import { useState } from 'react'

type Entrada = { loteId: string; loteNombre: string; index: number; dia: number; cantidad: number; observacion: string }

// Lista de avances registrados con editar (✏️, mini-form en línea: día + cantidad + observación)
// y borrar (×). Cada avance se ubica por loteId + index. Solo se usa en actividades abiertas.
export function AvancesEditables({
  actividadId,
  entradas,
  unidad,
  etiquetaPorDia,
  diaLabels,
  editar,
  eliminar,
}: {
  actividadId: string
  entradas: Entrada[]
  unidad: string
  etiquetaPorDia: string[]
  diaLabels: string[]
  editar: (f: FormData) => void | Promise<void>
  eliminar: (f: FormData) => void | Promise<void>
}) {
  const [editando, setEditando] = useState<string | null>(null)
  if (entradas.length === 0) return null

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-tierra">Avances:</span>
      {entradas.map((e) => {
        const clave = `${e.loteId}:${e.index}`
        if (editando === clave) {
          return (
            <form key={clave} action={editar} onSubmit={() => setEditando(null)} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={actividadId} />
              <input type="hidden" name="loteId" value={e.loteId} />
              <input type="hidden" name="index" value={e.index} />
              <label className="flex flex-col text-xs">
                Día
                <select name="dia" defaultValue={e.dia} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{diaLabels[d]}</option>))}
                </select>
              </label>
              <label className="flex flex-col text-xs">
                Cantidad
                <input name="cantidad" type="number" step="any" min="0" defaultValue={e.cantidad} className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
              </label>
              <label className="flex flex-1 flex-col text-xs">
                Observación
                <input name="observacion" defaultValue={e.observacion} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
              </label>
              <button className="rounded-lg bg-bosque px-3 py-1 text-xs font-semibold text-white">Guardar</button>
              <button type="button" onClick={() => setEditando(null)} className="text-xs text-tierra underline">cancelar</button>
            </form>
          )
        }
        return (
          <div key={clave} className="flex flex-wrap items-center gap-2">
            <span>{etiquetaPorDia[e.dia]} · {e.loteNombre} — {e.cantidad} {unidad}{e.observacion ? ` · ${e.observacion}` : ''}</span>
            <button type="button" onClick={() => setEditando(clave)} className="text-xs text-tierra hover:text-tinta" title="editar">✏️</button>
            <form action={eliminar} className="inline">
              <input type="hidden" name="id" value={actividadId} />
              <input type="hidden" name="loteId" value={e.loteId} />
              <input type="hidden" name="index" value={e.index} />
              <button className="text-xs text-tierra hover:text-rose-700" title="borrar">×</button>
            </form>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/cumplimiento/avances-editables.tsx
git commit -m "feat(cumplimiento): componente AvancesEditables (editar/borrar avance)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `page.tsx` — usar `AvancesEditables` y quitar el % por actividad

**Files:**
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `AvancesEditables` (Task 4); `editarAvanceAccion`, `eliminarAvanceAccion` (Task 3); variables `avances`, `cab`, `estadoGrupo`, `bloqueado`, `interactivo`, `etiquetaDia`, `resumenAvances`, `unidadStd`, `DIAS` (ya en scope).

- [ ] **Step 1: Add imports**

En `src/app/cumplimiento/page.tsx`:
- Añadir al import de `./acciones`: `editarAvanceAccion`, `eliminarAvanceAccion`.
- Añadir el import del componente: `import { AvancesEditables } from './avances-editables'`.

- [ ] **Step 2: Quitar el `pctAct` por actividad**

Eliminar la línea (≈193):
```tsx
            const pctAct = porcentajeCumplimiento(dias as unknown as ActividadDominio[])
```
Reemplazar el span (≈213-215):
```tsx
                  <span className="ml-auto rounded-lg bg-arena px-2 py-0.5 text-xs">
                    {nDias > 1 ? `${nDias} días · ` : ''}Cumplido: <b>{pctAct === null ? '—' : `${pctAct}%`}</b>
                  </span>
```
por:
```tsx
                  {nDias > 1 && (
                    <span className="ml-auto rounded-lg bg-arena px-2 py-0.5 text-xs">{nDias} días</span>
                  )}
```
(No tocar el import de `porcentajeCumplimiento`: sigue usándose para el `pct` total de la semana, ≈l.91.)

- [ ] **Step 3: Construir `etiquetaPorDia` y `entradas`, y renderizar la lista editable**

Dentro del IIFE (donde ya están `avances`, `etiquetaDia`, `unidadStd`, `resumenAvances`, `interactivo`), añadir tras `const resumenAvances = …`:
```tsx
                  const etiquetaPorDia = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => (d === 0 ? '' : etiquetaDia(d)))
                  const entradasAvance = cab.lotes.flatMap((l) =>
                    (avances[l.id] ?? []).map((e, index) => ({
                      loteId: l.id,
                      loteNombre: l.nombre,
                      index,
                      dia: e.dia,
                      cantidad: e.cantidad,
                      observacion: e.observacion ?? '',
                    })),
                  )
```
Reemplazar el bloque (≈256-258):
```tsx
                      {resumenAvances && (
                        <span className="text-sm text-tierra">Avances: {resumenAvances}</span>
                      )}
```
por:
```tsx
                      {interactivo && !bloqueado ? (
                        <AvancesEditables
                          actividadId={cab.id}
                          entradas={entradasAvance}
                          unidad={unidadStd}
                          etiquetaPorDia={etiquetaPorDia}
                          diaLabels={DIAS}
                          editar={editarAvanceAccion}
                          eliminar={eliminarAvanceAccion}
                        />
                      ) : (
                        resumenAvances && <span className="text-sm text-tierra">Avances: {resumenAvances}</span>
                      )}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`, `Finished TypeScript`.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): avances editables en la tarjeta y quita el % por actividad

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Día en la actividad de reemplazo (cambio)

**Files:**
- Modify: `src/app/cumplimiento/form-registrar.tsx`
- Modify: `src/app/cumplimiento/actividad-estandar.tsx`
- Modify: `src/app/cumplimiento/actividad-maquinaria.tsx`
- Modify: `src/app/cumplimiento/acciones.ts`
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Produces: `FormRegistrar` con nuevo prop `diaActividad: number`; emite `<input/select name="reemplazoDia">`. `registrarNovedadGrupo` acepta `reemplazo.dia?: number | null`.

- [ ] **Step 1: `FormRegistrar` — prop, estado, selector**

En `src/app/cumplimiento/form-registrar.tsx`:
1. Añadir al destructuring de props `diaActividad,` y a su tipo `diaActividad: number`.
2. Tras `const UNIDADES = [...]` (≈l.57) añadir:
```tsx
  const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
```
3. Junto a los otros `useState` (p. ej. tras `reemplazoUnidadSel`), añadir:
```tsx
  const [reemplazoDia, setReemplazoDia] = useState(String(diaActividad))
```
4. En el bloque `{esCambio && (…)}`, justo antes del `<label className="flex w-full flex-col text-xs">Potreros …`, insertar:
```tsx
          <label className="flex flex-col text-xs">
            Día *
            <select name="reemplazoDia" value={reemplazoDia} onChange={(e) => setReemplazoDia(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{DIAS[d]}</option>))}
            </select>
          </label>
```

- [ ] **Step 2: Pasar `diaActividad` desde los dos componentes**

En `src/app/cumplimiento/actividad-estandar.tsx` y `src/app/cumplimiento/actividad-maquinaria.tsx`, en la llamada a `<FormRegistrar …>` (donde ya se pasa `estadoInicial={estado}`), añadir:
```tsx
          diaActividad={dia}
```
(Ambos componentes ya reciben el prop `dia`.)

- [ ] **Step 3: `acciones.ts` — leer y pasar el día**

En `registrarNovedadActividadAccion` (`src/app/cumplimiento/acciones.ts`), antes de construir `const reemplazo = …`, añadir:
```typescript
  const reemplazoDiaNum = Number(texto(form, 'reemplazoDia'))
  const reemplazoDia = reemplazoDiaNum >= 1 && reemplazoDiaNum <= 7 ? reemplazoDiaNum : undefined
```
Y añadir `dia: reemplazoDia` al objeto `reemplazo`:
```typescript
  const reemplazo = reemplazoDescripcion
    ? { descripcion: reemplazoDescripcion, unidad: reemplazoUnidad, loteIds: reemplazoLoteIds, medida: reemplazoMedida, bultos: reemplazoBultos, dia: reemplazoDia }
    : null
```

- [ ] **Step 4: `repositorio.ts` — usar el día en el reemplazo**

En `registrarNovedadGrupo` (`src/datos/repositorio.ts`):
1. En el tipo de `reemplazo`, añadir `dia?: number | null`:
```typescript
  reemplazo?: { descripcion: string; unidad?: string | null; loteIds?: string[]; medida?: Record<string, number>; bultos?: Record<string, number>; dia?: number | null } | null,
```
2. En el `tx.actividad.create` del reemplazo, cambiar `dia: g.base.dia,` por:
```typescript
          dia: reemplazo.dia ?? g.base.dia,
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add src/app/cumplimiento/form-registrar.tsx src/app/cumplimiento/actividad-estandar.tsx src/app/cumplimiento/actividad-maquinaria.tsx src/app/cumplimiento/acciones.ts src/datos/repositorio.ts
git commit -m "feat(cumplimiento): dia en la actividad de reemplazo (cambio) para el Excel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras todas las tareas)

Desplegar preview (`npx vercel@latest deploy --yes`) y comprobar:
1. Registrar 2 avances de un potrero → aparecen con ✏️/×; editar el primero (día+cantidad+obs) → cambia y el total se recalcula; borrar el segundo → desaparece; borrar todos → queda Parcial.
2. Actividad cerrada / plazo vencido → los avances vuelven a solo lectura (sin ✏️/×).
3. Una tarjeta ya no muestra `Cumplido: X%`; el % total de la semana y los conteos siguen; "N días" aparece con varios días.
4. Novedad de cambio → el bloque de reemplazo pide **Día** (default = día de la actividad) → al guardar, la actividad "En reemplazo de…" queda en ese día (verificable en el Excel día a día).

Limpiar en Neon los datos de prueba creados.

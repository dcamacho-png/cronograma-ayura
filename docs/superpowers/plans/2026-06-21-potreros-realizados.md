# Potreros realizados + centro de costo en "actividad realizada" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) Agregar el campo Centro de costo al formulario "agregar actividad realizada" de Maquinaria; (B) permitir marcar con checkboxes en cuáles potreros se realizó una actividad multi-lote al registrarla como Parcial o Reprogramada, guardarlo, mostrarlo en pantalla y exportarlo en el Excel.

**Architecture:** Parte A reutiliza la constante/​patrón de centro de costo ya existente. Parte B añade `Actividad.lotesHechos Json?` (lista de ids de lote), un helper puro `textoLotesHechos`, checkboxes en `FormRegistrar` (solo Parcial/Reprogramada con >1 lote), y una 12ª columna en el Excel.

**Tech Stack:** Next.js 16 (App Router), Prisma 6 (Postgres/Neon, JSONB), React 19, Tailwind v4, Vitest, exceljs.

## Global Constraints

- Parte A: el select "Centro de costo" (— sin centro —, catálogo `CENTROS_COSTO` de `@/dominio/centro-costo`, `Otras…`) va en `FormActividadRealizada`, **solo Maquinaria**, **opcional**, patrón `__otra__` (input `centroCostoOtra`). La actividad creada es `CUMPLIDA` y guarda el centro.
- Parte B disparador: estado `PARCIAL` o `REPROGRAMADA` **y** `lotesActividad.length > 1`. NO restringido a Maquinaria. **Opcional** (puede no marcarse ninguno).
- Los lotes NO marcados NO vuelven al banco; la lógica de "vuelve al banco" de `registrarCumplimiento` NO cambia.
- `Actividad.lotesHechos Json?` guarda un `string[]` de **ids de lote** (subconjunto de `a.lotes`). Migración aditiva (JSONB nullable).
- Prisma `Json?`: NO acepta `null` directo de JS — para "sin dato" se **omite** el campo en el update; para guardar se castea a `Prisma.InputJsonValue` (`Prisma` ya está importado en `repositorio.ts`). (El `String?` `centroCosto` SÍ acepta null directo y se pasa tal cual.)
- `registrarCumplimiento` gana `lotesHechos: string[] = []` como ÚLTIMO parámetro (después de `centroCosto`), default `[]` (retrocompatible).
- `crearActividadRealizada` gana `centroCosto: string | null` en su objeto `datos`.
- Excel: nueva columna **"Potreros realizados"** como **12ª (última)** de `COLUMNAS_CUMPLIMIENTO`.
- Visualización en pantalla: línea registrada muestra `· ✅ Realizados: L1, L3` (nombres, vía `textoLotesHechos`).
- Migraciones nuevas: `prisma/migrations/20260621140000_lotes_hechos/migration.sql`.
- NO tocar flujo banco/reprogramación, Programar/grilla, Resumen, PDF.
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` (y `npm test` donde aplique). NO ejecutar app/seed/build local (base en Neon). `npx prisma generate` sí.
- AGENTS.md: `FormRegistrar` y `FormActividadRealizada` son `'use client'`; seguir los patrones existentes (el bloque `__otra__` y los checkboxes de día en `asignar-tarea-form.tsx`).
- Spec: `docs/superpowers/specs/2026-06-21-potreros-realizados-design.md`.

## File Structure

- `src/app/cumplimiento/form-actividad-realizada.tsx` — centro de costo (Parte A).
- `src/dominio/lotes-hechos.ts` (+ `.test.ts`) — NUEVO: `textoLotesHechos` (Parte B).
- `prisma/schema.prisma` — `lotesHechos Json?` en `Actividad`.
- `prisma/migrations/20260621140000_lotes_hechos/migration.sql` — NUEVO.
- `src/datos/repositorio.ts` — `crearActividadRealizada` (centroCosto, Parte A) y `registrarCumplimiento` (lotesHechos, Parte B).
- `src/app/cumplimiento/acciones.ts` — `agregarActividadRealizadaAccion` (centroCosto) y `registrarAccion` (lotesHechos).
- `src/app/cumplimiento/form-registrar.tsx` — checkboxes de potreros (Parte B).
- `src/app/cumplimiento/page.tsx` — pasar `lotesActividad`; mostrar "✅ Realizados".
- `src/dominio/cumplimiento-export.ts` (+ `.test.ts`) — columna "Potreros realizados" (12ª).
- `src/app/cumplimiento/exportar/route.ts` — pasar `lotesHechos` al helper.

---

## Task 1: Parte A — Centro de costo en "agregar actividad realizada"

**Files:**
- Modify: `src/app/cumplimiento/form-actividad-realizada.tsx`
- Modify: `src/app/cumplimiento/acciones.ts` (`agregarActividadRealizadaAccion` ~42-64)
- Modify: `src/datos/repositorio.ts` (`crearActividadRealizada` ~466-498)

**Interfaces:**
- Consumes: `CENTROS_COSTO` de `@/dominio/centro-costo` (ya existe).
- Produces: `crearActividadRealizada(datos)` con `datos.centroCosto: string | null`.

- [ ] **Step 1: `crearActividadRealizada` acepta y guarda centroCosto**

En `src/datos/repositorio.ts`, en el tipo del parámetro `datos` de `crearActividadRealizada` (~466-476), agregar tras `medida`:

```ts
  medida: number | null
  centroCosto: string | null
}) {
```

Y en el `data` del `prisma.actividad.create` (~483-496), agregar tras `haRealizada: datos.medida,`:

```ts
      haRealizada: datos.medida,
      centroCosto: datos.centroCosto,
      lotes: datos.loteId ? { connect: [{ id: datos.loteId }] } : undefined,
```

- [ ] **Step 2: El select en el formulario**

En `src/app/cumplimiento/form-actividad-realizada.tsx`:

1. Import (tras la línea de `etiquetaMedida`/`unidad`):

```tsx
import { CENTROS_COSTO } from '@/dominio/centro-costo'
```

2. Estado, junto a `const [desc, setDesc] = useState('')`:

```tsx
  const [centroCosto, setCentroCosto] = useState('')
```

3. Dentro del bloque `{esMaquinaria && (<> … </>)}`, después del `<label>` de la medida (el de `etiquetaMedida(unidadSel)`), agregar:

```tsx
          <label className="flex flex-col text-xs">
            Centro de costo
            <select
              name="centroCosto"
              value={centroCosto}
              onChange={(e) => setCentroCosto(e.target.value)}
              className="rounded border p-1 text-sm"
            >
              <option value="">— sin centro —</option>
              {CENTROS_COSTO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__otra__">Otras…</option>
            </select>
          </label>
          {centroCosto === '__otra__' && (
            <label className="flex flex-col text-xs">
              Otras (texto libre)
              <input name="centroCostoOtra" className="w-40 rounded border p-1 text-sm" />
            </label>
          )}
```

- [ ] **Step 3: La acción resuelve y pasa centroCosto**

En `src/app/cumplimiento/acciones.ts`, en `agregarActividadRealizadaAccion`, después de la línea de validación `if (!areaId || ... || !descripcion) return` y antes de `await crearActividadRealizada({`, agregar:

```ts
  const centroSelect = texto(form, 'centroCosto')
  const centroCosto = centroSelect === '__otra__' ? textoOpcional(form, 'centroCostoOtra') : (centroSelect || null)
```

Y en el objeto pasado a `crearActividadRealizada`, agregar tras `medida: numeroOpcional(form, 'medida'),`:

```ts
    medida: numeroOpcional(form, 'medida'),
    centroCosto,
  })
```

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/form-actividad-realizada.tsx src/app/cumplimiento/acciones.ts src/datos/repositorio.ts
git commit -m "fix(cumplimiento): centro de costo en el formulario de actividad realizada (maquinaria)"
```

---

## Task 2: Helper `textoLotesHechos` (TDD)

**Files:**
- Create: `src/dominio/lotes-hechos.ts`
- Create: `src/dominio/lotes-hechos.test.ts`

**Interfaces:**
- Produces: `textoLotesHechos(lotes: { id: string; nombre: string }[], ids: string[] | null | undefined): string` — nombres de los lotes (en el orden de `lotes`) cuyo id está en `ids`, unidos por `", "`; `''` si no hay.

- [ ] **Step 1: Escribir el test (RED)**

Crear `src/dominio/lotes-hechos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { textoLotesHechos } from './lotes-hechos'

describe('textoLotesHechos', () => {
  const lotes = [{ id: 'a', nombre: 'L1' }, { id: 'b', nombre: 'L2' }, { id: 'c', nombre: 'L3' }]
  it('lista los nombres marcados en el orden de lotes', () => {
    expect(textoLotesHechos(lotes, ['c', 'a'])).toBe('L1, L3')
  })
  it('ignora ids que no están en lotes', () => {
    expect(textoLotesHechos(lotes, ['b', 'zzz'])).toBe('L2')
  })
  it('devuelve cadena vacía sin ids', () => {
    expect(textoLotesHechos(lotes, null)).toBe('')
    expect(textoLotesHechos(lotes, undefined)).toBe('')
    expect(textoLotesHechos(lotes, [])).toBe('')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/dominio/lotes-hechos.test.ts`
Expected: FAIL — "Cannot find module './lotes-hechos'".

- [ ] **Step 3: Implementar (GREEN)**

Crear `src/dominio/lotes-hechos.ts`:

```ts
// Nombres de los lotes (en el orden de `lotes`) cuyo id está en `ids`. '' si no hay.
export function textoLotesHechos(
  lotes: { id: string; nombre: string }[],
  ids: string[] | null | undefined,
): string {
  if (!ids || ids.length === 0) return ''
  return lotes.filter((l) => ids.includes(l.id)).map((l) => l.nombre).join(', ')
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/dominio/lotes-hechos.test.ts`
Expected: PASS (3 casos).

- [ ] **Step 5: Suite + gate**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: suite verde (88 → 91, +3), sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/dominio/lotes-hechos.ts src/dominio/lotes-hechos.test.ts
git commit -m "feat(dominio): helper textoLotesHechos"
```

---

## Task 3: Esquema + migración + `registrarCumplimiento`

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Actividad`)
- Create: `prisma/migrations/20260621140000_lotes_hechos/migration.sql`
- Modify: `src/datos/repositorio.ts` (`registrarCumplimiento` ~377-392)

**Interfaces:**
- Produces:
  - `Actividad.lotesHechos` (Json nullable).
  - `registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo?, centroCosto?, lotesHechos?: string[])` — nuevo parámetro final, default `[]`, guardado (omitido si vacío).

- [ ] **Step 1: Campo en el esquema**

En `prisma/schema.prisma`, modelo `Actividad`, junto a `centroCosto` (agregado por la feature anterior), agregar:

```prisma
  lotesHechos Json?
```

- [ ] **Step 2: Migración**

Crear `prisma/migrations/20260621140000_lotes_hechos/migration.sql`:

```sql
-- Potreros donde realmente se realizó la actividad (parcial/reprogramada), ids de lote
ALTER TABLE "Actividad" ADD COLUMN "lotesHechos" JSONB;
```

- [ ] **Step 3: Regenerar el cliente**

Run: `npx prisma generate`
Expected: "Generated Prisma Client ...".

- [ ] **Step 4: `registrarCumplimiento` recibe y guarda lotesHechos**

En `src/datos/repositorio.ts`, en la firma de `registrarCumplimiento`, agregar el parámetro final (después de `centroCosto: string | null = null,`):

```ts
  centroCosto: string | null = null,
  lotesHechos: string[] = [],
) {
```

Y en el `prisma.actividad.update` de esa función, agregar `lotesHechos` al `data` (omitido si vacío, casteado si presente):

```ts
  await prisma.actividad.update({
    where: { id },
    data: {
      estado,
      motivoId,
      nota: notaFinal,
      haRealizada: reemplazo ? null : haRealizada,
      centroCosto,
      ...(lotesHechos.length ? { lotesHechos: lotesHechos as Prisma.InputJsonValue } : {}),
    },
  })
```

(El resto de la función no cambia. `Prisma` ya está importado al inicio del archivo.)

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (La llamada actual en `registrarAccion` sigue válida por el default `[]`; se actualizará en Task 4.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260621140000_lotes_hechos/migration.sql src/datos/repositorio.ts
git commit -m "feat(datos): lotesHechos en Actividad; registrarCumplimiento lo guarda"
```

---

## Task 4: UI — checkboxes de potreros + acción + visualización

**Files:**
- Modify: `src/app/cumplimiento/form-registrar.tsx`
- Modify: `src/app/cumplimiento/acciones.ts` (`registrarAccion` ~66-87)
- Modify: `src/app/cumplimiento/page.tsx` (uso de `FormRegistrar` ~199-210 y línea registrada ~211-218)

**Interfaces:**
- Consumes: `registrarCumplimiento(..., lotesHechos)` (Task 3); `textoLotesHechos` (Task 2).
- Produces: el form envía `loteHecho` (múltiple) con ids; `registrarAccion` los arma y los pasa.

- [ ] **Step 1: Prop + checkboxes en `FormRegistrar`**

En `src/app/cumplimiento/form-registrar.tsx`:

1. Agregar la prop al tipo del componente (junto a `haProgramada`):

```tsx
  haProgramada,
  lotesActividad,
  accion,
}: {
```

y en el bloque de tipos:

```tsx
  haProgramada: number
  lotesActividad: { id: string; nombre: string }[]
  accion: (formData: FormData) => void | Promise<void>
}) {
```

2. Tras la línea `const requiereMotivo = ...`, agregar:

```tsx
  const requierePotreros = (estado === 'PARCIAL' || estado === 'REPROGRAMADA') && lotesActividad.length > 1
```

3. Inmediatamente ANTES del bloque `{esCambio && (`, insertar:

```tsx
      {requierePotreros && (
        <div className="flex w-full flex-col gap-1 rounded border border-gray-200 bg-gray-50 p-2 text-xs">
          <span className="font-semibold text-gray-700">¿En cuáles potreros se realizó? (opcional)</span>
          <div className="flex flex-wrap gap-3">
            {lotesActividad.map((l) => (
              <label key={l.id} className="flex items-center gap-1">
                <input type="checkbox" name="loteHecho" value={l.id} className="accent-[#11603a]" />
                {l.nombre}
              </label>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 2: `registrarAccion` arma y pasa lotesHechos**

En `src/app/cumplimiento/acciones.ts`, dentro de `registrarAccion`, después de la línea que resuelve `centroCosto` (~75), agregar:

```ts
  const lotesHechos = form.getAll('loteHecho').map((v) => String(v))
```

Y cambiar la llamada `await registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo, centroCosto)` por:

```ts
  await registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo, centroCosto, lotesHechos)
```

- [ ] **Step 3: La página pasa `lotesActividad` y muestra "Realizados"**

En `src/app/cumplimiento/page.tsx`:

1. Import (junto a los otros imports de dominio, p. ej. tras el de `unidadDe`):

```tsx
import { textoLotesHechos } from '@/dominio/lotes-hechos'
```

2. En el uso de `<FormRegistrar ... />`, agregar la prop (tras `haProgramada={...}`):

```tsx
                  haProgramada={a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)}
                  lotesActividad={a.lotes}
                  accion={registrarAccion}
```

3. En la línea de actividad ya registrada, tras la línea del centro de costo (`{a.centroCosto && ...}`), agregar:

```tsx
                  {a.centroCosto && <span className="text-gray-500">· 🏷️ {a.centroCosto}</span>}
                  {textoLotesHechos(a.lotes, a.lotesHechos as string[] | null) && (
                    <span className="text-gray-500">· ✅ Realizados: {textoLotesHechos(a.lotes, a.lotesHechos as string[] | null)}</span>
                  )}
```

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/form-registrar.tsx src/app/cumplimiento/acciones.ts src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): marcar potreros realizados en parcial/reprogramada"
```

---

## Task 5: Columna "Potreros realizados" en el Excel (TDD)

**Files:**
- Modify: `src/dominio/cumplimiento-export.test.ts`
- Modify: `src/dominio/cumplimiento-export.ts`
- Modify: `src/app/cumplimiento/exportar/route.ts`

**Interfaces:**
- Consumes: `textoLotesHechos` (Task 2); `Actividad.lotesHechos` (Task 3).
- Produces: `COLUMNAS_CUMPLIMIENTO` con 12ª columna "Potreros realizados"; `ActividadExport` con `lotesHechos: string[] | null`.

- [ ] **Step 1: Actualizar el test (RED)**

En `src/dominio/cumplimiento-export.test.ts`:

1. En el helper `act(...)`, agregar `lotesHechos: null` (junto a `centroCosto: null`):

```ts
    bultosPorLote: null,
    centroCosto: null,
    lotesHechos: null,
    ...p,
  }
}
```

2. Reemplazar el `describe('COLUMNAS_CUMPLIMIENTO', …)` para 12 columnas:

```ts
describe('COLUMNAS_CUMPLIMIENTO', () => {
  it('tiene las 12 columnas en el orden acordado', () => {
    expect([...COLUMNAS_CUMPLIMIENTO]).toEqual([
      'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados',
    ])
  })
})
```

3. En las 5 aserciones `.toEqual([...])` de `filaCumplimiento`, agregar un `''` más al final de cada arreglo (la columna potreros, vacía en esos casos). Quedan con DOS `''` de cola previos (bultos, centro) más este = TRES `''` al final:

```ts
  it('actividad de ha con medida', () => {
    expect(filaCumplimiento(act({}), '15 jun', mapa)).toEqual(
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 3, 'ha', '', '', ''],
    )
  })
  it('actividad de hora usa "horas"', () => {
    expect(filaCumplimiento(act({ descripcion: 'ESTERCOLERO', haRealizada: 6 }), '16 jun', mapa)).toEqual(
      ['Lun', '16 jun', 'Ana', 'ESTERCOLERO', '6603', 'L1', 'Cumplida', 6, 'horas', '', '', ''],
    )
  })
  it('actividad de kg', () => {
    expect(filaCumplimiento(act({ descripcion: 'GRANEL', haRealizada: 100 }), '', mapa)).toEqual(
      ['Lun', '', 'Ana', 'GRANEL', '6603', 'L1', 'Cumplida', 100, 'kg', '', '', ''],
    )
  })
  it('sin medida deja medida y unidad vacías; traduce el estado', () => {
    expect(filaCumplimiento(act({ haRealizada: null, estado: 'NO_CUMPLIDA' }), '', mapa)).toEqual(
      ['Lun', '', 'Ana', 'ENCALADORA', '6603', 'L1', 'No cumplida', '', '', '', '', ''],
    )
  })
  it('descripción fuera del catálogo → ha; máquina y lotes vacíos; día 3 = Mié', () => {
    expect(filaCumplimiento(act({ descripcion: 'Algo libre', haRealizada: 2, maquina: null, lotes: [], dia: 3 }), '', mapa)).toEqual(
      ['Mié', '', 'Ana', 'Algo libre', '', '', 'Cumplida', 2, 'ha', '', '', ''],
    )
  })
```

(El caso de bultos sigue usando `[9]` y el de centro de costo `[10]`, sin cambios.)

4. Añadir un caso nuevo para potreros realizados (después del de centro de costo):

```ts
  it('incluye los potreros realizados cuando existen', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }, { id: 'l2', nombre: 'L2' }, { id: 'l3', nombre: 'L3' }],
      lotesHechos: ['l1', 'l3'],
    })
    expect(filaCumplimiento(a, '15 jun', mapa)[11]).toBe('L1, L3')
  })
```

- [ ] **Step 2: Correr el test y verificar que falla (RED)**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: FAIL — falta la columna 12 (longitud 11 vs 12), `lotesHechos` no existe en `ActividadExport`, `[11]` es `undefined`.

- [ ] **Step 3: Implementar (GREEN)**

En `src/dominio/cumplimiento-export.ts`:

1. Importar el helper (junto al import de `./bultos`):

```ts
import { textoLotesHechos } from './lotes-hechos'
```

2. Agregar la columna a `COLUMNAS_CUMPLIMIENTO` (último elemento):

```ts
export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados',
] as const
```

3. Agregar `lotesHechos` al tipo `ActividadExport` (después de `centroCosto`):

```ts
  bultosPorLote: BultosPorLote | null
  centroCosto: string | null
  lotesHechos: string[] | null
}
```

4. Agregar el valor al final del arreglo que devuelve `filaCumplimiento` (después de `a.centroCosto ?? ''`):

```ts
    a.centroCosto ?? '',
    textoLotesHechos(a.lotes, a.lotesHechos),
  ]
```

- [ ] **Step 4: Correr el test y verificar que pasa (GREEN)**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: PASS.

- [ ] **Step 5: El route pasa lotesHechos**

En `src/app/cumplimiento/exportar/route.ts`, el `ActividadExport.lotesHechos` es `string[] | null` y `a.lotesHechos` es Json, así que hay que castear igual que `bultosPorLote`. Cambiar la línea de la fila por:

```ts
    ws.addRow(filaCumplimiento({ ...a, bultosPorLote: a.bultosPorLote as BultosPorLote | null, lotesHechos: a.lotesHechos as string[] | null }, fecha, unidadPorNombre))
```

(El import de `BultosPorLote` ya existe en el route.)

- [ ] **Step 6: Gate completo**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; suite verde (91 → 92, +1 caso).

- [ ] **Step 7: Commit**

```bash
git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts src/app/cumplimiento/exportar/route.ts
git commit -m "feat(cumplimiento): columna 'Potreros realizados' en el Excel"
```

---

## Fase de despliegue (después del plan)

1. `git push` (respaldo).
2. **Deploy manual por CLI:** `npx vercel --prod --yes --scope ayura-llanos`. El build corre `prisma migrate deploy && next build` → aplica `20260621140000_lotes_hechos` (aditiva, sin pérdida de datos).
3. Verificación manual: (A) en "agregar actividad realizada" de maquinaria, elegir centro de costo; (B) registrar una fertilización de 2+ lotes como Parcial marcando 1 potrero → ver "✅ Realizados: …" en la línea y la columna "Potreros realizados" en el Excel.

---

## Self-Review (autor del plan)

**1. Cobertura de la spec:**
- Parte A: centro de costo en `FormActividadRealizada` + acción + `crearActividadRealizada` → Task 1. ✓
- Parte B helper `textoLotesHechos` + test → Task 2. ✓
- Parte B `lotesHechos Json?` + migración + `registrarCumplimiento` → Task 3. ✓
- Parte B checkboxes (Parcial/Reprogramada, >1 lote, opcional) + acción + display "✅ Realizados" → Task 4. ✓
- Parte B columna "Potreros realizados" (12ª) en Excel → Task 5. ✓
- Lotes no marcados NO vuelven al banco → no se toca la lógica de banco (Task 3 solo agrega al update). ✓
- Json null (omitir si vacío, cast InputJsonValue) → Task 3 Step 4 + constraints. ✓

**2. Placeholders:** sin "TBD"/"etc."; todo el código está completo. ✓

**3. Consistencia de tipos:**
- `textoLotesHechos(lotes, ids)` definido en Task 2; usado en Task 4 (page.tsx) y Task 5 (export). ✓
- `registrarCumplimiento(..., centroCosto, lotesHechos)` definido en Task 3, llamado en Task 4 con ambos en orden. ✓
- `lotesHechos: string[] | null` consistente entre `ActividadExport` (Task 5), el cast en page.tsx (Task 4) y el route (Task 5). ✓
- `lotesActividad: { id: string; nombre: string }[]` (Task 4 Step 1) alimentado por `a.lotes` (Task 4 Step 3). ✓
- `COLUMNAS_CUMPLIMIENTO` (12 columnas) y `ActividadExport` (con `lotesHechos`) consistentes entre def, test y route (Task 5). ✓
- Índices del test: bultos `[9]`, centro de costo `[10]`, potreros `[11]`. ✓
- `crearActividadRealizada` gana `centroCosto` (Task 1) — coherente con la columna `centroCosto` ya existente. ✓

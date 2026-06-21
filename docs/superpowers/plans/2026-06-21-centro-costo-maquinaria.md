# Centro de costo en Maquinaria (Cumplimiento) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir asignar un centro de costo (catálogo fijo + "Otras" libre) a las actividades de Maquinaria al registrar el cumplimiento, guardarlo en la actividad, mostrarlo en la línea registrada y exportarlo como columna en el Excel de Cumplimiento.

**Architecture:** Columna nullable `centroCosto String?` en `Actividad` (migración aditiva). El select vive en `FormRegistrar` (solo maquinaria, opcional, todos los estados); `registrarAccion` resuelve select/"Otras" y `registrarCumplimiento` lo guarda. El Excel gana la 11ª columna "Centro de costo".

**Tech Stack:** Next.js 16 (App Router), Prisma 6 (Postgres/Neon), React 19, Tailwind v4, Vitest, exceljs.

## Global Constraints

- Catálogo EXACTO: `Biodigestor`, `Ceba`, `Nelore`, `Maiz`, `Riego` (en ese orden), + opción `Otras…` (texto libre).
- Centro de costo: **opcional**, **solo Maquinaria**, visible en **todos los estados** (Cumplida/Parcial/No cumplida/Reprogramada). Se captura **al registrar el cumplimiento**.
- Valor guardado: el texto de la opción del catálogo; si es "Otras", el texto escrito (vacío ⇒ `null`).
- Dato en `Actividad.centroCosto String?`; migración **aditiva** (columna TEXT nullable). Sin backfill.
- Prisma: un `String?` SÍ acepta `null` directo (a diferencia de `Json?`), así que `centroCosto` se pasa tal cual (no se omite el campo).
- `registrarCumplimiento` gana el nuevo parámetro **al final** con default `null` (retrocompatible).
- La actividad de "cambio de actividad" creada por el reemplazo NO recibe centro de costo en esta versión.
- Excel: nueva columna **"Centro de costo"** como **11ª (última)** de `COLUMNAS_CUMPLIMIENTO`.
- NO tocar: Programar/grilla, PDF, Resumen, ni el flujo de otras áreas.
- Migración nueva: `prisma/migrations/20260621120000_centro_costo/migration.sql`.
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` (y `npm test` donde aplique). NO ejecutar app/seed/build local (base en Neon).
- AGENTS.md: este NO es el Next.js estándar — `FormRegistrar` es componente cliente `'use client'`; seguir los patrones existentes (el bloque "Otra…" de reemplazo ya presente).
- Spec: `docs/superpowers/specs/2026-06-21-centro-costo-maquinaria-design.md`.

## File Structure

- `prisma/schema.prisma` — `centroCosto String?` en `Actividad`.
- `prisma/migrations/20260621120000_centro_costo/migration.sql` — NUEVO.
- `src/datos/repositorio.ts` — `registrarCumplimiento` (param + update).
- `src/dominio/centro-costo.ts` — NUEVO: constante `CENTROS_COSTO`.
- `src/app/cumplimiento/form-registrar.tsx` — select "Centro de costo" + "Otras" (solo maquinaria).
- `src/app/cumplimiento/acciones.ts` — `registrarAccion` resuelve y pasa `centroCosto`.
- `src/app/cumplimiento/page.tsx` — mostrar 🏷️ en la línea registrada.
- `src/dominio/cumplimiento-export.ts` (+ `.test.ts`) — columna "Centro de costo" (11ª).
- `src/app/cumplimiento/exportar/route.ts` — verificar (pasa `centroCosto` por el spread).

---

## Task 1: Esquema + migración + repositorio

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Actividad`)
- Create: `prisma/migrations/20260621120000_centro_costo/migration.sql`
- Modify: `src/datos/repositorio.ts` (`registrarCumplimiento` ~377-391)

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `Actividad.centroCosto` (String nullable).
  - `registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo?, centroCosto?: string | null)` — nuevo parámetro final, default `null`, guardado en el `update`.

- [ ] **Step 1: Campo en el esquema**

En `prisma/schema.prisma`, modelo `Actividad`, junto a `nota`/`vecesReprogramada` (~línea 68-69), agregar:

```prisma
  centroCosto       String?
```

- [ ] **Step 2: Migración**

Crear `prisma/migrations/20260621120000_centro_costo/migration.sql`:

```sql
-- Centro de costo (texto libre o del catálogo) en actividades de maquinaria
ALTER TABLE "Actividad" ADD COLUMN "centroCosto" TEXT;
```

- [ ] **Step 3: Regenerar el cliente**

Run: `npx prisma generate`
Expected: "Generated Prisma Client ...".

- [ ] **Step 4: `registrarCumplimiento` recibe y guarda el centro de costo**

En `src/datos/repositorio.ts`, en la firma de `registrarCumplimiento` (~377-384), agregar el parámetro final:

```ts
export async function registrarCumplimiento(
  id: string,
  estado: string,
  motivoId: string | null,
  nota: string | null,
  haRealizada: number | null,
  reemplazo?: { descripcion: string; loteId: string | null; maquinaId: string | null; medida: number | null } | null,
  centroCosto: string | null = null,
) {
```

Y en el `prisma.actividad.update` de esa función (~388-391), agregar `centroCosto` al `data`:

```ts
  await prisma.actividad.update({
    where: { id },
    data: { estado, motivoId, nota: notaFinal, haRealizada: reemplazo ? null : haRealizada, centroCosto },
  })
```

(El resto de la función —novedad/banco y creación de la actividad de reemplazo— no cambia; la de reemplazo NO lleva centro de costo.)

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (La llamada existente en `registrarAccion` sigue válida por el default `null`; se actualizará en Task 2.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260621120000_centro_costo/migration.sql src/datos/repositorio.ts
git commit -m "feat(datos): centroCosto en Actividad; registrarCumplimiento lo guarda"
```

---

## Task 2: Captura (constante + formulario + acción) + visualización

**Files:**
- Create: `src/dominio/centro-costo.ts`
- Modify: `src/app/cumplimiento/form-registrar.tsx`
- Modify: `src/app/cumplimiento/acciones.ts` (`registrarAccion` ~66-87)
- Modify: `src/app/cumplimiento/page.tsx` (línea registrada ~211-218)

**Interfaces:**
- Consumes: `registrarCumplimiento(..., centroCosto)` (Task 1).
- Produces: el form de maquinaria envía `centroCosto` (select) y, si es `__otra__`, `centroCostoOtra`; `registrarAccion` arma el texto y lo pasa a `registrarCumplimiento`.

- [ ] **Step 1: Constante de dominio**

Crear `src/dominio/centro-costo.ts`:

```ts
// Centros de costo a los que se puede imputar una actividad de maquinaria.
// Además del catálogo, la UI ofrece "Otras…" (texto libre).
export const CENTROS_COSTO = ['Biodigestor', 'Ceba', 'Nelore', 'Maiz', 'Riego'] as const
```

- [ ] **Step 2: Select de centro de costo en el formulario**

En `src/app/cumplimiento/form-registrar.tsx`:

1. Import (después de la línea de `etiquetaMedida`/`unidad`):

```tsx
import { CENTROS_COSTO } from '@/dominio/centro-costo'
```

2. Estado local, junto a los otros `useState` (después de `const [reemplazoDesc, setReemplazoDesc] = useState('')`):

```tsx
  const [centroCosto, setCentroCosto] = useState('')
```

3. Justo DESPUÉS del bloque `{esMaquinaria && ( <label> … haRealizada … </label> )}` (el del campo de medida, ~líneas 83-95) y ANTES del bloque `{esCambio && (`, insertar:

```tsx
      {esMaquinaria && (
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
      )}
      {esMaquinaria && centroCosto === '__otra__' && (
        <label className="flex flex-col text-xs">
          Otras (texto libre)
          <input name="centroCostoOtra" className="w-40 rounded border p-1 text-sm" />
        </label>
      )}
```

(Aparece en todos los estados; es opcional —sin `required`—. Mismo patrón "__otra__" que el reemplazo.)

- [ ] **Step 3: La acción resuelve y pasa el centro de costo**

En `src/app/cumplimiento/acciones.ts`, dentro de `registrarAccion`, después de la línea `const haRealizada = numeroOpcional(form, 'haRealizada')` (~73), agregar:

```ts
  const centroSelect = texto(form, 'centroCosto')
  const centroCosto = centroSelect === '__otra__' ? textoOpcional(form, 'centroCostoOtra') : (centroSelect || null)
```

Y cambiar la llamada `await registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo)` (~85) por:

```ts
  await registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo, centroCosto)
```

- [ ] **Step 4: Mostrar el centro de costo en la línea registrada**

En `src/app/cumplimiento/page.tsx`, en el bloque de la actividad ya registrada (el `else` con `🔒 registrada`, ~211-218), después de la línea de `a.nota`:

```tsx
                  {a.nota && <span className="text-gray-500">· {a.nota}</span>}
                  {a.centroCosto && <span className="text-gray-500">· 🏷️ {a.centroCosto}</span>}
```

(`a.centroCosto` existe en el tipo porque Prisma devuelve la columna escalar tras Task 1 + `prisma generate`.)

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/dominio/centro-costo.ts src/app/cumplimiento/form-registrar.tsx src/app/cumplimiento/acciones.ts src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): centro de costo (catálogo + Otras) al registrar maquinaria"
```

---

## Task 3: Columna "Centro de costo" en el Excel (TDD)

**Files:**
- Modify: `src/dominio/cumplimiento-export.test.ts`
- Modify: `src/dominio/cumplimiento-export.ts`
- Modify: `src/app/cumplimiento/exportar/route.ts`

**Interfaces:**
- Consumes: `Actividad.centroCosto` (Task 1).
- Produces: `COLUMNAS_CUMPLIMIENTO` con 11ª columna "Centro de costo"; `ActividadExport` con `centroCosto: string | null`.

- [ ] **Step 1: Actualizar el test (RED)**

En `src/dominio/cumplimiento-export.test.ts`:

1. En el helper `act(...)`, agregar `centroCosto: null` (junto a `bultosPorLote: null`):

```ts
function act(p: Partial<ActividadExport>): ActividadExport {
  return {
    dia: 1,
    descripcion: 'ENCALADORA',
    estado: 'CUMPLIDA',
    haRealizada: 3,
    responsable: { nombre: 'Ana' },
    maquina: { nombre: '6603' },
    lotes: [{ id: 'l1', nombre: 'L1' }],
    bultosPorLote: null,
    centroCosto: null,
    ...p,
  }
}
```

2. Reemplazar el `describe('COLUMNAS_CUMPLIMIENTO', …)` para 11 columnas:

```ts
describe('COLUMNAS_CUMPLIMIENTO', () => {
  it('tiene las 11 columnas en el orden acordado', () => {
    expect([...COLUMNAS_CUMPLIMIENTO]).toEqual([
      'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo',
    ])
  })
})
```

3. En las 5 aserciones `.toEqual([...])` de `filaCumplimiento`, agregar un `''` más al final de cada arreglo esperado (la columna centro de costo, vacía en esos casos). Quedan:

```ts
  it('actividad de ha con medida', () => {
    expect(filaCumplimiento(act({}), '15 jun', mapa)).toEqual(
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 3, 'ha', '', ''],
    )
  })
  it('actividad de hora usa "horas"', () => {
    expect(filaCumplimiento(act({ descripcion: 'ESTERCOLERO', haRealizada: 6 }), '16 jun', mapa)).toEqual(
      ['Lun', '16 jun', 'Ana', 'ESTERCOLERO', '6603', 'L1', 'Cumplida', 6, 'horas', '', ''],
    )
  })
  it('actividad de kg', () => {
    expect(filaCumplimiento(act({ descripcion: 'GRANEL', haRealizada: 100 }), '', mapa)).toEqual(
      ['Lun', '', 'Ana', 'GRANEL', '6603', 'L1', 'Cumplida', 100, 'kg', '', ''],
    )
  })
  it('sin medida deja medida y unidad vacías; traduce el estado', () => {
    expect(filaCumplimiento(act({ haRealizada: null, estado: 'NO_CUMPLIDA' }), '', mapa)).toEqual(
      ['Lun', '', 'Ana', 'ENCALADORA', '6603', 'L1', 'No cumplida', '', '', '', ''],
    )
  })
  it('descripción fuera del catálogo → ha; máquina y lotes vacíos; día 3 = Mié', () => {
    expect(filaCumplimiento(act({ descripcion: 'Algo libre', haRealizada: 2, maquina: null, lotes: [], dia: 3 }), '', mapa)).toEqual(
      ['Mié', '', 'Ana', 'Algo libre', '', '', 'Cumplida', 2, 'ha', '', ''],
    )
  })
```

(El caso de bultos sigue usando índice `[9]` y no cambia.)

4. Añadir un caso nuevo para el centro de costo (después del de bultos):

```ts
  it('incluye el centro de costo cuando existe', () => {
    expect(filaCumplimiento(act({ centroCosto: 'Biodigestor' }), '15 jun', mapa)[10]).toBe('Biodigestor')
  })
```

- [ ] **Step 2: Correr el test y verificar que falla (RED)**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: FAIL — la columna 11 falta (longitud 10 vs 11), `centroCosto` no existe en el tipo `ActividadExport`, `[10]` es `undefined`.

- [ ] **Step 3: Implementar (GREEN)**

En `src/dominio/cumplimiento-export.ts`:

1. Agregar la columna a `COLUMNAS_CUMPLIMIENTO` (último elemento):

```ts
export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo',
] as const
```

2. Agregar `centroCosto` al tipo `ActividadExport` (después de `bultosPorLote`):

```ts
export type ActividadExport = {
  dia: number
  descripcion: string
  estado: string
  haRealizada: number | null
  responsable: { nombre: string }
  maquina: { nombre: string } | null
  lotes: { id: string; nombre: string }[]
  bultosPorLote: BultosPorLote | null
  centroCosto: string | null
}
```

3. Agregar el valor al final del arreglo que devuelve `filaCumplimiento` (después de `textoBultosPorLote(...)`):

```ts
    textoBultosPorLote(a.lotes, a.bultosPorLote),
    a.centroCosto ?? '',
  ]
```

- [ ] **Step 4: Correr el test y verificar que pasa (GREEN)**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar el route**

En `src/app/cumplimiento/exportar/route.ts`, la fila se arma con `filaCumplimiento({ ...a, bultosPorLote: a.bultosPorLote as BultosPorLote | null }, ...)`. Como `a` (de `listarActividades`) ahora trae la columna escalar `centroCosto` (`string | null`), el spread `...a` ya la incluye y satisface `ActividadExport` sin cambios. NO se requiere editar el route salvo que `tsc` se queje; si lo hace, NO castear (es `string | null`, asignable directo) — revisar que `a` realmente traiga `centroCosto`.

- [ ] **Step 6: Gate completo**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; suite verde (87 → 88, +1 caso).

- [ ] **Step 7: Commit**

```bash
git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts src/app/cumplimiento/exportar/route.ts
git commit -m "feat(cumplimiento): columna 'Centro de costo' en el Excel"
```

---

## Fase de despliegue (después del plan)

1. `git push` (respaldo).
2. **Deploy manual por CLI:** `npx vercel --prod --yes --scope ayura-llanos`. El build corre `prisma migrate deploy && next build` → aplica `20260621120000_centro_costo` (aditiva, sin pérdida de datos).
3. Verificación manual: registrar una actividad de maquinaria eligiendo un centro de costo del catálogo y otra con "Otras" (texto libre); ver 🏷️ en la línea registrada y la columna "Centro de costo" en el Excel.

---

## Self-Review (autor del plan)

**1. Cobertura de la spec:**
- `centroCosto String?` + migración aditiva → Task 1. ✓
- `registrarCumplimiento` nuevo param + guarda en update → Task 1. ✓
- Catálogo `CENTROS_COSTO` (5 valores exactos, en orden) → Task 2 Step 1. ✓
- Select + "Otras" en `FormRegistrar`, solo maquinaria, opcional, todos los estados → Task 2 Step 2. ✓
- `registrarAccion` resuelve select/"Otras" y lo pasa → Task 2 Step 3. ✓
- Visualización 🏷️ en línea registrada → Task 2 Step 4. ✓
- Columna "Centro de costo" (11ª) en Excel + tipo + helper → Task 3. ✓
- Reemplazo NO recibe centro de costo → Task 1 Step 4 (nota). ✓
- No Programar/PDF/Resumen/otras áreas → no tocados. ✓

**2. Placeholders:** sin "TBD"/"etc."; todo el código está completo. ✓

**3. Consistencia de tipos:**
- `centroCosto: string | null` consistente entre repo (Task 1), `ActividadExport` (Task 3) y la lectura `a.centroCosto` (Task 2 Step 4, Task 3). ✓
- `CENTROS_COSTO` (Task 2 Step 1) usado en el form (Task 2 Step 2). ✓
- `registrarCumplimiento(..., centroCosto)` definido en Task 1 y llamado en Task 2 Step 3. ✓
- `COLUMNAS_CUMPLIMIENTO` (11 columnas) y `ActividadExport` (con `centroCosto`) consistentes entre def, test y route (Task 3). ✓
- Índices del test: bultos en `[9]` (sin cambio), centro de costo en `[10]`. ✓

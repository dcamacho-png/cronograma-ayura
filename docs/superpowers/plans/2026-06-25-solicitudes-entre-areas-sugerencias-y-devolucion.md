# Solicitudes entre áreas: sugerencias, devolución con observación y acciones de banco — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enriquecer las solicitudes entre áreas con día sugerido (ambas variantes) y colaboradores + cuadro de descripción (solo estándar), permitir devolver con observación, y dar Eliminar/Editar/Reenviar en el banco del solicitante.

**Architecture:** Un módulo de dominio puro (`dominio/sugerencia.ts`) formatea las sugerencias. La persistencia son 3 columnas nuevas en `Tarea` (CSV/texto). Las acciones y el repositorio se extienden; la UI añade campos al form de solicitud (compartidos con un form de edición), la devolución con observación, y muestra la sugerencia al coordinador ejecutor.

**Tech Stack:** Next.js 16 (App Router, RSC, Server Actions), React 19, Prisma + Neon Postgres, Vitest, Tailwind v4.

## Global Constraints

- **Día sugerido = días de la semana** (CSV de `1..7`, 1=Lun … 7=Dom); aplica en **ambas** variantes (estándar y maquinaria). (Spec.)
- **Colaboradores sugeridos = responsables del área ejecutora (B)**; **solo estándar**. **Cuadro de descripción** (`detalle`) en solicitud estándar (maquinaria ya lo tenía). (Spec.)
- **Observación de devolución = opcional**, visible para el solicitante (A). (Spec.)
- **Sugerencia para B = solo mostrar** (texto), sin precargar el formulario de asignación. (Spec.)
- **Las sugerencias son no vinculantes**: la asignación real la sigue haciendo el coordinador de B; su flujo de asignación/cumplimiento NO cambia. (Spec.)
- **Migración aditiva** (columnas nullable, sin backfill); base Neon compartida (local = prod). (Spec / memoria `despliegue-nube`.)
- **Typecheck FIABLE** con tsconfig que excluye `.next` (tsc directo da falso-verde). (memoria `tsc-local-no-fiable`.)
- **Las 145 pruebas actuales deben seguir verdes.**

---

## Verification Harness (referenciado por las tareas)

**A) Typecheck fiable:**

```bash
cd /home/derlly/projects/cronograma
cat > tsconfig.tmpcheck.json <<'EOF'
{ "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "plugins": [] },
  "include": ["src/**/*.ts", "src/**/*.tsx", "next-env.d.ts"],
  "exclude": ["node_modules", ".next"] }
EOF
npx tsc --noEmit -p tsconfig.tmpcheck.json && echo "TYPECHECK OK"
rm -f tsconfig.tmpcheck.json tsconfig.tmpcheck.tsbuildinfo
```

**B) Tests:** `cd /home/derlly/projects/cronograma && npm run test`

**C) Servidor local** (la `DATABASE_URL` real está en `.claude/settings.local.json`):

```bash
cd /home/derlly/projects/cronograma
DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)
DATABASE_URL="$DB" npx next dev -p 3100   # background
```

**D) Screenshot/curl autenticado:** cookie `sesion` firmada con HMAC-SHA256 (secreto dev `cronograma-local-secret`) sobre el id del usuario; `ADMIN_ID=cmqme5i7300mvod5qt2g5hqco`. Ver memoria `verificacion-navegador`.

---

## Task 1: Esquema y migración

**Files:**
- Modify: `prisma/schema.prisma` (model `Tarea`)
- Create: `prisma/migrations/20260625130000_solicitud_sugerencias_y_devolucion/migration.sql`

**Interfaces:**
- Produces: columnas `Tarea.observacionDevolucion (String?)`, `Tarea.diasSugeridos (String?)`, `Tarea.responsablesSugeridosIds (String?)`. El cliente Prisma regenerado las expone en el tipo `Tarea`.

- [ ] **Step 1: Editar `prisma/schema.prisma`.** En `model Tarea`, tras la línea `detalle String?`, agregar:

```prisma
  observacionDevolucion String?
  diasSugeridos String?
  responsablesSugeridosIds String?
```

- [ ] **Step 2: Crear la migración** en `prisma/migrations/20260625130000_solicitud_sugerencias_y_devolucion/migration.sql`:

```sql
ALTER TABLE "Tarea" ADD COLUMN "observacionDevolucion" TEXT;
ALTER TABLE "Tarea" ADD COLUMN "diasSugeridos" TEXT;
ALTER TABLE "Tarea" ADD COLUMN "responsablesSugeridosIds" TEXT;
```

- [ ] **Step 3: Aplicar y regenerar** (apunta a la base Neon real):

```bash
cd /home/derlly/projects/cronograma
DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)
DATABASE_URL="$DB" npx prisma migrate deploy
DATABASE_URL="$DB" npx prisma generate
```

Expected: migración `20260625130000_solicitud_sugerencias_y_devolucion` aplicada; "Generated Prisma Client".

- [ ] **Step 4: Verificar columnas:**

```bash
cd /home/derlly/projects/cronograma
DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)
DATABASE_URL="$DB" node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.tarea.findFirst({select:{id:true,observacionDevolucion:true,diasSugeridos:true,responsablesSugeridosIds:true}}).then(r=>{console.log('OK columnas',r);return p.\$disconnect()})"
```

Expected: imprime el objeto con las 3 claves nuevas (valor `null`), sin error.

- [ ] **Step 5: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): sugerencias (días/colaboradores) y observación de devolución en Tarea"
```

---

## Task 2: `dominio/sugerencia.ts` — formato de sugerencias (TDD)

**Files:**
- Create: `src/dominio/sugerencia.ts`
- Test: `src/dominio/sugerencia.test.ts`

**Interfaces:**
- Produces:
  - `const DIAS_SEMANA: string[]` (índice 1..7 → 'Lun'…'Dom'; índice 0 = '')
  - `function parseCsv(csv: string | null): string[]`
  - `function etiquetaDias(csv: string | null): string`
  - `function etiquetaResponsables(csv: string | null, nombrePorId: Map<string, string>): string`
  - `function textoSugerencia(areaNombre: string, diasCsv: string | null, responsablesCsv: string | null, nombrePorId: Map<string, string>): string | null`

- [ ] **Step 1: Escribir el test** en `src/dominio/sugerencia.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseCsv, etiquetaDias, etiquetaResponsables, textoSugerencia } from './sugerencia'

describe('parseCsv', () => {
  it('parsea, trim y descarta vacíos', () => {
    expect(parseCsv(' a , b ,, c ')).toEqual(['a', 'b', 'c'])
    expect(parseCsv(null)).toEqual([])
    expect(parseCsv('')).toEqual([])
  })
})

describe('etiquetaDias', () => {
  it('CSV de días → nombres', () => {
    expect(etiquetaDias('1,3,5')).toBe('Lun, Mié, Vie')
  })
  it('vacío → ""', () => {
    expect(etiquetaDias(null)).toBe('')
    expect(etiquetaDias('')).toBe('')
  })
})

describe('etiquetaResponsables', () => {
  const mapa = new Map([['r1', 'Juan'], ['r2', 'Ana']])
  it('CSV de ids → nombres, omite ids sin nombre', () => {
    expect(etiquetaResponsables('r1,r2', mapa)).toBe('Juan, Ana')
    expect(etiquetaResponsables('r1,rX', mapa)).toBe('Juan')
  })
  it('vacío → ""', () => {
    expect(etiquetaResponsables(null, mapa)).toBe('')
  })
})

describe('textoSugerencia', () => {
  const mapa = new Map([['r1', 'Juan']])
  it('días + personas', () => {
    expect(textoSugerencia('Ganadería', '1,2', 'r1', mapa)).toBe('Sugerido por Ganadería: días Lun, Mar · personas Juan')
  })
  it('solo días (caso maquinaria, sin colaboradores)', () => {
    expect(textoSugerencia('Maíz', '4', null, mapa)).toBe('Sugerido por Maíz: días Jue')
  })
  it('null si no hay nada que sugerir', () => {
    expect(textoSugerencia('Ganadería', null, null, mapa)).toBeNull()
    expect(textoSugerencia('Ganadería', '', '', mapa)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla** — `npx vitest run src/dominio/sugerencia.test.ts`. Expected: FAIL ("Cannot find module './sugerencia'").

- [ ] **Step 3: Implementar** `src/dominio/sugerencia.ts`:

```ts
export const DIAS_SEMANA = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function parseCsv(csv: string | null): string[] {
  if (!csv) return []
  return csv.split(',').map((s) => s.trim()).filter(Boolean)
}

export function etiquetaDias(csv: string | null): string {
  return parseCsv(csv)
    .map((d) => DIAS_SEMANA[Number(d)] ?? '')
    .filter(Boolean)
    .join(', ')
}

export function etiquetaResponsables(csv: string | null, nombrePorId: Map<string, string>): string {
  return parseCsv(csv)
    .map((id) => nombrePorId.get(id))
    .filter((n): n is string => !!n)
    .join(', ')
}

export function textoSugerencia(
  areaNombre: string,
  diasCsv: string | null,
  responsablesCsv: string | null,
  nombrePorId: Map<string, string>,
): string | null {
  const d = etiquetaDias(diasCsv)
  const r = etiquetaResponsables(responsablesCsv, nombrePorId)
  const partes: string[] = []
  if (d) partes.push(`días ${d}`)
  if (r) partes.push(`personas ${r}`)
  if (partes.length === 0) return null
  return `Sugerido por ${areaNombre}: ${partes.join(' · ')}`
}
```

- [ ] **Step 4: Correr el test y verificar que pasa** — `npx vitest run src/dominio/sugerencia.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/sugerencia.ts src/dominio/sugerencia.test.ts
git commit -m "feat(dominio): formato de sugerencias de día y colaboradores"
```

---

## Task 3: Repositorio y acciones de solicitud

**Files:**
- Modify: `src/datos/repositorio.ts` (`crearSolicitud`, `devolverAlSolicitante`, `reenviarSolicitud`, nueva `editarSolicitud`)
- Modify: `src/app/tareas/acciones.ts` (`crearSolicitudAccion`, `devolverAlSolicitanteAccion`, nueva `editarSolicitudAccion`)

**Interfaces:**
- Consumes: nada de tareas previas (usa columnas de Task 1).
- Produces:
  - `crearSolicitud(areaEjecutoraId, descripcion, solicitadaPorAreaId, loteIds, bultosPorLote?, detalle?, diasSugeridos?: string | null, responsablesSugeridosIds?: string | null)`
  - `devolverAlSolicitante(id: string, observacion: string | null)`
  - `editarSolicitud(id: string, datos: { descripcion: string; detalle: string | null; loteIds: string[]; bultosPorLote: Record<string, number> | null; diasSugeridos: string | null; responsablesSugeridosIds: string | null })`
  - acción `editarSolicitudAccion(form: FormData)`

- [ ] **Step 1: `crearSolicitud`** en `repositorio.ts` — agregar los 2 parámetros y persistirlos. Reemplazar la función por:

```ts
export function crearSolicitud(
  areaEjecutoraId: string,
  descripcion: string,
  solicitadaPorAreaId: string,
  loteIds: string[],
  bultosPorLote: Record<string, number> | null = null,
  detalle: string | null = null,
  diasSugeridos: string | null = null,
  responsablesSugeridosIds: string | null = null,
) {
  return prisma.tarea.create({
    data: {
      areaId: areaEjecutoraId,
      descripcion,
      solicitadaPorAreaId,
      detalle,
      diasSugeridos,
      responsablesSugeridosIds,
      lotes: { connect: loteIds.map((id) => ({ id })) },
      ...(bultosPorLote ? { bultosPorLote } : {}),
    },
  })
}
```

- [ ] **Step 2: `devolverAlSolicitante` y `reenviarSolicitud`** en `repositorio.ts` — reemplazar por:

```ts
export function devolverAlSolicitante(id: string, observacion: string | null) {
  return prisma.tarea.update({
    where: { id },
    data: { estado: 'DEVUELTA', anioSel: null, semanaSel: null, observacionDevolucion: observacion },
  })
}

export function reenviarSolicitud(id: string) {
  return prisma.tarea.update({
    where: { id },
    data: { estado: 'PENDIENTE', anioSel: null, semanaSel: null, observacionDevolucion: null },
  })
}
```

- [ ] **Step 3: `editarSolicitud`** — añadir en `repositorio.ts` (junto a las anteriores):

```ts
export function editarSolicitud(
  id: string,
  datos: {
    descripcion: string
    detalle: string | null
    loteIds: string[]
    bultosPorLote: Record<string, number> | null
    diasSugeridos: string | null
    responsablesSugeridosIds: string | null
  },
) {
  return prisma.tarea.update({
    where: { id },
    data: {
      descripcion: datos.descripcion,
      detalle: datos.detalle,
      diasSugeridos: datos.diasSugeridos,
      responsablesSugeridosIds: datos.responsablesSugeridosIds,
      bultosPorLote: datos.bultosPorLote ?? undefined,
      lotes: { set: datos.loteIds.map((lid) => ({ id: lid })) },
    },
  })
}
```

- [ ] **Step 4: Acciones** en `src/app/tareas/acciones.ts`:
  - Añadir `editarSolicitud` al import de `@/datos/repositorio`.
  - En `crearSolicitudAccion`, antes del `await crearSolicitud(...)`, leer las sugerencias y pasarlas:

```ts
  const diasSugeridos = form.getAll('diaSugerido').map((v) => String(v).trim()).filter(Boolean).join(',') || null
  const responsablesSugeridosIds = form.getAll('responsableSugerido').map((v) => String(v).trim()).filter(Boolean).join(',') || null
  await crearSolicitud(areaEjecutoraId, descripcion, solicitanteAreaId, loteIds, Object.keys(bultos).length > 0 ? bultos : null, detalle, diasSugeridos, responsablesSugeridosIds)
```

  - Reemplazar `devolverAlSolicitanteAccion` por:

```ts
export async function devolverAlSolicitanteAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await devolverAlSolicitante(id, textoOpcional(form, 'observacion'))
  revalidatePath('/tareas')
}
```

  - Añadir la acción de edición (espeja la lógica de descripción de `crearSolicitudAccion`):

```ts
export async function editarSolicitudAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  const est = textoOpcional(form, 'estipulada')
  const descripcion = est === '__otra__'
    ? textoOpcional(form, 'otra')
    : (est ?? textoOpcional(form, 'descripcion'))
  if (!descripcion) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  for (const lid of loteIds) {
    const b = numeroOpcional(form, `bultos_${lid}`)
    if (b != null) bultos[lid] = b
  }
  const detalle = textoOpcional(form, 'detalle')
  const diasSugeridos = form.getAll('diaSugerido').map((v) => String(v).trim()).filter(Boolean).join(',') || null
  const responsablesSugeridosIds = form.getAll('responsableSugerido').map((v) => String(v).trim()).filter(Boolean).join(',') || null
  await editarSolicitud(id, { descripcion, detalle, loteIds, bultosPorLote: Object.keys(bultos).length > 0 ? bultos : null, diasSugeridos, responsablesSugeridosIds })
  revalidatePath('/tareas')
}
```

- [ ] **Step 5: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 6: Tests** — Harness B. Expected: 145 verdes (sin cambios de lógica de dominio).

- [ ] **Step 7: Commit**

```bash
git add src/datos/repositorio.ts src/app/tareas/acciones.ts
git commit -m "feat(tareas): repo+acciones para sugerencias, devolución con observación y edición"
```

---

## Task 4: Campos compartidos + FormSolicitar (crear)

**Files:**
- Create: `src/app/tareas/campos-sugerencia.tsx`
- Modify: `src/app/tareas/form-solicitar.tsx`
- Modify: `src/app/tareas/page.tsx` (pasar responsables por área a `FormSolicitar`)

**Interfaces:**
- Consumes: `DIAS_SEMANA` (Task 2); columnas (Task 1).
- Produces: `CasillasDias`, `CasillasColaboradores` (componentes cliente reutilizables por Task 5).

- [ ] **Step 1: Crear `src/app/tareas/campos-sugerencia.tsx`:**

```tsx
'use client'

import { DIAS_SEMANA } from '@/dominio/sugerencia'

export function CasillasDias({ seleccion = [] }: { seleccion?: string[] }) {
  const set = new Set(seleccion)
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <label key={d} className="flex items-center gap-1">
          <input type="checkbox" name="diaSugerido" value={d} defaultChecked={set.has(String(d))} className="accent-bosque" />
          {DIAS_SEMANA[d]}
        </label>
      ))}
    </div>
  )
}

export function CasillasColaboradores({
  responsables,
  seleccion = [],
}: {
  responsables: { id: string; nombre: string }[]
  seleccion?: string[]
}) {
  const set = new Set(seleccion)
  if (responsables.length === 0) return <p className="text-xs text-tierra">El área elegida no tiene responsables.</p>
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {responsables.map((r) => (
        <label key={r.id} className="flex items-center gap-1">
          <input type="checkbox" name="responsableSugerido" value={r.id} defaultChecked={set.has(r.id)} className="accent-bosque" />
          {r.nombre}
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: `form-solicitar.tsx`** — añadir el prop `responsablesPorArea` y los campos nuevos.
  - Ampliar el tipo de props con: `responsablesPorArea: Record<string, { id: string; nombre: string }[]>`.
  - Importar: `import { CasillasDias, CasillasColaboradores } from './campos-sugerencia'`.
  - Calcular `const responsablesB = responsablesPorArea[areaEjecutoraId] ?? []`.
  - En la **rama estándar** (el `else` final, hoy solo "Descripción" + lote), tras el `<input name="descripcion" ...>` añadir el cuadro de descripción, los días y los colaboradores:

```tsx
        <label className="flex flex-col text-sm">
          Descripción (opcional)
          <textarea name="detalle" rows={2} placeholder="Detalles / instrucciones" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span>Día sugerido (opcional)</span>
          <CasillasDias />
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span>Colaboradores sugeridos (opcional)</span>
          <CasillasColaboradores key={areaEjecutoraId} responsables={responsablesB} />
        </div>
```

  - En la **rama maquinaria** (el bloque `esMaquinaria ? (...)`), tras el bloque de lotes/detalle existente, añadir SOLO los días:

```tsx
          <div className="flex flex-col gap-1 text-sm">
            <span>Día sugerido (opcional)</span>
            <CasillasDias />
          </div>
```

- [ ] **Step 3: `tareas/page.tsx`** — proveer los responsables por área.
  - Importar `listarResponsablesTodos` (ya existe en el repo) en el import de `@/datos/repositorio`.
  - Añadir `listarResponsablesTodos()` al `Promise.all` y construir el mapa:

```tsx
  const [tareas, estipuladas, lotes, solicitudes, responsablesTodos] = await Promise.all([
    listarTareasPendientes(areaId),
    listarActividadesEstipuladas(),
    listarLotes(),
    listarSolicitudesDeArea(areaId),
    listarResponsablesTodos(),
  ])
  const responsablesPorArea: Record<string, { id: string; nombre: string }[]> = {}
  for (const r of responsablesTodos) {
    if (!r.activo) continue
    ;(responsablesPorArea[r.areaId] ??= []).push({ id: r.id, nombre: r.nombre })
  }
```

  - Pasar el prop al `FormSolicitar` existente: añadir `responsablesPorArea={responsablesPorArea}`.

- [ ] **Step 4: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 5: Verificación visual** — Harness C/D. Screenshot de `/tareas` (admin). Al elegir un área ejecutora estándar en "Solicitar a otra área", deben verse: cuadro de descripción, casillas Lun–Dom y colaboradores del área elegida. Eligiendo maquinaria: solo las casillas de día. Expected: campos presentes, estilo cálido.

- [ ] **Step 6: Commit**

```bash
git add src/app/tareas/campos-sugerencia.tsx src/app/tareas/form-solicitar.tsx src/app/tareas/page.tsx
git commit -m "feat(tareas): día sugerido (ambas variantes) y colaboradores (estándar) en solicitud"
```

---

## Task 5: Devolución con observación + acciones en el banco de A

**Files:**
- Create: `src/app/tareas/form-editar-solicitud.tsx`
- Modify: `src/app/tareas/page.tsx` (banco de B: devolver con observación; Mis solicitudes: observación + Eliminar/Editar/Reenviar)

**Interfaces:**
- Consumes: `CasillasDias`/`CasillasColaboradores` (Task 4); `editarSolicitudAccion`, `eliminarTareaAccion`, `reenviarSolicitudAccion`, `devolverAlSolicitanteAccion` (Task 3 / existentes); `parseCsv` (Task 2).
- `tareas/page.tsx` ya tiene `responsablesPorArea` (Task 4) y `solicitudes` (con `area` = B incluida, que trae `maqTareas` y demás banderas).

- [ ] **Step 1: Banco de B — devolver con observación.** En `tareas/page.tsx`, reemplazar el form de "Devolver al solicitante" (en el `<li>` de cada tarea con `t.solicitadaPorArea`) por uno con campo de observación:

```tsx
                    <form action={devolverAlSolicitanteAccion} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={t.id} />
                      <input name="observacion" placeholder="motivo (opcional)" className="w-44 rounded-lg border border-borde bg-marfil px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-bosque/40" />
                      <button className="text-sm text-amber-700 hover:underline">↩️ Devolver</button>
                    </form>
```

- [ ] **Step 2: Crear `src/app/tareas/form-editar-solicitud.tsx`** (cliente, con toggle; consciente de variante por `esMaquinaria`):

```tsx
'use client'

import { useState } from 'react'
import { SelectFincaLote } from '../_componentes/select-finca-lote'
import { PickerLotesBultos } from './picker-lotes-bultos'
import { CasillasDias, CasillasColaboradores } from './campos-sugerencia'

type Estipulada = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }

export function FormEditarSolicitud({
  id,
  esMaquinaria,
  descripcion,
  detalle,
  diasSeleccion,
  responsablesSeleccion,
  responsablesB,
  estipuladas,
  lotes,
  accion,
}: {
  id: string
  esMaquinaria: boolean
  descripcion: string
  detalle: string | null
  diasSeleccion: string[]
  responsablesSeleccion: string[]
  responsablesB: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  lotes: Lote[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-sm text-bosque hover:underline">
        ✏️ Editar
      </button>
    )
  }
  return (
    <form action={accion} className="mt-1 flex w-full flex-col gap-2 rounded-lg border border-borde bg-arena p-2 text-sm">
      <input type="hidden" name="id" value={id} />
      {esMaquinaria ? (
        <label className="flex flex-col text-xs">
          Actividad
          <select name="estipulada" defaultValue={descripcion} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
            {estipuladas.map((e) => (
              <option key={e.id} value={e.nombre}>{e.nombre}</option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col text-xs">
          Descripción
          <input name="descripcion" defaultValue={descripcion} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      <label className="flex flex-col text-xs">
        Descripción (opcional)
        <textarea name="detalle" rows={2} defaultValue={detalle ?? ''} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
      </label>
      <label className="flex flex-col text-xs">
        Finca y lote
        {esMaquinaria ? <PickerLotesBultos lotes={lotes} /> : <SelectFincaLote lotes={lotes} name="loteId" />}
      </label>
      <div className="flex flex-col gap-1 text-xs">
        <span>Día sugerido</span>
        <CasillasDias seleccion={diasSeleccion} />
      </div>
      {!esMaquinaria && (
        <div className="flex flex-col gap-1 text-xs">
          <span>Colaboradores sugeridos</span>
          <CasillasColaboradores responsables={responsablesB} seleccion={responsablesSeleccion} />
        </div>
      )}
      <div className="flex gap-2">
        <button className="rounded-lg bg-bosque px-3 py-1 text-xs font-semibold text-white">Guardar cambios</button>
        <button type="button" onClick={() => setAbierto(false)} className="text-tierra underline">cancelar</button>
      </div>
    </form>
  )
}
```

> Borde aceptado (fuera de alcance fino): al editar una solicitud de **maquinaria**, el `<select name="estipulada">` solo lista el catálogo; si la descripción original fue un "Otra…" personalizado, el select arrancará en la primera opción del catálogo. Es un caso raro (las de maquinaria casi siempre son del catálogo); no se añade el campo "Otra…" al form de edición para no recargarlo.

- [ ] **Step 3: Mis solicitudes de A — observación + acciones.** En `tareas/page.tsx`, en la sección "📨 Mis solicitudes a otras áreas", dentro del `<li>` de cada solicitud `s`:
  - Importar `FormEditarSolicitud` (`./form-editar-solicitud`), `FormEliminar` (`./form-eliminar` ya importado en page) y `parseCsv` (`@/dominio/sugerencia`).
  - Mostrar la observación cuando esté devuelta (tras el `<span>` de estado):

```tsx
                {s.estado === 'DEVUELTA' && s.observacionDevolucion && (
                  <div className="mt-1 text-xs italic text-tierra">Obs.: {s.observacionDevolucion}</div>
                )}
```

  - Reemplazar el bloque que hoy solo tiene "Reenviar" (el `{s.estado === 'DEVUELTA' && (...)}`) por las tres acciones:

```tsx
                {s.estado === 'DEVUELTA' && (
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <form action={reenviarSolicitudAccion}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-xs font-semibold text-arcilla hover:underline">Reenviar</button>
                    </form>
                    <FormEditarSolicitud
                      id={s.id}
                      esMaquinaria={s.area.maqTareas}
                      descripcion={s.descripcion}
                      detalle={s.detalle}
                      diasSeleccion={parseCsv(s.diasSugeridos)}
                      responsablesSeleccion={parseCsv(s.responsablesSugeridosIds)}
                      responsablesB={responsablesPorArea[s.areaId] ?? []}
                      estipuladas={estipuladas}
                      lotes={lotes}
                      accion={editarSolicitudAccion}
                    />
                    <FormEliminar accion={eliminarTareaAccion} id={s.id} etiqueta={s.descripcion} />
                  </div>
                )}
```

  - Añadir `editarSolicitudAccion` al import de `'./acciones'` en `page.tsx`.

> Nota: `listarSolicitudesDeArea` ya incluye `area` (B) con sus banderas `maq*` y devuelve los escalares nuevos (`observacionDevolucion`, `diasSugeridos`, `responsablesSugeridosIds`, `detalle`). `FormEliminar` pide confirmación (es el mismo de configuración/tareas).

- [ ] **Step 4: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 5: Verificación visual** — Harness C/D. Screenshot de `/tareas`. En el banco (rol con solicitudes recibidas) el botón Devolver muestra el campo de observación; en "Mis solicitudes" una `DEVUELTA` muestra la observación y los tres controles (Reenviar / ✏️ Editar / ✕). Al pulsar Editar se abre el form prellenado. Expected: todo presente y coherente.

- [ ] **Step 6: Commit**

```bash
git add src/app/tareas/form-editar-solicitud.tsx src/app/tareas/page.tsx
git commit -m "feat(tareas): devolver con observación y acciones eliminar/editar/reenviar en el banco"
```

---

## Task 6: Mostrar la sugerencia al coordinador ejecutor (Programar)

**Files:**
- Modify: `src/app/programar/page.tsx`

**Interfaces:**
- Consumes: `textoSugerencia` (Task 2); `porAsignar` (cada tarea trae `diasSugeridos`, `responsablesSugeridosIds`, `solicitadaPorArea`); `responsablesActivos` (ya cargados).

- [ ] **Step 1: Construir el mapa de nombres y mostrar la sugerencia.** En `programar/page.tsx`:
  - Importar: `import { textoSugerencia } from '@/dominio/sugerencia'`.
  - Tras calcular `responsablesActivos`, construir: `const nombrePorResp = new Map(responsables.map((r) => [r.id, r.nombre]))`.
  - En el `.map((t) => ...)` del bloque "📌 Tareas por asignar", dentro del `<li>`, **después** del `<AsignarTareaForm .../>` y antes del form "Devolver al banco", insertar:

```tsx
                  {(() => {
                    const sug = textoSugerencia(
                      t.solicitadaPorArea?.nombre ?? '',
                      t.diasSugeridos,
                      t.responsablesSugeridosIds,
                      nombrePorResp,
                    )
                    return sug ? <p className="mt-1 text-xs italic text-tierra">💡 {sug}</p> : null
                  })()}
```

> Nota: si la solicitud no tiene `solicitadaPorArea` (tarea propia, no solicitada) o no tiene sugerencias, `textoSugerencia` devuelve `null` y no se muestra nada. Para maquinaria, `responsablesSugeridosIds` es `null` → solo aparece la parte de días.

- [ ] **Step 2: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 3: Verificación visual** — Harness C/D. Screenshot de `/programar` (semana futura con una solicitud que tenga sugerencias). Debe verse "💡 Sugerido por {Área}: días … · personas …" junto al formulario de asignar. Expected: el texto aparece; B sigue asignando manualmente.

- [ ] **Step 4: Commit**

```bash
git add src/app/programar/page.tsx
git commit -m "feat(programar): mostrar sugerencia de día y colaboradores en tareas por asignar"
```

---

## Task 7: Verificación completa y despliegue

**Files:** posibles retoques menores.

- [ ] **Step 1: Typecheck** — Harness A. Expected: `TYPECHECK OK`.
- [ ] **Step 2: Tests** — Harness B. Expected: todos verdes (145 previos + los nuevos de `sugerencia.ts`).
- [ ] **Step 3: Round-trip funcional** (server local + DB; restaurar al final). Como admin:
  1. Crear una solicitud estándar (área ejecutora estándar) con descripción, 2 días y 1–2 colaboradores; crear una de maquinaria con 1 día.
  2. Confirmar en DB que `Tarea.diasSugeridos`/`responsablesSugeridosIds`/`detalle` quedaron con los valores esperados:

```bash
DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)
DATABASE_URL="$DB" node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.tarea.findMany({where:{solicitadaPorAreaId:{not:null}},select:{descripcion:true,diasSugeridos:true,responsablesSugeridosIds:true,detalle:true,estado:true,observacionDevolucion:true},orderBy:{descripcion:'asc'}}).then(r=>{console.log(r);return p.\$disconnect()})"
```

  3. Programar la solicitud (semana futura) y verificar en `/programar` que aparece "💡 Sugerido por …".
  4. Devolver una solicitud con observación; verificar en "Mis solicitudes" que se ve la observación + Reenviar/Editar/Eliminar.
  5. Editar una devuelta (cambiar día/colaborador) y confirmar el cambio en DB; Reenviar y confirmar que `observacionDevolucion` quedó `null` y estado `PENDIENTE`.
  6. **Restaurar**: eliminar las tareas de prueba creadas (por id) para no dejar datos en producción.
- [ ] **Step 4: Desplegar** (la migración se aplica en build con `prisma migrate deploy`; si ya se aplicó en Task 1 a la base compartida, es no-op):

```bash
cd /home/derlly/projects/cronograma
git push origin master
npx vercel@latest deploy --prod
```

Expected: build OK, `READY`. (Auto-deploy GitHub→Vercel NO conectado; se publica por CLI. Ver memoria `despliegue-nube`.)

- [ ] **Step 5: Verificar en vivo** — `curl -s https://cronograma-ayura.vercel.app/login` → 200.

---

## Self-review (cobertura del spec)

- 3 columnas nuevas en `Tarea` + migración aditiva → Task 1. ✓
- `dominio/sugerencia.ts` (parse/etiquetas/textoSugerencia, maquinaria solo días) → Task 2. ✓
- Repo: `crearSolicitud` extendido, `devolverAlSolicitante(+obs)`, `reenviarSolicitud` limpia obs, `editarSolicitud` → Task 3. ✓
- Acciones: crear (lee sugerencias), devolver (lee observación), editar → Task 3. ✓
- FormSolicitar: estándar (detalle+días+colaboradores), maquinaria (solo días); responsables por área → Task 4. ✓
- Campos compartidos (`CasillasDias`/`CasillasColaboradores`) → Task 4 (consumidos por Task 5). ✓
- Devolver con observación (banco de B) → Task 5. ✓
- Mis solicitudes: observación visible + Eliminar/Editar/Reenviar; edición consciente de variante → Task 5. ✓
- Sugerencia visible para B en Programar (maquinaria solo días) → Task 6. ✓
- Pruebas unitarias + no-regresión + verificación manual + despliegue → Tasks 2/7. ✓
- Sin cambios de lógica de negocio / asignación definitiva intacta → gates de tests en Tasks 3/7. ✓

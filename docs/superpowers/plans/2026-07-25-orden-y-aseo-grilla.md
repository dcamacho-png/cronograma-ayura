# Orden y aseo en la grilla — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a la grilla de `/programar` una fila compartida `🧹 Orden y aseo` que registra uno o varios encargados por día, global a todas las áreas, visible en pantalla y en la imagen de WhatsApp.

**Architecture:** Tabla nueva `OrdenAseo` (global por `anio/semana/dia/responsable`). Repositorio expone listar/agregar/quitar + listado global de responsables activos. Server actions con autorización global (permiso `programar`, no Visor, mismo candado de tiempo). La UI agrega una fila al final de `GrillaSemana` con chips + selector; `page.tsx` la alimenta y la pasa también a las grillas de exportación.

**Tech Stack:** Next.js (App Router, server actions), Prisma + Postgres (Neon), React Server Components, Tailwind v4, Vitest.

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-07-25-orden-y-aseo-grilla-design.md`.
- Migración a producción SOLO con `prisma migrate deploy` (el `build` ya lo corre). NUNCA `prisma migrate reset` contra producción.
- Typecheck fiable: `npx tsc --noEmit -p tsconfig.check.json` (NO `tsconfig.json`; `.next` corrupto da falso verde).
- Tests: `npm test` (Vitest). Solo la lógica pura del dominio se prueba con Vitest; repositorio, acciones y componentes server no tienen harness de DB — se validan con typecheck + verificación manual.
- Autorización de mutaciones: sesión válida + permiso. Orden y aseo es GLOBAL (sin dueño de área) → se aparta a propósito de `puedeMutarArea`; documentar en el código.
- Días: 1=lunes … 7=domingo.
- Estilo de commits del repo: mensajes en español con scope, p. ej. `feat(orden-aseo): …`.

---

### Task 1: Helper de dominio `agruparOrdenAseoPorDia`

Lógica pura que agrupa las asignaciones planas (una por responsable) en una lista por día 1..7, para que la UI y el export la consuman sin lógica adentro.

**Files:**
- Create: `src/dominio/orden-aseo.ts`
- Test: `src/dominio/orden-aseo.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type AsignacionOrdenAseo = { dia: number; responsableId: string; nombre: string }`
  - `type DiaOrdenAseo = { dia: number; encargados: { responsableId: string; nombre: string }[] }`
  - `function agruparOrdenAseoPorDia(asignaciones: AsignacionOrdenAseo[]): DiaOrdenAseo[]`
    — devuelve SIEMPRE 7 entradas (dia 1..7, en orden), cada una con sus encargados
    (ordenados por `nombre` asc); días sin encargados quedan con `encargados: []`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/dominio/orden-aseo.test.ts
import { describe, it, expect } from 'vitest'
import { agruparOrdenAseoPorDia } from './orden-aseo'

describe('agruparOrdenAseoPorDia', () => {
  it('devuelve 7 días en orden, vacíos cuando no hay encargados', () => {
    const r = agruparOrdenAseoPorDia([])
    expect(r.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(r.every((d) => d.encargados.length === 0)).toBe(true)
  })

  it('agrupa varios encargados en el mismo día, ordenados por nombre', () => {
    const r = agruparOrdenAseoPorDia([
      { dia: 3, responsableId: 'b', nombre: 'Bruno' },
      { dia: 3, responsableId: 'a', nombre: 'Ana' },
      { dia: 1, responsableId: 'c', nombre: 'Carla' },
    ])
    expect(r[0]).toEqual({ dia: 1, encargados: [{ responsableId: 'c', nombre: 'Carla' }] })
    expect(r[2].encargados.map((e) => e.nombre)).toEqual(['Ana', 'Bruno'])
    expect(r[1].encargados).toEqual([])
  })

  it('ignora asignaciones con día fuera de 1..7', () => {
    const r = agruparOrdenAseoPorDia([
      { dia: 0, responsableId: 'x', nombre: 'X' },
      { dia: 8, responsableId: 'y', nombre: 'Y' },
      { dia: 5, responsableId: 'z', nombre: 'Z' },
    ])
    expect(r[4].encargados).toEqual([{ responsableId: 'z', nombre: 'Z' }])
    expect(r.flatMap((d) => d.encargados)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dominio/orden-aseo.test.ts`
Expected: FAIL — no se puede importar `agruparOrdenAseoPorDia` (módulo/func no existe).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/dominio/orden-aseo.ts
export type AsignacionOrdenAseo = { dia: number; responsableId: string; nombre: string }
export type DiaOrdenAseo = { dia: number; encargados: { responsableId: string; nombre: string }[] }

// Agrupa las asignaciones planas (una fila por responsable-día) en 7 días fijos
// (1=lunes … 7=domingo), cada uno con sus encargados ordenados por nombre.
export function agruparOrdenAseoPorDia(asignaciones: AsignacionOrdenAseo[]): DiaOrdenAseo[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dia) => ({
    dia,
    encargados: asignaciones
      .filter((a) => a.dia === dia)
      .map((a) => ({ responsableId: a.responsableId, nombre: a.nombre }))
      .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')),
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dominio/orden-aseo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/orden-aseo.ts src/dominio/orden-aseo.test.ts
git commit -m "feat(orden-aseo): helper de dominio para agrupar encargados por día"
```

---

### Task 2: Modelo Prisma `OrdenAseo` + migración

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Responsable` ~línea 51; agregar modelo nuevo `OrdenAseo` al final de los modelos)
- Create: `prisma/migrations/20260725120000_orden_aseo/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: tabla `OrdenAseo` y el delegado Prisma `prisma.ordenAseo` con `@@unique([anio, semana, dia, responsableId])` (clave compuesta `anio_semana_dia_responsableId`).

- [ ] **Step 1: Agregar la relación inversa en `Responsable`**

En `prisma/schema.prisma`, dentro de `model Responsable`, agregar la línea de relación (junto a `actividades` y `novedades`):

```prisma
  actividades Actividad[]
  novedades   NovedadResponsable[]
  ordenAseo   OrdenAseo[]
  activo      Boolean     @default(true)
```

- [ ] **Step 2: Agregar el modelo `OrdenAseo`**

Al final del archivo `prisma/schema.prisma` (después del último modelo):

```prisma
model OrdenAseo {
  id            String      @id @default(cuid())
  anio          Int
  semana        Int
  dia           Int          // 1=lunes … 7=domingo
  responsableId String
  responsable   Responsable @relation(fields: [responsableId], references: [id], onDelete: Cascade)

  @@unique([anio, semana, dia, responsableId])
  @@index([anio, semana])
}
```

- [ ] **Step 3: Crear el SQL de migración**

```sql
-- prisma/migrations/20260725120000_orden_aseo/migration.sql
-- CreateTable
CREATE TABLE "OrdenAseo" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "semana" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "responsableId" TEXT NOT NULL,

    CONSTRAINT "OrdenAseo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrdenAseo_anio_semana_idx" ON "OrdenAseo"("anio", "semana");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenAseo_anio_semana_dia_responsableId_key" ON "OrdenAseo"("anio", "semana", "dia", "responsableId");

-- AddForeignKey
ALTER TABLE "OrdenAseo" ADD CONSTRAINT "OrdenAseo_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Responsable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerar el cliente Prisma y validar el esquema**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` sin errores (aparece `prisma.ordenAseo`).

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260725120000_orden_aseo/migration.sql
git commit -m "feat(orden-aseo): modelo OrdenAseo (tabla global por semana/día) + migración"
```

---

### Task 3: Funciones de repositorio

**Files:**
- Modify: `src/datos/repositorio.ts` (agregar cerca de `listarDedicaciones`/`dedicarTractor`, ~línea 59)

**Interfaces:**
- Consumes: `prisma` (ya importado en el archivo), `prisma.ordenAseo` (Task 2).
- Produces:
  - `function listarOrdenAseo(anio: number, semana: number): Promise<{ dia: number; responsableId: string; nombre: string }[]>`
  - `function agregarOrdenAseo(anio: number, semana: number, dia: number, responsableId: string): Promise<void>`
  - `function quitarOrdenAseo(anio: number, semana: number, dia: number, responsableId: string): Promise<void>`
  - `function listarTodosResponsables(): Promise<{ id: string; nombre: string; areaNombre: string }[]>`

- [ ] **Step 1: Agregar las 4 funciones**

En `src/datos/repositorio.ts`, después de `dedicarTractor` (~línea 59):

```typescript
// ————— Orden y aseo (fila global compartida por todas las áreas) —————
export async function listarOrdenAseo(anio: number, semana: number) {
  const filas = await prisma.ordenAseo.findMany({
    where: { anio, semana },
    include: { responsable: { select: { nombre: true } } },
  })
  return filas.map((f) => ({ dia: f.dia, responsableId: f.responsableId, nombre: f.responsable.nombre }))
}

export async function agregarOrdenAseo(anio: number, semana: number, dia: number, responsableId: string): Promise<void> {
  // Idempotente: si ya existe (mismo anio/semana/dia/responsable), no duplica.
  await prisma.ordenAseo.upsert({
    where: { anio_semana_dia_responsableId: { anio, semana, dia, responsableId } },
    create: { anio, semana, dia, responsableId },
    update: {},
  })
}

export async function quitarOrdenAseo(anio: number, semana: number, dia: number, responsableId: string): Promise<void> {
  await prisma.ordenAseo.deleteMany({ where: { anio, semana, dia, responsableId } })
}

export async function listarTodosResponsables() {
  const rs = await prisma.responsable.findMany({
    where: { activo: true },
    include: { area: { select: { nombre: true } } },
    orderBy: [{ area: { nombre: 'asc' } }, { nombre: 'asc' }],
  })
  return rs.map((r) => ({ id: r.id, nombre: r.nombre, areaNombre: r.area.nombre }))
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores (0). Confirma que `prisma.ordenAseo` y la clave compuesta `anio_semana_dia_responsableId` existen en el cliente generado.

- [ ] **Step 3: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(orden-aseo): repositorio listar/agregar/quitar + listado global de responsables"
```

---

### Task 4: Server actions + autorización global

**Files:**
- Modify: `src/app/programar/acciones.ts`

**Interfaces:**
- Consumes: `agregarOrdenAseo`, `quitarOrdenAseo` (Task 3); `usuarioActual` (`@/auth/sesion`); `puedeVer`, `esSoloLectura` (`@/auth/permisos`); `programacionAbierta` (`@/dominio/semana`).
- Produces:
  - `async function agregarOrdenAseoAccion(form: FormData): Promise<void>`
  - `async function quitarOrdenAseoAccion(form: FormData): Promise<void>`

- [ ] **Step 1: Ampliar imports**

En `src/app/programar/acciones.ts`:

- Agregar a la import de `@/datos/repositorio` (línea 5) los nombres `agregarOrdenAseo, quitarOrdenAseo`.
- Cambiar la import de permisos (línea 9) de:

```typescript
import { puedeMutarArea } from '@/auth/permisos'
```

a:

```typescript
import { puedeMutarArea, puedeVer, esSoloLectura } from '@/auth/permisos'
```

- [ ] **Step 2: Agregar el helper de autorización global y las dos acciones**

Al final de `src/app/programar/acciones.ts`:

```typescript
// Orden y aseo es un recurso GLOBAL (compartido por todas las áreas, sin dueño),
// así que NO se autoriza con puedeMutarArea. Basta con sesión válida, permiso de
// programar y no ser solo-lectura (Visor). ADMIN pasa; VISOR nunca.
async function autorizadoGlobalProgramar(): Promise<boolean> {
  const u = await usuarioActual()
  return !!u && puedeVer(u, 'programar') && !esSoloLectura(u)
}

export async function agregarOrdenAseoAccion(form: FormData) {
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  const dia = Number(texto(form, 'dia'))
  const responsableId = texto(form, 'responsableId')
  if (!responsableId || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  if (!Number.isInteger(dia) || dia < 1 || dia > 7) return
  if (!programacionAbierta(anio, semana)) return
  if (!(await autorizadoGlobalProgramar())) return
  await agregarOrdenAseo(anio, semana, dia, responsableId)
  revalidatePath('/programar')
}

export async function quitarOrdenAseoAccion(form: FormData) {
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  const dia = Number(texto(form, 'dia'))
  const responsableId = texto(form, 'responsableId')
  if (!responsableId || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  if (!Number.isInteger(dia) || dia < 1 || dia > 7) return
  if (!programacionAbierta(anio, semana)) return
  if (!(await autorizadoGlobalProgramar())) return
  await quitarOrdenAseo(anio, semana, dia, responsableId)
  revalidatePath('/programar')
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores (0).

- [ ] **Step 4: Commit**

```bash
git add src/app/programar/acciones.ts
git commit -m "feat(orden-aseo): server actions agregar/quitar con autorización global"
```

---

### Task 5: Fila de orden y aseo en `GrillaSemana`

**Files:**
- Modify: `src/app/programar/grilla-semana.tsx`

**Interfaces:**
- Consumes: `agruparOrdenAseoPorDia`, `AsignacionOrdenAseo` (Task 1); `agregarOrdenAseoAccion`, `quitarOrdenAseoAccion` (Task 4).
- Produces: props nuevos en `GrillaSemana`:
  - `conOrdenAseo?: boolean` (default `false`) — solo si es `true` se renderiza la fila. Necesario porque el PDF (`exportar/page.tsx`) reusa `GrillaSemana` y NO debe mostrarla.
  - `ordenAseo?: AsignacionOrdenAseo[]` (default `[]`)
  - `todosResponsables?: { id: string; nombre: string; areaNombre: string }[]` (default `[]`)

- [ ] **Step 1: Imports nuevos**

En `src/app/programar/grilla-semana.tsx`, agregar a las imports (junto a las de `./acciones`) los nombres `agregarOrdenAseoAccion, quitarOrdenAseoAccion`, y una import nueva:

```typescript
import { agruparOrdenAseoPorDia, type AsignacionOrdenAseo } from '@/dominio/orden-aseo'
```

En la import existente de `./acciones` (línea 3), añadir `agregarOrdenAseoAccion, quitarOrdenAseoAccion` a la lista.

- [ ] **Step 2: Añadir los props a la firma**

En la desestructuración de props de `GrillaSemana` agregar `conOrdenAseo = false`, `ordenAseo = []` y `todosResponsables = []`, y en el tipo:

```typescript
  conOrdenAseo = false,
  ordenAseo = [],
  todosResponsables = [],
}: {
  areaNombre: string
  anio: number
  semana: number
  fechas: Date[]
  responsables: { id: string; nombre: string; finca: { nombre: string } | null }[]
  actividades: ActividadGrilla[]
  novedades?: NovedadGrilla[]
  turnoEditable?: boolean
  esMaquinaria: boolean
  paraExportar?: boolean
  conOrdenAseo?: boolean
  ordenAseo?: AsignacionOrdenAseo[]
  todosResponsables?: { id: string; nombre: string; areaNombre: string }[]
}) {
```

- [ ] **Step 3: Construir la fila de orden y aseo**

Justo antes del `return (` de `GrillaSemana` (después de definir `filaFinca`), agregar el render de la fila:

```typescript
  const diasOrdenAseo = agruparOrdenAseoPorDia(ordenAseo)
  const filaOrdenAseo = (
    <tr key="orden-aseo" className="border-t-2 border-borde">
      <td className={`border border-borde bg-arena p-2 align-top font-semibold text-bosque ${paraExportar ? 'text-lg' : ''}`}>
        🧹 Orden y aseo
      </td>
      {diasOrdenAseo.map((d) => (
        <td key={d.dia} className="border border-borde p-2 align-top">
          <div className="flex flex-wrap gap-1">
            {d.encargados.map((e) => (
              <span
                key={e.responsableId}
                className={`inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 ${paraExportar ? 'text-sm' : 'text-xs'}`}
              >
                {e.nombre}
                {editable && (
                  <form action={quitarOrdenAseoAccion} className="inline">
                    <input type="hidden" name="anio" value={anio} />
                    <input type="hidden" name="semana" value={semana} />
                    <input type="hidden" name="dia" value={d.dia} />
                    <input type="hidden" name="responsableId" value={e.responsableId} />
                    <button type="submit" aria-label={`Quitar a ${e.nombre}`} className="text-red-600 hover:underline">✕</button>
                  </form>
                )}
              </span>
            ))}
          </div>
          {editable && (
            <form action={agregarOrdenAseoAccion} className="mt-1 flex items-center gap-1">
              <input type="hidden" name="anio" value={anio} />
              <input type="hidden" name="semana" value={semana} />
              <input type="hidden" name="dia" value={d.dia} />
              <select
                name="responsableId"
                defaultValue=""
                aria-label={`Agregar encargado día ${d.dia}`}
                className="w-full rounded-lg border border-borde bg-marfil p-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-bosque/40"
              >
                <option value="" disabled>+ agregar…</option>
                {todosResponsables.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre} — {r.areaNombre}</option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-bosque px-1.5 text-xs font-semibold text-white">➕</button>
            </form>
          )}
        </td>
      ))}
    </tr>
  )
```

Nota: `editable` ya existe en el scope (`const editable = turnoEditable && !paraExportar`), así que la fila se apaga sola en el modo export (imagen WhatsApp): solo chips, sin selector.

- [ ] **Step 4: Insertar la fila al final del `<tbody>`**

En el `<tbody>` del `return`, después del bloque que renderiza los grupos/responsables, agregar `{filaOrdenAseo}` como último hijo:

```tsx
            <tbody>
              {agrupar
                ? grupos.map((g, gi) => (
                    <Fragment key={`g-${g.finca ?? '__sin__'}`}>
                      {paraExportar && gi > 0 && filaCabezado(`head-${g.finca ?? '__sin__'}`)}
                      {filaFinca(g.finca)}
                      {g.responsables.map((r) => filaResponsable(r))}
                    </Fragment>
                  ))
                : responsables.map((r) => filaResponsable(r))}
              {conOrdenAseo && filaOrdenAseo}
            </tbody>
```

Nota: el PDF (`exportar/page.tsx`) NO pasa `conOrdenAseo`, así que la fila no aparece ahí (default `false`).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores (0).

- [ ] **Step 6: Commit**

```bash
git add src/app/programar/grilla-semana.tsx
git commit -m "feat(orden-aseo): fila de orden y aseo (chips + selector) en la grilla"
```

---

### Task 6: Alimentar la fila desde `page.tsx`

**Files:**
- Modify: `src/app/programar/page.tsx`

**Interfaces:**
- Consumes: `listarOrdenAseo`, `listarTodosResponsables` (Task 3); props `ordenAseo`, `todosResponsables` de `GrillaSemana` (Task 5).
- Produces: nada (wiring).

- [ ] **Step 1: Importar las funciones nuevas**

En el bloque de import de `@/datos/repositorio` (líneas 5-13) agregar `listarOrdenAseo` y `listarTodosResponsables`.

- [ ] **Step 2: Cargar los datos en paralelo**

Ampliar el `Promise.all` (líneas 64-71) para incluir las dos consultas nuevas:

```typescript
  const [responsables, actividades, porAsignar, maquinas, dedicacionesRaw, novedadesRaw, ordenAseo, todosResponsables] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarActividades(areaId, anio, semana),
    tareasPorAsignar(areaId, anio, semana),
    listarMaquinas(),
    listarDedicaciones(anio, semana),
    listarNovedadesEnRango(areaId, fechas[0], fechas[6]),
    listarOrdenAseo(anio, semana),
    listarTodosResponsables(),
  ])
```

- [ ] **Step 3: Pasar los props a la grilla de pantalla**

En el `<GrillaSemana>` principal (líneas 220-230), agregar los dos props:

```tsx
        <GrillaSemana
          areaNombre={areaActual.nombre}
          anio={anio}
          semana={semana}
          fechas={fechas}
          responsables={responsablesActivos}
          actividades={actividadesCronograma}
          novedades={novedades}
          turnoEditable={programable && !soloLectura}
          esMaquinaria={esMaquinaria}
          conOrdenAseo
          ordenAseo={ordenAseo}
          todosResponsables={todosResponsables}
        />
```

- [ ] **Step 4: Pasar los props a la grilla de exportación (imagen WhatsApp)**

En el `<GrillaSemana ... paraExportar />` dentro del `partesExport.map` (líneas 257-267), agregar `conOrdenAseo` y `ordenAseo={ordenAseo}` (NO se pasa `todosResponsables`: en export `paraExportar` apaga el selector, así que no hace falta):

```tsx
            <GrillaSemana
              areaNombre={areaActual.nombre}
              anio={anio}
              semana={semana}
              fechas={fechas}
              responsables={g.responsables}
              actividades={actividadesCronograma}
              novedades={novedades}
              esMaquinaria={esMaquinaria}
              conOrdenAseo
              ordenAseo={ordenAseo}
              paraExportar
            />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores (0).

- [ ] **Step 6: Commit**

```bash
git add src/app/programar/page.tsx
git commit -m "feat(orden-aseo): alimentar la fila en pantalla y en la imagen de WhatsApp"
```

---

### Task 7: Verificación integral

**Files:** ninguno (verificación).

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Suite de tests**

Run: `npm test`
Expected: todo verde, incluido `src/dominio/orden-aseo.test.ts` (3 tests).

- [ ] **Step 2: Typecheck final**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: 0 errores.

- [ ] **Step 3: Lint**

Run: `npx eslint src/dominio/orden-aseo.ts src/datos/repositorio.ts src/app/programar/acciones.ts src/app/programar/grilla-semana.tsx src/app/programar/page.tsx`
Expected: sin errores.

- [ ] **Step 4: Verificación manual local (con DB de desarrollo)**

Aplicar la migración en local y levantar el dev server:

Run: `npx prisma migrate deploy` (contra la DB de desarrollo local — NUNCA prod)
Run: `npm run dev`

Comprobar en `/programar`:
1. Aparece la fila `🧹 Orden y aseo` al final de la grilla.
2. En una semana editable (≤ lunes 11pm): el selector muestra responsables de TODAS las áreas (`nombre — área`); agregar uno lo muestra como chip; el `✕` lo quita.
3. Cambiar de área (o abrir otra área): la fila muestra los MISMOS encargados (es compartida).
4. En una semana ya cerrada (candado): la fila se ve pero sin selector ni `✕` (solo lectura).
5. Descargar/compartir la imagen de WhatsApp: la fila de orden y aseo aparece en la foto.
6. Abrir `/programar/exportar?anio=…&semana=…` (PDF, como ADMIN): la fila de orden y aseo NO aparece.

- [ ] **Step 5: Commit final (si hubo ajustes) y cierre**

Si algún paso requirió ajustes, commitear con `fix(orden-aseo): …`. Si no, no hay commit.

---

## Notas de despliegue

- Al hacer deploy, `build` corre `prisma migrate deploy` y aplica `20260725120000_orden_aseo` en producción (Neon) automáticamente. La migración solo CREA una tabla nueva → no toca datos existentes.
- Actualizar la memoria del proyecto con una entrada nueva de la feature tras verificar en producción.

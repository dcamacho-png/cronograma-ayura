# Responsables por finca en /programar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada responsable pueda tener una finca fija y que la grilla de `/programar` agrupe las filas por finca (con encabezados) cuando hay fincas asignadas, dejando el resto igual.

**Architecture:** `Responsable` gana una `fincaId` nullable. La agrupación de filas es una función pura de dominio (testeable) que consume `GrillaSemana` (compartida por pantalla, PNG y PDF). La finca se asigna/edita en `/configuracion` con formularios server-side.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), React 19, Prisma 6 + Postgres (Neon), TypeScript, Vitest, Tailwind v4.

## Global Constraints

- **Finca opcional y data-driven:** `fincaId` es nullable; NO se hardcodea "Ganadería" por nombre de área. Si ningún responsable de una grilla tiene finca, esa grilla se renderiza **igual que hoy** (sin filas de encabezado de grupo).
- La finca del responsable es solo para **organizar/ordenar** la grilla; NO cambia la finca de las actividades (que se deriva del lote), ni la asignación, ni el Excel de cumplimiento.
- Typecheck confiable: `npx tsc -p tsconfig.check.json --noEmit` (NO `tsconfig.json` a secas — falso rojo por `.next`).
- Tests de dominio: `npm test` (vitest). Estilo: `import { describe, it, expect } from 'vitest'`.
- Migración en dev: `npx prisma migrate dev`. En prod corre sola vía `prisma migrate deploy` (script `build`).
- Seguir estilos/paleta existentes (`border-borde`, `bg-arena`, `bg-marfil`, `text-bosque`, etc.).

---

### Task 1: Modelo de datos — `fincaId` en Responsable

**Files:**
- Modify: `prisma/schema.prisma`
- Create (generado): `prisma/migrations/<timestamp>_responsable_finca/migration.sql`

**Interfaces:**
- Produces: `Responsable.fincaId: string | null`, `Responsable.finca: Finca | null`, `Finca.responsables: Responsable[]`.

- [ ] **Step 1: Editar el modelo `Responsable`**

Reemplazar el modelo actual:

```prisma
model Responsable {
  id          String      @id @default(cuid())
  nombre      String
  areaId      String
  area        Area        @relation(fields: [areaId], references: [id])
  actividades Actividad[]
  activo      Boolean     @default(true)
}
```

por:

```prisma
model Responsable {
  id          String      @id @default(cuid())
  nombre      String
  areaId      String
  area        Area        @relation(fields: [areaId], references: [id])
  fincaId     String?
  finca       Finca?      @relation(fields: [fincaId], references: [id])
  actividades Actividad[]
  activo      Boolean     @default(true)
}
```

- [ ] **Step 2: Agregar la relación inversa en `Finca`**

En el modelo `Finca`, añadir la línea `responsables Responsable[]` junto a las otras relaciones. Reemplazar:

```prisma
model Finca {
  id          String      @id @default(cuid())
  nombre      String      @unique
  actividades Actividad[]
  tareas      Tarea[]
  lotes       Lote[]
  notasConservatorio NotaConservatorio[]
}
```

por:

```prisma
model Finca {
  id          String      @id @default(cuid())
  nombre      String      @unique
  actividades Actividad[]
  tareas      Tarea[]
  lotes       Lote[]
  responsables Responsable[]
  notasConservatorio NotaConservatorio[]
}
```

- [ ] **Step 3: Crear la migración y regenerar el cliente**

La `DATABASE_URL` real NO está en `.env` (vacía); está en `.claude/settings.local.json`. Correr con esa URL:

Run:
```bash
DBURL=$(grep -oE 'postgresql://[^"'"'"' ]+' .claude/settings.local.json | head -1)
DATABASE_URL="$DBURL" npx prisma migrate dev --name responsable_finca
```
Expected: crea `prisma/migrations/<timestamp>_responsable_finca/` con un `ALTER TABLE "Responsable" ADD COLUMN "fincaId"` y `prisma generate` corre OK. La columna es nullable → no pide default ni rompe filas existentes.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): fincaId opcional en Responsable"
```

---

### Task 2: Dominio — `agruparResponsablesPorFinca` (TDD)

**Files:**
- Create: `src/dominio/responsables-finca.ts`
- Test: `src/dominio/responsables-finca.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type ConFinca = { nombre: string; finca: { nombre: string } | null }
  agruparResponsablesPorFinca<T extends ConFinca>(rs: T[]): { finca: string | null; responsables: T[] }[]
  hayFincasAsignadas(grupos: { finca: string | null }[]): boolean
  ```
  Grupos: fincas ordenadas alfabéticamente primero, el grupo `finca: null` ("sin finca") siempre al final; responsables ordenados por `nombre` dentro de cada grupo. `hayFincasAsignadas` = existe algún grupo con `finca !== null`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/dominio/responsables-finca.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { agruparResponsablesPorFinca, hayFincasAsignadas } from './responsables-finca'

const r = (nombre: string, finca: string | null) => ({ id: nombre, nombre, finca: finca ? { nombre: finca } : null })

describe('agruparResponsablesPorFinca', () => {
  it('lista vacía → sin grupos', () => {
    expect(agruparResponsablesPorFinca([])).toEqual([])
  })

  it('todos sin finca → un solo grupo null ordenado por nombre', () => {
    const g = agruparResponsablesPorFinca([r('Zoe', null), r('Ana', null)])
    expect(g).toHaveLength(1)
    expect(g[0].finca).toBeNull()
    expect(g[0].responsables.map((x) => x.nombre)).toEqual(['Ana', 'Zoe'])
  })

  it('agrupa por finca (alfabético) y deja "sin finca" al final', () => {
    const g = agruparResponsablesPorFinca([
      r('Beto', 'La Esperanza'),
      r('Aldo', 'Bella Vista'),
      r('Nadie', null),
      r('Carlos', 'Bella Vista'),
    ])
    expect(g.map((x) => x.finca)).toEqual(['Bella Vista', 'La Esperanza', null])
    expect(g[0].responsables.map((x) => x.nombre)).toEqual(['Aldo', 'Carlos'])
    expect(g[2].responsables.map((x) => x.nombre)).toEqual(['Nadie'])
  })
})

describe('hayFincasAsignadas', () => {
  it('true si algún grupo tiene finca, false si solo hay grupo null', () => {
    expect(hayFincasAsignadas([{ finca: null }])).toBe(false)
    expect(hayFincasAsignadas([{ finca: 'X' }, { finca: null }])).toBe(true)
    expect(hayFincasAsignadas([])).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- responsables-finca`
Expected: FAIL (módulo `./responsables-finca` no existe).

- [ ] **Step 3: Implementar el módulo**

Crear `src/dominio/responsables-finca.ts`:

```ts
// Agrupa responsables por su finca (fija). Fincas en orden alfabético; el grupo
// "sin finca" (finca=null) siempre al final. Responsables ordenados por nombre
// dentro de cada grupo. Función pura: no depende del orden de entrada.
type ConFinca = { nombre: string; finca: { nombre: string } | null }

export function agruparResponsablesPorFinca<T extends ConFinca>(
  rs: T[],
): { finca: string | null; responsables: T[] }[] {
  const map = new Map<string | null, T[]>()
  for (const r of rs) {
    const k = r.finca?.nombre ?? null
    const arr = map.get(k)
    if (arr) arr.push(r)
    else map.set(k, [r])
  }
  const ordenNombre = (a: T, b: T) => a.nombre.localeCompare(b.nombre, 'es')
  const conFinca = [...map.entries()]
    .filter(([k]) => k !== null)
    .sort((a, b) => (a[0] as string).localeCompare(b[0] as string, 'es'))
    .map(([finca, responsables]) => ({ finca, responsables: [...responsables].sort(ordenNombre) }))
  const sinFinca = map.get(null)
  if (sinFinca) conFinca.push({ finca: null, responsables: [...sinFinca].sort(ordenNombre) })
  return conFinca
}

export function hayFincasAsignadas(grupos: { finca: string | null }[]): boolean {
  return grupos.some((g) => g.finca !== null)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- responsables-finca`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/responsables-finca.ts src/dominio/responsables-finca.test.ts
git commit -m "feat(dominio): agruparResponsablesPorFinca + hayFincasAsignadas"
```

---

### Task 3: Repositorio — finca en responsables

**Files:**
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Consumes: modelo de Task 1.
- Produces:
  - `listarResponsablesPorArea(areaId)` ahora incluye `finca` y ordena por finca+nombre.
  - `listarResponsablesTodos()` ahora incluye `finca`.
  - `crearResponsable(nombre: string, areaId: string, fincaId?: string | null)`.
  - `setResponsableFinca(id: string, fincaId: string | null): Promise<Responsable>`.

- [ ] **Step 1: `listarResponsablesPorArea` con finca y orden**

Reemplazar:

```ts
export function listarResponsablesPorArea(areaId: string) {
  return prisma.responsable.findMany({ where: { areaId }, orderBy: { nombre: 'asc' } })
}
```

por:

```ts
export function listarResponsablesPorArea(areaId: string) {
  return prisma.responsable.findMany({
    where: { areaId },
    include: { finca: true },
    orderBy: [{ finca: { nombre: 'asc' } }, { nombre: 'asc' }],
  })
}
```

- [ ] **Step 2: `crearResponsable` con finca opcional**

Reemplazar:

```ts
export function crearResponsable(nombre: string, areaId: string) {
  return prisma.responsable.create({ data: { nombre, areaId } })
}
```

por:

```ts
export function crearResponsable(nombre: string, areaId: string, fincaId?: string | null) {
  return prisma.responsable.create({ data: { nombre, areaId, fincaId: fincaId ?? null } })
}
```

- [ ] **Step 3: `listarResponsablesTodos` con finca + nueva `setResponsableFinca`**

Reemplazar:

```ts
export function listarResponsablesTodos() {
  return prisma.responsable.findMany({
    include: { area: true, _count: { select: { actividades: true } } },
    orderBy: { nombre: 'asc' },
  })
}
```

por:

```ts
export function listarResponsablesTodos() {
  return prisma.responsable.findMany({
    include: { area: true, finca: true, _count: { select: { actividades: true } } },
    orderBy: { nombre: 'asc' },
  })
}

export function setResponsableFinca(id: string, fincaId: string | null) {
  return prisma.responsable.update({ where: { id }, data: { fincaId } })
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(repo): finca en responsables (listar/crear/setResponsableFinca)"
```

---

### Task 4: Administración de finca en /configuracion

**Files:**
- Modify: `src/app/configuracion/acciones.ts`
- Modify: `src/app/configuracion/page.tsx`

**Interfaces:**
- Consumes: `crearResponsable(nombre, areaId, fincaId?)`, `setResponsableFinca(id, fincaId)` (Task 3); `listarResponsablesTodos()` que ahora trae `finca`; `fincas` ya cargadas en `page.tsx` (`listarFincas`).
- Produces: `cambiarFincaResponsableAccion(form: FormData)`.

- [ ] **Step 1: Importar `setResponsableFinca` en acciones**

En `src/app/configuracion/acciones.ts`, en el `import { ... } from '@/datos/repositorio'` (línea 5), agregar `setResponsableFinca` a la lista de nombres importados.

- [ ] **Step 2: `crearResponsableAccion` lee `fincaId` opcional**

Reemplazar:

```ts
export async function crearResponsableAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  const areaId = texto(form, 'areaId')
  if (!nombre || !areaId) faltanDatos()
  await correr(() => crearResponsable(nombre, areaId), 'Responsable agregado.')
}
```

por:

```ts
export async function crearResponsableAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  const areaId = texto(form, 'areaId')
  if (!nombre || !areaId) faltanDatos()
  const fincaId = textoOpcional(form, 'fincaId')
  await correr(() => crearResponsable(nombre, areaId, fincaId), 'Responsable agregado.')
}
```

- [ ] **Step 3: Nueva `cambiarFincaResponsableAccion`**

Justo después de `cambiarEstadoResponsableAccion` (que termina cerca de la línea 115), agregar:

```ts
export async function cambiarFincaResponsableAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  const fincaId = textoOpcional(form, 'fincaId')
  await correr(() => setResponsableFinca(id, fincaId), 'Finca del responsable actualizada.')
}
```

- [ ] **Step 4: UI — importar la nueva acción en page.tsx**

En `src/app/configuracion/page.tsx`, en el import de acciones (donde está `cambiarEstadoResponsableAccion`), agregar `cambiarFincaResponsableAccion`.

- [ ] **Step 5: UI — finca por responsable en la lista + finca en el form de crear**

Reemplazar el bloque de la sección Responsables (el `<ul>...</ul>` y el `<form action={crearResponsableAccion}>`) por esta versión, que agrega: (a) la finca actual + un mini-form para cambiarla en cada item, y (b) un `<select name="fincaId">` opcional en el form de crear:

```tsx
          <ul className="mb-3 flex flex-col gap-2">
            {responsables.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded bg-arena px-2 py-1 text-sm">
                <span className={r.activo ? '' : 'text-tierra/60'}>
                  {r.nombre} <span className="text-tierra">· {r.area.nombre}</span>
                  <span className="text-tierra"> · 🏠 {r.finca?.nombre ?? 'sin finca'}</span>
                  {!r.activo && <span className="text-tierra/60"> · (inactivo)</span>}
                </span>
                <form action={cambiarFincaResponsableAccion} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={r.id} />
                  <select name="fincaId" defaultValue={r.fincaId ?? ''} className="rounded-lg border border-borde bg-marfil p-1 text-xs focus:outline-none focus:ring-2 focus:ring-bosque/40">
                    <option value="">— sin finca —</option>
                    {fincas.map((f) => (
                      <option key={f.id} value={f.id}>{f.nombre}</option>
                    ))}
                  </select>
                  <button className="rounded-lg bg-bosque px-1.5 py-0.5 text-xs font-semibold text-white">✓</button>
                </form>
                <form action={cambiarEstadoResponsableAccion}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="activo" value={r.activo ? '0' : '1'} />
                  <button className="text-xs font-semibold text-bosque hover:underline">
                    {r.activo ? 'Dar de baja' : 'Reactivar'}
                  </button>
                </form>
                {r._count.actividades === 0 && (
                  <FormEliminar accion={eliminarResponsableAccion} id={r.id} etiqueta={r.nombre} />
                )}
              </li>
            ))}
          </ul>
          <form action={crearResponsableAccion} className="flex flex-wrap gap-2">
            <input name="nombre" required placeholder="Nombre del responsable" className="flex-1 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <select name="areaId" required className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            <select name="fincaId" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— sin finca —</option>
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
            <button className="rounded-lg bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores (en particular, `r.finca` y `r.fincaId` existen porque `listarResponsablesTodos` ahora incluye `finca`).

- [ ] **Step 7: Commit**

```bash
git add src/app/configuracion/acciones.ts src/app/configuracion/page.tsx
git commit -m "feat(config): asignar/cambiar finca de un responsable"
```

---

### Task 5: Grilla — agrupar filas por finca

**Files:**
- Modify: `src/app/programar/grilla-semana.tsx`

**Interfaces:**
- Consumes: `agruparResponsablesPorFinca`, `hayFincasAsignadas` (Task 2); responsables con `finca` (Task 3).
- Produces: `GrillaSemana` acepta `responsables: { id: string; nombre: string; finca: { nombre: string } | null }[]` y renderiza encabezados de finca cuando aplica.

- [ ] **Step 1: Import del dominio y cambio del tipo del prop**

En `src/app/programar/grilla-semana.tsx`:

- Agregar al inicio (junto a los otros imports):
  ```ts
  import { agruparResponsablesPorFinca, hayFincasAsignadas } from '@/dominio/responsables-finca'
  ```
- Cambiar el tipo del prop `responsables` en la firma del componente, de:
  ```ts
    responsables: { id: string; nombre: string }[]
  ```
  a:
  ```ts
    responsables: { id: string; nombre: string; finca: { nombre: string } | null }[]
  ```

- [ ] **Step 2: Extraer una función que renderiza la fila de un responsable**

Dentro del componente, ANTES del `return`, definir un helper local que produce el `<tr>` de un responsable (es exactamente el `<tr>` actual del `.map`, para reusarlo con y sin agrupación). Agregar:

```tsx
  const filaResponsable = (r: { id: string; nombre: string }) => (
    <tr key={r.id}>
      <td className="border border-borde p-2 font-medium">{r.nombre}</td>
      {DIAS.map((_, i) => {
        const dia = i + 1
        const celdas = actividades.filter((a) => a.responsableId === r.id && a.dia === dia)
        return (
          <td key={dia} className="border border-borde p-2 align-top">
            {celdas.map((a) => (
              <div key={a.id} className="mb-1 rounded-lg bg-green-50 p-1">
                <div>{a.descripcion}</div>
                {esMaquinaria && (editable ? (
                  <form action={actualizarActividadAccion} className="mt-0.5 flex items-center gap-1">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="descripcion" value={a.descripcion} />
                    <input type="hidden" name="anio" value={anio} />
                    <input type="hidden" name="semana" value={semana} />
                    <input aria-label="Turno" name="turno" defaultValue={a.turno} className="w-20 rounded-lg border border-borde bg-marfil p-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-bosque/40" />
                    <button type="submit" className="rounded-lg bg-bosque px-1.5 text-xs font-semibold text-white">✓</button>
                  </form>
                ) : (
                  a.turno && <div className={`text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>{a.turno}</div>
                ))}
                {a.maquina && <div className={`text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>🚜 {a.maquina.nombre}</div>}
                {a.finca && <div className={`text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>🏠 {a.finca.nombre}</div>}
                {a.tarea?.detalle && <div className={`whitespace-pre-line text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>📝 {a.tarea.detalle}</div>}
                <InfoLotes lotes={a.lotes} bultosPorLote={a.bultosPorLote as Record<string, number> | null} className="mt-1" tamano={paraExportar ? 'text-sm' : 'text-xs'} />
                {editable && a.tareaId && (
                  <>
                    <form action={devolverAAsignacionAccion} className="mt-0.5">
                      <input type="hidden" name="tareaId" value={a.tareaId} />
                      <input type="hidden" name="anio" value={anio} />
                      <input type="hidden" name="semana" value={semana} />
                      <button type="submit" className="text-xs text-amber-700 hover:underline">↩️ Devolver a asignar</button>
                    </form>
                    <form action={devolverGrillaAlBancoAccion} className="mt-0.5">
                      <input type="hidden" name="tareaId" value={a.tareaId} />
                      <input type="hidden" name="anio" value={anio} />
                      <input type="hidden" name="semana" value={semana} />
                      <button type="submit" className="text-xs text-tierra hover:underline">↩️ Devolver al banco</button>
                    </form>
                  </>
                )}
                {editable && !a.tareaId && (
                  <form action={devolverActividadAlBancoAccion} className="mt-0.5">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="anio" value={anio} />
                    <input type="hidden" name="semana" value={semana} />
                    <button type="submit" className="text-xs text-tierra hover:underline">↩️ Devolver al banco</button>
                  </form>
                )}
              </div>
            ))}
          </td>
        )
      })}
    </tr>
  )
```

- [ ] **Step 3: Calcular los grupos y una fila-encabezado de finca**

Debajo de `filaResponsable`, agregar:

```tsx
  const grupos = agruparResponsablesPorFinca(responsables)
  const agrupar = hayFincasAsignadas(grupos)
  const filaFinca = (nombre: string | null) => (
    <tr key={`finca-${nombre ?? '__sin__'}`}>
      <td colSpan={8} className={`border border-borde bg-arena/60 p-2 font-semibold text-bosque ${paraExportar ? 'text-lg' : ''}`}>
        🏠 {nombre ?? 'Sin finca'}
      </td>
    </tr>
  )
```

- [ ] **Step 4: Reemplazar el `<tbody>` para usar grupos o el modo actual**

Reemplazar el bloque actual del `<tbody>` (el que hace `{responsables.map((r, idx) => ( <Fragment ...> ... </Fragment> ))}`) por:

```tsx
            <tbody>
              {agrupar
                ? grupos.map((g) => (
                    <Fragment key={`g-${g.finca ?? '__sin__'}`}>
                      {paraExportar && filaCabezado(`head-${g.finca ?? '__sin__'}`)}
                      {filaFinca(g.finca)}
                      {g.responsables.map((r) => filaResponsable(r))}
                    </Fragment>
                  ))
                : responsables.map((r, idx) => (
                    <Fragment key={r.id}>
                      {paraExportar && idx > 0 && idx % 5 === 0 && filaCabezado(`rep-${idx}`)}
                      {filaResponsable(r)}
                    </Fragment>
                  ))}
            </tbody>
```

Notas:
- Cuando NO se agrupa, es el comportamiento actual idéntico (incluida la repetición de cabecera cada 5 filas al exportar).
- Cuando se agrupa, al exportar se repite la cabecera de días al inicio de cada grupo (más legible por finca) en vez de cada 5 filas.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores. Los dos call-sites (`programar/page.tsx` y `programar/exportar/page.tsx`) pasan la lista de `listarResponsablesPorArea`, que ahora incluye `finca`, así que el tipo encaja sin tocarlos.

- [ ] **Step 6: Correr los tests de dominio (no deben romperse)**

Run: `npm test`
Expected: PASS (incluye `responsables-finca`).

- [ ] **Step 7: Commit**

```bash
git add src/app/programar/grilla-semana.tsx
git commit -m "feat(programar): agrupar responsables por finca en la grilla"
```

---

### Task 6: Verificación end-to-end en navegador

**Files:** ninguno (solo verificación).

Levantar dev con la `DATABASE_URL` real (está en `.claude/settings.local.json`, no en `.env`). Iniciar sesión como ADMIN.

- [ ] **Step 1: Asignar fincas en /configuracion**

Ir a `/configuracion` → sección Responsables. A 2+ responsables de Ganadería asignarles finca (usar el `<select>` + "✓" de cada uno); dejar alguno "sin finca". Confirmar que el texto "🏠 <finca>" se actualiza tras guardar.

- [ ] **Step 2: Ver la grilla agrupada**

Ir a `/programar?area=<idGanadería>&anio=&semana=` en una **semana futura**. Confirmar: filas-encabezado "🏠 <finca>" por finca (alfabéticas), responsables bajo su finca, y los sin finca al final bajo "Sin finca".

- [ ] **Step 3: Regresión Maquinaria**

Cambiar a área **Maquinaria** (nadie con finca). Confirmar que la grilla se ve **igual que antes**, sin filas-encabezado de finca.

- [ ] **Step 4: Export PNG/PDF**

Descargar la imagen (botón "Descargar imagen") y abrir el PDF (`/programar/exportar?...` como ADMIN). Confirmar que la agrupación por finca aparece también ahí.

- [ ] **Step 5: Registrar resultado**

Sin commit de código; anotar el resultado de la verificación.

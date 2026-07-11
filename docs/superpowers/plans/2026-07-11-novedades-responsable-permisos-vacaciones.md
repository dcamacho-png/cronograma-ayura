# Novedades por responsable (permisos y vacaciones) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar permisos y vacaciones por responsable, verlos en la grilla de `/programar` (y en la imagen exportada), y reportar días de ausencia por persona en un resumen mensual en `/resumen`.

**Architecture:** Modelo nuevo `NovedadResponsable` con rango de fechas reales (`@db.Date`). Un módulo de dominio puro `ausencias.ts` (con tests) calcula qué días de la semana cubre una novedad y agrega los días del mes por persona. La grilla y el resumen consumen ese dominio; las mutaciones van por server actions con el candado Visor y guard de semana futura ya existentes.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 6 + Neon Postgres, React 19, Tailwind v4, Vitest.

## Global Constraints

- **Migraciones a mano:** este repo NO usa `prisma migrate dev`. Se escribe el folder de migración con timestamp fijo y `migration.sql`; `prisma migrate deploy` (en `npm run build`) la aplica en Vercel. **NUNCA** `migrate reset` ni `migrate dev` contra la BD de producción.
- **Candado Visor:** toda server action mutante empieza con `if (await bloqueadoVisor()) return`.
- **Solo semana futura:** crear/borrar novedades solo si `esSemanaFutura(anio, semana, semanaActual())` (igual que el resto de `/programar`).
- **Typecheck fiable:** verificar con `npx tsc -p tsconfig.check.json --noEmit` (el `tsc` normal da falso-verde por `.next`).
- **Nombre de módulo:** el dominio nuevo se llama **`ausencias.ts`** (NO `novedades.ts`: ese nombre YA existe para el log de novedades de una Actividad).
- **Tests:** correr con `npm test` (vitest run). Solo se testea dominio puro.
- **Fechas UTC:** todo se compara por día UTC (los `Date` de `fechasDeSemana` y de `@db.Date` son medianoche UTC).

---

## File Structure

- `prisma/schema.prisma` — modelo `NovedadResponsable` + relación en `Responsable` (modificar).
- `prisma/migrations/20260711120000_novedad_responsable/migration.sql` — SQL de creación (crear).
- `src/dominio/ausencias.ts` — dominio puro: `diasCubiertos`, `resumenAusenciasMes`, tipos (crear).
- `src/dominio/ausencias.test.ts` — tests del dominio (crear).
- `src/datos/repositorio.ts` — `crearNovedadResponsable`, `eliminarNovedadResponsable`, `listarNovedadesEnRango` (modificar).
- `src/app/programar/acciones.ts` — `crearNovedadResponsableAccion`, `eliminarNovedadResponsableAccion` + helper `fechaUTC` (modificar).
- `src/app/programar/form-novedad.tsx` — client component del formulario "＋ Novedad" (crear).
- `src/app/programar/grilla-semana.tsx` — prop `novedades`, chips por día, lista+borrar en celda del nombre (modificar).
- `src/app/programar/page.tsx` — cargar novedades de la semana y pasarlas a la grilla (modificar).
- `src/app/resumen/page.tsx` — cargar ausencias del mes y pasarlas al componente (modificar).
- `src/app/resumen/resumen-area.tsx` — sección colapsable "🌴 Ausencias del mes" (modificar).

---

## Task 1: Modelo y migración

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Responsable` ~línea 48; añadir modelo nuevo al final o tras `Motivo`)
- Create: `prisma/migrations/20260711120000_novedad_responsable/migration.sql`

**Interfaces:**
- Produces: tabla/modelo `NovedadResponsable { id, responsableId, tipo, fechaInicio, fechaFin, horario?, nota?, creadoEn }` y `Responsable.novedades`.

- [ ] **Step 1: Añadir el modelo a `schema.prisma`**

Añadir el modelo (por ejemplo después del modelo `Motivo`):

```prisma
model NovedadResponsable {
  id            String      @id @default(cuid())
  responsableId String
  responsable   Responsable @relation(fields: [responsableId], references: [id], onDelete: Cascade)
  tipo          String      // "VACACIONES" | "PERMISO"
  fechaInicio   DateTime    @db.Date
  fechaFin      DateTime    @db.Date
  horario       String?
  nota          String?
  creadoEn      DateTime    @default(now())

  @@index([responsableId])
}
```

- [ ] **Step 2: Añadir la relación inversa en `Responsable`**

En el modelo `Responsable`, junto a `actividades Actividad[]`, agregar:

```prisma
  novedades   NovedadResponsable[]
```

- [ ] **Step 3: Escribir el SQL de la migración**

Crear `prisma/migrations/20260711120000_novedad_responsable/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "NovedadResponsable" (
    "id" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "horario" TEXT,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovedadResponsable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovedadResponsable_responsableId_idx" ON "NovedadResponsable"("responsableId");

-- AddForeignKey
ALTER TABLE "NovedadResponsable" ADD CONSTRAINT "NovedadResponsable_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Responsable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerar el cliente Prisma**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" sin errores.

- [ ] **Step 5: Verificar que el esquema valida contra la migración**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀"

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260711120000_novedad_responsable
git commit -m "feat(db): modelo NovedadResponsable (permisos y vacaciones)"
```

---

## Task 2: Dominio `ausencias.ts` (TDD)

**Files:**
- Create: `src/dominio/ausencias.ts`
- Test: `src/dominio/ausencias.test.ts`

**Interfaces:**
- Produces:
  - `type NovedadRango = { id: string; responsableId: string; tipo: 'VACACIONES' | 'PERMISO'; fechaInicio: Date; fechaFin: Date; horario: string | null; nota: string | null }`
  - `diasCubiertos(nov: NovedadRango, fechas: Date[]): number[]` — devuelve los índices-día 1..7 de `fechas` que caen dentro de `[fechaInicio, fechaFin]`.
  - `type AusenciaResumen = { responsableId: string; nombre: string; vacaciones: number; permiso: number; detalle: { tipo: 'VACACIONES' | 'PERMISO'; fechaInicio: Date; fechaFin: Date; horario: string | null; nota: string | null }[] }`
  - `resumenAusenciasMes(novedades: (NovedadRango & { nombre: string })[], primerDia: Date, ultimoDia: Date): AusenciaResumen[]` — agrupa por responsable y suma días de ausencia intersectados con `[primerDia, ultimoDia]`, ordenado por nombre.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/dominio/ausencias.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { diasCubiertos, resumenAusenciasMes, type NovedadRango } from './ausencias'

const d = (s: string) => new Date(s + 'T00:00:00.000Z')
// Semana con lunes 2026-07-06 … domingo 2026-07-12.
const semana = Array.from({ length: 7 }, (_, i) => d(`2026-07-${String(6 + i).padStart(2, '0')}`))

const nov = (over: Partial<NovedadRango>): NovedadRango => ({
  id: 'n1', responsableId: 'r1', tipo: 'VACACIONES',
  fechaInicio: d('2026-07-06'), fechaFin: d('2026-07-06'), horario: null, nota: null, ...over,
})

describe('diasCubiertos', () => {
  it('permiso de un día cae en su día', () => {
    expect(diasCubiertos(nov({ tipo: 'PERMISO', fechaInicio: d('2026-07-08'), fechaFin: d('2026-07-08') }), semana)).toEqual([3])
  })

  it('rango que empieza antes del lunes y termina el miércoles cubre lun-mié', () => {
    expect(diasCubiertos(nov({ fechaInicio: d('2026-07-01'), fechaFin: d('2026-07-08') }), semana)).toEqual([1, 2, 3])
  })

  it('rango totalmente fuera de la semana no cubre nada', () => {
    expect(diasCubiertos(nov({ fechaInicio: d('2026-07-20'), fechaFin: d('2026-07-25') }), semana)).toEqual([])
  })

  it('rango que abarca toda la semana cubre los 7 días', () => {
    expect(diasCubiertos(nov({ fechaInicio: d('2026-07-01'), fechaFin: d('2026-07-31') }), semana)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('resumenAusenciasMes', () => {
  const primer = d('2026-07-01')
  const ultimo = d('2026-07-31')

  it('suma días de vacaciones y permisos por persona', () => {
    const r = resumenAusenciasMes(
      [
        { ...nov({ id: 'a', fechaInicio: d('2026-07-05'), fechaFin: d('2026-07-09') }), nombre: 'Ana' }, // 5 días vac
        { ...nov({ id: 'b', tipo: 'PERMISO', fechaInicio: d('2026-07-10'), fechaFin: d('2026-07-10'), horario: '8-12' }), nombre: 'Ana' }, // 1 día permiso
      ],
      primer, ultimo,
    )
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ nombre: 'Ana', vacaciones: 5, permiso: 1 })
    expect(r[0].detalle).toHaveLength(2)
  })

  it('recorta al mes una novedad que cruza el fin de mes', () => {
    const r = resumenAusenciasMes(
      [{ ...nov({ fechaInicio: d('2026-07-30'), fechaFin: d('2026-08-05') }), nombre: 'Beto' }],
      primer, ultimo,
    )
    // 30 y 31 de julio = 2 días dentro del mes.
    expect(r[0]).toMatchObject({ nombre: 'Beto', vacaciones: 2 })
  })

  it('excluye novedades que no intersectan el mes y ordena por nombre', () => {
    const r = resumenAusenciasMes(
      [
        { ...nov({ fechaInicio: d('2026-06-01'), fechaFin: d('2026-06-10') }), nombre: 'Zoe' }, // fuera de julio
        { ...nov({ fechaInicio: d('2026-07-03'), fechaFin: d('2026-07-03') }), nombre: 'Carlos' },
      ],
      primer, ultimo,
    )
    expect(r.map((x) => x.nombre)).toEqual(['Carlos'])
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm test -- ausencias`
Expected: FAIL ("Cannot find module './ausencias'" o similar).

- [ ] **Step 3: Implementar `ausencias.ts`**

Crear `src/dominio/ausencias.ts`:

```ts
export type NovedadRango = {
  id: string
  responsableId: string
  tipo: 'VACACIONES' | 'PERMISO'
  fechaInicio: Date
  fechaFin: Date
  horario: string | null
  nota: string | null
}

export type AusenciaResumen = {
  responsableId: string
  nombre: string
  vacaciones: number
  permiso: number
  detalle: {
    tipo: 'VACACIONES' | 'PERMISO'
    fechaInicio: Date
    fechaFin: Date
    horario: string | null
    nota: string | null
  }[]
}

const MS_DIA = 86_400_000

// Milisegundos del día UTC (ignora hora/zona) para comparar fechas por día.
function diaUTC(f: Date): number {
  return Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate())
}

export function diasCubiertos(nov: NovedadRango, fechas: Date[]): number[] {
  const ini = diaUTC(nov.fechaInicio)
  const fin = diaUTC(nov.fechaFin)
  const dias: number[] = []
  fechas.forEach((f, i) => {
    const cur = diaUTC(f)
    if (cur >= ini && cur <= fin) dias.push(i + 1)
  })
  return dias
}

export function resumenAusenciasMes(
  novedades: (NovedadRango & { nombre: string })[],
  primerDia: Date,
  ultimoDia: Date,
): AusenciaResumen[] {
  const ini = diaUTC(primerDia)
  const fin = diaUTC(ultimoDia)
  const porResp = new Map<string, AusenciaResumen>()
  for (const n of novedades) {
    const desde = Math.max(diaUTC(n.fechaInicio), ini)
    const hasta = Math.min(diaUTC(n.fechaFin), fin)
    if (hasta < desde) continue // no intersecta el mes
    const dias = Math.round((hasta - desde) / MS_DIA) + 1
    let r = porResp.get(n.responsableId)
    if (!r) {
      r = { responsableId: n.responsableId, nombre: n.nombre, vacaciones: 0, permiso: 0, detalle: [] }
      porResp.set(n.responsableId, r)
    }
    if (n.tipo === 'VACACIONES') r.vacaciones += dias
    else r.permiso += dias
    r.detalle.push({ tipo: n.tipo, fechaInicio: n.fechaInicio, fechaFin: n.fechaFin, horario: n.horario, nota: n.nota })
  }
  return [...porResp.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test -- ausencias`
Expected: PASS (todos los `it` de ambos `describe`).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/ausencias.ts src/dominio/ausencias.test.ts
git commit -m "feat(dominio): ausencias — diasCubiertos + resumenAusenciasMes"
```

---

## Task 3: Repositorio

**Files:**
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Consumes: `prisma` (ya importado en el archivo).
- Produces:
  - `crearNovedadResponsable(data: { responsableId: string; tipo: string; fechaInicio: Date; fechaFin: Date; horario: string | null; nota: string | null })`
  - `eliminarNovedadResponsable(id: string)`
  - `listarNovedadesEnRango(areaId: string, desde: Date, hasta: Date)` — devuelve novedades del área cuyo rango cruza `[desde, hasta]`, con `responsable: { nombre }` incluido.

- [ ] **Step 1: Añadir las funciones al final de `repositorio.ts`**

```ts
export function crearNovedadResponsable(data: {
  responsableId: string
  tipo: string
  fechaInicio: Date
  fechaFin: Date
  horario: string | null
  nota: string | null
}) {
  return prisma.novedadResponsable.create({ data })
}

export function eliminarNovedadResponsable(id: string) {
  return prisma.novedadResponsable.delete({ where: { id } })
}

// Novedades de responsables del área cuyo rango [fechaInicio, fechaFin] se cruza
// con [desde, hasta]. Incluye el nombre del responsable para la UI/reporte.
export function listarNovedadesEnRango(areaId: string, desde: Date, hasta: Date) {
  return prisma.novedadResponsable.findMany({
    where: {
      responsable: { areaId },
      fechaInicio: { lte: hasta },
      fechaFin: { gte: desde },
    },
    include: { responsable: { select: { nombre: true } } },
    orderBy: { fechaInicio: 'asc' },
  })
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores (el cliente Prisma ya conoce `novedadResponsable` tras Task 1 Step 4).

- [ ] **Step 3: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(datos): repo de NovedadResponsable (crear/eliminar/listar en rango)"
```

---

## Task 4: Server actions

**Files:**
- Modify: `src/app/programar/acciones.ts`

**Interfaces:**
- Consumes: `crearNovedadResponsable`, `eliminarNovedadResponsable` (Task 3); `bloqueadoVisor`, `texto`, `textoOpcional`, `esSemanaFutura`, `semanaActual`, `revalidatePath` (ya en el archivo).
- Produces: `crearNovedadResponsableAccion(form: FormData)`, `eliminarNovedadResponsableAccion(form: FormData)`.

- [ ] **Step 1: Actualizar el import del repositorio**

En la línea `import { ... } from '@/datos/repositorio'` (línea 5), añadir `crearNovedadResponsable, eliminarNovedadResponsable` a la lista.

- [ ] **Step 2: Añadir el helper de fecha y las dos acciones al final de `acciones.ts`**

```ts
// "YYYY-MM-DD" (input date) → Date a medianoche UTC; null si no es válida.
function fechaUTC(form: FormData, clave: string): Date | null {
  const v = texto(form, clave)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(v + 'T00:00:00.000Z')
  return Number.isNaN(d.getTime()) ? null : d
}

export async function crearNovedadResponsableAccion(form: FormData) {
  if (await bloqueadoVisor()) return
  const responsableId = texto(form, 'responsableId')
  const tipo = texto(form, 'tipo')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!responsableId || (tipo !== 'VACACIONES' && tipo !== 'PERMISO')) return
  if (!Number.isInteger(anio) || !Number.isInteger(semana) || !esSemanaFutura(anio, semana, semanaActual())) return
  const fechaInicio = fechaUTC(form, 'fechaInicio')
  if (!fechaInicio) return
  let fechaFin = fechaUTC(form, 'fechaFin') ?? fechaInicio
  if (fechaFin.getTime() < fechaInicio.getTime()) fechaFin = fechaInicio
  await crearNovedadResponsable({
    responsableId,
    tipo,
    fechaInicio,
    fechaFin,
    horario: textoOpcional(form, 'horario'),
    nota: textoOpcional(form, 'nota'),
  })
  revalidatePath('/programar')
}

export async function eliminarNovedadResponsableAccion(form: FormData) {
  if (await bloqueadoVisor()) return
  const id = texto(form, 'id')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!id) return
  if (!Number.isInteger(anio) || !Number.isInteger(semana) || !esSemanaFutura(anio, semana, semanaActual())) return
  await eliminarNovedadResponsable(id)
  revalidatePath('/programar')
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/programar/acciones.ts
git commit -m "feat(programar): acciones crear/eliminar novedad de responsable"
```

---

## Task 5: Formulario, grilla y carga en /programar

**Files:**
- Create: `src/app/programar/form-novedad.tsx`
- Modify: `src/app/programar/grilla-semana.tsx`
- Modify: `src/app/programar/page.tsx`

**Interfaces:**
- Consumes: `crearNovedadResponsableAccion`, `eliminarNovedadResponsableAccion` (Task 4); `diasCubiertos` (Task 2); `listarNovedadesEnRango` (Task 3).
- Produces: `GrillaSemana` acepta el prop `novedades: NovedadGrilla[]`, donde
  `type NovedadGrilla = { id: string; responsableId: string; tipo: 'VACACIONES' | 'PERMISO'; fechaInicio: Date; fechaFin: Date; horario: string | null; nota: string | null }`.

- [ ] **Step 1: Crear el client component `form-novedad.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { crearNovedadResponsableAccion } from './acciones'

export function FormNovedad({
  responsableId,
  anio,
  semana,
}: {
  responsableId: string
  anio: number
  semana: number
}) {
  const [abierto, setAbierto] = useState(false)
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-1 text-xs text-bosque hover:underline"
      >
        ＋ Novedad
      </button>
    )
  }
  return (
    <form action={crearNovedadResponsableAccion} className="mt-1 space-y-1 rounded-lg border border-borde bg-marfil p-2 text-xs">
      <input type="hidden" name="responsableId" value={responsableId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <select name="tipo" defaultValue="VACACIONES" aria-label="Tipo" className="w-full rounded border border-borde bg-white p-1">
        <option value="VACACIONES">Vacaciones</option>
        <option value="PERMISO">Permiso</option>
      </select>
      <label className="block">Desde
        <input type="date" name="fechaInicio" required className="w-full rounded border border-borde bg-white p-1" />
      </label>
      <label className="block">Hasta
        <input type="date" name="fechaFin" className="w-full rounded border border-borde bg-white p-1" />
      </label>
      <input name="horario" placeholder="Horario (solo permisos)" className="w-full rounded border border-borde bg-white p-1" />
      <input name="nota" placeholder="Nota (opcional)" className="w-full rounded border border-borde bg-white p-1" />
      <div className="flex gap-1">
        <button type="submit" className="rounded bg-bosque px-2 py-0.5 font-semibold text-white">Guardar</button>
        <button type="button" onClick={() => setAbierto(false)} className="rounded border border-borde px-2 py-0.5">Cancelar</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: En `grilla-semana.tsx`, importar y ampliar tipos/props**

Añadir imports arriba (junto a los existentes):

```tsx
import { diasCubiertos } from '@/dominio/ausencias'
import { eliminarNovedadResponsableAccion } from './acciones'
import { FormNovedad } from './form-novedad'
```

> Nota: NO importar `crearNovedadResponsableAccion` aquí — lo usa `FormNovedad` internamente. Solo `eliminarNovedadResponsableAccion` se referencia en la grilla (botón ✕). El import de `./acciones` ya existe en la línea 3; añadir `eliminarNovedadResponsableAccion` a esa lista en vez de crear un import nuevo.

Añadir el tipo y el prop nuevo:

```tsx
type NovedadGrilla = {
  id: string
  responsableId: string
  tipo: 'VACACIONES' | 'PERMISO'
  fechaInicio: Date
  fechaFin: Date
  horario: string | null
  nota: string | null
}
```

En la firma de `GrillaSemana`, añadir `novedades` al objeto de props y a su tipo:

```tsx
  novedades = [],
  ...
  novedades?: NovedadGrilla[]
```

- [ ] **Step 3: En `grilla-semana.tsx`, mostrar chips por día y lista+borrar en la celda del nombre**

Reemplazar la celda del nombre y el `<td>` de cada día dentro de `filaResponsable`. La celda del nombre pasa de:

```tsx
      <td className="border border-borde p-2 font-medium">{r.nombre}</td>
```

a:

```tsx
      <td className="border border-borde p-2 align-top font-medium">
        <div>{r.nombre}</div>
        {novedades
          .filter((n) => n.responsableId === r.id)
          .map((n) => (
            <div key={n.id} className="mt-1 flex items-center gap-1 text-xs font-normal text-tierra">
              <span>{n.tipo === 'VACACIONES' ? '🌴' : '📄'} {fmtFecha(n.fechaInicio)}–{fmtFecha(n.fechaFin)}</span>
              {editable && (
                <form action={eliminarNovedadResponsableAccion}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="anio" value={anio} />
                  <input type="hidden" name="semana" value={semana} />
                  <button type="submit" aria-label="Quitar novedad" className="text-red-600 hover:underline">✕</button>
                </form>
              )}
            </div>
          ))}
        {editable && <FormNovedad responsableId={r.id} anio={anio} semana={semana} />}
      </td>
```

Dentro del `<td>` de cada día, **después** del `{celdas.map((a) => ( … ))}`, añadir los chips de novedad que cubren ese día:

```tsx
            {novedades
              .filter((n) => n.responsableId === r.id && diasCubiertos(n, fechas).includes(dia))
              .map((n) => (
                <div
                  key={n.id}
                  className={`mb-1 rounded-lg p-1 ${paraExportar ? 'text-sm' : 'text-xs'} ${
                    n.tipo === 'VACACIONES' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'
                  }`}
                >
                  {n.tipo === 'VACACIONES' ? '🌴 Vacaciones' : `📄 Permiso${n.horario ? ` · ${n.horario}` : ''}`}
                </div>
              ))}
```

> `fechas`, `anio`, `semana`, `editable` y `paraExportar` ya están en el scope de `filaResponsable`.

- [ ] **Step 4: En `page.tsx`, cargar las novedades de la semana y pasarlas a la grilla**

Mover el cálculo de `fechas` **antes** del `Promise.all` (hoy está en la línea ~94). Es decir, subir esta línea justo antes del bloque `const [responsables, …] = await Promise.all([`:

```tsx
  const fechas = fechasDeSemana(anio, semana)
```

Y eliminar la línea `const fechas = fechasDeSemana(anio, semana)` que quedaba después (para no declararla dos veces).

Añadir `listarNovedadesEnRango` al import del repositorio (línea 5-12) y a `Promise.all`:

```tsx
    listarNovedadesEnRango(areaId, fechas[0], fechas[6]),
```

capturando el resultado como `novedadesRaw` en el destructuring del `Promise.all`.

Después del `Promise.all`, mapear al shape de la grilla:

```tsx
  const novedades = novedadesRaw.map((n) => ({
    id: n.id,
    responsableId: n.responsableId,
    tipo: n.tipo as 'VACACIONES' | 'PERMISO',
    fechaInicio: n.fechaInicio,
    fechaFin: n.fechaFin,
    horario: n.horario,
    nota: n.nota,
  }))
```

Pasar `novedades={novedades}` a la instancia interactiva de `GrillaSemana` (~línea 209) **y** a cada instancia de export dentro del `partesExport.map` (~línea 245). En export las novedades se filtran por responsable dentro del componente, así que pasar la lista completa está bien.

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores.

- [ ] **Step 6: Verificar build local**

Run: `npx next build --no-lint` (o `npm run lint` para ESLint)
Expected: compila sin errores de tipos/JSX. (El `prisma migrate deploy` del build solo corre en Vercel; si `next build` intenta migrar sin `DATABASE_URL`, usar el typecheck del Step 5 como verificación principal y saltar el build local.)

- [ ] **Step 7: Commit**

```bash
git add src/app/programar/form-novedad.tsx src/app/programar/grilla-semana.tsx src/app/programar/page.tsx
git commit -m "feat(programar): novedades por responsable en la grilla (permiso/vacaciones)"
```

---

## Task 6: Reporte mensual de ausencias en /resumen

**Files:**
- Modify: `src/app/resumen/page.tsx`
- Modify: `src/app/resumen/resumen-area.tsx`

**Interfaces:**
- Consumes: `listarNovedadesEnRango` (Task 3); `resumenAusenciasMes`, `AusenciaResumen` (Task 2); `jueves` (ya calculado en `page.tsx` para recurrentes).
- Produces: `ResumenArea` acepta el prop `ausenciasMes?: AusenciaResumen[]`.

- [ ] **Step 1: En `resumen/page.tsx`, calcular el mes y cargar las ausencias**

Añadir `listarNovedadesEnRango` al import de `@/datos/repositorio` y `resumenAusenciasMes` al import de `@/dominio/resumen`… **no**: `resumenAusenciasMes` vive en `@/dominio/ausencias`. Añadir:

```tsx
import { resumenAusenciasMes } from '@/dominio/ausencias'
```

Tras el cálculo de `jueves` y `semanasMes` (~línea 44-45), computar los bordes del mes y cargar/agregar:

```tsx
  const anioMes = jueves.getUTCFullYear()
  const mes0 = jueves.getUTCMonth() // 0-based
  const primerDiaMes = new Date(Date.UTC(anioMes, mes0, 1))
  const ultimoDiaMes = new Date(Date.UTC(anioMes, mes0 + 1, 0))
  const novedadesMes = await listarNovedadesEnRango(areaId, primerDiaMes, ultimoDiaMes)
  const ausenciasMes = resumenAusenciasMes(
    novedadesMes.map((n) => ({
      id: n.id,
      responsableId: n.responsableId,
      tipo: n.tipo as 'VACACIONES' | 'PERMISO',
      fechaInicio: n.fechaInicio,
      fechaFin: n.fechaFin,
      horario: n.horario,
      nota: n.nota,
      nombre: n.responsable.nombre,
    })),
    primerDiaMes,
    ultimoDiaMes,
  )
```

> Si hay un `Promise.all` de cargas cerca, se puede añadir `listarNovedadesEnRango(areaId, primerDiaMes, ultimoDiaMes)` ahí en vez del `await` suelto; ambos funcionan.

Pasar `ausenciasMes={ausenciasMes}` a `<ResumenArea … />`.

- [ ] **Step 2: En `resumen-area.tsx`, aceptar el prop**

Añadir el import de tipo:

```tsx
import type { AusenciaResumen } from '@/dominio/ausencias'
```

En la firma de `ResumenArea`, junto a `recurrentesMes = []`, añadir `ausenciasMes = []`, y en el bloque de tipos junto a `recurrentesMes?: …`:

```tsx
  ausenciasMes?: AusenciaResumen[]
```

- [ ] **Step 3: En `resumen-area.tsx`, renderizar la sección colapsable**

Junto a las otras secciones `<details className="tarjeta p-3">` (p. ej. cerca de "⚠️ Motivos más frecuentes", ~línea 271), añadir:

```tsx
        <details className="tarjeta p-3">
          <summary className="cursor-pointer select-none text-sm font-semibold text-tinta">🌴 Ausencias del mes ({ausenciasMes.length})</summary>
          {ausenciasMes.length === 0 ? (
            <p className="mt-2 text-sm text-tierra">Sin ausencias registradas este mes.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {ausenciasMes.map((a) => (
                <li key={a.responsableId} className="rounded-lg border border-borde bg-marfil px-3 py-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{a.nombre}</span>
                    <span className="text-tierra">
                      {a.vacaciones > 0 && `🌴 ${a.vacaciones} d`}
                      {a.vacaciones > 0 && a.permiso > 0 && ' · '}
                      {a.permiso > 0 && `📄 ${a.permiso} d`}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-tierra">
                    {a.detalle.map((d, i) => (
                      <li key={i}>
                        {d.tipo === 'VACACIONES' ? '🌴' : '📄'}{' '}
                        {fmtRango(d.fechaInicio, d.fechaFin)}
                        {d.horario ? ` · ${d.horario}` : ''}
                        {d.nota ? ` — ${d.nota}` : ''}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </details>
```

Añadir un helper de formato de rango arriba del componente (o reutilizar uno existente si lo hay). Si no existe, añadir cerca del top del archivo:

```tsx
function fmtRango(a: Date, b: Date) {
  const f = (d: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d)
  return a.getTime() === b.getTime() ? f(a) : `${f(a)}–${f(b)}`
}
```

- [ ] **Step 4: Verificar typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores.

- [ ] **Step 5: Correr toda la suite de tests**

Run: `npm test`
Expected: PASS (incluidos los de `ausencias` y los previos).

- [ ] **Step 6: Commit**

```bash
git add src/app/resumen/page.tsx src/app/resumen/resumen-area.tsx
git commit -m "feat(resumen): reporte mensual de ausencias por responsable"
```

---

## Verificación final (post-deploy, manual)

Tras desplegar a producción (`git push` NO despliega; correr el deploy de Vercel — ver memoria de despliegue):

1. En `/programar`, semana **futura**: "＋ Novedad" en un responsable → crear unas **vacaciones** que crucen dos semanas; confirmar el chip 🌴 en los días cubiertos de **ambas** semanas.
2. Crear un **permiso** de un día con horario ("8:00–12:00"); confirmar el chip 📄 con el horario en ese día.
3. Confirmar que las novedades aparecen en la **imagen de WhatsApp / descarga** (sin botones).
4. Borrar una novedad con ✕; confirmar que desaparece.
5. En `/resumen`, abrir "🌴 Ausencias del mes"; confirmar días de vacaciones/permiso por persona y el detalle.
6. Escritura sobre data real: **crear solo lo propio y borrarlo al terminar** (ver memoria de verificación en navegador).

---

## Self-Review

- **Cobertura de la spec:** modelo (T1), dominio+tests (T2), repo (T3), acciones (T4), form+grilla+carga (T5), reporte mensual (T6), permisos/candado Visor y guard semana futura (T4/T5), export muestra chips sin botones (T5). ✔
- **Discrepancia con la spec:** el módulo de dominio se nombró `ausencias.ts` (la spec decía `novedades.ts`, que ya existe para otro concepto). Sin cambio funcional.
- **Sin placeholders:** todos los pasos con código traen el código completo. ✔
- **Consistencia de tipos:** `NovedadRango`/`NovedadGrilla` (mismos campos), `diasCubiertos`/`resumenAusenciasMes`/`AusenciaResumen` usados con las mismas firmas en T5/T6. `listarNovedadesEnRango` devuelve `responsable.nombre` que T6 mapea a `nombre`. ✔

# Dedicar tractor a un área (día a día) + mostrar todos los tractores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la grilla "🚜 Resumen por tractor" (en `/programar` del área de maquinaria) mostrar TODOS los tractores del catálogo y permitir dedicar cada tractor a un área **por día** (modificable, un día Ganadería y otro Maíz), solo informativo, en semanas futuras.

**Architecture:** Tabla nueva `DedicacionTractor` (una por tractor × año × semana × día) con migración SQL hecha a mano; un helper de dominio puro `construirFilasTractor` (una fila por máquina con sus actividades y sus dedicaciones por día); funciones de repositorio `listarDedicaciones`/`dedicarTractor`; una server action `dedicarTractorAccion`; y la reescritura de `grilla-tractor.tsx` para listar todas las máquinas y, en semanas futuras, un `<select>` cliente por celda que auto-envía.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/Postgres (Neon), Tailwind v4, Vitest.

## Global Constraints

- Ante dudas de API de Next, leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json` (el tsc normal da falso-verde).
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`. (El build corre `prisma migrate deploy && next build`.)
- Vitest: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run`.
- Migraciones: **archivos SQL hechos a mano** con prefijo timestamp (`prisma/migrations/YYYYMMDDHHMMSS_nombre/migration.sql`), aplicadas con `prisma migrate deploy`. NO usar `prisma migrate dev` (Neon no da shadow DB). OJO: la `DATABASE_URL` local apunta a la Neon de PRODUCCIÓN; `migrate deploy` aplica la migración a prod al instante. La tabla es ADITIVA (no toca datos existentes).
- Dedicación = **por día** (tractor × anio × semana × dia), única por esa combinación. Modificable e independiente por día. **Solo informativo**: NO toca el conflicto de máquina ni el cronograma principal.
- Áreas ofrecidas para dedicar = todas las que tengan `maqProgramar = false` (todas menos maquinaria).
- Control de dedicar visible SOLO en semanas futuras (`esSemanaFutura`); en semanas iniciadas la grilla sigue en solo-lectura pero muestra las dedicaciones existentes.
- Las acciones de `/programar` NO hacen auth propia (la página gatea con `puedeVer(u, 'programar')`); solo guardan con `esSemanaFutura`. Seguir ese patrón.
- Reutilizar estilos Tailwind existentes. NO tocar el export PDF de `/programar`, el export de imagen, ni `GrillaSemana`.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Esquema + migración + repositorio (DedicacionTractor)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260705120000_dedicacion_tractor/migration.sql`
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Produces (modelo Prisma): `DedicacionTractor { id, maquinaId, areaId, anio, semana, dia }`, único `(maquinaId, anio, semana, dia)`.
- Produces (repo): `listarDedicaciones(anio: number, semana: number)` → `Promise<Array<{ maquinaId: string; dia: number; areaId: string; area: { nombre: string } } & {…}>>` (registros con `include: { area: true }`); `dedicarTractor(maquinaId: string, areaId: string | null, anio: number, semana: number, dia: number): Promise<void>`.

- [ ] **Step 1: Añadir el modelo y back-relations en `prisma/schema.prisma`**

En `model Maquina` (hoy `id`, `nombre`, `actividades Actividad[]`), añadir la línea de relación:
```prisma
model Maquina {
  id          String      @id @default(cuid())
  nombre      String
  actividades Actividad[]
  dedicaciones DedicacionTractor[]
}
```

En `model Area`, añadir la relación inversa junto a las otras relaciones (tras `responsables Responsable[]`):
```prisma
  dedicaciones  DedicacionTractor[]
```

Añadir el modelo nuevo (después de `model Maquina`):
```prisma
model DedicacionTractor {
  id        String  @id @default(cuid())
  maquinaId String
  maquina   Maquina @relation(fields: [maquinaId], references: [id])
  areaId    String
  area      Area    @relation(fields: [areaId], references: [id])
  anio      Int
  semana    Int
  dia       Int

  @@unique([maquinaId, anio, semana, dia])
}
```

- [ ] **Step 2: Escribir la migración SQL a mano**

Crear `prisma/migrations/20260705120000_dedicacion_tractor/migration.sql` con EXACTAMENTE:
```sql
-- CreateTable
CREATE TABLE "DedicacionTractor" (
    "id" TEXT NOT NULL,
    "maquinaId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "semana" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,

    CONSTRAINT "DedicacionTractor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DedicacionTractor_maquinaId_anio_semana_dia_key" ON "DedicacionTractor"("maquinaId", "anio", "semana", "dia");

-- AddForeignKey
ALTER TABLE "DedicacionTractor" ADD CONSTRAINT "DedicacionTractor_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DedicacionTractor" ADD CONSTRAINT "DedicacionTractor_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Aplicar la migración y regenerar el cliente**

Run:
```bash
DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)
DATABASE_URL="$DB" npx prisma migrate deploy
DATABASE_URL="$DB" npx prisma generate
```
Expected: `migrate deploy` reporta la migración `20260705120000_dedicacion_tractor` aplicada (o "No pending migrations" si ya estaba); `generate` termina `✔ Generated Prisma Client`.

- [ ] **Step 4: Añadir las funciones de repositorio**

En `src/datos/repositorio.ts`, junto a `listarMaquinas` (líneas ~30-32), añadir:
```ts
export function listarDedicaciones(anio: number, semana: number) {
  return prisma.dedicacionTractor.findMany({
    where: { anio, semana },
    include: { area: true },
  })
}

export async function dedicarTractor(
  maquinaId: string,
  areaId: string | null,
  anio: number,
  semana: number,
  dia: number,
): Promise<void> {
  if (!areaId) {
    await prisma.dedicacionTractor.deleteMany({ where: { maquinaId, anio, semana, dia } })
    return
  }
  await prisma.dedicacionTractor.upsert({
    where: { maquinaId_anio_semana_dia: { maquinaId, anio, semana, dia } },
    create: { maquinaId, areaId, anio, semana, dia },
    update: { areaId },
  })
}
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
(Nota: no hay test unitario de esta capa — es esquema/DB/repo, como el resto del repositorio del proyecto; se valida con tsc + build.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260705120000_dedicacion_tractor src/datos/repositorio.ts
git commit -m "feat(repo): modelo DedicacionTractor (por día) + listarDedicaciones/dedicarTractor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Dominio — `construirFilasTractor`

**Files:**
- Create: `src/dominio/tractor.ts`
- Create: `src/dominio/tractor.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ActividadTractor = {
    id: string
    dia: number
    descripcion: string
    turno: string
    maquinaId: string | null
    maquina: { nombre: string } | null
    responsable: { nombre: string }
  }
  export type FilaTractor = {
    maquinaId: string
    nombre: string
    actividades: ActividadTractor[]
    dedicadasPorDia: Record<number, { areaId: string; areaNombre: string }>
  }
  export function construirFilasTractor(
    maquinas: { id: string; nombre: string }[],
    actividades: ActividadTractor[],
    dedicaciones: { maquinaId: string; dia: number; areaId: string; areaNombre: string }[],
  ): FilaTractor[]
  ```

- [ ] **Step 1: Escribir los tests (fallan)**

Crear `src/dominio/tractor.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { construirFilasTractor, type ActividadTractor } from './tractor'

const act = (over: Partial<ActividadTractor> & { id: string; maquinaId: string; dia: number }): ActividadTractor => ({
  descripcion: 'Labor',
  turno: '',
  maquina: { nombre: 'x' },
  responsable: { nombre: 'Pedro' },
  ...over,
})

describe('construirFilasTractor', () => {
  it('devuelve una fila por máquina aunque no tenga actividad ni dedicación', () => {
    const filas = construirFilasTractor(
      [{ id: 'm1', nombre: 'Tractor 1' }, { id: 'm2', nombre: 'Tractor 2' }],
      [],
      [],
    )
    expect(filas.map((f) => f.maquinaId)).toEqual(['m1', 'm2'])
    expect(filas[0].actividades).toEqual([])
    expect(filas[0].dedicadasPorDia).toEqual({})
  })

  it('adjunta la dedicación de un día con área a la máquina correcta', () => {
    const filas = construirFilasTractor(
      [{ id: 'm1', nombre: 'Tractor 1' }],
      [],
      [{ maquinaId: 'm1', dia: 3, areaId: 'a1', areaNombre: 'Ganadería' }],
    )
    expect(filas[0].dedicadasPorDia).toEqual({ 3: { areaId: 'a1', areaNombre: 'Ganadería' } })
  })

  it('un mismo tractor puede tener días distintos dedicados a áreas distintas', () => {
    const filas = construirFilasTractor(
      [{ id: 'm1', nombre: 'Tractor 1' }],
      [],
      [
        { maquinaId: 'm1', dia: 1, areaId: 'a1', areaNombre: 'Ganadería' },
        { maquinaId: 'm1', dia: 2, areaId: 'a2', areaNombre: 'Maíz-Riego' },
      ],
    )
    expect(filas[0].dedicadasPorDia).toEqual({
      1: { areaId: 'a1', areaNombre: 'Ganadería' },
      2: { areaId: 'a2', areaNombre: 'Maíz-Riego' },
    })
  })

  it('conserva las actividades de cada tractor y no mezcla entre máquinas', () => {
    const filas = construirFilasTractor(
      [{ id: 'm1', nombre: 'Tractor 1' }, { id: 'm2', nombre: 'Tractor 2' }],
      [act({ id: 't1', maquinaId: 'm1', dia: 1 }), act({ id: 't2', maquinaId: 'm2', dia: 1 })],
      [],
    )
    expect(filas[0].actividades.map((a) => a.id)).toEqual(['t1'])
    expect(filas[1].actividades.map((a) => a.id)).toEqual(['t2'])
  })

  it('ordena las filas por nombre de máquina', () => {
    const filas = construirFilasTractor(
      [{ id: 'm1', nombre: 'Zeta' }, { id: 'm2', nombre: 'Alfa' }],
      [],
      [],
    )
    expect(filas.map((f) => f.nombre)).toEqual(['Alfa', 'Zeta'])
  })
})
```

- [ ] **Step 2: Correr los tests → fallan**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run src/dominio/tractor.test.ts`
Expected: FAIL (no existe `./tractor`).

- [ ] **Step 3: Implementar `src/dominio/tractor.ts`**

```ts
export type ActividadTractor = {
  id: string
  dia: number
  descripcion: string
  turno: string
  maquinaId: string | null
  maquina: { nombre: string } | null
  responsable: { nombre: string }
}

export type FilaTractor = {
  maquinaId: string
  nombre: string
  actividades: ActividadTractor[]
  dedicadasPorDia: Record<number, { areaId: string; areaNombre: string }>
}

// Una fila por máquina (orden por nombre), con sus actividades de la semana y sus
// dedicaciones por día (tractor dedicado 100% a un área ese día). Solo informativo.
export function construirFilasTractor(
  maquinas: { id: string; nombre: string }[],
  actividades: ActividadTractor[],
  dedicaciones: { maquinaId: string; dia: number; areaId: string; areaNombre: string }[],
): FilaTractor[] {
  return [...maquinas]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((m) => {
      const dedicadasPorDia: Record<number, { areaId: string; areaNombre: string }> = {}
      for (const d of dedicaciones) {
        if (d.maquinaId === m.id) dedicadasPorDia[d.dia] = { areaId: d.areaId, areaNombre: d.areaNombre }
      }
      return {
        maquinaId: m.id,
        nombre: m.nombre,
        actividades: actividades.filter((a) => a.maquinaId === m.id),
        dedicadasPorDia,
      }
    })
}
```

- [ ] **Step 4: Correr los tests → pasan**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run src/dominio/tractor.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
```bash
git add src/dominio/tractor.ts src/dominio/tractor.test.ts
git commit -m "feat(dominio): construirFilasTractor (todas las máquinas + dedicaciones por día)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Acción + grilla (todos los tractores + dedicar por celda)

**Files:**
- Modify: `src/app/programar/acciones.ts`
- Create: `src/app/programar/select-dedicacion.tsx`
- Modify: `src/app/programar/grilla-tractor.tsx`
- Modify: `src/app/programar/page.tsx`

**Interfaces:**
- Consumes: `dedicarTractor`, `listarDedicaciones` (Task 1); `construirFilasTractor`, `ActividadTractor` (Task 2); `esSemanaFutura`, `semanaActual` (`@/dominio/semana`); `esMaquinaria as esMaquinariaVar` (`@/dominio/variante`, ya importado en page).
- Produces: server action `dedicarTractorAccion(form: FormData)`; componente cliente `SelectDedicacion`.

- [ ] **Step 1: Añadir la acción `dedicarTractorAccion`**

En `src/app/programar/acciones.ts`:
1. Añadir `dedicarTractor` al import de `@/datos/repositorio` (que hoy trae `crearActividadDesdeLotes, eliminarActividad, duplicarSemana, crearResponsable, actualizarActividad, asignarTarea, quitarSeleccionTarea, devolverAAsignacion, devolverGrillaAlBanco`):
```ts
import { crearActividadDesdeLotes, eliminarActividad, duplicarSemana, crearResponsable, actualizarActividad, asignarTarea, quitarSeleccionTarea, devolverAAsignacion, devolverGrillaAlBanco, dedicarTractor } from '@/datos/repositorio'
```
2. Añadir al final del archivo:
```ts
export async function dedicarTractorAccion(form: FormData) {
  const maquinaId = texto(form, 'maquinaId')
  const areaId = textoOpcional(form, 'areaId') // '' → null = quitar dedicación
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  const dia = Number(texto(form, 'dia'))
  if (!maquinaId || !Number.isInteger(anio) || !Number.isInteger(semana) || !Number.isInteger(dia)) return
  if (!esSemanaFutura(anio, semana, semanaActual())) return
  await dedicarTractor(maquinaId, areaId, anio, semana, dia)
  revalidatePath('/programar')
}
```
(`texto`, `textoOpcional`, `esSemanaFutura`, `semanaActual`, `revalidatePath` ya están en el archivo.)

- [ ] **Step 2: Crear el componente cliente `SelectDedicacion`**

Crear `src/app/programar/select-dedicacion.tsx`:
```tsx
'use client'

// Desplegable por celda (tractor × día) para dedicar el tractor a un área ese día.
// Select NO controlada (defaultValue, sin estado React) que auto-envía al cambiar.
export function SelectDedicacion({
  maquinaId,
  anio,
  semana,
  dia,
  areaIdActual,
  areas,
  accion,
}: {
  maquinaId: string
  anio: number
  semana: number
  dia: number
  areaIdActual: string
  areas: { id: string; nombre: string }[]
  accion: (form: FormData) => void
}) {
  return (
    <form action={accion} className="mt-1">
      <input type="hidden" name="maquinaId" value={maquinaId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <input type="hidden" name="dia" value={dia} />
      <select
        name="areaId"
        defaultValue={areaIdActual}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full rounded border border-borde bg-white px-1 py-0.5 text-xs text-tinta"
      >
        <option value="">— ninguna —</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
      </select>
    </form>
  )
}
```

- [ ] **Step 3: Reescribir `grilla-tractor.tsx`**

Reemplazar TODO el contenido de `src/app/programar/grilla-tractor.tsx` por:
```tsx
import { construirFilasTractor, type ActividadTractor } from '@/dominio/tractor'
import { SelectDedicacion } from './select-dedicacion'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function fmtFecha(f: Date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)
}

// Resumen por tractor: TODAS las máquinas del catálogo (una fila cada una), columnas Lun–Dom,
// con sus actividades por día. En semanas futuras, cada celda deja dedicar el tractor a un área
// ese día (solo informativo). Inverso del cronograma.
export function GrillaTractor({
  fechas,
  actividades,
  maquinas,
  dedicaciones,
  areasParaDedicar,
  futura,
  anio,
  semana,
  accion,
}: {
  fechas: Date[]
  actividades: ActividadTractor[]
  maquinas: { id: string; nombre: string }[]
  dedicaciones: { maquinaId: string; dia: number; areaId: string; areaNombre: string }[]
  areasParaDedicar: { id: string; nombre: string }[]
  futura: boolean
  anio: number
  semana: number
  accion: (form: FormData) => void
}) {
  const filas = construirFilasTractor(maquinas, actividades, dedicaciones)
  if (filas.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-bosque">🚜 Resumen por tractor</h2>
      <div className="overflow-x-auto rounded-xl border border-borde bg-white text-tinta">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-borde bg-arena p-2 text-left">Tractor</th>
              {DIAS.map((d, i) => (
                <th key={d} className="border border-borde bg-arena p-2 text-left">
                  {d}
                  <div className="text-xs font-normal text-tierra">{fechas[i] ? fmtFecha(fechas[i]) : ''}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => (
              <tr key={t.maquinaId}>
                <td className="border border-borde p-2 font-medium">🚜 {t.nombre}</td>
                {DIAS.map((_, i) => {
                  const dia = i + 1
                  const ded = t.dedicadasPorDia[dia]
                  const celdas = t.actividades.filter((a) => a.dia === dia)
                  return (
                    <td key={dia} className="border border-borde p-2 align-top">
                      {ded ? (
                        <div className="mb-1 rounded-lg bg-amber-50 p-1 text-xs font-medium text-amber-800">
                          🔒 {ded.areaNombre}
                        </div>
                      ) : (
                        celdas.map((a) => (
                          <div key={a.id} className="mb-1 rounded-lg bg-green-50 p-1">
                            <div>{a.descripcion}</div>
                            <div className="text-xs text-tierra">{a.responsable.nombre}</div>
                            {a.turno && <div className="text-xs text-tierra">{a.turno}</div>}
                          </div>
                        ))
                      )}
                      {futura && (
                        <SelectDedicacion
                          maquinaId={t.maquinaId}
                          anio={anio}
                          semana={semana}
                          dia={dia}
                          areaIdActual={ded?.areaId ?? ''}
                          areas={areasParaDedicar}
                          accion={accion}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Cablear `page.tsx`**

En `src/app/programar/page.tsx`:
1. Añadir `listarDedicaciones` al import de `@/datos/repositorio` (que hoy trae `listarAreas, listarResponsablesPorArea, listarActividades, tareasPorAsignar, listarMaquinas`):
```ts
import {
  listarAreas,
  listarResponsablesPorArea,
  listarActividades,
  tareasPorAsignar,
  listarMaquinas,
  listarDedicaciones,
} from '@/datos/repositorio'
```
2. Añadir `dedicarTractorAccion` al import de `./acciones` (hoy: `import { asignarTareaAccion, devolverAlBancoAccion } from './acciones'`):
```ts
import { asignarTareaAccion, devolverAlBancoAccion, dedicarTractorAccion } from './acciones'
```
3. Añadir `listarDedicaciones(anio, semana)` al `Promise.all` (hoy destructura `[responsables, actividades, porAsignar, maquinas]`):
```ts
  const [responsables, actividades, porAsignar, maquinas, dedicacionesRaw] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarActividades(areaId, anio, semana),
    tareasPorAsignar(areaId, anio, semana),
    listarMaquinas(),
    listarDedicaciones(anio, semana),
  ])
```
4. Tras `const esMaquinaria = esMaquinariaVar(areaActual, 'programar')` (línea ~62), añadir:
```ts
  const areasParaDedicar = areas.filter((a) => !esMaquinariaVar(a, 'programar'))
  const dedicaciones = dedicacionesRaw.map((d) => ({
    maquinaId: d.maquinaId,
    dia: d.dia,
    areaId: d.areaId,
    areaNombre: d.area.nombre,
  }))
```
5. Reemplazar el render de la grilla de tractores (hoy: `{esMaquinaria && (<GrillaTractor fechas={fechas} actividades={actividadesCronograma} />)}`) por:
```tsx
      {esMaquinaria && (
        <GrillaTractor
          fechas={fechas}
          actividades={actividadesCronograma}
          maquinas={maquinas}
          dedicaciones={dedicaciones}
          areasParaDedicar={areasParaDedicar}
          futura={futura}
          anio={anio}
          semana={semana}
          accion={dedicarTractorAccion}
        />
      )}
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 6: Vitest (regresión) + commit**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run` → todo verde.
```bash
git add src/app/programar/acciones.ts src/app/programar/select-dedicacion.tsx src/app/programar/grilla-tractor.tsx src/app/programar/page.tsx
git commit -m "feat(programar): grilla con todos los tractores + dedicar por día (informativo)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras las tareas)

Server local (`next dev`) + cookie firmada (ADMIN; ver memoria `verificacion-navegador`). En `/programar` del área de maquinaria, **semana futura**:

1. Aparecen TODOS los tractores del catálogo (no solo los usados), orden por nombre; cada celda de día futura tiene el desplegable "— ninguna —".
2. Dedicar un tractor un día a un área (p. ej. lunes → Ganadería): la celda muestra "🔒 Ganadería"; otro día del mismo tractor a otra área (martes → Maíz-Riego) muestra "🔒 Maíz-Riego" (modificable e independiente por día). El desplegable NO ofrece áreas de maquinaria.
3. Elegir "— ninguna —" en una celda dedicada la quita.
4. En una semana ya iniciada no aparece el desplegable, pero las dedicaciones existentes sí se ven.
5. El resto de `/programar` (cronograma, tareas por asignar, export) queda intacto.

Prueba de escritura reversible en prod: dedicar un día → verificar → quitar (o borrar el registro por id en la DB), confirmando estado final limpio.

## Nota

Tabla nueva `DedicacionTractor` (aditiva). Solo informativo: no toca el conflicto de máquina, el cronograma, ni el export. Dedicación por día, modificable.

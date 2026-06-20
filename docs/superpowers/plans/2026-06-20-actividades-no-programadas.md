# Actividades nuevas no programadas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar en Cumplimiento actividades nuevas no programadas (cumplidas) que no aparecen en el cronograma pero el Resumen cuenta y lista.

**Architecture:** Se agrega `Actividad.noProgramada` (migración). Un formulario en Cumplimiento crea esas actividades (CUMPLIDA, `noProgramada=true`) vía una nueva acción/repo. Programar (grilla + choques) y su PDF las excluyen; el Resumen agrega una sección con el conteo y la lista.

**Tech Stack:** Next.js 16, Prisma 6 (Postgres/Neon), React 19, Tailwind v4.

## Global Constraints

- La actividad nueva se guarda **CUMPLIDA** y con `noProgramada = true`.
- **No aparece en Programar** (grilla ni `ocupacion`) ni en el PDF del cronograma. Sí en Cumplimiento y Resumen.
- Resumen: sección "🆕 Actividades nuevas (no programadas) (N)" + lista (descripción · responsable · lote); además cuentan como cumplidas en los totales.
- Cumplimiento permite semanas pasadas → la acción NO bloquea semanas pasadas.
- No tocar los flujos de cambio de actividad ni de hectáreas realizadas.
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` (y `npm test` donde aplique) sin errores. NO ejecutar app/seed/build local (base en Neon).
- Spec: `docs/superpowers/specs/2026-06-20-actividades-no-programadas-design.md`.

## File Structure

- `prisma/schema.prisma` — `Actividad.noProgramada Boolean @default(false)`.
- `prisma/migrations/20260620150000_add_no_programada/migration.sql` — NUEVO.
- `src/datos/repositorio.ts` — `crearActividadRealizada(...)`.
- `src/app/cumplimiento/acciones.ts` — `agregarActividadRealizadaAccion`.
- `src/app/cumplimiento/form-actividad-realizada.tsx` — NUEVO (cliente).
- `src/app/cumplimiento/page.tsx` — traer responsables activos + render del formulario.
- `src/app/programar/page.tsx` — excluir `noProgramada` de grilla y `ocupacion`.
- `src/app/programar/exportar/page.tsx` — excluir `noProgramada` del PDF.
- `src/app/resumen/resumen-area.tsx` — sección de nuevas.

---

## Task 1: Modelo `noProgramada` + repo + acción

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Actividad`)
- Create: `prisma/migrations/20260620150000_add_no_programada/migration.sql`
- Modify: `src/datos/repositorio.ts` (nueva función)
- Modify: `src/app/cumplimiento/acciones.ts` (nueva acción)

**Interfaces:**
- Produces: `Actividad.noProgramada: boolean`; `crearActividadRealizada(datos: { areaId, anio, semana, dia, responsableId, descripcion, loteId: string|null, maquinaId: string|null })`; `agregarActividadRealizadaAccion(form: FormData)`.

- [ ] **Step 1: Campo en el esquema**

En `prisma/schema.prisma`, en el modelo `Actividad`, agregar una línea (junto a los otros campos opcionales como `haRealizada`):

```prisma
  noProgramada Boolean @default(false)
```

- [ ] **Step 2: Migración incremental**

Crear `prisma/migrations/20260620150000_add_no_programada/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN "noProgramada" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Regenerar el cliente**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" sin errores.

- [ ] **Step 4: Función de repositorio**

En `src/datos/repositorio.ts`, agregar:

```ts
export async function crearActividadRealizada(datos: {
  areaId: string
  anio: number
  semana: number
  dia: number
  responsableId: string
  descripcion: string
  loteId: string | null
  maquinaId: string | null
}) {
  let fincaId: string | null = null
  if (datos.loteId) {
    const lote = await prisma.lote.findUnique({ where: { id: datos.loteId } })
    fincaId = lote?.fincaId ?? null
  }
  return prisma.actividad.create({
    data: {
      anio: datos.anio,
      semana: datos.semana,
      dia: datos.dia,
      descripcion: datos.descripcion,
      estado: 'CUMPLIDA',
      noProgramada: true,
      areaId: datos.areaId,
      fincaId,
      responsableId: datos.responsableId,
      maquinaId: datos.maquinaId,
      lotes: datos.loteId ? { connect: [{ id: datos.loteId }] } : undefined,
    },
  })
}
```

- [ ] **Step 5: Acción en cumplimiento**

En `src/app/cumplimiento/acciones.ts`, agregar el import de `crearActividadRealizada` a la línea de import de `@/datos/repositorio` (junto a `registrarCumplimiento`), y agregar la acción:

```ts
export async function agregarActividadRealizadaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  const dia = Number(texto(form, 'dia'))
  const responsableId = texto(form, 'responsableId')
  const descripcion = texto(form, 'descripcion')
  if (!areaId || !Number.isInteger(anio) || !Number.isInteger(semana) || !(dia >= 1 && dia <= 7) || !responsableId || !descripcion) return
  await crearActividadRealizada({
    areaId,
    anio,
    semana,
    dia,
    responsableId,
    descripcion,
    loteId: textoOpcional(form, 'loteId'),
    maquinaId: textoOpcional(form, 'maquinaId'),
  })
  revalidatePath('/cumplimiento')
}
```
(`texto`, `textoOpcional`, `revalidatePath` ya existen en ese archivo.)

- [ ] **Step 6: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260620150000_add_no_programada src/datos/repositorio.ts src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): campo noProgramada + crearActividadRealizada + acción"
```

---

## Task 2: Formulario "Agregar actividad realizada" + página de Cumplimiento

**Files:**
- Create: `src/app/cumplimiento/form-actividad-realizada.tsx`
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `agregarActividadRealizadaAccion` (Task 1); `SelectFincaLote` (existente).
- Produces: `FormActividadRealizada` con props `{ areaId, anio, semana, esMaquinaria, responsables, lotes, maquinas, accion }`.

- [ ] **Step 1: Componente del formulario**

Crear `src/app/cumplimiento/form-actividad-realizada.tsx`:

```tsx
'use client'

import { SelectFincaLote } from '../_componentes/select-finca-lote'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Lote = { id: string; nombre: string; finca: { nombre: string } }

export function FormActividadRealizada({
  areaId,
  anio,
  semana,
  esMaquinaria,
  responsables,
  lotes,
  maquinas,
  accion,
}: {
  areaId: string
  anio: number
  semana: number
  esMaquinaria: boolean
  responsables: { id: string; nombre: string }[]
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  return (
    <form action={accion} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <span className="w-full text-sm font-semibold text-blue-900">➕ Agregar actividad realizada (no programada)</span>
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <label className="flex flex-col text-xs">
        Responsable
        <select name="responsableId" required className="rounded border p-1 text-sm">
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs">
        Día
        <select name="dia" required defaultValue="" className="rounded border p-1 text-sm">
          <option value="" disabled>—</option>
          {DIAS.map((d, i) => (
            <option key={d} value={i + 1}>{d}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col text-xs">
        Descripción
        <input name="descripcion" required placeholder="¿Qué se hizo?" className="rounded border p-1 text-sm" />
      </label>
      <label className="flex flex-col text-xs">
        Finca y lote
        <SelectFincaLote lotes={lotes} name="loteId" />
      </label>
      {esMaquinaria && (
        <label className="flex flex-col text-xs">
          Máquina
          <select name="maquinaId" className="rounded border p-1 text-sm">
            <option value="">— sin máquina —</option>
            {maquinas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </label>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Agregar</button>
    </form>
  )
}
```

- [ ] **Step 2: Página — traer responsables activos**

En `src/app/cumplimiento/page.tsx`:

a) Ampliar el import de `@/datos/repositorio` para incluir `listarResponsablesPorArea`:
```ts
import { listarAreas, listarMotivos, listarActividades, listarLotes, listarMaquinas, listarResponsablesPorArea } from '@/datos/repositorio'
```

b) Importar el formulario y la acción:
```ts
import { FormActividadRealizada } from './form-actividad-realizada'
```
Y en el import de `./acciones`, agregar `agregarActividadRealizadaAccion` (junto a `registrarAccion`).

c) Reemplazar el `Promise.all` `[motivos, actividades, lotes, maquinas]` por uno que también traiga responsables, y derivar los activos:
```ts
  const [motivos, actividades, lotes, maquinas, responsablesTodos] = await Promise.all([
    listarMotivos(),
    listarActividades(areaId, anio, semana),
    listarLotes(),
    listarMaquinas(),
    listarResponsablesPorArea(areaId),
  ])
  const responsables = responsablesTodos.filter((r) => r.activo)
  const motivoCambioId = motivos.find((m) => m.nombre === 'Cambio de actividad')?.id ?? null
```

- [ ] **Step 3: Página — render del formulario**

En `src/app/cumplimiento/page.tsx`, justo ANTES del bloque que lista las actividades (la parte `{actividades.length === 0 ? (...) : (<ul ...>...)}`), insertar (solo si hay responsables activos):

```tsx
      {responsables.length > 0 && (
        <FormActividadRealizada
          areaId={areaId}
          anio={anio}
          semana={semana}
          esMaquinaria={esMaquinaria}
          responsables={responsables}
          lotes={lotes}
          maquinas={maquinas}
          accion={agregarActividadRealizadaAccion}
        />
      )}
```

- [ ] **Step 4: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual (diferida al despliegue)**

Como un área con responsables: en Cumplimiento aparece "➕ Agregar actividad realizada"; al llenarla y Agregar, queda registrada como cumplida.

- [ ] **Step 6: Commit**

```bash
git add src/app/cumplimiento/form-actividad-realizada.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): formulario para agregar actividad realizada no programada"
```

---

## Task 3: Excluir de Programar/PDF + sección en Resumen

**Files:**
- Modify: `src/app/programar/page.tsx`
- Modify: `src/app/programar/exportar/page.tsx`
- Modify: `src/app/resumen/resumen-area.tsx`

**Interfaces:**
- Consumes: `Actividad.noProgramada` (Task 1).

- [ ] **Step 1: Programar — excluir noProgramada de la grilla y choques**

En `src/app/programar/page.tsx`, después del `Promise.all` (donde se obtiene `actividades`), agregar:
```ts
  const actividadesCronograma = actividades.filter((a) => !a.noProgramada)
```
Luego usar `actividadesCronograma` en lugar de `actividades` en DOS lugares:
1. la construcción de `ocupacion` (`const ocupacion = actividadesCronograma.map((a) => ({ ... }))`).
2. el prop de la grilla: `<GrillaSemana ... actividades={actividadesCronograma} />`.
(El resto del archivo no cambia.)

- [ ] **Step 2: Exportar cronograma — excluir noProgramada**

En `src/app/programar/exportar/page.tsx`, en el `Promise.all` que arma `datos`, filtrar las actividades de cada área:
```ts
      actividades: (await listarActividades(a.id, anio, semana)).filter((act) => !act.noProgramada),
```

- [ ] **Step 3: Resumen — tipo + cálculo de nuevas**

En `src/app/resumen/resumen-area.tsx`:

a) En el tipo `ActividadResumen`, agregar:
```ts
  noProgramada: boolean
```

b) En el bloque de cálculo (junto a `cambios`, `haActividadLista`, etc.), agregar:
```ts
  const nuevas = actividades.filter((a) => a.noProgramada)
```

- [ ] **Step 4: Resumen — render de la sección de nuevas**

En `src/app/resumen/resumen-area.tsx`, justo ANTES del `<h2 ...>🔄 Actividades cambiadas o reprogramadas</h2>`, insertar:

```tsx
      {nuevas.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">🆕 Actividades nuevas (no programadas) ({nuevas.length})</h2>
          <ul className="space-y-1 text-sm">
            {nuevas.map((a) => (
              <li key={a.id} className="rounded border px-3 py-1">
                {a.descripcion}
                <span className="text-gray-500"> · {a.responsable.nombre}</span>
                {a.lotes.length > 0 ? (
                  <span className="text-gray-500"> · 📍 {a.lotes.map((l) => l.nombre).join(', ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
```

- [ ] **Step 5: Verificar typecheck, lint y tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; suite (65) verde.

- [ ] **Step 6: Commit**

```bash
git add src/app/programar/page.tsx src/app/programar/exportar/page.tsx src/app/resumen/resumen-area.tsx
git commit -m "feat: ocultar noProgramada del cronograma/PDF y listarlas en Resumen"
```

---

## Fase de despliegue (después del plan)

1. `git push` + `npx vercel@latest deploy --prod --scope ayura-llanos --token <token>` → el build aplica `add_no_programada` en Neon.
2. Verificar en la URL: agregar una actividad realizada en Cumplimiento; confirmar que NO sale en Programar y SÍ en Resumen (sección de nuevas).

---

## Self-Review (autor del plan)

- **Cobertura del spec:** modelo `noProgramada` + migración (Task 1) ✓; `crearActividadRealizada` + acción (Task 1) ✓; formulario "+ Agregar actividad realizada" con responsable/día/descripción/lote/máquina, guarda CUMPLIDA (Task 2) ✓; responsables activos en la página (Task 2) ✓; excluir de Programar (grilla + ocupacion) y del PDF (Task 3) ✓; Resumen sección conteo + lista (Task 3) ✓.
- **Placeholders:** ninguno; código/SQL completos. El `<token>` de despliegue lo provee la usuaria.
- **Consistencia de tipos:** `crearActividadRealizada(datos {...})` igual en repo, acción y plan; los `name` del formulario (`areaId, anio, semana, responsableId, dia, descripcion, loteId, maquinaId`) coinciden con lo que lee la acción; `FormActividadRealizada` props ↔ lo que pasa `page.tsx`; `ActividadResumen` gana `noProgramada` (provisto por `listarActividades`); `actividadesCronograma` se usa para grilla y ocupacion.
- **Nota:** sin ejecutar app/seed/build local (base Neon); se prueba al desplegar. Migración aditiva, sin pérdida de datos.

# Correcciones de Cumplimiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En Cumplimiento, pedir "hectáreas realizadas" (en vez de faltantes) y permitir registrar la actividad que se hizo en lugar de la cambiada (motivo "Cambio de actividad"), creándola como cumplida que cuenta.

**Architecture:** Se agrega `Actividad.haRealizada` (migración incremental). El dominio gana `hectareasRealizadas`. El formulario de cumplimiento pide "ha realizadas" siempre en Maquinaria y, cuando el motivo es "Cambio de actividad", muestra campos para la actividad de reemplazo; `registrarCumplimiento` la crea como CUMPLIDA. El Resumen muestra solo realizadas y la nota "Cambiada por: …".

**Tech Stack:** Next.js 16, Prisma 6 (Postgres/Neon), React 19, Tailwind v4, Vitest.

## Global Constraints

- "Ha realizadas" se pide SIEMPRE que el área sea Maquinaria (cualquier estado), valor inicial = ha del/los lote(s), editable. Se deja de pedir "ha faltantes".
- En el Resumen se muestra SOLO "ha realizadas" (sin faltantes).
- Motivo disparador del reemplazo: **"Cambio de actividad"** (motivo nuevo).
- La actividad de reemplazo se crea CUMPLIDA, mismo día/responsable/turno, con descripción + lote (+ máquina si Maquinaria); cuenta en programadas y resumen.
- La original conserva su estado/motivo; su nota queda "Cambiada por: <nueva>"; sigue volviendo al banco como hoy.
- No se borra la columna `haFaltante` (queda huérfana, sin uso).
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` (y `npm test` donde aplique) sin errores. NO ejecutar la app/seed/build local (la base es Neon; se prueba al desplegar).
- Spec: `docs/superpowers/specs/2026-06-20-correcciones-cumplimiento-design.md`.

## File Structure

- `prisma/schema.prisma` — `Actividad.haRealizada Float?`.
- `prisma/migrations/20260620140000_add_ha_realizada/migration.sql` — NUEVO.
- `src/dominio/resumen.ts` — `hectareasRealizadas` (Task 1); quitar `hectareasTrabajadasYFaltantes` (Task 4).
- `src/dominio/resumen.test.ts` — tests de `hectareasRealizadas` (Task 1); quitar los viejos (Task 4).
- `src/datos/repositorio.ts` — `registrarCumplimiento` (haRealizada + reemplazo).
- `src/app/cumplimiento/acciones.ts` — `registrarAccion`.
- `prisma/seed.ts` — motivo "Cambio de actividad".
- `src/app/cumplimiento/form-registrar.tsx` — campos ha realizadas + reemplazo.
- `src/app/cumplimiento/page.tsx` — pasa lotes/máquinas/motivoCambioId/haProgramada.
- `src/app/resumen/resumen-area.tsx` — tarjeta solo realizadas + haPorActividad + nota en cambios.

---

## Task 1: Modelo `haRealizada` + dominio `hectareasRealizadas`

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Actividad`)
- Create: `prisma/migrations/20260620140000_add_ha_realizada/migration.sql`
- Modify: `src/dominio/resumen.ts` (añadir `hectareasRealizadas`)
- Modify: `src/dominio/resumen.test.ts` (añadir tests)

**Interfaces:**
- Produces: `Actividad.haRealizada: number | null`; `hectareasRealizadas(filas: { estado: string; haProgramada: number; haRealizada: number | null }[]): number`.

- [ ] **Step 1: Campo en el esquema**

En `prisma/schema.prisma`, en el modelo `Actividad`, junto a `haFaltante  Float?` agregar una línea:

```prisma
  haRealizada Float?
```

- [ ] **Step 2: Migración incremental**

Crear `prisma/migrations/20260620140000_add_ha_realizada/migration.sql` con:

```sql
-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN "haRealizada" DOUBLE PRECISION;
```

- [ ] **Step 3: Regenerar el cliente Prisma**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" sin errores.

- [ ] **Step 4: Función de dominio `hectareasRealizadas`**

En `src/dominio/resumen.ts`, agregar (sin quitar todavía `hectareasTrabajadasYFaltantes`):

```ts
export function hectareasRealizadas(
  filas: { estado: string; haProgramada: number; haRealizada: number | null }[],
): number {
  let total = 0
  for (const f of filas) {
    if (f.estado === 'PENDIENTE') continue
    total += f.haRealizada ?? (f.estado === 'CUMPLIDA' ? f.haProgramada : 0)
  }
  return r1(total)
}
```
(Usa el helper `r1` existente.)

- [ ] **Step 5: Tests de `hectareasRealizadas`**

En `src/dominio/resumen.test.ts`, añadir al import de `'./resumen'` el nombre `hectareasRealizadas`, y agregar este bloque:

```ts
describe('hectareasRealizadas', () => {
  it('suma realizadas; cumplida sin valor = programada; pendiente se ignora; no cumplida sin valor = 0', () => {
    const filas = [
      { estado: 'CUMPLIDA', haProgramada: 10, haRealizada: null }, // 10 (cae a programada)
      { estado: 'PARCIAL', haProgramada: 8, haRealizada: 5 }, // 5
      { estado: 'NO_CUMPLIDA', haProgramada: 4, haRealizada: null }, // 0
      { estado: 'PENDIENTE', haProgramada: 6, haRealizada: null }, // ignorado
    ]
    expect(hectareasRealizadas(filas)).toBe(15)
  })
  it('usa el valor realizado explícito aunque sea cumplida', () => {
    expect(hectareasRealizadas([{ estado: 'CUMPLIDA', haProgramada: 10, haRealizada: 7 }])).toBe(7)
  })
})
```

- [ ] **Step 6: Verificar typecheck, lint y tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; los tests nuevos pasan (la suite sube a 66).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260620140000_add_ha_realizada src/dominio/resumen.ts src/dominio/resumen.test.ts
git commit -m "feat(cumplimiento): campo haRealizada + dominio hectareasRealizadas"
```

---

## Task 2: Backend — registrarCumplimiento (ha realizadas + reemplazo) + motivo

**Files:**
- Modify: `src/datos/repositorio.ts` (`registrarCumplimiento`)
- Modify: `src/app/cumplimiento/acciones.ts` (`registrarAccion`)
- Modify: `prisma/seed.ts` (`MOTIVOS`)

**Interfaces:**
- Consumes: `Actividad.haRealizada` (Task 1).
- Produces: `registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo?)` con `reemplazo?: { descripcion: string; loteId: string | null; maquinaId: string | null } | null`.

- [ ] **Step 1: Reescribir `registrarCumplimiento`**

En `src/datos/repositorio.ts`, reemplazar toda la función `registrarCumplimiento` por:

```ts
export async function registrarCumplimiento(
  id: string,
  estado: string,
  motivoId: string | null,
  nota: string | null,
  haRealizada: number | null,
  reemplazo?: { descripcion: string; loteId: string | null; maquinaId: string | null } | null,
) {
  const act = await prisma.actividad.findUnique({ where: { id }, include: { lotes: true } })
  if (!act || act.estado !== 'PENDIENTE') return null // ya registrada / bloqueada
  const notaFinal = reemplazo ? `Cambiada por: ${reemplazo.descripcion}` : nota
  await prisma.actividad.update({ where: { id }, data: { estado, motivoId, nota: notaFinal, haRealizada } })

  // Novedad (todo lo que no es 100% cumplido): la tarea vuelve al banco sin semana,
  // conservando el contador. Solo aplica a tareas de UN día (única actividad en su semana).
  if (estado !== 'CUMPLIDA' && act.tareaId) {
    const enLaSemana = await prisma.actividad.count({
      where: { tareaId: act.tareaId, anio: act.anio, semana: act.semana },
    })
    if (enLaSemana === 1) {
      await prisma.tarea.update({
        where: { id: act.tareaId },
        data: { estado: 'PENDIENTE', anioSel: null, semanaSel: null, vecesReprogramada: act.vecesReprogramada + 1 },
      })
    }
  }

  // Cambio de actividad: crear la que SÍ se hizo, como cumplida, mismo día/responsable.
  if (reemplazo && reemplazo.descripcion) {
    let fincaId: string | null = null
    let haReemplazo: number | null = null
    if (reemplazo.loteId) {
      const lote = await prisma.lote.findUnique({ where: { id: reemplazo.loteId } })
      fincaId = lote?.fincaId ?? null
      haReemplazo = lote?.hectareas ?? null
    }
    await prisma.actividad.create({
      data: {
        anio: act.anio,
        semana: act.semana,
        dia: act.dia,
        descripcion: reemplazo.descripcion,
        turno: act.turno,
        estado: 'CUMPLIDA',
        areaId: act.areaId,
        fincaId,
        responsableId: act.responsableId,
        maquinaId: reemplazo.maquinaId,
        haRealizada: haReemplazo,
        nota: `En reemplazo de: ${act.descripcion}`,
        lotes: reemplazo.loteId ? { connect: [{ id: reemplazo.loteId }] } : undefined,
      },
    })
  }

  return true
}
```

- [ ] **Step 2: Actualizar `registrarAccion`**

En `src/app/cumplimiento/acciones.ts`, reemplazar la función `registrarAccion` por:

```ts
export async function registrarAccion(form: FormData) {
  const id = texto(form, 'id')
  const estado = texto(form, 'estado')
  if (!id || !ESTADOS_VALIDOS.includes(estado) || estado === 'PENDIENTE') return
  const motivoId = textoOpcional(form, 'motivoId')
  if (estado !== 'CUMPLIDA' && !motivoId) return
  const nota = textoOpcional(form, 'nota')
  const haRealizada = numeroOpcional(form, 'haRealizada')
  const reemplazoDescripcion = textoOpcional(form, 'reemplazoDescripcion')
  const reemplazo = reemplazoDescripcion
    ? {
        descripcion: reemplazoDescripcion,
        loteId: textoOpcional(form, 'reemplazoLoteId'),
        maquinaId: textoOpcional(form, 'reemplazoMaquinaId'),
      }
    : null
  await registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo)
  revalidatePath('/cumplimiento')
}
```

(Las funciones `texto`, `textoOpcional`, `numeroOpcional`, `ESTADOS_VALIDOS` y el import de `registrarCumplimiento` ya existen en ese archivo; no se tocan.)

- [ ] **Step 3: Motivo "Cambio de actividad" en el seed**

En `prisma/seed.ts`, en la constante `MOTIVOS`, agregar `'Cambio de actividad'`:

```ts
const MOTIVOS = [
  'Clima',
  'Daño de máquina',
  'Falta de personal',
  'Falta de insumos',
  'Cambio de prioridad',
  'Cambio de actividad',
  'Otro',
]
```

- [ ] **Step 4: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (El formulario aún envía `haFaltante`; se actualiza en Task 3. La acción ya lee `haRealizada`/reemplazo; por ahora llegan vacíos — comportamiento intermedio aceptable.)

- [ ] **Step 5: Commit**

```bash
git add src/datos/repositorio.ts src/app/cumplimiento/acciones.ts prisma/seed.ts
git commit -m "feat(cumplimiento): registrar ha realizadas y crear actividad de reemplazo; motivo Cambio de actividad"
```

---

## Task 3: Formulario de Cumplimiento + página

**Files:**
- Modify: `src/app/cumplimiento/form-registrar.tsx` (reescritura)
- Modify: `src/app/cumplimiento/page.tsx` (datos + props)

**Interfaces:**
- Consumes: `registrarAccion` que lee `haRealizada`, `reemplazoDescripcion`, `reemplazoLoteId`, `reemplazoMaquinaId` (Task 2).
- Produces: `FormRegistrar` con props `{ actividadId, esMaquinaria, motivos, motivoCambioId, lotes, maquinas, haProgramada, accion }`.

- [ ] **Step 1: Reescribir `form-registrar.tsx`**

Reemplazar todo `src/app/cumplimiento/form-registrar.tsx` por:

```tsx
'use client'

import { useState } from 'react'
import { SelectFincaLote } from '../_componentes/select-finca-lote'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }

export function FormRegistrar({
  actividadId,
  esMaquinaria,
  motivos,
  motivoCambioId,
  lotes,
  maquinas,
  haProgramada,
  accion,
}: {
  actividadId: string
  esMaquinaria: boolean
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  haProgramada: number
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [estado, setEstado] = useState('')
  const [motivoId, setMotivoId] = useState('')
  const requiereMotivo = estado !== '' && estado !== 'CUMPLIDA'
  const esCambio = motivoId !== '' && motivoId === motivoCambioId

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={actividadId} />
      <label className="flex flex-col text-xs">
        Estado
        <select
          name="estado"
          required
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="rounded border p-1 text-sm"
        >
          <option value="">— marcar —</option>
          <option value="CUMPLIDA">✅ Cumplida</option>
          <option value="NO_CUMPLIDA">🔴 No cumplida</option>
          <option value="PARCIAL">🟡 Parcial</option>
          <option value="REPROGRAMADA">🔄 Reprogramada</option>
        </select>
      </label>
      <label className="flex flex-col text-xs">
        Motivo{requiereMotivo ? ' *' : ''}
        <select
          name="motivoId"
          required={requiereMotivo}
          value={motivoId}
          onChange={(e) => setMotivoId(e.target.value)}
          className="rounded border p-1 text-sm"
        >
          <option value="">—</option>
          {motivos.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col text-xs">
        Observación / lo que faltó
        <input name="nota" placeholder="(para parcial o reprogramada)" className="rounded border p-1 text-sm" />
      </label>
      {esMaquinaria && (
        <label className="flex flex-col text-xs">
          Hectáreas realizadas *
          <input
            name="haRealizada"
            type="number"
            step="0.1"
            min="0"
            required
            defaultValue={haProgramada}
            className="w-28 rounded border p-1 text-sm"
          />
        </label>
      )}
      {esCambio && (
        <div className="flex w-full flex-wrap items-end gap-2 rounded border border-amber-200 bg-amber-50 p-2">
          <span className="w-full text-xs font-semibold text-amber-800">Actividad que se hizo en su lugar</span>
          <label className="flex flex-1 flex-col text-xs">
            Descripción *
            <input name="reemplazoDescripcion" required className="rounded border p-1 text-sm" />
          </label>
          <label className="flex flex-col text-xs">
            Finca y lote
            <SelectFincaLote lotes={lotes} name="reemplazoLoteId" />
          </label>
          {esMaquinaria && (
            <label className="flex flex-col text-xs">
              Máquina
              <select name="reemplazoMaquinaId" className="rounded border p-1 text-sm">
                <option value="">— sin máquina —</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Registrar</button>
    </form>
  )
}
```

- [ ] **Step 2: Página de Cumplimiento — datos y props**

En `src/app/cumplimiento/page.tsx`:

a) Ampliar el import de `@/datos/repositorio` para incluir `listarLotes` y `listarMaquinas`:
```ts
import { listarAreas, listarMotivos, listarActividades, listarLotes, listarMaquinas } from '@/datos/repositorio'
```

b) Reemplazar el `Promise.all` que trae `[motivos, actividades]` por:
```ts
  const [motivos, actividades, lotes, maquinas] = await Promise.all([
    listarMotivos(),
    listarActividades(areaId, anio, semana),
    listarLotes(),
    listarMaquinas(),
  ])
  const motivoCambioId = motivos.find((m) => m.nombre === 'Cambio de actividad')?.id ?? null
```

c) En el render del `<FormRegistrar .../>`, pasar las props nuevas. El bloque queda:
```tsx
                <FormRegistrar
                  actividadId={a.id}
                  esMaquinaria={esMaquinaria}
                  motivos={motivos}
                  motivoCambioId={motivoCambioId}
                  lotes={lotes}
                  maquinas={maquinas}
                  haProgramada={a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)}
                  accion={registrarAccion}
                />
```
(Conservar las demás props/atributos que ya tuviera el `FormRegistrar`. `a.lotes` está disponible porque `listarActividades` incluye `lotes`.)

- [ ] **Step 3: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual (diferida al despliegue)**

(No se corre local; se verifica tras desplegar.) Como Maquinaria: el formulario pide "Hectáreas realizadas" en todos los estados; al elegir motivo "Cambio de actividad" aparecen los campos de la actividad nueva.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/form-registrar.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): formulario pide ha realizadas y datos de actividad de reemplazo"
```

---

## Task 4: Resumen — solo realizadas + nota "Cambiada por"

**Files:**
- Modify: `src/app/resumen/resumen-area.tsx`
- Modify: `src/dominio/resumen.ts` (quitar función vieja)
- Modify: `src/dominio/resumen.test.ts` (quitar tests viejos)

**Interfaces:**
- Consumes: `hectareasRealizadas` (Task 1); `Actividad.haRealizada` (Task 1).

- [ ] **Step 1: `resumen-area.tsx` — tipo, import y cálculo**

En `src/app/resumen/resumen-area.tsx`:

a) En el import de `@/dominio/resumen`, cambiar `hectareasTrabajadasYFaltantes` por `hectareasRealizadas`.

b) En el tipo `ActividadResumen`, cambiar `haFaltante: number | null` por:
```ts
  haRealizada: number | null
  nota: string | null
```

c) Reemplazar el bloque de cálculo de hectáreas:
```ts
  const haActividad = (a: ActividadResumen) => a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)
  const realizadas = hectareasRealizadas(
    actividades.map((a) => ({ estado: a.estado, haProgramada: haActividad(a), haRealizada: a.haRealizada ?? null })),
  )

  const haPorActividad = new Map<string, number>()
  for (const a of actividades) {
    if (a.estado === 'PENDIENTE') continue
    const realizada = a.haRealizada ?? (a.estado === 'CUMPLIDA' ? haActividad(a) : 0)
    haPorActividad.set(a.descripcion, (haPorActividad.get(a.descripcion) ?? 0) + realizada)
  }
  const haActividadLista = [...haPorActividad.entries()].sort((a, b) => b[1] - a[1])
```
(Esto reemplaza las líneas que usaban `hectareasTrabajadasYFaltantes`/`ha`/`a.haFaltante`.)

- [ ] **Step 2: `resumen-area.tsx` — tarjeta de hectáreas (solo realizadas)**

En la tarjeta de Maquinaria de hectáreas, reemplazar las dos líneas (trabajadas + faltantes) por una sola:
```tsx
            <div className="mb-1 text-sm text-gray-500">Hectáreas</div>
            <div className="text-2xl font-extrabold text-[#2e9e5b]">{realizadas} ha <span className="text-sm font-medium text-gray-500">realizadas</span></div>
```

- [ ] **Step 3: `resumen-area.tsx` — mostrar nota en "cambiadas o reprogramadas"**

En la lista `🔄 Actividades cambiadas o reprogramadas`, dentro del `<li>` de cada `a`, después del `<span>` con descripción/responsable/motivo, agregar la nota si existe:
```tsx
              {a.nota && <span className="text-xs text-gray-500">· {a.nota}</span>}
```
(Colócalo dentro del `<span className="flex-1">…</span>` existente, tras el motivo, para que se vea "… · Cambio de actividad · Cambiada por: X".)

- [ ] **Step 4: Quitar la función vieja del dominio**

En `src/dominio/resumen.ts`, eliminar `export function hectareasTrabajadasYFaltantes(...) { ... }` y la interfaz `FilaHa` (ya sin uso). Mantener `r1` y `hectareasRealizadas`.

- [ ] **Step 5: Quitar los tests viejos**

En `src/dominio/resumen.test.ts`, quitar del import `hectareasTrabajadasYFaltantes` y eliminar el bloque `describe('hectareasTrabajadasYFaltantes', ...)`. (Quedan los de `hectareasRealizadas` de Task 1.)

- [ ] **Step 6: Verificar typecheck, lint y tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; suite verde (sin referencias a la función vieja).

- [ ] **Step 7: Commit**

```bash
git add src/app/resumen/resumen-area.tsx src/dominio/resumen.ts src/dominio/resumen.test.ts
git commit -m "feat(resumen): mostrar solo hectáreas realizadas y la nota 'Cambiada por'"
```

---

## Fase de despliegue (después del plan, con la usuaria)

1. `git push` (respaldo) y `npx vercel@latest deploy --prod --scope ayura-llanos --token <token>` → el build corre `prisma migrate deploy` y aplica `add_ha_realizada` en Neon.
2. Agregar el motivo "Cambio de actividad" a la base en vivo: re-correr el seed contra Neon (upsert) o agregarlo en Configuración → Motivos.
3. Verificar en la URL: registrar con "Cambio de actividad" y revisar la nueva actividad + el Resumen con "ha realizadas".

---

## Self-Review (autor del plan)

- **Cobertura del spec:** B (modelo haRealizada + migración, dominio hectareasRealizadas, form ha realizadas siempre maquinaria, resumen solo realizadas, repo guarda haRealizada) — Tasks 1,2,3,4 ✓. A (motivo nuevo, campos reemplazo en form, creación de actividad cumplida, nota "Cambiada por", se ve en resumen) — Tasks 2,3,4 ✓. "Volver al banco" intacto ✓. Despliegue documentado ✓.
- **Placeholders:** ninguno; código y SQL completos. El `<token>` de la fase de despliegue lo provee la usuaria (no es código).
- **Consistencia de tipos:** `registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo?)` igual en repo y acción; `reemplazo` con `{descripcion, loteId, maquinaId}`; `FormRegistrar` props coinciden con lo que `page.tsx` pasa y con los `name` que lee `registrarAccion` (`haRealizada`, `reemplazoDescripcion`, `reemplazoLoteId`, `reemplazoMaquinaId`); `hectareasRealizadas` firma idéntica en dominio, su test y `resumen-area`; `ActividadResumen` gana `haRealizada` + `nota` (provistos por `listarActividades`).
- **Orden seguro:** Task 1 añade `hectareasRealizadas` sin quitar la vieja (tsc verde); Task 4 cambia `resumen-area` y recién entonces elimina la vieja y su test (tsc verde). El campo `haRealizada` existe desde Task 1 (migración + generate), así que Tasks 2–4 lo usan sin romper tipos.
- **Nota:** no se ejecuta app/seed/build local (base en Neon); verificación por tsc/lint/test y prueba en el despliegue.

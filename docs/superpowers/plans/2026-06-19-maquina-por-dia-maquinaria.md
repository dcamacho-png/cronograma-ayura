# Máquina por día (solo Maquinaria) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que, al programar el área Maquinaria, se asigne una máquina (tractor) por cada día, separada del responsable; opcional; visible en Programar, Cumplimiento y Resumen.

**Architecture:** Se reutiliza `Actividad.maquinaId` (ya existe). Se quita `Maquina.operario`. La máquina se elige en el formulario cliente de "Tareas por asignar" (un selector por día marcado, solo si el área es Maquinaria); la server action `asignarTareaAccion` lee `maquina_<día>` y `asignarTarea` graba la máquina en la actividad de cada día. Las pantallas muestran `🚜 nombre`.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), Prisma 6 + SQLite, React 19, Tailwind v4, TypeScript, Vitest.

## Global Constraints

- **Solo área Maquinaria.** Toda la UI de máquinas se condiciona a `esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')`. Otras áreas no cambian.
- Máquina **opcional** (siempre puede quedar "— sin máquina —").
- **Una máquina por día** (el turno sigue siendo único para todos los días).
- Prisma 6, SQLite en `prisma/dev.db`. Tras cambiar el esquema: correr migración y **reiniciar `npm run dev`**.
- Gate automático de cada tarea: `npx tsc --noEmit` y `npm run lint` sin errores.
- Spec: `docs/superpowers/specs/2026-06-19-maquina-por-dia-maquinaria-design.md`.

## File Structure

- `prisma/schema.prisma` — quitar `operario` de `Maquina`.
- `prisma/seed.ts` — inventario de tractores (sin operario).
- `src/datos/repositorio.ts` — `crearMaquina(nombre)`; `asignarTarea(..., maquinaPorDia)`.
- `src/app/configuracion/acciones.ts` + `src/app/configuracion/page.tsx` — quitar operario.
- `src/app/programar/acciones.ts` — `asignarTareaAccion` lee `maquina_<día>`.
- `src/app/programar/asignar-tarea-form.tsx` — días controlados + selector de máquina por día.
- `src/app/programar/page.tsx` — traer `listarMaquinas`, pasar `esMaquinaria`/`maquinas`, mostrar 🚜 en grilla.
- `src/app/cumplimiento/page.tsx` — mostrar 🚜.
- `src/app/resumen/page.tsx` — mostrar 🚜 en el detalle por estado.

---

## Task 1: Catálogo de máquinas sin operario + tractores del Excel

Quita `operario` de extremo a extremo (esquema, seed, repo, Configuración) y recarga el inventario con los tractores de la hoja "I. MAQUINAS". Debe quedar como una unidad porque al borrar la columna el cliente Prisma deja de tener `operario` y cualquier referencia rompe el typecheck.

**Files:**
- Modify: `prisma/schema.prisma:47-52` (modelo `Maquina`)
- Modify: `prisma/seed.ts:56-67` (lista `MAQUINAS`) y `prisma/seed.ts:103-108` (bloque de siembra)
- Modify: `src/datos/repositorio.ts:112-113` (`crearMaquina`)
- Modify: `src/app/configuracion/acciones.ts:43-48` (`crearMaquinaAccion`)
- Modify: `src/app/configuracion/page.tsx:122` y `131-132` (lista + form)

**Interfaces:**
- Produces: `crearMaquina(nombre: string)` (sin segundo parámetro). `Maquina` ya no tiene `operario`.

- [ ] **Step 1: Quitar `operario` del esquema**

En `prisma/schema.prisma`, el modelo `Maquina` queda:

```prisma
model Maquina {
  id          String      @id @default(cuid())
  nombre      String
  actividades Actividad[]
}
```

- [ ] **Step 2: Crear la migración**

Run: `npx prisma migrate dev --name maquina_sin_operario`
Expected: migración aplicada, "Your database is now in sync with your schema". (Si avisa de pérdida de datos en la columna `operario`, aceptar — ese es el objetivo.)

- [ ] **Step 3: Reemplazar la lista de máquinas en el seed**

En `prisma/seed.ts`, sustituir el bloque `const MAQUINAS = [...]` (líneas ~56-67) por:

```ts
// Tractores de la hoja "I. MAQUINAS" (col C) — sin operario (el operario puede cambiar de máquina).
const MAQUINAS: string[] = [
  '6603', '5090E', '5090E PALA', '5075E', '5403',
  '8030', '4299', '365', 'SAME 55', 'KUBOTA 108s', 'ZETOR 5711',
]
```

- [ ] **Step 4: Ajustar la siembra de máquinas en el seed**

En `prisma/seed.ts`, reemplazar el bloque que crea máquinas (líneas ~103-108) por:

```ts
  const totalMaquinas = await prisma.maquina.count()
  if (totalMaquinas === 0) {
    for (const nombre of MAQUINAS) {
      await prisma.maquina.create({ data: { nombre } })
    }
  }
```

- [ ] **Step 5: `crearMaquina` sin operario (repo)**

En `src/datos/repositorio.ts` (líneas ~112-113):

```ts
export function crearMaquina(nombre: string) {
  return prisma.maquina.create({ data: { nombre } })
}
```

- [ ] **Step 6: `crearMaquinaAccion` sin operario**

En `src/app/configuracion/acciones.ts` (líneas ~43-48):

```ts
export async function crearMaquinaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (nombre) await intentar(() => crearMaquina(nombre))
  revalidatePath('/configuracion')
}
```

- [ ] **Step 7: Quitar operario de la UI de Configuración**

En `src/app/configuracion/page.tsx`, cambiar la línea 122:

```tsx
                <span>{m.nombre}</span>
```

y quitar el input de operario del form (línea 132), dejándolo así:

```tsx
          <form action={crearMaquinaAccion} className="flex flex-wrap gap-2">
            <input name="nombre" required placeholder="Máquina (placa/nombre)" className="flex-1 rounded border p-2 text-sm" />
            <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
```

- [ ] **Step 8: Recargar el inventario en la DB local**

Las máquinas viejas pueden seguir en la tabla tras la migración. Bórralas y resiembra los tractores:

Run:
```bash
npx prisma db execute --schema prisma/schema.prisma --stdin <<< "DELETE FROM Maquina;"
npm run db:seed
```
Expected: el seed termina con "... N máquinas ..." (N = 11).

- [ ] **Step 9: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin salida de errores.

- [ ] **Step 10: Commit**

```bash
git add prisma/ src/datos/repositorio.ts src/app/configuracion/
git commit -m "feat(maquinaria): catálogo de máquinas sin operario + tractores del Excel"
```

---

## Task 2: `asignarTarea` graba máquina por día (backend)

**Files:**
- Modify: `src/datos/repositorio.ts:200-...` (`asignarTarea`)
- Modify: `src/app/programar/acciones.ts` (`asignarTareaAccion`)

**Interfaces:**
- Consumes: `Maquina` sin operario (Task 1).
- Produces: `asignarTarea(tareaId, responsableId, dias: number[], loteIdFallback: string | null, turno: string, maquinaPorDia: Record<number, string | null>)`. La server action envía por día un campo `maquina_<día>` (ej. `maquina_1`).

- [ ] **Step 1: Nueva firma y grabado de máquina en `asignarTarea`**

En `src/datos/repositorio.ts`, cambiar la firma (añadir `maquinaPorDia`) y, dentro del `for (const dia of diasUnicos)`, añadir `maquinaId` al `data` del `create`:

```ts
export async function asignarTarea(
  tareaId: string,
  responsableId: string,
  dias: number[],
  loteIdFallback: string | null,
  turno: string,
  maquinaPorDia: Record<number, string | null> = {},
) {
```

y en el `data` de `tx.actividad.create` (junto a `responsableId`, `tareaId`):

```ts
            responsableId,
            maquinaId: maquinaPorDia[dia] ?? null,
            tareaId: tarea.id,
```

(El resto de la función no cambia.)

- [ ] **Step 2: La acción lee `maquina_<día>`**

En `src/app/programar/acciones.ts`, dentro de `asignarTareaAccion`, después de calcular `dias` y antes de llamar a `asignarTarea`, construir el mapa y pasarlo:

```ts
export async function asignarTareaAccion(form: FormData) {
  const tareaId = texto(form, 'tareaId')
  const responsableId = texto(form, 'responsableId')
  const dias = form
    .getAll('dia')
    .map((v) => Number(String(v)))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  const loteId = textoOpcional(form, 'loteId')
  const turno = texto(form, 'turno')
  const maquinaPorDia: Record<number, string | null> = {}
  for (const dia of dias) {
    const m = textoOpcional(form, `maquina_${dia}`)
    maquinaPorDia[dia] = m || null
  }
  if (!tareaId || !responsableId || dias.length === 0) return
  await asignarTarea(tareaId, responsableId, dias, loteId, turno, maquinaPorDia)
  revalidatePath('/programar')
}
```

- [ ] **Step 3: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (La UI aún no envía `maquina_<día>`; el mapa queda vacío y todo se asigna sin máquina — comportamiento idéntico al actual.)

- [ ] **Step 4: Commit**

```bash
git add src/datos/repositorio.ts src/app/programar/acciones.ts
git commit -m "feat(maquinaria): asignarTarea graba máquina por día"
```

---

## Task 3: Selector de máquina por día en Programar + 🚜 en la grilla

**Files:**
- Modify: `src/app/programar/asignar-tarea-form.tsx`
- Modify: `src/app/programar/page.tsx:4-14` (imports), `:48-53` (datos), pasar props (~107-114), grilla (~151-157)

**Interfaces:**
- Consumes: `asignarTareaAccion` que lee `maquina_<día>` (Task 2).
- Produces: `AsignarTareaForm` con props nuevas `esMaquinaria: boolean` y `maquinas: { id: string; nombre: string }[]`.

- [ ] **Step 1: Días controlados + selector de máquina por día en `AsignarTareaForm`**

Reescribir `src/app/programar/asignar-tarea-form.tsx` así:

```tsx
'use client'

import { useState } from 'react'
import { turnoPorDia } from '@/dominio/turno'
import { SelectFincaLote } from '../_componentes/select-finca-lote'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Lote = { id: string; nombre: string; finca: { nombre: string } }

export function AsignarTareaForm({
  tareaId,
  descripcion,
  lotesTarea,
  responsables,
  lotes,
  esMaquinaria,
  maquinas,
  accion,
}: {
  tareaId: string
  descripcion: string
  lotesTarea: { nombre: string }[]
  responsables: { id: string; nombre: string }[]
  lotes: Lote[]
  esMaquinaria: boolean
  maquinas: { id: string; nombre: string }[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [turno, setTurno] = useState(turnoPorDia(1))
  const [dias, setDias] = useState<number[]>([])
  const tieneLotes = lotesTarea.length > 0

  const toggleDia = (d: number) =>
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tareaId" value={tareaId} />
      <span className="min-w-[160px] flex-1 font-medium">{descripcion}</span>
      <label className="flex flex-col text-xs">
        Responsable
        <select name="responsableId" required className="rounded border p-1 text-sm">
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-col text-xs">
        Días
        <div className="flex gap-1">
          {DIAS.map((d, i) => (
            <label
              key={d}
              className="flex cursor-pointer flex-col items-center rounded border px-1.5 py-0.5 has-[:checked]:border-[#11603a] has-[:checked]:bg-green-50"
            >
              <span>{d}</span>
              <input
                type="checkbox"
                name="dia"
                value={i + 1}
                checked={dias.includes(i + 1)}
                onChange={() => toggleDia(i + 1)}
                className="accent-[#11603a]"
              />
            </label>
          ))}
        </div>
      </div>
      <label className="flex flex-col text-xs">
        Turno
        <input
          name="turno"
          value={turno}
          onChange={(e) => setTurno(e.target.value)}
          className="w-28 rounded border p-1 text-sm"
        />
      </label>
      {esMaquinaria && dias.length > 0 && (
        <div className="flex w-full flex-col gap-1 text-xs">
          <span className="text-gray-500">Máquina por día (opcional)</span>
          {[...dias].sort((a, b) => a - b).map((d) => (
            <label key={d} className="flex items-center gap-1">
              <span className="w-8">{DIAS[d - 1]}</span>
              <select name={`maquina_${d}`} className="rounded border p-1 text-sm">
                <option value="">— sin máquina —</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {tieneLotes ? (
        <span className="text-xs text-gray-600">Lote(s): {lotesTarea.map((l) => l.nombre).join(', ')}</span>
      ) : (
        <label className="flex flex-col text-xs">
          Finca y lote
          <SelectFincaLote lotes={lotes} name="loteId" />
        </label>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Asignar →</button>
    </form>
  )
}
```

- [ ] **Step 2: `programar/page.tsx` — traer máquinas, calcular `esMaquinaria`, pasar props**

En los imports de repositorio (líneas ~4-10), añadir `listarMaquinas`:

```ts
import {
  listarAreas,
  listarResponsablesPorArea,
  listarActividades,
  tareasPorAsignar,
  listarLotes,
  listarMaquinas,
} from '@/datos/repositorio'
```

En el `Promise.all` (líneas ~48-53), añadir `listarMaquinas()`:

```ts
  const [responsables, actividades, porAsignar, lotes, maquinas] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarActividades(areaId, anio, semana),
    tareasPorAsignar(areaId, anio, semana),
    listarLotes(),
    listarMaquinas(),
  ])
  const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')
```

En el render de `<AsignarTareaForm ... />` (líneas ~107-114), añadir las props:

```tsx
                  <AsignarTareaForm
                    tareaId={t.id}
                    descripcion={t.descripcion}
                    lotesTarea={t.lotes}
                    responsables={responsables}
                    lotes={lotes}
                    esMaquinaria={esMaquinaria}
                    maquinas={maquinas}
                    accion={asignarTareaAccion}
                  />
```

- [ ] **Step 3: Mostrar 🚜 en la grilla**

En `src/app/programar/page.tsx`, en la celda de actividad (líneas ~151-157), añadir la línea de máquina:

```tsx
                        {celdas.map((a) => (
                          <div key={a.id} className="mb-1 rounded bg-green-50 p-1">
                            <div>{a.descripcion}</div>
                            {a.turno && <div className="text-xs text-gray-500">{a.turno}</div>}
                            {a.maquina && <div className="text-xs text-gray-500">🚜 {a.maquina.nombre}</div>}
                            <InfoLotes lotes={a.lotes} className="mt-1" />
                          </div>
                        ))}
```

- [ ] **Step 4: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual e2e**

Reiniciar el dev server si el esquema cambió en esta sesión (`npm run dev`). Entrar como `maquinaria` / `clave123`:
1. Crear una tarea en el banco y programarla para la semana actual.
2. En Programar → "Tareas por asignar": marcar 2 días (ej. Lun y Mié). Aparece "Máquina por día (opcional)" con un selector por cada día marcado.
3. Elegir máquinas distintas para Lun y Mié; Asignar.
4. La grilla muestra 🚜 con la máquina correcta en cada día.
5. Como otra área (ej. `maiz`): el formulario de asignar **no** muestra selector de máquina.

- [ ] **Step 6: Commit**

```bash
git add src/app/programar/asignar-tarea-form.tsx src/app/programar/page.tsx
git commit -m "feat(maquinaria): selector de máquina por día al asignar + 🚜 en grilla"
```

---

## Task 4: Mostrar 🚜 en Cumplimiento y Resumen

**Files:**
- Modify: `src/app/cumplimiento/page.tsx:156-157`
- Modify: `src/app/resumen/page.tsx:170-175`

**Interfaces:**
- Consumes: actividades con `maquina` incluida (`listarActividades` ya la incluye).

- [ ] **Step 1: 🚜 en Cumplimiento**

En `src/app/cumplimiento/page.tsx`, tras la línea de descripción (línea 156), añadir la línea de máquina:

```tsx
              <div className="mb-2 font-medium">{a.descripcion}</div>
              {a.maquina && <div className="mb-2 text-sm text-gray-600">🚜 {a.maquina.nombre}</div>}
              <InfoLotes lotes={a.lotes} className="mb-2" />
```

- [ ] **Step 2: 🚜 en Resumen (detalle por estado)**

En `src/app/resumen/page.tsx`, en el `<li>` del detalle por estado (líneas ~171-174), añadir la máquina:

```tsx
                  <li key={a.id}>
                    {a.descripcion}
                    {a.maquina ? ` · 🚜 ${a.maquina.nombre}` : ''}
                    {a.lotes.length > 0 ? ` · 📍 ${a.lotes.map((l) => l.nombre).join(', ')}` : ''}
                  </li>
```

- [ ] **Step 3: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

Como `maquinaria`, con una actividad que tenga máquina asignada (Task 3):
- En Cumplimiento aparece 🚜 con la máquina bajo la descripción.
- En Resumen, el detalle por estado muestra `· 🚜 <máquina>`.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/page.tsx src/app/resumen/page.tsx
git commit -m "feat(maquinaria): mostrar máquina en Cumplimiento y Resumen"
```

---

## Self-Review (autor del plan)

- **Cobertura del spec:** catálogo sin operario + tractores (Task 1) ✓; elegir máquina al asignar, por día, opcional, solo maquinaria (Tasks 2-3) ✓; mostrar en Programar/Cumplimiento/Resumen (Tasks 3-4) ✓; gating `esMaquinaria` ✓; `Actividad.maquinaId` reutilizado ✓.
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos:** `asignarTarea(..., maquinaPorDia: Record<number, string | null>)` y la acción que arma `maquina_<día>` coinciden; `AsignarTareaForm` recibe `esMaquinaria` + `maquinas: {id,nombre}[]` que `programar/page.tsx` provee desde `listarMaquinas()`; `crearMaquina(nombre)` usado por `crearMaquinaAccion`.
- **Nota de ejecución:** Task 1 cambia el esquema → tras la migración, reiniciar `npm run dev` antes de probar Tasks 3-4.
```


# Bultos visibles + no repetir lote + devolver a asignación + sin turno no-maquinaria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (#1) mostrar bultos en /tareas; (#2) mostrar bultos al asignar; (#3) no volver a pedir finca/lote al asignar; (#4) botón "Devolver a asignar" en la grilla (futuras); (#5) sin turno en Ganadería/Nelore/Maíz-Riego (grilla y asignar).

**Architecture:** Cambios de display + quitar el selector de lote del asignar + una acción para deshacer asignación + gatear el turno por área (maquinaria). Sin migración.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 6, React 19, Tailwind v4.

## Global Constraints

- Sin migración. No tocar cumplimiento/resumen/tablero ni otras áreas fuera de lo descrito.
- #2/#3: en el asignar NUNCA se pregunta finca/lote; se muestra el lote de la creación como texto, anotando bultos `"Nombre (N bultos)"`. Si la tarea no tiene lote → "Sin lote".
- #4: `devolverAAsignacion(tareaId, anio, semana)` borra `actividad.deleteMany({tareaId,anio,semana})` y deja la tarea `estado:'PENDIENTE'` (sin tocar anioSel/semanaSel) → reaparece en "Tareas por asignar". Botón en la grilla SOLO si `turnoEditable` (semana futura) y `a.tareaId` no nulo. Acción con guard `esSemanaFutura`. No incrementa vecesReprogramada.
- #5: turno solo para Maquinaria. En no-maquinaria: ocultar turno en la grilla y quitar el campo "Turno" del asignar; guardar `turno:''`. La detección de conflictos de responsable no se ajusta (en no-maquinaria queda inactiva — aceptado).
- `GrillaSemana.turnoEditable` y `esMaquinaria` son props; el PDF (`exportar/page.tsx`) pasa `esMaquinaria` por área y NO pasa `turnoEditable` (default false).
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint`. NO ejecutar app/seed/build local (Neon).
- AGENTS.md: grilla y forms son server/`'use client'` según corresponde; los `<form>` con server action funcionan en server components.
- Spec: `docs/superpowers/specs/2026-06-21-bultos-visibles-y-devolver-asignacion-design.md`.

## File Structure

- `src/app/tareas/page.tsx` — #1.
- `src/app/programar/asignar-tarea-form.tsx` — #2/#3/#5 (form).
- `src/app/programar/page.tsx` — #2/#3/#5 (props a AsignarTareaForm y GrillaSemana; quitar `lotes`).
- `src/app/programar/acciones.ts` — #5 (asignarTareaAccion) y #4 (devolverAAsignacionAccion).
- `src/datos/repositorio.ts` — #5 (asignarTarea) y #4 (devolverAAsignacion).
- `src/app/programar/grilla-semana.tsx` — #4 (botón + tareaId) y #5 (ocultar turno).
- `src/app/programar/exportar/page.tsx` — #5 (esMaquinaria por área).

---

## Task 1: #1 — Bultos visibles en /tareas

**Files:**
- Modify: `src/app/tareas/page.tsx` (InfoLotes en banco ~132 y en mis solicitudes ~186)

**Interfaces:**
- Consumes: `t.bultosPorLote`/`s.bultosPorLote` (escalares Json que ya devuelven `listarTareasPendientes`/`listarSolicitudesDeArea`).

- [ ] **Step 1: Pasar bultos a InfoLotes (banco)**

En `src/app/tareas/page.tsx`, en el `<li>` del banco "Tareas pendientes", cambiar:

```tsx
                    <InfoLotes lotes={t.lotes} />
```

por:

```tsx
                    <InfoLotes lotes={t.lotes} bultosPorLote={t.bultosPorLote as Record<string, number> | null} />
```

- [ ] **Step 2: Pasar bultos a InfoLotes (mis solicitudes)**

En el `<li>` de "📨 Mis solicitudes a otras áreas", cambiar:

```tsx
                <InfoLotes lotes={s.lotes} />
```

por:

```tsx
                <InfoLotes lotes={s.lotes} bultosPorLote={s.bultosPorLote as Record<string, number> | null} />
```

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/tareas/page.tsx
git commit -m "fix(tareas): mostrar bultos por lote en banco y en 'Mis solicitudes'"
```

---

## Task 2: #2/#3/#5 — Asignar sin selector de lote, con bultos, y turno solo maquinaria

**Files:**
- Modify: `src/app/programar/asignar-tarea-form.tsx`
- Modify: `src/app/programar/page.tsx` (call a `AsignarTareaForm`, quitar `lotes`)
- Modify: `src/app/programar/acciones.ts` (`asignarTareaAccion`)
- Modify: `src/datos/repositorio.ts` (`asignarTarea`)

**Interfaces:**
- Produces: `asignarTarea(tareaId, responsableIds, dias, loteIdFallback, turno, maquinaPorDia?, esMaquinaria)` — nuevo último parámetro `esMaquinaria: boolean`; `AsignarTareaForm` con prop `bultosPorLote?: Record<string, number> | null` y `lotesTarea: { id: string; nombre: string }[]`, sin prop `lotes`.

- [ ] **Step 1: `asignarTarea` guarda turno solo para maquinaria**

En `src/datos/repositorio.ts`, en `asignarTarea`, agregar el parámetro final a la firma (después de `maquinaPorDia: Record<number, string | null> = {}`):

```ts
  maquinaPorDia: Record<number, string | null> = {},
  esMaquinaria = true,
```

Y en el `tx.actividad.create`, cambiar la línea del turno:

```ts
          turno: esMaquinaria ? (turno.trim() || turnoPorDia(dia)) : '',
```

(El resto de `asignarTarea` no cambia.)

- [ ] **Step 2: `asignarTareaAccion` pasa esMaquinaria**

En `src/app/programar/acciones.ts`, en `asignarTareaAccion`, después de leer `turno`, agregar:

```ts
  const esMaquinaria = texto(form, 'esMaquinaria') === '1'
```

Y cambiar la llamada a `asignarTarea(...)` para pasar `esMaquinaria` como último argumento:

```ts
  const res = await asignarTarea(tareaId, responsableIds, dias, loteId, turno, maquinaPorDia, esMaquinaria)
```

- [ ] **Step 3: `AsignarTareaForm` — bultos en lote, sin selector, turno solo maquinaria**

En `src/app/programar/asignar-tarea-form.tsx`:

1. Quitar el import de `SelectFincaLote` (línea `import { SelectFincaLote } from '../_componentes/select-finca-lote'`).

2. En el tipo de props: cambiar `lotesTarea: { nombre: string }[]` por `lotesTarea: { id: string; nombre: string }[]`; quitar `lotes: Lote[]`; agregar `bultosPorLote?: Record<string, number> | null`. (Quitar también el `type Lote` si queda sin uso, y `lotes,` del destructure.)

3. Estado del turno por área — reemplazar `const [turno, setTurno] = useState(turnoPorDia(1))` por:

```tsx
  const [turno, setTurno] = useState(esMaquinaria ? turnoPorDia(1) : '')
```

4. Envolver el `<label>` del Turno (el bloque `Turno <input name="turno" …/>`) en `{esMaquinaria && ( … )}`.

5. Agregar, junto a los `<input type="hidden">` del inicio del form, uno para el área:

```tsx
      <input type="hidden" name="esMaquinaria" value={esMaquinaria ? '1' : ''} />
```

6. Reemplazar el bloque del lote `{tieneLotes ? (<span>Lote(s): …</span>) : (<label>Finca y lote<SelectFincaLote …/></label>)}` por (siempre texto, con bultos):

```tsx
      <span className="text-xs text-gray-600">
        {lotesTarea.length > 0
          ? `Lote(s): ${lotesTarea
              .map((l) => {
                const bb = bultosPorLote?.[l.id]
                return typeof bb === 'number' ? `${l.nombre} (${bb} bultos)` : l.nombre
              })
              .join(', ')}`
          : 'Sin lote'}
      </span>
```

(Quitar la const `tieneLotes` si queda sin uso.)

- [ ] **Step 4: `programar/page.tsx` — props y quitar `lotes`**

En `src/app/programar/page.tsx`:

1. En el `Promise.all`, quitar `listarLotes()` y la variable `lotes` del destructure:

```tsx
  const [responsables, actividades, porAsignar, maquinas] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarActividades(areaId, anio, semana),
    tareasPorAsignar(areaId, anio, semana),
    listarMaquinas(),
  ])
```

y quitar `listarLotes` del import de `@/datos/repositorio`.

2. En el `<AsignarTareaForm …>`: quitar `lotes={lotes}` y agregar `bultosPorLote={t.bultosPorLote as Record<string, number> | null}` (mantener `lotesTarea={t.lotes}`):

```tsx
                    lotesTarea={t.lotes}
                    bultosPorLote={t.bultosPorLote as Record<string, number> | null}
                    responsables={responsablesActivos}
                    esMaquinaria={esMaquinaria}
                    maquinas={maquinas}
```

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/programar/asignar-tarea-form.tsx src/app/programar/page.tsx src/app/programar/acciones.ts src/datos/repositorio.ts
git commit -m "feat(programar): asignar sin re-pedir lote, con bultos visibles, turno solo maquinaria"
```

---

## Task 3: #4/#5 — Devolver a asignación + ocultar turno en la grilla (no-maquinaria)

**Files:**
- Modify: `src/datos/repositorio.ts` (`devolverAAsignacion`)
- Modify: `src/app/programar/acciones.ts` (`devolverAAsignacionAccion`)
- Modify: `src/app/programar/grilla-semana.tsx` (botón + `tareaId` + ocultar turno)
- Modify: `src/app/programar/page.tsx` (pasar `esMaquinaria` a `GrillaSemana`)
- Modify: `src/app/programar/exportar/page.tsx` (pasar `esMaquinaria` por área)

**Interfaces:**
- Consumes: `esSemanaFutura`/`semanaActual` (ya importados en programar/acciones.ts).
- Produces: `devolverAAsignacion(tareaId, anio, semana)`; `GrillaSemana` con prop `esMaquinaria: boolean` y `ActividadGrilla.tareaId`.

- [ ] **Step 1: Repo `devolverAAsignacion`**

En `src/datos/repositorio.ts`, agregar (cerca de `asignarTarea`):

```ts
// Deshace la asignación de una tarea en una semana: borra sus actividades de esa
// semana y la deja PENDIENTE en la misma semana (reaparece en "Tareas por asignar").
export async function devolverAAsignacion(tareaId: string, anio: number, semana: number) {
  await prisma.actividad.deleteMany({ where: { tareaId, anio, semana } })
  return prisma.tarea.update({ where: { id: tareaId }, data: { estado: 'PENDIENTE' } })
}
```

- [ ] **Step 2: Acción `devolverAAsignacionAccion`**

En `src/app/programar/acciones.ts`:

1. Agregar `devolverAAsignacion` al import desde `@/datos/repositorio`.
2. Agregar la acción (asegurando que `esSemanaFutura` y `semanaActual` estén importados de `@/dominio/semana` — ya lo están por `actualizarActividadAccion`):

```ts
export async function devolverAAsignacionAccion(form: FormData) {
  const tareaId = texto(form, 'tareaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!tareaId || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  if (!esSemanaFutura(anio, semana, semanaActual())) return
  await devolverAAsignacion(tareaId, anio, semana)
  revalidatePath('/programar')
}
```

- [ ] **Step 3: Grilla — tareaId, ocultar turno (no-maq), botón devolver**

En `src/app/programar/grilla-semana.tsx`:

1. Importar la acción (junto a `actualizarActividadAccion`):

```tsx
import { actualizarActividadAccion, devolverAAsignacionAccion } from './acciones'
```

2. En el tipo `ActividadGrilla`, agregar `tareaId: string | null`.

3. Agregar la prop `esMaquinaria: boolean` al destructure y al tipo del componente (junto a `turnoEditable`).

4. Envolver el bloque del turno en `{esMaquinaria && (…)}`. Es decir, el actual:

```tsx
                            {turnoEditable ? (
                              <form action={actualizarActividadAccion} …>…</form>
                            ) : (
                              a.turno && <div className="text-xs text-gray-500">{a.turno}</div>
                            )}
```

queda:

```tsx
                            {esMaquinaria && (turnoEditable ? (
                              <form action={actualizarActividadAccion} className="mt-0.5 flex items-center gap-1">
                                <input type="hidden" name="id" value={a.id} />
                                <input type="hidden" name="descripcion" value={a.descripcion} />
                                <input type="hidden" name="anio" value={anio} />
                                <input type="hidden" name="semana" value={semana} />
                                <input aria-label="Turno" name="turno" defaultValue={a.turno} className="w-20 rounded border p-0.5 text-xs" />
                                <button type="submit" className="rounded bg-[#11603a] px-1.5 text-xs font-semibold text-white">✓</button>
                              </form>
                            ) : (
                              a.turno && <div className="text-xs text-gray-500">{a.turno}</div>
                            ))}
```

5. Después de la línea de `<InfoLotes … />` (dentro del mismo `<div>` de la actividad), agregar el botón "Devolver a asignar" (solo futuras y solo si viene de una tarea):

```tsx
                            {turnoEditable && a.tareaId && (
                              <form action={devolverAAsignacionAccion} className="mt-0.5">
                                <input type="hidden" name="tareaId" value={a.tareaId} />
                                <input type="hidden" name="anio" value={anio} />
                                <input type="hidden" name="semana" value={semana} />
                                <button type="submit" className="text-xs text-amber-700 hover:underline">↩️ Devolver a asignar</button>
                              </form>
                            )}
```

- [ ] **Step 4: `programar/page.tsx` — pasar esMaquinaria a GrillaSemana**

En `src/app/programar/page.tsx`, en el `<GrillaSemana …>`, agregar `esMaquinaria={esMaquinaria}` (la variable `esMaquinaria` ya existe en la página):

```tsx
        <GrillaSemana
          areaNombre={areaActual.nombre}
          semana={semana}
          anio={anio}
          fechas={fechas}
          responsables={responsablesActivos}
          actividades={actividadesCronograma}
          turnoEditable={futura}
          esMaquinaria={esMaquinaria}
        />
```

- [ ] **Step 5: `exportar/page.tsx` — esMaquinaria por área**

En `src/app/programar/exportar/page.tsx`, en el `<GrillaSemana …>` del map por área, agregar:

```tsx
            <GrillaSemana
              areaNombre={area.nombre}
              anio={anio}
              semana={semana}
              fechas={fechas}
              responsables={responsables}
              actividades={actividades}
              esMaquinaria={area.nombre.toLowerCase().includes('maquinaria')}
            />
```

- [ ] **Step 6: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (`GrillaSemana` ahora requiere `esMaquinaria`; ambos llamadores —page y exportar— lo pasan.)

- [ ] **Step 7: Commit**

```bash
git add src/datos/repositorio.ts src/app/programar/acciones.ts src/app/programar/grilla-semana.tsx src/app/programar/page.tsx src/app/programar/exportar/page.tsx
git commit -m "feat(programar): devolver tarea a asignación + ocultar turno en áreas no-maquinaria"
```

---

## Fase de despliegue (después del plan)

1. `git push`.
2. **Deploy:** `npx vercel --prod --yes --scope ayura-llanos` (sin migración). Si falla con P1002 (advisory lock de migración por un build cancelado), liberar la sesión zombi en Neon (`SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype='advisory' AND objid=72707369`) y reintentar.
3. Verificación manual: bultos visibles en /tareas y al asignar; asignar no pide finca/lote; "Devolver a asignar" en la grilla (semana futura) regresa la tarea a "Tareas por asignar"; en Ganadería/Nelore/Maíz-Riego no aparece turno en grilla ni al asignar.

---

## Self-Review (autor del plan)

**1. Cobertura de la spec:**
- #1 InfoLotes con bultos (banco + mis solicitudes) → Task 1. ✓
- #2 bultos en "Lote(s)" del asignar → Task 2 Step 3.6. ✓
- #3 quitar selector finca/lote del asignar (+ quitar `lotes`) → Task 2 Steps 3.1/3.2/3.6 + 4. ✓
- #4 `devolverAAsignacion` + acción + botón en grilla → Task 3 Steps 1-3. ✓
- #5 turno: guardar '' (repo), no pedir (form), ocultar en grilla, pasar esMaquinaria (page+export) → Task 2 (Steps 1-3) + Task 3 (Steps 3.3-3.4, 4, 5). ✓

**2. Placeholders:** sin "TBD"/"etc."; código completo. ✓

**3. Consistencia de tipos:**
- `asignarTarea(..., esMaquinaria)` (Task 2 Step 1) ↔ llamada con `esMaquinaria` (Task 2 Step 2). ✓
- `AsignarTareaForm` `bultosPorLote?`/`lotesTarea:{id,nombre}` sin `lotes` (Task 2 Step 3) ↔ props en page (Task 2 Step 4). ✓
- `GrillaSemana` props `esMaquinaria` + `ActividadGrilla.tareaId` (Task 3 Step 3) ↔ page (Step 4) y exportar (Step 5). ✓
- `devolverAAsignacion(tareaId,anio,semana)` (Task 3 Step 1) ↔ acción (Step 2) ↔ form en grilla (Step 3.5). ✓
- `esSemanaFutura`/`semanaActual` ya importados en programar/acciones.ts (fix previo de turno). ✓

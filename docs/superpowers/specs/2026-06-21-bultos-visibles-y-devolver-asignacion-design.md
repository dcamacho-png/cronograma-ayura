# Bultos visibles + no repetir lote al asignar + devolver a asignación — Design

**Fecha:** 2026-06-21
**Estado:** aprobado por la usuaria (pendiente de plan)

Cuatro ajustes sobre el flujo banco → asignar → grilla. Sin migración.

- **#1:** mostrar la cantidad de bultos por lote en `/tareas` (banco de tareas recibidas y "Mis solicitudes a otras áreas"). Hoy se guardan pero no se muestran.
- **#2:** mostrar los bultos por lote en el formulario de "📌 Tareas por asignar" (al asignar, maquinaria debe ver las cantidades).
- **#3:** quitar el selector "Finca y lote" del paso de asignar (el lote viene de la creación/solicitud; no se vuelve a pedir).
- **#4:** poder "↩️ Devolver a asignar" una tarea ya asignada (solo semanas futuras), para corregir una asignación: borra las actividades de esa tarea en esa semana y la tarea reaparece en "Tareas por asignar".

## Decisiones (acordadas con la usuaria)

- #2/#3: en el asignar nunca se pregunta finca/lote; se usa el de la creación, mostrado como texto con sus bultos. Si la tarea no tiene lote, se asigna sin lote.
- #4: botón en la grilla (solo semanas futuras, igual que la edición de turno) en cada actividad que provenga de una tarea (`tareaId` no nulo); devuelve la tarea a "Tareas por asignar" de esa misma semana.

## Arquitectura

### #1 — Bultos en `/tareas` (`src/app/tareas/page.tsx`)
Las dos llamadas a `InfoLotes` reciben el mapa de bultos (escalar `bultosPorLote` que ya devuelven `listarTareasPendientes` y `listarSolicitudesDeArea`):
- Banco "Tareas pendientes": `<InfoLotes lotes={t.lotes} bultosPorLote={t.bultosPorLote as Record<string, number> | null} />`.
- "Mis solicitudes a otras áreas": `<InfoLotes lotes={s.lotes} bultosPorLote={s.bultosPorLote as Record<string, number> | null} />`.
(`InfoLotes` ya sabe mostrar "Nombre (N bultos)".)

### #2 + #3 — `AsignarTareaForm` (`src/app/programar/asignar-tarea-form.tsx`) + `programar/page.tsx`

`AsignarTareaForm`:
- Cambiar el tipo `lotesTarea: { nombre: string }[]` → `lotesTarea: { id: string; nombre: string }[]`.
- Nueva prop `bultosPorLote?: Record<string, number> | null`.
- Quitar el import de `SelectFincaLote` y la prop `lotes`.
- Reemplazar el bloque `{tieneLotes ? (<span>Lote(s): …</span>) : (<label>Finca y lote<SelectFincaLote/></label>)}` por SIEMPRE el texto (sin selector), anotando los bultos:
  ```tsx
  <span className="text-xs text-gray-600">
    {lotesTarea.length > 0
      ? `Lote(s): ${lotesTarea.map((l) => {
          const bb = bultosPorLote?.[l.id]
          return typeof bb === 'number' ? `${l.nombre} (${bb} bultos)` : l.nombre
        }).join(', ')}`
      : 'Sin lote'}
  </span>
  ```
- `tieneLotes` deja de usarse para ramificar (se puede eliminar la variable si queda sin uso).

`programar/page.tsx`:
- En el `<AsignarTareaForm …>`: quitar `lotes={lotes}`, y agregar `bultosPorLote={t.bultosPorLote as Record<string, number> | null}` (mantener `lotesTarea={t.lotes}`, que ya trae `id`/`nombre`).
- Quitar `lotes` del `Promise.all`/destructure y el import de `listarLotes` (ya no se usa en esta página tras quitar el selector). (`listarMaquinas`/`maquinas` SÍ se siguen usando.)
- `asignarTareaAccion` no cambia: al no haber selector, `loteId` llega vacío y `asignarTarea` usa `tarea.lotes`.

### #4 — Devolver a asignación

`src/datos/repositorio.ts`:
```ts
// Deshace la asignación de una tarea en una semana: borra sus actividades de esa
// semana y la deja PENDIENTE en la misma semana (reaparece en "Tareas por asignar").
export async function devolverAAsignacion(tareaId: string, anio: number, semana: number) {
  await prisma.actividad.deleteMany({ where: { tareaId, anio, semana } })
  return prisma.tarea.update({ where: { id: tareaId }, data: { estado: 'PENDIENTE' } })
}
```
(No se tocan `anioSel`/`semanaSel`: la tarea sigue marcada para esa semana → `tareasPorAsignar` la vuelve a listar.)

`src/app/programar/acciones.ts`:
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
(importar `devolverAAsignacion` del repo; `esSemanaFutura`/`semanaActual` ya están o se agregan al import de `@/dominio/semana`.)

`src/app/programar/grilla-semana.tsx`:
- En el tipo `ActividadGrilla`, agregar `tareaId: string | null`.
- Importar `devolverAAsignacionAccion` de `./acciones`.
- Dentro de la celda de cada actividad, cuando `turnoEditable && a.tareaId`, agregar un mini-formulario:
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
- (`listarActividades` ya devuelve el escalar `tareaId`; `programar/page.tsx` pasa `actividades` completas, así que `a.tareaId` está disponible.)

## Flujo (#4)

Asignar una tarea (futura) → aparece en la grilla → si hubo error, "↩️ Devolver a asignar" borra sus actividades de esa semana y la tarea vuelve a "📌 Tareas por asignar" (misma semana) → se asigna de nuevo correctamente.

### #5 — Sin turno en Ganadería, Nelore y Maíz-Riego

El turno es concepto de Maquinaria. Para las demás áreas (no maquinaria) se oculta en la grilla y se quita del formulario de asignar; la actividad se guarda con turno vacío.

`src/app/programar/asignar-tarea-form.tsx`:
- Estado inicial del turno según área: `const [turno, setTurno] = useState(esMaquinaria ? turnoPorDia(1) : '')`.
- Envolver el `<label>Turno …</label>` en `{esMaquinaria && (…)}` (no se muestra para otras áreas).
- Agregar un hidden para que la acción sepa el área: `<input type="hidden" name="esMaquinaria" value={esMaquinaria ? '1' : ''} />`.
- (La sección "Máquina por día" ya está bajo `{esMaquinaria && …}`. El aviso `conflictosResp` no cambia: con `turno=''` y actividades guardadas con `''`, en no-maquinaria simplemente no marca conflictos.)

`src/app/programar/acciones.ts` (`asignarTareaAccion`):
- `const esMaquinaria = texto(form, 'esMaquinaria') === '1'`.
- Pasar `esMaquinaria` a `asignarTarea`.

`src/datos/repositorio.ts` (`asignarTarea`):
- Nuevo parámetro final `esMaquinaria: boolean`.
- Al crear cada actividad: `turno: esMaquinaria ? (turno.trim() || turnoPorDia(dia)) : ''`.
- (La detección de conflictos sigue igual; en no-maquinaria el `turno=''` hace que `turnoEfectivo('',dia)` no calce con los guardados `''`, así que NO se marcan conflictos de responsable en esas áreas — aceptado: una persona puede tener varias tareas el mismo día ahí.)

`src/app/programar/grilla-semana.tsx`:
- Nueva prop `esMaquinaria: boolean`.
- El bloque del turno (form editable o texto) se muestra solo si `esMaquinaria` (envolver todo el `{turnoEditable ? <form> : a.turno && <div>}` en `{esMaquinaria && (…)}`).

`src/app/programar/page.tsx` y `src/app/programar/exportar/page.tsx`:
- Pasar `esMaquinaria={...}` a `GrillaSemana`. En el export (PDF, todas las áreas) se calcula por cada área: `esMaquinaria: a.nombre.toLowerCase().includes('maquinaria')`.

## Retrocompatibilidad y constraints

- Sin migración (display + quitar un campo + un borrado/reset).
- #5: en no-maquinaria el turno se guarda vacío y no se detectan conflictos de responsable por turno (se acepta multi-tarea por día). Maquinaria sin cambios.
- #4 solo aplica a semanas futuras (mismo umbral `esSemanaFutura` que la edición de turno; con guard de servidor) y solo a actividades con `tareaId` (las "actividades realizadas" sueltas no lo muestran).
- `devolverAAsignacion` no incrementa `vecesReprogramada` (es una corrección, no una reprogramación).
- No se toca cumplimiento, resumen, ni el PDF (la grilla del PDF tiene `turnoEditable` por defecto false → no muestra los botones).
- AGENTS.md: la grilla es server component; los `<form>` con server action funcionan sin `'use client'`.

## Archivos

- `src/app/tareas/page.tsx` — #1 (bultos en InfoLotes ×2).
- `src/app/programar/asignar-tarea-form.tsx` — #2/#3 (bultos en "Lote(s)", quitar selector).
- `src/app/programar/page.tsx` — #2/#3 (quitar `lotes`, pasar `bultosPorLote`).
- `src/datos/repositorio.ts` — #4 (`devolverAAsignacion`).
- `src/app/programar/acciones.ts` — #4 (`devolverAAsignacionAccion`).
- `src/app/programar/grilla-semana.tsx` — #4 (botón + `tareaId` en `ActividadGrilla`) y #5 (ocultar turno si no maquinaria).
- `src/app/programar/exportar/page.tsx` — #5 (pasar `esMaquinaria` por área a `GrillaSemana`).

(Resumen por archivo: tareas/page.tsx = #1; asignar-tarea-form.tsx = #2/#3/#5; programar/page.tsx = #2/#3/#5; repositorio.ts = #4/#5; programar/acciones.ts = #4/#5; grilla-semana.tsx = #4/#5; exportar/page.tsx = #5.)

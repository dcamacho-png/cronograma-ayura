# Correcciones de Cumplimiento: cambio de actividad + hectáreas realizadas

Estado: APROBADO (2026-06-20)

## Problema / petición

Dos correcciones en el registro de Cumplimiento:

**A. Cambio de actividad.** Cuando una actividad no se hizo porque **se cambió por otra**, poder registrar **cuál actividad se hizo en su lugar**; esa nueva se crea **cumplida** y **cuenta** en las actividades programadas y en el resumen. En la original debe quedar especificado por cuál se cambió.

**B. Hectáreas realizadas (en vez de faltantes).** Hoy el formulario pide "Ha faltantes". Se quiere **omitir ese valor** y en su lugar pedir **"Hectáreas realizadas"** (lo que sí se hizo). En el Resumen mostrar **solo** las realizadas.

## Decisiones acordadas

- A: la original queda como se marcó (Parcial/No cumplida/Reprogramada) con motivo **"Cambio de actividad"**; se crea una actividad NUEVA **cumplida** el mismo día/responsable, con descripción + lote (+ máquina si es Maquinaria), que cuenta. La original guarda en su nota "Cambiada por: <nueva>".
- A: el disparador es un **motivo nuevo "Cambio de actividad"**.
- A: la original **sigue volviendo al banco** (comportamiento actual) — no se cambia.
- B: el campo **"Hectáreas realizadas"** se pide **siempre que el área sea Maquinaria** (cualquier estado), con valor inicial = hectáreas del/los lote(s) (editable).
- B: en el Resumen se muestra **solo "Ha realizadas"** (se quita "faltantes").

## Contexto técnico

- `src/app/cumplimiento/form-registrar.tsx` (cliente): estado + motivo + nota + (maquinaria) `haFaltante`.
- `registrarAccion` (`cumplimiento/acciones.ts`) → `registrarCumplimiento` (`repositorio.ts`): hoy recibe `haFaltante`; si no es CUMPLIDA y es tarea de un día, devuelve la tarea al banco.
- `dominio/resumen.ts`: `hectareasTrabajadasYFaltantes(filas{estado,haProgramada,haFaltante})`. Tests en `resumen.test.ts`.
- `resumen-area.tsx`: tarjeta "Hectáreas" (trabajadas + faltantes) y "Hectáreas realizadas por actividad"; tipo `ActividadResumen` con `haFaltante`.
- `cumplimiento/page.tsx`: pasa `esMaquinaria` + `motivos` al form; no pasa lotes/máquinas.
- Modelo `Actividad` tiene `haFaltante Float?`. Base en producción (Neon Postgres); migración incremental se aplica con `prisma migrate deploy` en el build.

## Parte B — Hectáreas realizadas

### Modelo
- Agregar `haRealizada Float?` a `Actividad` (en `prisma/schema.prisma`). Se **deja de usar** `haFaltante` (la columna se conserva, sin escribir ni leer, para no romper la base; no se borra).
- Migración incremental nueva `prisma/migrations/<timestamp>_add_ha_realizada/migration.sql` (timestamp posterior a `0_init`):
  ```sql
  ALTER TABLE "Actividad" ADD COLUMN "haRealizada" DOUBLE PRECISION;
  ```

### Dominio (`dominio/resumen.ts`)
- Reemplazar `hectareasTrabajadasYFaltantes` por:
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
  (Mantener el helper `r1`. Eliminar `hectareasTrabajadasYFaltantes` y el tipo `FilaHa` si queda sin uso.)
- Tests `resumen.test.ts`: reemplazar los de `hectareasTrabajadasYFaltantes` por tests de `hectareasRealizadas` (cumplida sin valor = haProgramada; parcial = el valor dado; pendiente = se ignora; no cumplida sin valor = 0).

### Resumen (`resumen-area.tsx`)
- En el tipo `ActividadResumen`: `haFaltante` → `haRealizada: number | null`.
- Import: `hectareasRealizadas` en vez de `hectareasTrabajadasYFaltantes`.
- Cálculo: `const realizadas = hectareasRealizadas(actividades.map((a) => ({ estado: a.estado, haProgramada: haActividad(a), haRealizada: a.haRealizada ?? null })))`.
- Tarjeta "Hectáreas": mostrar **solo** `{realizadas} ha realizadas` (verde). Quitar la línea de faltantes.
- `haPorActividad`: `realizada = a.haRealizada ?? (a.estado === 'CUMPLIDA' ? haActividad(a) : 0)`.

### Formulario (`form-registrar.tsx`)
- Quitar el input `haFaltante`.
- Agregar, **siempre que `esMaquinaria`** (cualquier estado), un input **"Hectáreas realizadas"** `name="haRealizada"`, `type=number step=0.1 min=0`, `required` cuando `esMaquinaria`, con `defaultValue` = `haProgramada` (prop nueva).

### Acción / repo
- `registrarAccion`: leer `haRealizada` (numeroOpcional). Pasarlo a `registrarCumplimiento`.
- `registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo?)`: guardar `haRealizada` en la actividad (en vez de `haFaltante`).

## Parte A — Cambio de actividad

### Motivo
- Agregar `'Cambio de actividad'` a `MOTIVOS` en `prisma/seed.ts`. En la base en vivo se agrega re-corriendo el seed (upsert) o desde Configuración → Motivos.

### Formulario (`form-registrar.tsx`)
- Props nuevas: `motivoCambioId: string | null`, `lotes: Lote[]`, `maquinas: {id,nombre}[]`.
- Hacer el `<select name="motivoId">` **controlado** (estado `motivoId`).
- Cuando `motivoId === motivoCambioId` (y no vacío), mostrar la sección "Actividad que se hizo en su lugar":
  - `name="reemplazoDescripcion"` (texto, `required` en ese caso).
  - finca→lote: `<SelectFincaLote lotes={lotes} name="reemplazoLoteId" />`.
  - si `esMaquinaria`: `<select name="reemplazoMaquinaId">` con opción "— sin máquina —" + `maquinas`.

### Acción / repo
- `registrarAccion`: si viene `reemplazoDescripcion` no vacío, armar `reemplazo = { descripcion, loteId: textoOpcional('reemplazoLoteId'), maquinaId: textoOpcional('reemplazoMaquinaId') }` y pasarlo a `registrarCumplimiento`.
- `registrarCumplimiento(..., reemplazo?)`:
  - La nota de la original: si hay `reemplazo`, `nota = "Cambiada por: " + reemplazo.descripcion`; si no, la nota del formulario.
  - Tras actualizar la original (y la lógica de volver al banco intacta), si hay `reemplazo`:
    - derivar `fincaId` del `loteId` (si hay).
    - crear una Actividad nueva: `anio/semana/dia/areaId/responsableId/turno` = los de la original; `descripcion = reemplazo.descripcion`; `estado = 'CUMPLIDA'`; `fincaId`; `lotes connect [loteId]` si hay; `maquinaId = reemplazo.maquinaId`; `vecesReprogramada = 0`; `tareaId = null`; `nota = "En reemplazo de: " + act.descripcion`; `haRealizada` = suma de hectáreas del lote (si hay) — completa, por estar cumplida.

### Página de Cumplimiento (`cumplimiento/page.tsx`)
- Traer también `listarLotes()` y `listarMaquinas()`.
- `motivoCambioId = motivos.find((m) => m.nombre === 'Cambio de actividad')?.id ?? null`.
- Por cada actividad pendiente, calcular `haProgramada` = suma de hectáreas de sus lotes y pasarlo al `FormRegistrar`, junto con `lotes`, `maquinas`, `motivoCambioId`.

### Resumen — mostrar "Cambiada por"
- En `resumen-area.tsx`, en la lista "🔄 Actividades cambiadas o reprogramadas", mostrar la `nota` de la actividad si existe (ej. "Cambiada por: …"). El tipo `ActividadResumen` ya puede incluir `nota: string | null`.

## Qué NO cambia

- Lógica de "volver al banco" por novedad (original): igual.
- Estados, % de cumplimiento (la nueva actividad cumplida cuenta como una más; aceptado).
- Otras pantallas (Programar, Tareas, Tablero, exportaciones): sin cambios de lógica (Resumen/Export reflejan el nuevo cálculo de ha automáticamente vía `ResumenArea`).

## Pruebas

- Dominio: tests de `hectareasRealizadas` (reemplazan los de faltantes). Suite sigue verde.
- `npx tsc --noEmit` y `npm run lint` limpios.
- Verificación manual (tras desplegar): como Maquinaria, registrar Parcial con motivo "Cambio de actividad" → la original queda con "Cambiada por: X", se crea la nueva cumplida (aparece en la grilla y cuenta), y el Resumen muestra solo "ha realizadas".

## Despliegue (fase manual, después del código)

1. `git push` (respaldo) + `vercel deploy --prod` (el build corre `prisma migrate deploy` → aplica la migración `add_ha_realizada` en Neon).
2. Agregar el motivo "Cambio de actividad" a la base en vivo: re-correr el seed contra Neon (upsert) **o** agregarlo en Configuración → Motivos.

## Notas

- Migración incremental: SQL trivial (agrega columna nullable), sin pérdida de datos.
- `haFaltante` queda como columna huérfana (sin uso); se puede limpiar en una migración futura.

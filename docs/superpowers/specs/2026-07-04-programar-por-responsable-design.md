# Programación por responsable (días + turno de cada uno) — Design

**Fecha:** 2026-07-04
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

Hoy, al asignar una tarea a la grilla (`AsignarTareaForm` → `asignarTareaAccion` → `asignarTarea`), se eligen N responsables y **una sola barra de Días compartida**. El repo crea el producto cartesiano: una fila `Actividad` por cada (responsable × día), todas con el **mismo** turno. El campo **Turno** (texto libre) solo se muestra en áreas de **maquinaria**; en estándar no hay turno. La máquina se elige **por día** (compartida).

Esto no permite que una misma actividad la desarrollen varias personas en **días** o **turnos distintos**.

## Objetivo

Que al seleccionar más de un responsable, **cada responsable tenga su propia barra de días** (y, en maquinaria, su propio **turno** y su **máquina por día**), de modo que la actividad se pueda programar con distintas personas en distintos días/horarios en un solo envío.

## Decisiones (acordadas con el usuario)

1. **Enfoque A:** un solo formulario "Asignar"; cada responsable seleccionado despliega su propio bloque (días + turno + máquina-por-día). Un único submit crea todas las filas.
2. **Alcance:** los **días por responsable** aplican a **todas las áreas** (estándar y maquinaria). El **turno por responsable** aplica **solo a maquinaria** (estándar sigue sin turno, `turno=''`).
3. **"Horario" = el campo Turno actual** (texto libre), ahora **uno por responsable** (aplica a todos los días de ese responsable; no hay turno distinto por día).
4. **Máquina por (responsable × día):** en maquinaria, bajo la barra de cada responsable, un selector de máquina por cada día que ese responsable eligió.
5. **Sin cambios de esquema:** cada `Actividad` ya guarda su propio `turno` y `maquinaId` por fila. El cambio es en cómo el formulario recolecta y cómo la acción/repo iteran (bloque por responsable, no cartesiano).

## Arquitectura

### 1. UI — `src/app/programar/asignar-tarea-form.tsx` (client)

- Se conserva el desplegable multi-select de **Responsables**.
- Estado nuevo: `porResp: Record<string, { dias: number[]; turno: string }>` (una entrada por responsable seleccionado). Al marcar un responsable se crea su entrada (`{ dias: [], turno: esMaquinaria ? turnoPorDia(1) : '' }`); al desmarcarlo se elimina.
- Por cada responsable seleccionado se renderiza un bloque con:
  - **Días**: barra de 7 checkboxes, ligada a `porResp[rid].dias` (respeta `diasPasados`, deshabilitados).
  - **(maquinaria) Turno**: input de texto ligado a `porResp[rid].turno`.
  - **(maquinaria) Máquina por día**: un `<select>` por cada día que ese responsable eligió, con `name="maquina_<rid>_<dia>"` (no controlado). Las opciones disponibles se filtran contra `ocupacion` para ese `dia` + `turnoEfectivo(porResp[rid].turno, dia)` (misma lógica de disponibilidad de hoy).
- **Conflicto en vivo** (por responsable): para cada día de un responsable donde `ocupacion` ya tiene ese `responsableId` en `dia` + `turnoEfectivo`, se muestra el aviso (igual que hoy, pero por responsable). Los conflictos de **máquina** se validan en el servidor (como hoy).
- **Botón Asignar** deshabilitado si ningún responsable tiene ≥1 día, o si hay algún conflicto de responsable en vivo.
- Estándar: mismo bloque por responsable pero sin Turno ni Máquina.

### 2. Contrato de `name`s (FormData)

- `tareaId`, `areaId`, `anio`, `semana`, `esMaquinaria` — hidden (como hoy).
- `responsableId` (múltiple) — responsables seleccionados.
- `dia_<rid>` (múltiple) — días de ese responsable.
- `turno_<rid>` — turno de ese responsable (solo maquinaria; en estándar no se envía o se ignora).
- `maquina_<rid>_<dia>` — máquina de ese responsable en ese día (solo maquinaria).
- `respNombre_<rid>` — hidden con el nombre del responsable, para que la acción pueda nombrar a la persona en los mensajes de conflicto (la acción no consulta responsables).

### 3. Acción — `src/app/programar/acciones.ts` (`asignarTareaAccion`)

- Lee `responsableId` (getAll). Para cada `rid`: `dias = getAll('dia_'+rid)` (enteros 1–7 válidos), `turno = texto('turno_'+rid)`, y `maquinaPorDia[dia] = textoOpcional('maquina_'+rid+'_'+dia)` para cada día.
- Construye `asignaciones: Asignacion[]` filtrando responsables sin días.
- Valida: `tareaId` presente y al menos una asignación con días. Si no, return.
- Llama `asignarTarea(tareaId, asignaciones, loteId, esMaquinaria)`. Si hay conflictos, arma el mensaje de error (redirect `?error=`, como hoy) resolviendo el nombre de cada responsable con los hidden `respNombre_<rid>` → p.ej. `"No se asignó. Ana — Mar: el responsable ya tiene una tarea en ese turno · Beto — Vie: la máquina ya está ocupada en ese turno"`.

Tipo:
```ts
type Asignacion = { responsableId: string; dias: number[]; turno: string; maquinaPorDia: Record<number, string | null> }
```

### 4. Repo — `src/datos/repositorio.ts` (`asignarTarea`)

- **Firma nueva:** `asignarTarea(tareaId: string, asignaciones: Asignacion[], loteIdFallback: string | null, esMaquinaria = true)`. (Reemplaza los parámetros `responsableIds/dias/turno/maquinaPorDia` compartidos.)
- Resuelve tarea, semana, lotes/finca como hoy.
- Dentro de la transacción:
  - Lee `existentes` de la BD para los días involucrados (unión de todos los días de todas las asignaciones).
  - **Conflictos BD:** por cada asignación, `detectarConflictosAsignacion(existentes, asig.dias, asig.responsableId, asig.maquinaPorDia, asig.turno)`. Cada conflicto se anota con `responsableId`.
  - **Conflicto intra-envío (nuevo):** si dos asignaciones usan la **misma `maquinaId`** (no nula) en el mismo `dia` + `turnoEfectivo`, es conflicto de máquina.
  - Si hay conflictos, return `{ ok:false, motivo:'conflicto', conflictos }` (con `responsableId` en cada uno).
  - Crea **una fila por (asignación × su día)** con `turno` (maquinaria: `asig.turno.trim() || turnoPorDia(dia)`; estándar: `''`), `responsableId = asig.responsableId`, `maquinaId = asig.maquinaPorDia[dia] ?? null`.
  - Marca la tarea `PROGRAMADA`.

### 5. Dominio — `src/dominio/programacion.ts`

- `Conflicto` gana campo opcional `responsableId?: string` (para mensajes claros por persona). `detectarConflictosAsignacion` lo rellena con el `responsableId` recibido.
- **Nueva función testeable** para el conflicto intra-envío:
  ```ts
  export function conflictosMaquinaEntreResponsables(asignaciones: Asignacion[]): Conflicto[]
  ```
  Devuelve, por cada (dia, turnoEfectivo) donde una misma `maquinaId` no nula aparece en 2+ asignaciones, un `Conflicto { dia, tipo:'maquina' }`. Usada por el repo. Con test unitario.

## Flujo de datos

```
Usuario marca responsables → cada uno abre su bloque (días + turno + máquina)
  → submit del <form action={asignarTareaAccion}>
      → asignarTareaAccion arma Asignacion[] (dia_<rid>, turno_<rid>, maquina_<rid>_<dia>)
      → asignarTarea(tareaId, asignaciones, loteId, esMaquinaria)
          → conflictos BD (por responsable) + conflictos máquina intra-envío
          → si limpio: crea 1 Actividad por (responsable × su día) con su turno/máquina
          → tarea = PROGRAMADA
      → revalidatePath('/programar')
```

## Casos borde

- **Un solo responsable:** funciona igual que un bloque único (equivalente al comportamiento actual, pero con su propia barra).
- **Responsable sin días:** se ignora (no crea filas para él); si NINGUNO tiene días, no se asigna.
- **Días pasados:** deshabilitados por responsable (igual que hoy con `diasPasados`).
- **Estándar:** `turno=''` y sin máquina; el bloque por responsable solo muestra la barra de días.
- **Mismo responsable en el desplegable no puede repetirse** (checkbox), así que no hay colisión responsable-consigo-mismo.
- **Dos responsables, misma máquina, mismo día+turno:** bloqueado con mensaje (conflicto intra-envío).
- **Dos responsables, mismo día+turno, distinta máquina (o sin máquina):** permitido.

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- Tests unitarios (vitest): `conflictosMaquinaEntreResponsables` (casos: sin conflicto, misma máquina mismo día+turno, misma máquina distinto día, máquina nula ignorada) y que `detectarConflictosAsignacion` rellena `responsableId`.
- En vivo (server local + cookie firmada; escrituras reversibles): asignar una tarea con 2 responsables en días distintos → se crean las filas correctas por responsable/día; en maquinaria con turnos/máquinas distintas; y el bloqueo por máquina compartida en mismo día+turno.

## Fuera de alcance

- Turno distinto por día dentro de un mismo responsable (se decidió: un turno por responsable).
- Cambios en la grilla, el export o `/resumen` (las filas resultantes tienen la misma forma que hoy).
- Reasignar/editar la programación por responsable después de creada (se maneja con los flujos existentes de devolver/borrar).

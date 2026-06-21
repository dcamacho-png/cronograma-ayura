# Varios responsables por actividad + devolver solicitud al solicitante — Design

**Fecha:** 2026-06-21
**Estado:** aprobado por la usuaria (pendiente de plan)

Dos mejoras independientes:

- **Parte A:** al asignar en Programar, poder elegir **varios responsables** para la misma actividad. Se crea **una copia por responsable** (× día).
- **Parte B:** una tarea **solicitada** a maquinaria que no se realiza se **devuelve al área solicitante** (no se elimina), con un botón **"Reenviar"** para mandarla de nuevo.

Ninguna requiere migración: A no cambia el esquema; B reutiliza el campo de texto `Tarea.estado` con un nuevo valor `'DEVUELTA'`.

---

## Parte A — Varios responsables por actividad

### Decisión
Una **copia de la actividad por responsable** (× día). Cada actividad conserva un único `responsableId` (encaja con la grilla responsable×día y con el registro de cumplimiento por responsable, sin cambios de modelo).

### Cambios

**`src/app/programar/asignar-tarea-form.tsx`** (cliente):
- El `<select name="responsableId">` único se reemplaza por **casillas** (un `<input type="checkbox" name="responsableId" value={r.id}>` por responsable activo), igual estilo que las casillas de días.
- Estado: `const [responsableIds, setResponsableIds] = useState<string[]>(responsables[0] ? [responsables[0].id] : [])` con un `toggleResp(id)`.
- El aviso en vivo de ocupación se generaliza a todos los responsables marcados: por cada `rid` en `responsableIds`, los días en que ese responsable ya tiene tarea en ese turno (usando `ocupacion`/`turnoEfectivo`). Se muestra "⚠️ {nombre} ya tiene tarea: {días}" por cada conflicto.
- El botón "Asignar →" se deshabilita si `responsableIds.length === 0` o si hay algún conflicto.

**`src/app/programar/acciones.ts`** (`asignarTareaAccion`):
- `const responsableIds = form.getAll('responsableId').map((v) => String(v)).filter(Boolean)`.
- Guarda: `if (!tareaId || responsableIds.length === 0 || dias.length === 0) return`.
- Llama `asignarTarea(tareaId, responsableIds, dias, loteId, turno, maquinaPorDia)`.

**`src/datos/repositorio.ts`** (`asignarTarea`):
- Firma: `responsableId: string` → `responsableIds: string[]`.
- Detección de conflictos: por cada `rid` en `responsableIds`, llamar `detectarConflictosAsignacion(existentes, diasUnicos, rid, maquinaPorDia, turno)`; juntar y **deduplicar** por `${dia}-${tipo}`. Si hay alguno, retornar `{ ok:false, motivo:'conflicto', conflictos }`.
- Creación: doble bucle `for (const rid of responsableIds) for (const dia of diasUnicos)` → una `actividad.create` por cada par (mismo `tareaId`, lotes, turno, maquinaPorDia[dia], bultos), con `responsableId: rid`. `creadas` cuenta el total.
- `tx.tarea.update(... estado: 'PROGRAMADA')` igual que hoy.

### Notas / fuera de alcance
- La máquina por día es la misma para todas las copias de ese día (la usuaria eligió varios responsables para la misma actividad). NO se detectan conflictos de máquina **dentro del mismo lote de creación** (la detección es contra actividades existentes); aceptable para esta versión.
- El modelo `Actividad.responsableId` sigue siendo único; no hay relación muchos-a-muchos.

---

## Parte B — Devolver solicitud al solicitante + reenviar

### Decisión
Nuevo valor `'DEVUELTA'` para `Tarea.estado` (texto, sin migración). Flujo:
1. En el **banco de maquinaria**, las tareas **solicitadas** (`solicitadaPorAreaId != null`) muestran, en vez de "eliminar", un botón **"↩️ Devolver al solicitante"** → la tarea pasa a `estado='DEVUELTA'` (con `anioSel/semanaSel = null`). Sale del banco de maquinaria (que lista `PENDIENTE` con `anioSel = null`). NO se elimina. Las tareas **propias** (sin `solicitadaPorAreaId`) conservan "eliminar".
2. En **"📨 Mis solicitudes a otras áreas"** del solicitante, las tareas `DEVUELTA` se muestran como **"🔴 No realizada"** con un botón **"Reenviar"** → vuelve a `estado='PENDIENTE'` (`anioSel/semanaSel = null`), reaparece en el banco de maquinaria.

### Cambios

**`src/datos/repositorio.ts`:**
```ts
export function devolverAlSolicitante(id: string) {
  return prisma.tarea.update({ where: { id }, data: { estado: 'DEVUELTA', anioSel: null, semanaSel: null } })
}
export function reenviarSolicitud(id: string) {
  return prisma.tarea.update({ where: { id }, data: { estado: 'PENDIENTE', anioSel: null, semanaSel: null } })
}
```
(`listarTareasPendientes` no cambia: ya filtra `estado:'PENDIENTE', anioSel:null`, así que `DEVUELTA` queda fuera del banco de maquinaria. `listarSolicitudesDeArea` ya trae todas las solicitudes del área, incluida `DEVUELTA`.)

**`src/app/tareas/acciones.ts`:**
```ts
export async function devolverAlSolicitanteAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await devolverAlSolicitante(id)
  revalidatePath('/tareas')
}
export async function reenviarSolicitudAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await reenviarSolicitud(id)
  revalidatePath('/tareas')
}
```
(importar `devolverAlSolicitante`, `reenviarSolicitud` del repositorio.)

**`src/app/tareas/page.tsx`:**
- Banco "Tareas pendientes": en cada `<li>`, el bloque `<form action={eliminarTareaAccion}>…eliminar…</form>` se vuelve condicional:
  - si `t.solicitadaPorArea` → `<form action={devolverAlSolicitanteAccion}>` con botón "↩️ Devolver al solicitante" (texto pequeño, ámbar/gris).
  - si no → el "eliminar" actual.
  (ambos envían `<input type="hidden" name="id" value={t.id}>`.)
- "📨 Mis solicitudes a otras áreas": en cada `<li>`, el estado mostrado gana el caso `DEVUELTA`:
  - `s.estado === 'PROGRAMADA'` → "✅ Programada"; `s.estado === 'DEVUELTA'` → "🔴 No realizada"; si no → "🕓 En banco".
  - cuando `s.estado === 'DEVUELTA'`, además un `<form action={reenviarSolicitudAccion}>` con botón "Reenviar" (`<input type="hidden" name="id" value={s.id}>`).

### Notas / fuera de alcance
- El botón "Devolver al solicitante" solo aplica a solicitudes en el banco (PENDIENTE, sin programar). Tareas ya programadas/asignadas no se cubren aquí (su no-realización es el flujo de Cumplimiento existente).
- No se toca el flujo de cumplimiento, la grilla ni otras áreas.

---

## Retrocompatibilidad y constraints

- Sin migración: A no cambia el esquema; B usa `Tarea.estado` (String) con nuevo valor `'DEVUELTA'`.
- `asignarTarea` cambia de firma (`responsableId` → `responsableIds[]`); el único llamador es `asignarTareaAccion` (se actualiza en el mismo cambio).
- Tareas existentes con estado PENDIENTE/PROGRAMADA no se ven afectadas; `DEVUELTA` es un estado nuevo.
- Despliegue: el build de Vercel corre `prisma migrate deploy && next build` (sin migración nueva, solo build).
- AGENTS.md: `asignar-tarea-form.tsx` es `'use client'`; seguir los patrones existentes (casillas de días, formularios con server actions).

## Archivos

- `src/datos/repositorio.ts` — `asignarTarea` (responsableIds); `devolverAlSolicitante`, `reenviarSolicitud` (nuevas).
- `src/app/programar/asignar-tarea-form.tsx` — responsables como casillas.
- `src/app/programar/acciones.ts` — `asignarTareaAccion` (responsableIds).
- `src/app/tareas/acciones.ts` — `devolverAlSolicitanteAccion`, `reenviarSolicitudAccion`.
- `src/app/tareas/page.tsx` — botón "Devolver al solicitante" en el banco; estado "🔴 No realizada" + "Reenviar" en "Mis solicitudes".

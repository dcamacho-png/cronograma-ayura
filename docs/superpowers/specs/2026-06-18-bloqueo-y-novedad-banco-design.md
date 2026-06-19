# Diseño — Bloquear actividad al programar + volver al banco por novedad

**Fecha:** 2026-06-18 · **Estado:** Aprobado

## Problema
En Tareas, al elegir semana y "Guardar", la tarea **se queda en el banco** (el banco mostraba todas las pendientes). Parece que el botón "no funciona". Verificado: la acción sí guarda la semana (`anioSel/semanaSel`), solo que la tarea no sale del banco.

## Comportamiento deseado
La actividad, al **programarse, se bloquea** (sale del banco). Vuelve al banco **solo si hay una novedad** — por dos vías (ambas):
- **A — Novedad en cumplimiento:** al marcar **No cumplida / Reprogramar / Parcial** (todo lo que no es 100% cumplido), la actividad **vuelve al banco** sin semana, para reprogramarla. El registro de esa semana queda en el **historial** intacto.
- **B — Manual en Programar:** botón **"↩️ Devolver al banco"** en cada tarea de "Por asignar" → la saca de la semana.

Se **conserva el contador de reprogramaciones** (semáforo verde→rojo) entre vueltas al banco.

## Datos
- `Tarea` gana `vecesReprogramada Int @default(0)` (cambio aditivo).

## Repositorio
- `listarTareasPendientes(areaId)` → solo PENDIENTE **con `anioSel: null`** (banco = sin programar). (Único uso: la pantalla Tareas.)
- `asignarTarea(...)` → la actividad creada **hereda** `vecesReprogramada: tarea.vecesReprogramada` (conserva el contador).
- `registrarCumplimiento(id, estado, ...)`:
  - Marca la actividad (estado/motivo/nota/haFaltante) como hoy.
  - **Reemplaza** la copia automática a la semana siguiente: si `estado !== 'CUMPLIDA'` y la actividad tiene `tareaId`, devuelve la **tarea** al banco: `estado='PENDIENTE'`, `anioSel=null`, `semanaSel=null`, `vecesReprogramada = act.vecesReprogramada + 1`. (Sin `tareaId`: solo se bloquea.)
- **Devolver al banco (B):** reusa `quitarSeleccionTarea(id)` (la tarea en "Por asignar" sigue PENDIENTE; solo se le quita la semana).

## UI
- **Tareas:** el banco ya solo muestra sin-programar (por el query). El selector arranca en "Elegir semana…"; al Guardar una semana, la tarea sale del banco.
- **Programar:** botón "↩️ Devolver al banco" por tarea en "Por asignar" → `devolverAlBancoAccion` → `quitarSeleccionTarea`.
- **Cumplimiento:** si hay un texto tipo "se reprogramó a la semana siguiente", cambiarlo por "vuelve al banco para reprogramar".

## Pruebas
- 52 tests de dominio siguen verdes (no tocan el repo). build + e2e del ciclo completo (programar → asignar → novedad en cumplimiento → reaparece en banco sin semana, con contador +1 → reasignar hereda contador). Reiniciar `npm run dev` tras migrar.

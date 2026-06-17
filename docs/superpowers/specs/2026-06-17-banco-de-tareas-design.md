# Diseño — Banco de Tareas por Área

**Fecha:** 2026-06-17
**Estado:** Aprobado (con maqueta validada por la usuaria)

---

## 1. Problema / objetivo

El equipo necesita un lugar donde **ir anotando las actividades por hacer** (un "banco" o backlog) por área, y cada semana **elegir cuáles intentar ejecutar**. Las elegidas deben **aparecer en Programar** de esa área, listas para asignarse a un responsable y un día.

## 2. Flujo (4 pasos)

1. **Anotar** tareas en el banco del área (sin responsable ni día todavía).
2. **Seleccionar** cuáles atacar en una semana dada.
3. En **Programar**, **asignar** cada tarea seleccionada a un responsable + día (+ finca).
4. Al asignar, la tarea **entra a la grilla** como actividad normal y **sale del banco** (queda "Programada"). — Es de **una sola vez**.

## 3. Modelo de datos

- **Tarea** (tabla nueva):
  - `id`
  - `areaId` → Área
  - `descripcion`
  - `fincaId` (opcional) → Finca
  - `estado`: `PENDIENTE` (en el banco) | `PROGRAMADA` (ya bajó a la grilla; sale del banco)
  - `anioSel` (opcional, Int) y `semanaSel` (opcional, Int): la semana para la que se seleccionó. `null` = en el banco sin seleccionar.
- **Actividad**: se agrega `tareaId` (opcional) → de qué tarea proviene (trazabilidad). No cambia nada más; las actividades creadas desde tareas son actividades normales (entran a cumplimiento, resumen y tablero igual que las demás).

## 4. Pantalla nueva `/tareas` (el banco)

- Selector de **área** (pills) y navegación de **semana** (← / →), igual que las demás pantallas. La semana que se ve es la "semana destino" para seleccionar.
- **Lista de tareas PENDIENTES** del área (el banco activo). Cada tarea muestra descripción y finca.
  - Si está seleccionada para la semana vista → badge **"➡️ Semana N"** + botón **"Quitar"**.
  - Si no → botón **"Seleccionar para semana N"**.
  - Botón **"eliminar"** la tarea.
- **Agregar tarea**: campo descripción + select de finca (opcional) → "Agregar al banco".

## 5. Integración en `/programar` (área + semana)

- Nueva sección arriba: **"📌 Tareas por asignar — semana N"** = tareas del área con `estado = PENDIENTE`, `anioSel = anio`, `semanaSel = semana`.
- Cada una con un formulario: **responsable** (select) + **día** (select) + **finca** (select, preseleccionada con la finca de la tarea si tiene) → botón **"Asignar"**.
- Al **Asignar**:
  1. Se crea una **Actividad** en esa área/semana con el día y responsable elegidos, descripción y finca de la tarea, y `tareaId` apuntando a la tarea.
  2. La **Tarea** pasa a `estado = PROGRAMADA` → desaparece del banco y de "por asignar".
- El resto de Programar (grilla, agregar/editar/eliminar actividad, duplicar) sigue igual.

## 6. Navegación

- La barra superior agrega un enlace **"Tareas"** (entre Programar y Cumplimiento, o al inicio).

## 7. Arquitectura / unidades

- **Repositorio** (`src/datos/repositorio.ts`): `listarTareasPendientes(areaId)`, `crearTarea(areaId, descripcion, fincaId|null)`, `eliminarTarea(id)`, `seleccionarTarea(id, anio, semana)`, `quitarSeleccionTarea(id)`, `tareasPorAsignar(areaId, anio, semana)`, y `asignarTarea(tareaId, responsableId, dia, fincaId)` (crea la actividad + marca la tarea PROGRAMADA, en una transacción).
- **Pantallas**: `src/app/tareas/page.tsx` + `acciones.ts`; modificación de `src/app/programar/page.tsx` + `acciones.ts` (sección por asignar) y `nav-principal.tsx`.
- **Dominio**: no requiere lógica pura nueva significativa (las métricas existentes ya cubren las actividades resultantes).

## 8. Estrategia de pruebas

- No hay lógica pura nueva relevante → no hay TDD nuevo de dominio.
- El repositorio (incluida la transacción `asignarTarea`) y las pantallas se verifican con `npm run build` + una **prueba end-to-end** contra la base (crear tarea → seleccionar → asignar → confirmar que se creó la actividad con `tareaId` y la tarea quedó `PROGRAMADA` y fuera del banco), más `curl` de las páginas.

## 9. Fuera de alcance (YAGNI)

- Tareas recurrentes, prioridades, fechas límite, arrastrar-soltar, y reabrir una tarea ya programada.

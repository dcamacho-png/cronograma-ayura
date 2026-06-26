# Cumplimiento por actividad (versión estándar) — Design

**Fecha:** 2026-06-26

## Objetivo

En la versión **estándar** (no maquinaria) de `/cumplimiento`, el cumplimiento se
diligencia **una sola vez por actividad** (grupo `tareaId`), no día a día ni por
responsable. Si la actividad abarca varios días, se registran **avances**; el cierre
(CUMPLIDA) lo decide el usuario con un botón. El conteo y el % se llevan **por actividad
programada** (ya es así hoy).

## Alcance

- Aplica **solo al estándar** (`esMaquinaria === false` en `cumplimiento`). **Maquinaria
  queda intacta** (flujo por día actual).
- Aplica a **todas** las actividades estándar (de uno o varios días), por consistencia
  (un solo modo).
- **No** cambia el esquema de Prisma ni la programación/parrilla.

## Contexto actual (lo que cambia)

`asignarTarea` crea **una fila `Actividad` por (responsable × día)**, todas con el mismo
`tareaId` y conectadas a **los mismos lotes**. Hoy `/cumplimiento` renderiza, dentro de la
tarjeta del grupo, una sub-fila por día y por responsable, cada una con su botón
"✓ Cumplido" / "registrar novedad" / avance, y guarda `estado`/`avancePorLote` **por fila**.

Esto obliga a marcar cumplimiento día a día y por responsable. El cambio colapsa todo eso
a **un único control por actividad**.

## Comportamiento nuevo

La tarjeta de una actividad estándar muestra **un solo control** (no sub-filas por día).
La cabecera sigue mostrando descripción, responsables y lotes (sin cambios).

Estados y controles del control único:

- **PENDIENTE** (ninguna fila registrada):
  - *Con lotes:* formulario de **registrar avance por lote** (cantidad por lote) + botón
    **registrar novedad**.
  - *Sin lotes:* campo **avance/observación** (texto) + botón **✓ Cumplida** + **registrar
    novedad**.
- **PARCIAL** (hay avance, aún no cerrada):
  - *Con lotes:* resumen de avances + seguir registrando avance + **✓ Marcar cumplida** +
    **Devolver al banco**.
  - *Sin lotes:* observación editable + **✓ Marcar cumplida** + **Devolver al banco**.
- **CUMPLIDA / NO_CUMPLIDA / REPROGRAMADA:** resumen de solo lectura (estado, motivo,
  nota, avances/realizado) + **↩ desmarcar** (vuelve a PENDIENTE todo el grupo).

**Registrar novedad** (No cumplida + motivo, con opción de **cambio de actividad**):
reutiliza el formulario actual `FormRegistrar`, pero aplicado al grupo.

## Enfoque de datos (sin cambio de esquema)

Todas las acciones del estándar operan sobre **el grupo `(tareaId, anio, semana)`** mediante
nuevas funciones de repositorio que reciben `tareaId`, y escriben en **todas las filas del
grupo** de forma atómica (transacción). Como las filas comparten lotes, las métricas
existentes (que ya agrupan por `tareaId` y promedian por fila) salen **correctas sin
modificarlas**: todas las filas del grupo quedan en el mismo estado y con el mismo
`avancePorLote`, así que el promedio por fila = la fracción de la actividad.

- **Registrar avance por lote** → mismo `avancePorLote` (consolidado) en todas las filas;
  estado de todas = `PARCIAL`. El `dia` de cada `AvanceEntrada` usa el **día más temprano
  programado** del grupo (el avance es a nivel de actividad; el día es incidental).
- **Avance/observación genérico (sin lotes)** → guarda el texto en `nota` de todas las
  filas; estado = `PARCIAL`. Editable (se sobrescribe la `nota`).
- **Marcar cumplida** → todas las filas = `CUMPLIDA`; `haRealizada` = suma de avances de los
  lotes (si los hay).
- **Registrar novedad (No cumplida + motivo)** → todas las filas = `NO_CUMPLIDA` con
  `motivoId`/`nota`. Si es **cambio de actividad**, se crea **una sola** actividad de
  reemplazo (cumplida) — no una por fila.
- **Desmarcar** → todas las filas = `PENDIENTE`, limpiando lo capturado (igual que
  `reabrirActividad` actual, aplicado al grupo).
- **Devolver al banco / reprogramar** → ya operan a nivel de `tarea` (`devolverAlBanco`,
  flujo de reprogramación); se reutilizan tal cual.

### Funciones de repositorio nuevas (a nivel de grupo)

Reciben `tareaId` (+ `anio`, `semana` para acotar a la semana mostrada) y envuelven en
transacción la actualización de todas las filas del grupo:

- `registrarAvanceLoteActividad(tareaId, anio, semana, avances)`
- `registrarAvanceObservacionActividad(tareaId, anio, semana, nota)` (caso sin lotes)
- `marcarCumplidaActividad(tareaId, anio, semana)`
- `registrarNovedadActividad(tareaId, anio, semana, motivoId, nota, reemplazo?)`
- `reabrirActividadGrupo(tareaId, anio, semana)` (desmarcar)

> Las funciones por fila actuales (`registrarAvanceLote`, `marcarCumplidaDesdeParcial`,
> `registrarCumplimiento`, `reabrirActividad`) se conservan para maquinaria.

## Acciones (server actions)

Nuevas acciones en `src/app/cumplimiento/acciones.ts` que reciben `tareaId`/`anio`/`semana`
del `FormData` y llaman a las funciones de grupo. **Reusan el guard de plazo** del feature
anterior: como el grupo comparte `anio`/`semana`, se valida con `bloqueadoPorPlazo(anio,
semana)`.

## Impacto en métricas

Ninguno: `agruparPorActividad`, `conteoEstadoActividades`, `porcentajeCumplimiento`,
`tieneDiaPendiente` ya operan por `tareaId`. Con todas las filas del grupo en el mismo
estado, los resultados son consistentes y el gate de "pendientes" (pasar a la siguiente
semana) se limpia correctamente al registrar la actividad.

## Casos borde

- **Multi-responsable:** una actividad con varios responsables comparte un único resultado
  (todas sus filas quedan igual). El cumplimiento ya no se atribuye por responsable, en línea
  con el pedido. El ranking por responsable (`rankingResponsables`) sigue existiendo pero
  refleja el resultado de la actividad para todos sus responsables (aceptable; no se pide
  cambiarlo).
- **Actividad de un solo día:** mismo control único; con lotes ofrece avance, sin lotes
  ofrece observación + cumplida.
- **Sin `tareaId`** (actividad suelta/no programada): conserva el comportamiento por fila
  actual (el control de grupo requiere `tareaId`).
- **Plazo vencido:** el control queda en solo lectura para áreas (feature ya desplegado).

## Pruebas

- **Dominio:** las métricas no cambian; agregar pruebas solo si se introduce algún helper de
  consolidación de avances a nivel de grupo.
- **Repositorio/acciones/página:** según convención del repo, se verifican con typecheck +
  build + verificación manual (no tienen pruebas unitarias automáticas).

## Fuera de alcance

- Maquinaria (sigue por día).
- Cambios de esquema, programación o parrilla.
- Rediseño del ranking por responsable.

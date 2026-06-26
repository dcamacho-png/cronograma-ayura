# Solicitudes entre áreas: sugerencias, devolución con observación y acciones de banco — Design

**Fecha:** 2026-06-25
**Estado:** aprobado en brainstorming, pendiente de plan de implementación.

## Objetivo

Mejorar el flujo de solicitudes de actividades entre áreas (solo en la **variante estándar**), sin tocar la lógica de maquinaria ni la asignación definitiva:

1. **Solicitud enriquecida:** al solicitar a otra área, el solicitante (A) puede **sugerir** día(s) de la semana (en **ambas** variantes) y, **solo en la variante estándar**, colaboradores (responsables del área ejecutora B) y un cuadro de descripción. Las sugerencias son **no vinculantes**.
2. **Devolución con observación:** cuando el coordinador del área ejecutora (B) devuelve la actividad al solicitante (A), puede escribir una observación (opcional) con el motivo; A la ve.
3. **Acciones en el banco de A:** una solicitud devuelta (`DEVUELTA`) gana, además de **Reenviar** (ya existe), las opciones de **Eliminar** y **Editar**.
4. **Sugerencia visible para B:** al asignar, el coordinador de B ve (solo texto) la sugerencia de días y personas de A.

## Contexto actual (lo que existe hoy)

- `model Tarea`: `{ id, descripcion, turno, estado, anioSel?, semanaSel?, vecesReprogramada, areaId (ejecutora), solicitadaPorAreaId? (solicitante), fincaId?, loteId?, lotes[], bultosPorLote?, detalle?, actividades[] }`. Estados usados: `PENDIENTE` (en banco / activa), `DEVUELTA` (devuelta al solicitante), `PROGRAMADA`.
- **Crear solicitud:** `crearSolicitud(areaEjecutoraId, descripcion, solicitadaPorAreaId, loteIds, bultosPorLote?, detalle?)` → `Tarea` con `areaId=B`, `solicitadaPorAreaId=A`, estado `PENDIENTE`. Aparece en el banco de B como "📨 de A".
- **FormSolicitar** (`tareas/form-solicitar.tsx`): A elige área ejecutora B (de `areas`, con bandera `maqTareas`); si B es maquinaria muestra actividad de catálogo + (bultos/detalle); si es estándar solo descripción + finca/lote. La variante se decide por `maqTareas` de B (feature recién implementada).
- **Devolver al solicitante:** `devolverAlSolicitante(id)` → estado `DEVUELTA` (sin texto). Botón "↩️ Devolver al solicitante" en el banco de B (`tareas/page.tsx`).
- **Reenviar:** `reenviarSolicitud(id)` → estado `PENDIENTE` (vuelve a B). Único botón hoy en "Mis solicitudes" de A para una `DEVUELTA`.
- **Mis solicitudes** (en `tareas/page.tsx`): lista las solicitudes de A; muestra estado `PROGRAMADA`/`DEVUELTA`/en banco; `detalle` se muestra si existe.
- **Asignación (B):** en `programar/page.tsx`, bloque "📌 Tareas por asignar" con `AsignarTareaForm` (días 1–7 + responsables, definitivo). `programarTarea` fija `anioSel/semanaSel` y estado `PROGRAMADA`.
- Helpers de acciones de tareas: `tareas/acciones.ts` (`crearSolicitudAccion`, `devolverAlSolicitanteAccion`, `reenviarSolicitudAccion`, `crearTareaAccion`, `eliminarTareaAccion`, …).

## Decisiones tomadas (del brainstorming)

- Días sugeridos = **días de la semana** (multi, Lun–Dom); aplica en **ambas variantes** (estándar y maquinaria).
- Colaboradores sugeridos = **responsables del área ejecutora (B)**; **solo variante estándar**.
- Cuadro de descripción (`detalle`): variante estándar (maquinaria ya lo tenía).
- Observación al devolver = **opcional**, visible para A.
- Acciones en banco de A sobre `DEVUELTA`: **Reenviar / Eliminar / Editar**. Editar = contenido (descripción, cuadro de descripción, lotes, días sugeridos, colaboradores sugeridos); **el área ejecutora B se mantiene**.
- Sugerencia para B = **solo mostrar** (texto), sin precargar el formulario de asignación.
- Maquinaria: solo se añade el **día sugerido**; sin colaboradores. El resto de su flujo no cambia.
- Almacenamiento **A**: columnas de texto/CSV en `Tarea` (no Json, no tablas relación).

## Modelo de datos (Prisma)

En `model Tarea`, 3 columnas nuevas, todas nullable (migración aditiva):

- `observacionDevolucion String?` — motivo escrito por B al devolver; lo ve A.
- `diasSugeridos String?` — CSV de días de la semana, p. ej. `"1,3,5"` (1=Lun … 7=Dom).
- `responsablesSugeridosIds String?` — CSV de ids de responsables del área ejecutora B.

El campo existente `detalle String?` pasa a usarse también en la solicitud estándar como "cuadro de descripción". `diasSugeridos` se rellena en **ambas** variantes; `responsablesSugeridosIds` **solo en estándar** (en maquinaria queda vacío). `observacionDevolucion` aplica a cualquier solicitud devuelta.

**Migración** (`prisma migrate deploy`, base Neon compartida): `ALTER TABLE "Tarea" ADD COLUMN ...` para las 3 columnas (TEXT, nullable). Sin backfill. El código viejo ignora las columnas nuevas → seguro aplicar antes del deploy.

## Componentes

### Dominio puro — `src/dominio/sugerencia.ts` (nuevo)
- `DIAS_SEMANA: string[]` (índices 1–7 → 'Lun'…'Dom') o reutilizar la constante existente si la hay.
- `parseCsvIds(csv: string | null): string[]` — parsea CSV, trim, descarta vacíos.
- `etiquetaDias(csv: string | null): string` — CSV de días → "Lun, Mié, Vie" ('' si vacío).
- `etiquetaResponsables(csv: string | null, nombrePorId: Map<string,string>): string` — CSV de ids → "Juan, Ana" (omite ids sin nombre).
- `textoSugerencia(areaNombre, diasCsv, responsablesCsv, nombrePorId): string | null` — arma "Sugerido por {A}: días …, personas …"; omite la parte de personas si `responsablesCsv` viene vacío/null (caso maquinaria, que nunca trae colaboradores); `null` si no hay nada que sugerir.
Funciones puras, testeables.

### Repositorio — `src/datos/repositorio.ts`
- `crearSolicitud(...)` gana parámetros opcionales `diasSugeridos?: string | null`, `responsablesSugeridosIds?: string | null` (además del `detalle` que ya recibe). Los persiste.
- `devolverAlSolicitante(id, observacion: string | null)` — guarda `observacionDevolucion` + estado `DEVUELTA`.
- `reenviarSolicitud(id)` — además de poner `PENDIENTE`, limpia `observacionDevolucion` (= `null`).
- `editarSolicitud(id, { descripcion, detalle, loteIds, bultosPorLote, diasSugeridos, responsablesSugeridosIds })` — actualiza esos campos (re-`set` de `lotes`), conservando `areaId`/`solicitadaPorAreaId`/estado. En maquinaria, `responsablesSugeridosIds` viene `null`; en estándar, `bultosPorLote` viene `null`.
- (Opcional) `listarResponsablesActivosPorArea()` o reutilizar `listarResponsablesTodos()` filtrando `activo`, para alimentar las sugerencias por área en el form.

### Acciones — `src/app/tareas/acciones.ts`
- `crearSolicitudAccion`: lee `detalle`, `diaSugerido` (getAll → CSV), `responsableSugerido` (getAll → CSV) y los pasa a `crearSolicitud`. Solo se envían en la rama estándar del form.
- `devolverAlSolicitanteAccion`: lee `observacion` (texto opcional) y la pasa a `devolverAlSolicitante`.
- `reenviarSolicitudAccion`: sin cambios de firma (la limpieza de observación va en el repo).
- `editarSolicitudAccion` (nueva): lee id + campos y llama `editarSolicitud`.
- `eliminarTareaAccion` (ya existe): se reutiliza para "Eliminar" la solicitud `DEVUELTA`.

### UI

**`tareas/form-solicitar.tsx`:**
- Rama **estándar**: añade textarea de descripción (`detalle`), casillas Lun–Dom (`name="diaSugerido"`), y casillas de colaboradores con los **responsables activos de B** (`name="responsableSugerido"`), que se actualizan al cambiar el área ejecutora.
- Rama **maquinaria**: añade **solo** las casillas Lun–Dom (`name="diaSugerido"`). **Sin** colaboradores. El resto (actividad de catálogo, lotes/bultos, detalle) queda igual.
- `tareas/page.tsx` pasa a `FormSolicitar` los responsables activos agrupados por área (vía `listarResponsablesTodos()` filtrando `activo`).

**Campos reutilizables:** extraer la parte de campos de solicitud estándar (descripción + detalle + lotes + días + colaboradores) en un componente/render compartido para que `FormSolicitar` (crear) y el form de edición no dupliquen. (DRY.)

**`tareas/page.tsx` — banco de B:** el botón "Devolver al solicitante" pasa a un mini-form con campo de observación opcional + botón "Devolver".

**`tareas/page.tsx` — Mis solicitudes de A:** la fila `DEVUELTA` muestra la `observacionDevolucion` si existe, y ofrece **Reenviar** (existe), **Eliminar** (`FormEliminar` → `eliminarTareaAccion`) y **Editar** (abre el form de edición prellenado, componente cliente `form-editar-solicitud.tsx`). El form de edición es **consciente de la variante** del área ejecutora B (su `maqTareas`): en estándar muestra descripción/detalle/lotes/días/colaboradores; en maquinaria muestra actividad/detalle/lotes-bultos/días (sin colaboradores). Reusa los mismos componentes de campos que `FormSolicitar`.

**`programar/page.tsx` — Tareas por asignar:** junto a `AsignarTareaForm`, mostrar `textoSugerencia(...)` cuando la solicitud tenga sugerencias (en maquinaria solo aparece la parte de días). `programar/page.tsx` ya carga responsables del área; construir el `Map<id,nombre>` para resolver nombres.

## Manejo de errores / casos borde
- CSV con ids inexistentes (responsable borrado): se omiten al formatear (no rompe).
- Solicitud estándar sin sugerencias: campos quedan `null`; no se muestra texto de sugerencia.
- Editar solo aplica a solicitudes de A en estado `DEVUELTA`; Eliminar idem (no exponer en otros estados).
- Cambiar de variante (B pasa de estándar a maquinaria después de crear una solicitud): las sugerencias guardadas quedan inertes; no se muestran en el flujo de maquinaria. Aceptable.

## Pruebas
- **Unitarias nuevas (Vitest):** `sugerencia.ts` — `etiquetaDias` (CSV→nombres, vacío→''), `etiquetaResponsables` (omite ids sin nombre), `textoSugerencia` (null si todo vacío; formato correcto), `parseCsvIds`.
- **No-regresión:** las 145 pruebas actuales siguen verdes; la asignación definitiva y el registro de cumplimiento de maquinaria no cambian (a maquinaria solo se le añade el día sugerido en la solicitud).
- **Verificación manual (controlador):** server local + cookies firmadas. Crear solicitud estándar con día+colaboradores y una de maquinaria con día → ver la sugerencia en B (Programar, maquinaria solo días); devolver con observación → verla en A; editar/eliminar/reenviar en A (estándar y maquinaria). Round-trip en DB y restaurar.

## Fuera de alcance (YAGNI)
- Colaboradores sugeridos en maquinaria (maquinaria solo lleva día sugerido).
- Cuadro de descripción nuevo en maquinaria (ya tiene `detalle`).
- Precargar el formulario de asignación con la sugerencia (solo se muestra).
- Hacer vinculante la sugerencia (la asignación real sigue siendo decisión de B).
- Historial de devoluciones / múltiples observaciones (solo la última observación).
- Permisos nuevos.

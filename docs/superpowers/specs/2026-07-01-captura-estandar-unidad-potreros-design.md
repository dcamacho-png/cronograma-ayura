# Captura estándar: unidad elegible + potreros por finca + cantidad — Design Spec

**Fecha:** 2026-07-01

## Objetivo

Rediseñar la captura de cumplimiento de las actividades **estándar** (no maquinaria):
- Elegir la **unidad de medida al registrar** (Cantidad / Ha / Jornales / Otro→texto libre), una por actividad.
- Con potreros: elegir el potrero por **Finca → Lote** (desplegables del catálogo) e ingresar **cantidad por lote**; registrar un avance de un lote no asignado lo **anexa**. Reemplaza el picker de lotes actual y el checklist "Editar potreros" (plan Q).
- Sin potreros (general): **unidad + cantidad + observación** de texto.
Maquinaria (`DiaMaquinaria`) no cambia.

## Contexto (verificado en código)

- Modelo `Actividad`: tiene `avancePorLote Json?`, `haRealizada Float?`, `nota String?`, `fincaId`, relación `lotes`. **No** tiene campo de unidad para actividades estándar.
- `ActividadEstandar` (client) con potreros usa `FormAvanceLote` (checkbox de los lotes ya asignados + cantidad) y cierra con `marcarCumplida`; sin potreros usa una observación de texto (`registrarObservacion`). Recibe `lotesCatalogo: { id; nombre; finca: { nombre } }[]` y `lotesActividad: { id; nombre }[]`.
- `FormAvanceLote` es **compartido** con maquinaria (`DiaMaquinaria`) — no se debe romper ese uso.
- Cumplimiento por **grupo** (`filasHermanas`, `tareaId`); acciones de grupo aplican en `$transaction` a todas las filas y `revalidatePath('/cumplimiento')`, con guard `bloqueadoPorPlazoActividad`.
- La página deriva la unidad de la actividad con `unidadDe(unidadPorNombre, descripcion)` (catálogo de maquinaria); para estándar cae a `'ha'`. `etiquetaMedida`/`unidadAbreviada` esperan un `Unidad` (`'ha'|'hora'|'kg'|'cantidad'`).
- `avancePorLote` se acumula con `registrarAvanceLoteGrupo`; `totalAvanceLotes`/`lotesPendientes` recorren los lotes **vigentes** de la actividad. `setLotesGrupo(id, loteIds)` (plan Q) reemplaza el conjunto de lotes y ajusta finca.

## Diseño

### BD (migración aditiva)

- Nueva columna **`Actividad.unidadRealizada String?`** (nullable). Guarda la unidad elegida como **texto** para estándar (`"cantidad"`, `"ha"`, `"jornales"` o el texto libre de "Otro"). Migración aditiva a la base Neon compartida.
- **Nota de separación:** para estándar, la etiqueta de la medida se toma **verbatim** de `unidadRealizada` (string libre), NO se pasa por `etiquetaMedida`/`Unidad`. Maquinaria sigue usando el sistema `Unidad`/catálogo intacto.

### Repositorio (`src/datos/repositorio.ts`)

- `setUnidadRealizadaGrupo(id: string, unidad: string)` — fija `unidadRealizada` en todas las filas del grupo.
- `anexarLotesGrupo(id: string, loteIds: string[])` — **conecta** (sin quitar) esos lotes a todas las filas del grupo (para el "anexar" al registrar avance de un lote nuevo).
- `registrarMedidaGeneralGrupo(id: string, unidad: string, cantidad: number, nota: string | null)` — para actividades **sin lotes**: fija `unidadRealizada`, `haRealizada = cantidad`, `nota`, y deja las filas abiertas en `PARCIAL` (como la observación actual).
- Se reutiliza `setLotesGrupo` (plan Q) para el "quitar" potrero.

### Acciones (`src/app/cumplimiento/acciones.ts`)

- `registrarAvanceEstandarAccion(form)` — para el flujo con potreros: lee `id`, `dia`, `loteId`, `cantidad`, `unidad` (y `unidadOtra` si `unidad === 'otro'`). Guard de plazo. Resuelve la unidad (si "otro", usa el texto). Llama a `anexarLotesGrupo(id, [loteId])`, `setUnidadRealizadaGrupo(id, unidad)`, y `registrarAvanceLoteGrupo(id, dia, null, [{ loteId, cantidad }])`. `revalidatePath('/cumplimiento')`. (Ignora si cantidad ≤ 0 o falta loteId.)
- `registrarMedidaGeneralAccion(form)` — sin potreros: lee `id`, `unidad`(+`unidadOtra`), `cantidad`, `nota`. Guard de plazo. Llama a `registrarMedidaGeneralGrupo`. `revalidatePath`.
- Se reutiliza `setLotesActividadAccion` (plan Q) para "quitar" potrero.

### UI (`src/app/cumplimiento/actividad-estandar.tsx`)

Reemplaza el `FormAvanceLote`/observación por la nueva captura (client component, `useState`):

- **Selector de unidad** (una por actividad): `<select>` con `Cantidad / Ha / Jornales / Otro`; si "Otro" → input de texto. Valor inicial = `unidadRealizada` de la actividad (o "Cantidad" por defecto). Se envía en cada registro.
- **Con potreros:**
  - **Finca** `<select>` (fincas distintas del `lotesCatalogo`) → **Lote** `<select>` (lotes de esa finca) → **Cantidad** (number) → **Día** (`<select>` 1–7, default el día de la actividad) → botón "Guardar avance" (→ `registrarAvanceEstandarAccion`).
  - Lista de **potreros ya registrados** (los `lotesActividad` con su avance) y, por cada uno, un enlace **"quitar"** (→ `setLotesActividadAccion` con la lista restante). Cambiar = quitar + agregar otro.
  - "Marcar cumplida" cierra (ya existe; botón siempre visible tras el plan R).
- **Sin potreros (general):** selector de unidad + **Cantidad** + **Observación** (texto, se mantiene) → botón "Guardar" (→ `registrarMedidaGeneralAccion`).
- Nueva prop para las acciones nuevas (`registrarAvanceEstandar`, `registrarMedidaGeneral`) además de las que ya recibe.

### Página (`src/app/cumplimiento/page.tsx`)

- Pasar las nuevas acciones a `ActividadEstandar`; ya pasa `lotesCatalogo` (con finca) y `lotesActividad`.
- Para el **display** de la medida de actividades **estándar**, usar `cab.unidadRealizada` (verbatim) en vez de `unidadDe(...)`; si es null, sin unidad. (Maquinaria sigue igual.)
- Incluir `unidadRealizada` en los campos que la página ya lee de la actividad (viene de `listarActividades`; añadir al `select`/tipo si hiciera falta).

## Alcance / límites

- Solo **estándar**; maquinaria (`DiaMaquinaria`, `FormAvanceLote`) no cambia.
- `Jornales`/`Otro` son **solo etiqueta**; no cambian cálculos. El "Realizado" del resumen sigue **solo-maquinaria** (no se toca). El Excel de cumplimiento se deja igual por ahora.
- La unidad es una por actividad (se sobre-escribe con el último registro). Debe quedar ≥1 potrero al "quitar" (guard de `setLotesActividadAccion`, plan Q). Respeta el plazo vencido.

## Testing

- Funciones nuevas de repositorio/acciones/UI: sin tests unitarios (convención); **typecheck fiable** + verificación en vivo. (No hay lógica de dominio pura nueva que testear con Vitest.)
- Migración: aditiva; verificar que aplica en Neon (el build de Vercel corre `prisma migrate deploy`).
- Manual: en una actividad estándar con potreros → elegir unidad, Finca→Lote→cantidad→Guardar avance (anexa el lote si es nuevo), ver el avance acumulado con la etiqueta de la unidad elegida, "quitar" un potrero, y "Marcar cumplida"; en una actividad sin potreros → unidad + cantidad + observación; que respeta el plazo; que maquinaria no cambió.

## Fuera de alcance

- Totalización de la medida estándar en el resumen (sigue solo-maquinaria).
- Excel/PDF de cumplimiento con la nueva unidad.
- Cambiar el catálogo de fincas/lotes (vive en Configuración).

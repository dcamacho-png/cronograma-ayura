# Resumen 100% por actividad — Design Spec

**Fecha:** 2026-06-29

## Objetivo

Que **todas** las métricas de la hoja de resumen (`/resumen`) se evalúen **por actividad**, no por fila cruda. Una actividad culminada cuenta una sola vez, sin importar cuántos responsables o días tenga; su medida de maquinaria (ha/kg/horas) se cuenta una sola vez.

## Principio (definido por la usuaria)

> Todo debe evaluarse por actividades, independiente de los responsables y los días. Una actividad culminada cuenta. El avance se lleva por actividad y ese acumulado ya es el total realizado.

## Contexto del modelo de datos (verificado en código)

- `listarActividades` (`src/datos/repositorio.ts:30`) devuelve **filas crudas**: una fila por **(día × responsable)**.
- Al asignar una tarea a N responsables sobre M días se crean **N×M filas**, todas con el **mismo `tareaId`** y **conectadas a los mismos lotes** (`repositorio.ts:344-362`).
- Al cerrar una actividad, `marcarCumplidaGrupo` (`repositorio.ts:621-639`) escribe el **mismo `haRealizada` total en cada fila-hermana**. Por eso `vecesReprogramada`, `motivoId`, `haRealizada` y los lotes son **idénticos en todas las filas de un grupo**.
- Agrupador canónico ya existente: `agruparPorActividad` (`src/dominio/metricas.ts:40`) → clave `tareaId ?? "solo:${id}"`. Estado agrupado: `estadoActividad` (`metricas.ts:56`) → si todas las filas comparten estado, ese; si hay mezcla, `PARCIAL`.

## Problema actual

El resumen mezcla dos formas de contar:

- **Ya por actividad (correcto, no se toca):** `porcentajeCumplimiento`, `conteoEstadoActividades`, `agruparPorActividad().size` → Cumplimiento %, "Cumplidas/total", chips de conteo.
- **Por fila cruda (a corregir):** `medidasPorUnidad`/`medidaPorActividad` (Realizado), `extremosFinalizadas` (ranking), `porcentajeReprogramadas`, `motivosFrecuentes`, `actividadesConCambio` (lista), Detalle-por-estado (listas) y "Nuevas".

El impacto más grave: **"Realizado" suma fila por fila**, así que una labor de 10 ha en 3 días (3 filas con `haRealizada=10`) muestra **30 ha** en vez de 10.

## Diseño

La idea es **consolidar las filas a "una actividad" antes de calcular** y que todas las métricas consuman eso.

Dos planos, según dónde vive el dato:

1. **Conteos / estado / motivo / reprogramación / ranking / cambios** → viven en el dominio (`Actividad` tiene `responsableId`, `tareaId`, `vecesReprogramada`, `motivoId`, `dia`, `estado`). Estas funciones de dominio se reescriben para **agrupar por `tareaId` internamente** y seguir recibiendo `Actividad[]` crudas. API estable, comportamiento por actividad, testeable.

2. **Medidas (ha/kg/horas)** → dependen de `lotes[].hectareas`, que **no existe en el tipo de dominio** (`Actividad.lotes` solo trae `{ id }`). Por eso la consolidación de la medida vive en el **componente** `resumen-area.tsx`, que sí tiene las hectáreas, y alimenta `medidasPorUnidad` (que queda **sin cambios**) con **una fila por actividad**.

### Cambios por métrica

| Métrica | Hoy (por fila) | Nuevo (por actividad) |
|---|---|---|
| Cumplimiento %, Cumplidas/total, chips | por actividad | **sin cambio** |
| **Realizado (ha/kg/horas)** | suma cada fila → ×(días×resp.) | una fila por actividad → medida única |
| **Realizado por actividad** | suma filas por descripción | suma de la medida única de cada actividad, por descripción |
| **Motivos frecuentes** | cuenta filas | cuenta actividades (1 motivo por actividad) |
| **Reprogramadas %** | filas reprog / filas | actividades reprog / actividades |
| **Detalle por estado (listas)** | filtra filas por estado de fila | una entrada por actividad, usando estado agrupado |
| **Cambiadas/reprogramadas (lista)** | una por fila (duplica multi-resp.) | una por actividad |
| **Ranking finalizadas** | filas CUMPLIDA por responsable | cada actividad culminada suma **1 a cada responsable asignado** (una vez, aunque dure varios días) |
| **Nuevas (no programadas)** | cuenta filas | cuenta actividades |

### Funciones de dominio a reescribir (`src/dominio/metricas.ts` y `src/dominio/resumen.ts`)

Todas siguen recibiendo `Actividad[]` crudas y consolidan por `tareaId` internamente (usando `agruparPorActividad` + `estadoActividad`):

- **`porcentajeReprogramadas(actividades)`** → `total` = nº de grupos; `reprog` = grupos cuya fila base tiene `vecesReprogramada > 0`; `round(reprog/total*100)`.
- **`motivosFrecuentes(actividades)`** → por grupo, tomar un único `motivoId` (de la fila base) si existe; contar por motivo; ordenar desc.
- **`extremosFinalizadas(actividades)`** → inicializar el conteo en 0 para **cada `responsableId` distinto** que aparezca; por grupo cuyo `estadoActividad === 'CUMPLIDA'`, sumar 1 a **cada `responsableId` distinto del grupo**; devolver `mas`/`menos`.
- **`actividadesConCambio(actividades)`** → por grupo cuyo `estadoActividad ∈ {PARCIAL, NO_CUMPLIDA, REPROGRAMADA}`, devolver **una fila representativa** (la base); ordenar por `vecesReprogramada` desc y luego `dia` (mínimo del grupo) asc. La fila representativa conserva `descripcion`, `responsable`, `motivo`, `nota`, `vecesReprogramada` para el render.

`medidasPorUnidad` y `hectareasRealizadas` (`src/dominio/resumen.ts`) **no cambian**: ya suman correctamente las filas que se les pasen; el arreglo es que el componente les pase **una fila por actividad**.

### Cambios en el componente `src/app/resumen/resumen-area.tsx`

- Añadir `tareaId: string | null` (y `responsableId: string`) al tipo `ActividadResumen` (existen en runtime; solo hace falta declararlos para poder agrupar con `agruparPorActividad`).
- **Medidas:** agrupar las `ActividadResumen` por `tareaId`; por grupo construir **una** fila de medida con:
  - `estado` = `estadoActividad(grupo)`
  - `haProgramada` = `haActividad(base)` (hectáreas de los lotes, compartidos → una vez)
  - `haRealizada` = `base.haRealizada ?? null` (idéntico en el grupo)
  - `unidad` = `unidadDe(unidadPorNombre, base.descripcion)`
  - Pasar ese arreglo a `medidasPorUnidad`. Para "Realizado por actividad", agrupar esas medidas únicas por `descripcion`.
- **Detalle por estado:** consolidar a una entrada por actividad (estado agrupado) y agrupar por `descripcion`+lotes para el listado; el conteo del encabezado de cada estado debe cuadrar con los chips (que ya son por actividad).
- **Nuevas (no programadas):** contar **actividades** (grupos) cuya base tenga `noProgramada`, no filas.

## Testing

Convención del repo: probar funciones de **dominio** con Vitest; componente/RSC se verifican con typecheck + ejecución.

- `src/dominio/metricas.test.ts`: nuevos casos para `porcentajeReprogramadas`, `motivosFrecuentes`, `extremosFinalizadas` con **filas-hermanas** (mismo `tareaId`, varios días/responsables) demostrando que cuentan por actividad.
- `src/dominio/resumen.test.ts`: ajustar/añadir casos de `actividadesConCambio` para verificar **una entrada por actividad** (no por fila) y el orden.
- `medidasPorUnidad`: añadir un caso que confirme que, alimentado con **una fila por actividad** (en vez de N filas idénticas), el total no se infla.
- Typecheck fiable (excluyendo `.next`, ver convención del repo).
- Verificación manual en `/resumen` con una semana de maquinaria multi-día.

## Impacto / aviso

En áreas de maquinaria, las labores que hoy abarcan varios días o responsables verán su **"Realizado" bajar al número correcto** (p. ej. 30 ha → 10 ha). Es la corrección esperada. Los conteos de Motivos, Reprogramadas % y la lista de cambios también pueden **bajar** al dejar de duplicar por fila.

## Fuera de alcance

- No se cambia cómo se captura el avance ni cómo se guarda `haRealizada` (sigue idéntico en cada fila; el resumen simplemente lo lee una vez por actividad).
- No se cambia el PDF/exportación salvo que reutilice estas mismas funciones de dominio (en cuyo caso hereda la corrección sin trabajo extra).
- Semántica de PARCIAL para "Realizado" se mantiene igual que hoy (PARCIAL sin `haRealizada` aporta 0).

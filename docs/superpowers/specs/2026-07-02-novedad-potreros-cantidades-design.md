# Novedad: potreros con cantidades (ha + bultos) — Design Spec

**Fecha:** 2026-07-02

## Objetivo

En el registro de **novedad** (FormRegistrar), cuando la actividad tiene **varios potreros**, reemplazar el checklist simple "¿En cuáles potreros se realizó?" por una **tabla por lote** que precarga las cantidades **asignadas** y permite editar lo **realmente hecho**:
- ☑️ casilla "se hizo" (por lote),
- **Ha** por lote (precargada con el área asignada del lote; editable),
- **Bultos** por lote (solo actividades de fertilización que usan bultos; precargado con los bultos asignados; editable),
- **Anexar uno o varios potreros** (finca→lote) con su ha + bultos.

No cambia el catálogo (el área del lote); solo registra lo hecho en esta actividad.

## Contexto (verificado en código)

- `FormRegistrar` (`src/app/cumplimiento/form-registrar.tsx`): con `requierePotreros = (estado === 'PARCIAL' || 'REPROGRAMADA') && lotesActividad.length > 1`, muestra casillas `name="loteHecho"` por lote (solo `{id, nombre}`). Recibe `lotes` (= catálogo) y `lotesActividad`.
- `registrarNovedadActividadAccion` (`acciones.ts`): lee `loteHecho[]`, arma `reemplazo`, llama `registrarNovedadGrupo(id, estado, motivoId, nota, reemplazo, lotesHechos)`.
- `registrarNovedadGrupo` (`repositorio.ts`): setea estado/motivo/nota/`lotesHechos` en las filas del grupo; devuelve la tarea al banco si NO_CUMPLIDA/REPROGRAMADA.
- `bultosPorLote` (JSON `loteId→bultos`) = bultos **asignados**; `usaBultos(descripcion)` (`src/dominio/bultos.ts`) indica si la actividad usa bultos (FERTILIZACION GRANULADA/ENCALADORA/FERTILIZACION POLLINAZA). Los lotes de `listarActividades` (include `lotes: true`) traen `hectareas` en runtime.

## Diseño

### A. UI — tabla de potreros en `FormRegistrar`

Cuando `requierePotreros`, por cada lote de `lotesActividad`: casilla `loteHecho` + input `ha_<loteId>` (number, `defaultValue` = `hectareas` del lote) + —si `usaBultos(descripcion)`— input `bultos_<loteId>` (number, `defaultValue` = bultos asignados del lote). Debajo, un bloque **"Anexar potrero"** que permite agregar **uno o varios** potreros no asignados: finca→lote (del catálogo) + ha + bultos; cada uno agregado se suma a la tabla (con su casilla `loteHecho` + `ha_`/`bultos_`), y se pueden añadir más (lista con estado en el cliente).
- Props nuevas de `FormRegistrar`: `lotesActividad` gana `hectareas?: number | null`; nueva prop `bultosAsignados: Record<string, number> | null`; `descripcion: string` (para `usaBultos`). El catálogo (`lotes`) ya se recibe.

### B. Acción — `registrarNovedadActividadAccion`

Además de `loteHecho[]`, leer por lote los `ha_<loteId>` y `bultos_<loteId>` (para los marcados y el anexado), armar `medidas: { loteId; ha: number | null; bultos: number | null }[]`, y pasarlas a `registrarNovedadGrupo`.

### C. Repositorio — `registrarNovedadGrupo`

Nuevo parámetro `medidas?: { loteId: string; ha: number | null; bultos: number | null }[]`. Al guardar (en la $transaction, en cada fila del grupo):
- `lotesHechos` = ids marcados (como hoy).
- **Anexar** los lotes marcados que no estén ya en la actividad (`lotes: { connect }`).
- `bultosPorLote` = mezcla del actual con los `bultos` editados (por loteId) — bultos aplicados.
- `haRealizada` = suma de las `ha` de los lotes marcados.
- estado/motivo/nota/reemplazo como hoy.

### D. Controles / página

`ActividadEstandar` y `ActividadMaquinaria` pasan a `FormRegistrar` (vía la ruta de novedad) `lotesActividad` con `hectareas`, `bultosAsignados` (= `cab.bultosPorLote`) y `descripcion` (= `cab.descripcion`). La página ya tiene `cab.lotes` (con hectáreas), `cab.bultosPorLote` y `cab.descripcion`.

## Testing

- **Repo/acciones/UI:** typecheck fiable + verificación en vivo (sin tests unitarios nuevos; no hay dominio puro nuevo — el merge de bultos y la suma de ha viven en el repositorio).
- **Manual:** en una actividad de **fertilización** con varios potreros, registrar novedad **Parcial**: la tabla precarga ha y bultos asignados por lote; marcar algunos, editar cantidades, anexar un potrero no asignado; verificar que `lotesHechos`, `bultosPorLote` (aplicados) y `haRealizada` (suma de marcados) quedan guardados y que el catálogo del lote no cambia. En una actividad **no** de fertilización con varios potreros: igual pero sin columna de bultos.

## Fuera de alcance

- El flujo de avance diario (FormAvance) no cambia.
- El resumen y el Excel leen lo ya guardado (`bultosPorLote`, `haRealizada`) como hasta ahora.
- No se modifica el área del lote en el catálogo.

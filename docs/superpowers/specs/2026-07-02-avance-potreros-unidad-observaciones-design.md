# Avance con tabla de potreros, unidad y observaciones — Design Spec

**Fecha:** 2026-07-02

## Objetivo

Rehacer el **registro de avance diario** (`FormAvance`) para que en las actividades con
potreros muestre una **tabla por potrero** (casilla "se hizo" + ha + bultos), incluya el
**selector de unidad** y un **cuadro de observaciones**; mover la unidad **dentro** del
formulario (quitando el cuadro suelto "Guardar unidad"); y **ajustar la novedad** para que
el estado **Parcial** use un **checklist simple** (marcar potreros hechos + anexar otros) y
también tenga el **selector de unidad**.

Motivo: una actividad de maquinaria/estándar se programa para varios días; el avance diario
es donde se captura lo hecho (potreros + cantidades + observación). La novedad Parcial solo
necesita registrar cuáles de los potreros estipulados se hicieron (más anexar), sin cantidades.

## Contexto (verificado en código)

- **`AvanceEntrada`** (`src/dominio/avance-lote.ts`): `{ dia; maquinaId; cantidad; centroCosto?; responsableId? }`. Se acumula con `agregarAvances`/`registrarAvanceLoteGrupo` en `avancePorLote` (JSON). No tiene observación.
- **`FormAvance`** (`src/app/cumplimiento/form-avance.tsx`): hoy un avance = **un potrero por envío** (día, responsable, finca→lote→cantidad, y en maquinaria máquina + centro). Recibe `lotesCatalogo`, `fincaDefault`, `responsables`, `responsableDefault`, `diaActividad`, `esMaquinaria`, `maquinas`. **No** tiene selector de unidad ni observaciones ni tabla por potrero.
- **`registrarAvanceLoteGrupo`** (`repositorio.ts:581`): `(id, dia, maquinaId, avances: {loteId; cantidad}[], centroCosto?, responsableId?)`; agrega entradas y marca `PARCIAL`.
- **`registrarAvanceAccion`** (`acciones.ts:122`): lee un `loteId` + `cantidad`; `anexarLotesGrupo(id,[loteId])` + `registrarAvanceLoteGrupo(...)`. `unidadElegida(form)` resuelve unidad (select + "otro"→texto).
- **Unidad por actividad**: cuadro **suelto** `<form action={setUnidadRealizada}>` con "Guardar unidad" en `ActividadEstandar` (`actividad-estandar.tsx:152`) y equivalente en `ActividadMaquinaria`. Acción `setUnidadRealizadaGrupo(id, unidad)` (`repositorio.ts:669`). El selector (`selectorUnidad`) ya usa la lista ampliada Ha/Hora/Kg/Cantidad/Bultos/Jornales/Otro.
- **`FormRegistrar`** (novedad, `form-registrar.tsx`): con Plan W muestra, si `(estado PARCIAL|REPROGRAMADA) && lotesActividad.length>1`, una **tabla** por lote (`loteHecho` + `ha_<id>` + `bultos_<id>`) + bloque **anexar**. Props Plan W: `lotesActividad` con `hectareas?`, `bultosAsignados?`, `descripcion?`.
- **`registrarNovedadActividadAccion`** (`acciones.ts:155`): lee `loteHecho[]` + arma `medidas` (`ha_`/`bultos_`) → `registrarNovedadGrupo(id, estado, motivoId, nota, reemplazo, lotesHechos, medidas)`.
- **`registrarNovedadGrupo`** (Plan W): setea `lotesHechos`, **anexa** (connect) los `lotesHechos` no asignados, **mezcla** `bultosPorLote` y suma `haRealizada` desde `medidas`.
- **Excel** (`cumplimiento-export.ts` `filasCumplimiento`, l.49-107): una fila por avance; columna **Observación** = `a.nota`; **Unidad** = `a.unidadRealizada ?? unidad-catálogo`; **Responsable** = `nombreResponsable(e.responsableId) || a.responsable.nombre`. `ctx` ya trae `nombreResponsable`.
- `usaBultos(descripcion)` (`src/dominio/bultos.ts`): true para fertilización con bultos.

## Diseño

### A. Modelo — observación por avance

- `AvanceEntrada` gana **`observacion?: string | null`** (por avance; aplica a todos los lotes de ese envío).
- `agregarAvances` y `registrarAvanceLoteGrupo` propagan `observacion` (nuevo parámetro posicional opcional `observacion?: string | null`, después de `responsableId`) hacia cada entrada creada.
- `registrarAvanceLoteGrupo` gana además un parámetro opcional **`bultosPorLote?: Record<string, number> | null`**: cuando viene, mezcla (spread del actual + claves nuevas con valor no nulo) en el `bultosPorLote` de las filas del grupo, dentro de la misma `$transaction`.

### B. `FormAvance` — tabla de potreros + unidad + observaciones (actividades con lotes)

Un solo envío puede registrar **varios potreros** a la vez. El componente recibe además:
`lotesActividad: { id; nombre; hectareas?: number | null }[]`, `bultosAsignados?: Record<string, number> | null`, `descripcion?: string`, `unidadActual?: string | null`.

Contenido del formulario:
- **Día** (Lun–Dom; `name="dia"`, default = día de la actividad).
- **Responsable** (`name="responsableId"`, default el de la actividad; editable).
- **Solo maquinaria:** **Tractor** (`name="maquinaId"`) y **Centro de costo** (`name="centroCosto"`, `CENTROS_COSTO` + "Otras…"→`centroCostoOtra`).
- **Unidad** (`name="unidad"`, lista ampliada Ha/Hora/Kg/Cantidad/Bultos/Jornales/Otro→`unidadOtra`; default `unidadActual`).
- **Tabla por potrero**: por cada lote de `lotesActividad` (+ anexados en estado cliente): casilla `name="loteHecho"` value=`id`; input `name="ha_<id>"` (number, default `hectareas`) = **la medida**; si `usaBultos(descripcion)`, input `name="bultos_<id>"` (number, default `bultosAsignados[id]`). Debajo, bloque **"Anexar potrero(s)"**: finca→lote (del `lotesCatalogo`, filtrando por finca y excluyendo los ya presentes) + "+ agregar" que suma a la lista cliente (con su casilla marcada por defecto).
- **Observaciones** (`name="observacion"`, textarea/input libre).
- Botón "Guardar avance".

La rama **sin lotes** (medida general) no cambia: mantiene su selector de unidad + cantidad + nota como hoy.

### C. `registrarAvanceAccion` — leer tabla + unidad + observación

- Leer `dia`, `responsableId`, (maquinaria) `maquinaId` + `centroCosto` (+ `centroCostoOtra`), `unidad` (vía `unidadElegida`), `observacion`.
- `lotesHechos = form.getAll('loteHecho')`. Por cada uno leer `ha_<id>` (→ `cantidad`) y `bultos_<id>`.
- Guard de plazo (como hoy).
- `anexarLotesGrupo(id, lotesHechos)` (anexa los no asignados).
- `setUnidadRealizadaGrupo(id, unidadElegida(form))`.
- Armar `avances = lotesHechos.map(id => ({ loteId: id, cantidad: ha_<id> ?? 0 }))` y `bultosMap` con los `bultos_<id>` no nulos.
- `registrarAvanceLoteGrupo(id, dia, maquinaId, avances, centroCosto, responsableId, observacion, bultosMap)`.
- `revalidatePath`.

### D. `FormRegistrar` (novedad) — Parcial = checklist simple + anexar + unidad

- Estados: No cumplida / Reprogramada / Parcial (sin cambios de estados).
- **Revertir** la tabla Plan W: cuando `(estado PARCIAL|REPROGRAMADA) && lotesActividad.length>1`, mostrar **solo** el checklist (`loteHecho` por lote, sin `ha_`/`bultos_`) + el bloque **anexar** (se conserva). Se eliminan los inputs `ha_<id>`/`bultos_<id>` y la prop `bultosAsignados` deja de usarse para inputs (puede quitarse); `descripcion`/`usaBultos` ya no se necesitan aquí.
- **Añadir** el selector de **unidad** (`name="unidad"` + `unidadOtra`, lista ampliada, default la unidad actual) al formulario de novedad.

### E. `registrarNovedadActividadAccion` + `registrarNovedadGrupo` — quitar medidas, fijar unidad

- La acción **deja de** leer `ha_`/`bultos_` y de armar `medidas`. Lee `unidad` y llama `setUnidadRealizadaGrupo(id, unidadElegida(form))`. Llama `registrarNovedadGrupo(id, estado, motivoId, nota, reemplazo, lotesHechos)` (sin `medidas`).
- `registrarNovedadGrupo`: **quitar** el parámetro `medidas` y la lógica de mezcla de `bultosPorLote`/suma de `haRealizada`. **Conservar**: setear `lotesHechos` y **anexar (connect)** los `lotesHechos` que no estén ya asignados (para permitir anexar otros potreros en Parcial). Estado/motivo/nota/reemplazo/devolución como estaban antes del Plan W.

### F. Controles / página / Excel

- `ActividadEstandar` y `ActividadMaquinaria`: **eliminar** el cuadro suelto "Guardar unidad" (`<form action={setUnidadRealizada}>` + `selectorUnidad`). Pasar a `FormAvance` las props nuevas (`lotesActividad` con hectáreas, `bultosAsignados`, `descripcion`, `unidadActual`). Seguir pasando a `FormRegistrar` lo necesario (ya recibe `lotesActividad`; añadir `unidadActual`).
- `page.tsx`: proveer `unidadActual = cab.unidadRealizada` a ambos controles; el resto de props ya existen (`cab.lotes` con hectáreas, `cab.bultosPorLote`, `cab.descripcion`).
- **Excel** (`filasCumplimiento`, fila de avance): columna **Observación** = `e.observacion ?? a.nota ?? ''` (la de la entrada, con fallback a la nota de la actividad). Resto igual.

## Testing

- **Dominio (Vitest):**
  - `avance-lote.test.ts`: `agregarAvances` guarda `observacion` en cada entrada nueva.
  - `cumplimiento-export.test.ts`: la fila de avance usa `e.observacion` con fallback a `a.nota`.
- **Repo/acciones/UI/RSC:** typecheck fiable (`tsconfig.check.json`) + verificación en vivo.
- **Manual:**
  1. Actividad de **fertilización** con varios potreros → **Registrar avance**: tabla precarga ha (área) y bultos asignados; marcar algunos, editar cantidades, anexar un potrero no asignado, elegir unidad y escribir observación → se guardan avances (cantidad = ha), `bultosPorLote` (aplicados), `unidadRealizada`; el Excel día a día muestra responsable/tractor reales, unidad de la actividad y la **observación** del avance.
  2. Actividad **no** de fertilización con varios potreros → igual pero **sin** columna de bultos.
  3. **Novedad Parcial** → checklist simple (marcar potreros hechos + anexar otro) + selector de unidad; se guardan `lotesHechos` (con anexados conectados) y `unidadRealizada`; **no** se tocan bultos/haRealizada.
  4. El cuadro suelto "Guardar unidad" **ya no aparece** en ninguna versión.

## Fuera de alcance

- Resumen/tablero/programar no cambian; el resumen sigue leyendo `haRealizada`/`bultosPorLote` como hasta ahora.
- No se cambia el enum `Unidad` ni la lista de Configuración; la lista ampliada vive en los selectores de la UI.
- No se modifica el área del lote en el catálogo (las ha del avance son lo hecho, no el catálogo).
- La medida del avance por potrero es **siempre ha** (decisión confirmada); los bultos son dato aparte (solo fertilización). El selector de unidad etiqueta la unidad declarada de la actividad y aparece en todas las actividades.

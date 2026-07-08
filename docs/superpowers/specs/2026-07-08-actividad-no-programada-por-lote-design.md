# Actividad no programada: por lote, unidad, bultos y observación

Fecha: 2026-07-08

## Contexto

El cuadro "➕ Agregar actividad realizada (no programada)" en `/cumplimiento`
(`FormActividadRealizada`) es básico comparado con los demás formularios: elige
un solo lote (dos desplegables), no tiene selector de unidad, no captura cantidad
por lote ni bultos, y no tiene observación. Guarda solo `haRealizada` total, sin
`avancePorLote`, por lo que el Excel la exporta como una sola fila resumen.

Objetivo: que funcione como "Registrar avance" — varios potreros, unidad, medida
por lote (sugerida con las hectáreas, editable), bultos donde aplique, y observación.

## Cambios

### 1. Catálogo de bultos (`src/dominio/bultos.ts`)
`ACTIVIDADES_CON_BULTOS` agrega: `ESTERCOLERO`, `ESPARCIDOR`, `REGAR COMPOST`, `GRANEL`
(además de las existentes FERTILIZACION GRANULADA, ENCALADORA, FERTILIZACION POLLINAZA).

### 2. Picker de potreros generalizado (`src/app/cumplimiento/picker-reemplazo-potreros.tsx`)
Se generaliza el picker (multi-lote + candado de finca + medida prellenada con hectáreas
editable + bultos) con dos props nuevas, retrocompatibles:
- `prefijo?: string` (default `'reemplazo'`) — prefijo de los `name` de los inputs
  ocultos (`<prefijo>LoteId`, `<prefijo>Medida_<id>`, `<prefijo>Bultos_<id>`).
- `conObservacion?: boolean` (default `false`) — si true, cada potrero marcado muestra
  un input de observación y emite `<prefijo>Obs_<id>`.

El flujo de reemplazo lo sigue usando con los defaults ⇒ comportamiento idéntico.

### 3. Formulario (`src/app/cumplimiento/form-actividad-realizada.tsx`)
- Agregar selector de **unidad** (misma lista y "Otro" que `FormAvance`): `unidad`/`unidadOtra`.
- Reemplazar `SelectFincaLote` (single) por el picker generalizado en modo multi-lote,
  con `conBultos` reactivo a la descripción elegida (`usaBultos(descripcion)`), y
  `conObservacion` = true. Prefijo propio (p. ej. sin prefijo: `loteId`, `medida_`,
  `bultos_`, `obs_`).
- Quitar el input `medida` único (ahora es por lote). Conservar tractor + centro de
  costo en maquinaria.
- `conBultos` y la unidad se recalculan según la descripción seleccionada (estado cliente).

### 4. Acción y creación (`acciones.ts` + `repositorio.ts`)
`agregarActividadRealizadaAccion` lee: `loteId` (getAll → varios), por lote
`medida_<id>`, `bultos_<id>`, `obs_<id>`, la `unidad`/`unidadOtra`, más
responsable/día/descripción/máquina/centro de costo.

`crearActividadRealizada` pasa a aceptar `loteIds: string[]`, `unidad`, y mapas por lote,
y en `prisma.actividad.create` escribe:
- `lotes.connect` con todos los loteIds; `fincaId` del primer lote.
- `avancePorLote`: una entrada por lote `{ dia, maquinaId, cantidad: medida, responsableId,
  centroCosto?, observacion? }`.
- `bultosPorLote`: `{ loteId: bultos }` para los que tengan bultos.
- `unidadRealizada` = unidad elegida; `haRealizada` = suma de medidas.
- `estado: 'CUMPLIDA'`, `noProgramada: true`.

Con `avancePorLote` poblado, `filasCumplimiento` desglosa por lote sin tocar el export.

## Dominio testeable
La construcción del `avancePorLote`/`bultosPorLote`/total a partir de las entradas por
lote se hace con helpers puros ya existentes (`agregarAvances`, `totalAvanceLotes`) o uno
nuevo si hace falta; se cubre con tests unitarios (TDD).

## Verificación y despliegue
- Tests + typecheck.
- Navegador (dev local → DB prod): crear una actividad no programada de fertilización con
  2 lotes, unidad, medidas (ha sugeridas), bultos y observación por lote; revisar que el
  Excel la desglose por lote. Borrar la actividad de prueba al terminar.
- `git push` + `npx vercel@latest deploy --prod --yes`.

# Correcciones: unidad por lote, candado de finca, bultos en Excel

Fecha: 2026-07-07

## Contexto

Cuatro correcciones surgidas del uso real en `/cumplimiento` y `/programar`.
El disparador fue la actividad "BOLA" de Carlos Botiva (Maquinaria, 2026-S28),
que quedó con lotes de dos fincas distintas mezclados (Entremontes + Acajure),
lo cual no debería ocurrir en una asignación.

## Causa raíz de la mezcla de fincas

Ningún punto del sistema impone que una tarea/actividad tenga lotes de una sola
finca. Los selectores de lotes (`PickerLotesBultos`, `PickerReemplazoPotreros`, y
el bloque "Anexar potrero(s)" de `FormAvance`) usan el desplegable de finca solo
para **filtrar la lista visible**, pero la selección se guarda por id de lote y
**persiste al cambiar de finca**. Así se pueden marcar lotes de varias fincas.
Al asignar la tarea (`asignarTarea`), la actividad hereda todos esos lotes y su
`fincaId` se toma solo del primer lote. El lote extra de BOLA (MATAPALO1, que no
estaba en la tarea) se agregó vía "Anexar potrero(s)" (`anexarLotesGrupo`, que
conecta lotes sin revalidar finca).

## Cambios

### 1. Etiqueta de unidad por lote (item confuso "ha")
`src/app/cumplimiento/form-avance.tsx`: la etiqueta fija `ha` de cada fila de
potrero (línea ~121) pasa a mostrar la **unidad seleccionada** arriba (`unidadSel`,
o el texto de "Otro"). El `name` del input sigue siendo `ha_<loteId>` (el servidor
guarda la medida y la unidad por separado, así que es solo cosmético). Se hace
`unidadOtra` controlado para que la etiqueta refleje el texto en vivo.

### 2. Candado de finca (una tarea/actividad = una sola finca)
Comportamiento elegido: **fijar la finca** al marcar el primer lote.

- `PickerLotesBultos` (`src/app/tareas/picker-lotes-bultos.tsx`): mientras haya
  ≥1 lote marcado, el desplegable de finca queda deshabilitado y fijo en la finca
  de los lotes marcados. Para cambiar de finca hay que desmarcar todo.
- `PickerReemplazoPotreros` (`src/app/cumplimiento/picker-reemplazo-potreros.tsx`):
  mismo candado.
- "Anexar potrero(s)" en `FormAvance`: el desplegable de finca se fija a la finca
  de la actividad (`fincaDefault`) y solo ofrece lotes de esa finca. Si la
  actividad no tiene finca, se permite elegir una vez y luego queda fija.

No se cambia la lógica del servidor (los selectores son el único punto de entrada);
el candado de UI previene la mezcla en origen.

### 3. Editar avance
Sin cambios (confirmado por el usuario: día/cantidad/observación es suficiente).

### 4. Bultos por lote en el Excel
`src/dominio/cumplimiento-export.ts`: en el bucle que emite **una fila por avance**
(líneas 67-88), la columna "Bultos por lote" deja de repetir el texto con todos los
lotes (`textoBultosPorLote`) y pasa a mostrar **el valor de bultos de ESE lote**
(`a.bultosPorLote?.[l.id] ?? ''`), igual que "Medida realizada" ya muestra la ha de
ese lote. La fila-resumen de una cumplida sin avances (varios lotes en una fila)
mantiene el texto agregado, porque ahí sí representa a todos los lotes juntos.

## Corrección del dato existente (BOLA)

Actividad `cmr8jrae00003ju04z9yrj4de` (única fila de su `tareaId`). Dejar solo:
- MATAPALO1 (`cmqme22ci008sod5qmgp05ukm`) — tiene 2 avances registrados.
- MATAPALO2 (`cmqme22sx008uod5qkri8lwdn`).

Quitar: CONEJO3, L.SECA2 (Entremontes), MATAPALO3, SANCOCHO2 (Acajure).
Actualizar `fincaId` de la actividad a **Acajure** (finca de MATAPALO1/2).
`avancePorLote` solo referencia MATAPALO1 (se conserva) → no quedan avances huérfanos.

## Verificación y despliegue

- Typecheck con `tsconfig.check.json`.
- Verificación en navegador (dev local → DB prod, sin escritura salvo la limpieza
  puntual de BOLA): candado de finca en el picker, etiqueta de unidad, y export de
  Excel con bultos por lote (descargar el .xlsx autenticado y revisar la columna).
- Limpieza de BOLA por script puntual (solo esa fila, por id).
- Deploy: `git push` + `npx vercel@latest deploy --prod --yes`.

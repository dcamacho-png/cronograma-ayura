# Seguimiento por día en maquinaria + actividad única con varios responsables

**Fecha:** 2026-06-22

## Contexto

Segunda iteración de [cumplimiento por actividad](2026-06-22-cumplimiento-por-actividad-design.md).
Esa entrega dejó: agrupar por `tareaId`, una tarjeta por actividad, y en no-maquinaria
un checkbox "✓ Cumplido" + novedad por día. Faltan tres cosas:

1. **Maquinaria** sigue mostrando el formulario completo viejo por día (estado +
   motivo + medida + centro de costo). Debe verse como las otras áreas: tarjeta por
   actividad y, por día, un **campo de avance** en su unidad (ha/hora/kg) en vez de
   checkbox.
2. **Varios responsables:** `asignarTarea` crea **una fila por (responsable × día)**,
   todas con el mismo `tareaId`. Hoy la tarjeta repite el mismo día (una vez por
   responsable) y el contador "N días" cuenta filas, no días. La actividad debe ser
   **una sola** aunque tenga varios responsables.
3. El **"↩ desmarcar"** hoy solo existe en no-maquinaria y limpia solo motivo/nota.

## Decisiones (acordadas)

1. **Maquinaria por día:** campo de avance numérico con la etiqueta de su unidad
   (ha/hora/kg del catálogo) + centro de costo opcional + **Guardar** → marca el día
   **CUMPLIDA** con esa medida (`haRealizada`). Más **"registrar novedad"** → no
   cumplida con motivo. Un día con avance registrado cuenta como cumplido.
2. **Unidades:** solo **ha / hora / kg** (las del catálogo). No se agregan bultos.
3. **Varios responsables = una actividad:** una sola tarjeta por `tareaId`. Adentro se
   agrupa **por día** (cada día una vez); bajo cada día, **una fila por responsable**
   con su propio control. El nombre del responsable se muestra por fila **solo cuando
   la actividad tiene más de un responsable**.
4. **Contador de la cabecera:** "{días distintos} días" cuenta **días distintos**, no
   filas. La cabecera muestra el/los responsable(s).
5. **Desmarcar unificado:** nueva `reabrirActividad(id)` que vuelve el día a PENDIENTE
   y limpia `haRealizada`, `centroCosto`, `motivoId`, `nota`, `lotesHechos`. El
   "↩ desmarcar" la usa en **ambas** áreas.
6. **Cálculo:** sin cambios. `porcentajeCumplimiento` ya agrupa por `tareaId` y cuenta
   por fila (responsable-día). La actividad pesa 1; sus filas cuentan adentro;
   % = filas cumplidas ÷ filas totales.

## A. Visualización de la tarjeta (todas las áreas)

En `src/app/cumplimiento/page.tsx`, cada tarjeta (grupo `tareaId`) se reestructura:

- **Cabecera:** descripción · responsable(s) · badge derecho
  `"{díasDistintos} días · Cumplido: X%"`. Si la actividad tiene un solo responsable,
  se muestra su nombre; si tiene varios, se muestran los nombres distintos (separados
  por coma). El "{díasDistintos} días" solo aparece cuando hay más de un día distinto.
  Los lotes (`InfoLotes`) se muestran una vez por tarjeta.
- **Cuerpo:** agrupar las filas del grupo **por `dia`** (orden ascendente). Para cada
  día, una sub-sección con el encabezado del día (Lun/Mar… + fecha) y, dentro,
  **una fila por responsable** (las filas de ese día). Cada fila renderiza el control
  del día según el área (B) o el estado registrado.
- El **nombre del responsable** se muestra en cada fila **solo si** la actividad tiene
  más de un responsable distinto.

Helper de dominio reutilizable para no duplicar la lógica de "responsables distintos" y
"días distintos": funciones puras en `src/dominio/` (p. ej. `responsablesDistintos(dias)`
y `diasDistintos(dias)`), testeables con Vitest.

## B. Control por día en maquinaria

Nuevo componente cliente `src/app/cumplimiento/dia-maquinaria.tsx`, análogo a
`DiaNoMaquinaria`:

- **Día PENDIENTE:** input numérico de avance (etiqueta `etiquetaMedida(unidad)`),
  un select de **centro de costo** (opcional, los `CENTROS_COSTO` existentes), y botón
  **Guardar**. Al guardar, postea a `registrarAccion` con `estado=CUMPLIDA`,
  `haRealizada=<valor>` y `centroCosto`. Más un enlace **"registrar novedad"** que
  revela el `FormRegistrar` completo (`esMaquinaria=true`) con `registrarAccion` para
  no-cumplida/parcial/reprogramada con motivo.
- En `page.tsx`, la rama de día PENDIENTE pasa a:
  `esMaquinaria ? <DiaMaquinaria…/> : <DiaNoMaquinaria…/>`.

`registrarAccion` → `registrarCumplimiento` ya acepta `haRealizada`, `centroCosto`,
`estado`, `motivoId`, `nota`. No cambia su firma; el componente nuevo solo envía los
campos del caso "avance".

## C. Desmarcar unificado

- Nueva función en `src/datos/repositorio.ts`:
  `reabrirActividad(id)` → `update` con `estado='PENDIENTE'`, `haRealizada=null`,
  `centroCosto=null`, `motivoId=null`, `nota=null`, `lotesHechos=null`.
- Nueva acción `desmarcarAccion(form)` en `src/app/cumplimiento/acciones.ts`: lee `id`,
  llama `reabrirActividad(id)`, `revalidatePath('/cumplimiento')`.
- El botón "↩ desmarcar" (estado registrado) usa `desmarcarAccion` en **ambas** áreas.
  Reemplaza el uso actual de `marcarEstadoAccion(estado=PENDIENTE)` en no-maquinaria.

## D. Cálculo

Sin cambios en `metricas.ts`. Se valida con pruebas nuevas que cubran el caso
multi-responsable (varias filas con mismo `tareaId` y distinto `responsableId`):
- 1 actividad, 2 responsables × 2 días, todas cumplidas → 100% (una actividad).
- Misma actividad con la mitad de filas cumplidas → 50%.
- En `rankingResponsables`, cada responsable ve su parte como una actividad propia.

## Lo que NO cambia

- El modelo de datos (sigue una fila por responsable-día). Sin migraciones.
- La exportación a Excel (una fila por día/responsable).
- `pesoEstado`, `agruparPorActividad`, la firma de `porcentajeCumplimiento`.
- La asignación en *Programar* (sigue creando fila por responsable × día).

## Pruebas

- **Dominio (`metricas.test.ts`):** casos multi-responsable de arriba; y los helpers
  `responsablesDistintos` / `diasDistintos` con su propio test (incluye el caso de
  filas repetidas por responsable en el mismo día).
- **UI:** verificación manual (typecheck + lint + revisión en navegador): tarjeta de
  maquinaria con campo de avance por día; tarjeta multi-responsable con día una vez y
  responsables dentro; desmarcar en ambas áreas restaura a Pendiente y baja el %.

## Criterios de aceptación

1. Maquinaria muestra una tarjeta por actividad; cada día pide el **avance** en su
   unidad y al guardar queda cumplido con esa medida; existe "registrar novedad".
2. Una actividad con varios responsables se ve como **una tarjeta**, con cada día una
   sola vez y los responsables dentro; el contador cuenta días distintos.
3. "↩ desmarcar" funciona en maquinaria y no-maquinaria y limpia la medida/motivo.
4. El % sigue contando la actividad como una (filas cumplidas ÷ filas totales).
5. Excel y modelo de datos sin cambios.

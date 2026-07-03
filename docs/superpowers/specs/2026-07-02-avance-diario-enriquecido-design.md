# Avance diario enriquecido (estándar + maquinaria) — Design Spec

**Fecha:** 2026-07-02

## Objetivo

Enriquecer el registro de **avance diario** en cumplimiento (ambas versiones):
- **Por avance** se captura: día/fecha, **responsable** (editable — el real de ese día), **potrero(s)** de la finca de la actividad con su **cantidad**, y —en maquinaria— **tractor** y **centro de costo**. Responsable/tractor pueden variar respecto a la asignación y se guardan por avance.
- **Por actividad** (una sola vez, no por avance): la **unidad** de medida, elegida de una lista ampliada (Ha/Hora/Kg/Cantidad/Bultos/Jornales/Otro→texto).

El Excel día a día muestra el responsable/tractor **reales del avance** y la **unidad de la actividad**.

## Contexto (verificado en código)

- Entrada de avance `AvanceEntrada` (`src/dominio/avance-lote.ts`) = `{ dia, maquinaId, cantidad, centroCosto? }` (`centroCosto` del plan U). Se acumula con `agregarAvances`/`registrarAvanceLoteGrupo` en `avancePorLote` (JSON).
- Unidad **por actividad** ya existe: columna `Actividad.unidadRealizada` (texto, plan S). Estándar la elige con un selector (Cantidad/Ha/Jornales/Otro); maquinaria hoy usa la unidad del catálogo (etiqueta, sin selector).
- Estándar (`ActividadEstandar`, plan S): avance por Finca→Lote→cantidad. Maquinaria (`ActividadMaquinaria`, plan U): avance con `FormAvanceLote` (checkbox de lotes asignados + máquina + centro + día).
- Excel (`filasCumplimiento`): una fila por avance; hoy muestra `a.responsable.nombre`, `e.maquinaId` (vía `ctx.nombreMaquina`), `e.centroCosto ?? a.centroCosto`, y unidad del catálogo. `ctx` resuelve `nombreMaquina`.

## Diseño

### A. Modelo — responsable por avance; unidad por actividad

- `AvanceEntrada` gana **`responsableId?: string | null`** (por avance). **NO** se añade unidad al avance.
- La **unidad** sigue en `Actividad.unidadRealizada` (por actividad, texto). Se **amplía** el selector a: **Ha, Hora, Kg, Cantidad, Bultos, Jornales, Otro** (input texto). Lista fija en la UI; no cambia el enum `Unidad` ni Configuración.
- `agregarAvances`/`registrarAvanceLoteGrupo` pasan el `responsableId` (agrupando los campos "por avance" `maquinaId, centroCosto, responsableId` en un objeto `extra` para no alargar la firma). Registrar el avance de un lote no asignado lo **anexa** (reutiliza `anexarLotesGrupo`).

### B. Formulario de avance unificado (client) — reemplaza los dos actuales

Un componente compartido (estándar + maquinaria por `esMaquinaria`). Campos del avance:
- **Día** (Lun–Dom).
- **Responsable** (`<select>` de los responsables del área; por defecto el de la actividad; editable).
- **Potrero(s)**: **Finca** (por defecto la de la actividad) → **Lote** (de esa finca, del catálogo) → **Cantidad**; se pueden añadir varios y anexar no asignados.
- **Solo maquinaria:** **Tractor** (`<select>` de máquinas) y **Centro de costo** (`CENTROS_COSTO` + "Otras…").
- Al "Guardar avance", los campos día/responsable/(tractor/centro) son del avance y cada lote lleva su cantidad → entradas en `avancePorLote`.

**Unidad** = un selector aparte **por actividad** (no en el formulario de avance), con la lista ampliada, guardando `unidadRealizada`. El estándar ya lo tiene (se amplía la lista); maquinaria lo **gana** (reemplaza la etiqueta de catálogo). Marcar cumplida / novedad / devolver no cambian.

### C. Acciones

- La acción de avance lee día, `responsableId`, lotes+cantidades y —maquinaria— `maquinaId` + `centroCosto`; guard de plazo; anexa los lotes elegidos; `registrarAvanceLoteGrupo` con el `extra`; `revalidatePath`.
- La unidad se fija con la acción de unidad por actividad (estándar ya la tiene vía `setUnidadRealizadaGrupo`/su acción; maquinaria reutiliza la misma).

### D. Excel

- `filasCumplimiento`, fila de avance: **Responsable** = nombre de `e.responsableId` (fallback `a.responsable.nombre`); **Máquina** = `e.maquinaId` (ya); **Centro de costo** = `e.centroCosto ?? a.centroCosto` (ya); **Unidad** = `a.unidadRealizada ?? unidad-catálogo`. `ctx` gana `nombreResponsable(id)`; `ActividadExport` gana `unidadRealizada`.
- La ruta `exportar/route.ts` arma el mapa `responsableId → nombre` y lo pasa en `ctx`.

## Testing

- **Dominio (Vitest):** `avance-lote.test.ts` (agregarAvances guarda `responsableId`); `cumplimiento-export.test.ts` (fila de avance usa el responsable de la entrada con fallback y la unidad de la actividad).
- **Repo/acciones/UI/RSC:** typecheck fiable + verificación en vivo.
- **Manual:** en estándar y maquinaria, elegir la unidad de la actividad (probar Bultos/Jornales/Otro), y registrar avances con responsable distinto al asignado, finca→lote(s)+cantidad (y un potrero no asignado → se anexa), y —maquinaria— tractor + centro; el Excel muestra el responsable/tractor reales por día y la unidad de la actividad.

## Fuera de alcance (decisiones confirmadas)

- **A:** un solo componente de avance compartido (tractor/centro ocultos en estándar) reemplaza los dos formularios.
- **B:** el "Realizado" del resumen (solo maquinaria) se mantiene como está (no totaliza las unidades nuevas por ahora).
- Unidad **por actividad** (no por avance). No se cambia el enum `Unidad` ni la lista de Configuración; la lista ampliada vive en el selector de unidad del control.
- Resumen/tablero/programar no cambian.

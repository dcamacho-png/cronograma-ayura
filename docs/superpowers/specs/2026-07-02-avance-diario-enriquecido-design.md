# Avance diario enriquecido (estándar + maquinaria) — Design Spec

**Fecha:** 2026-07-02

## Objetivo

Enriquecer el registro de **avance diario** en cumplimiento (ambas versiones) para capturar, **por avance**: día/fecha, **responsable** (editable — el real de ese día), **unidad** de medida (lista + "otro" texto libre), **potrero(s) de la finca de la actividad** con su **cantidad**, y —en maquinaria— **tractor** y **centro de costo**. El responsable/tractor/unidad pueden variar respecto a la asignación original y se guardan por avance. El Excel día a día muestra esos datos reales del avance.

## Contexto (verificado en código)

- Entrada de avance `AvanceEntrada` (`src/dominio/avance-lote.ts`) = `{ dia, maquinaId, cantidad, centroCosto? }` (el `centroCosto` se añadió en el plan U). Se acumula con `agregarAvances`/`registrarAvanceLoteGrupo` en `avancePorLote` (JSON).
- Estándar (`ActividadEstandar`, plan S): avance por **Finca→Lote→cantidad** + selector de unidad (texto libre `unidadRealizada` a nivel actividad).
- Maquinaria (`ActividadMaquinaria`, plan U): avance con `FormAvanceLote` (checkbox de lotes asignados + máquina + centro de costo + día); unidad = catálogo (etiqueta).
- Excel (`filasCumplimiento`): una fila por avance; hoy muestra `a.responsable.nombre` (de la actividad), `e.maquinaId` (del avance) y unidad del catálogo. `ctx` resuelve `nombreMaquina`.
- Lista de unidades de maquinaria (Configuración estipuladas): ha/hora/kg/cantidad (`Unidad` enum). El resumen "Realizado" (solo maquinaria) totaliza por ese enum.

## Diseño

### A. Modelo — entrada de avance enriquecida (dominio + repo)

- `AvanceEntrada` gana `responsableId?: string | null` y `unidad?: string | null` (texto libre: ha/hora/kg/cantidad/bultos/jornales o el "otro"). Sin migración (JSON).
- `agregarAvances(avance, dia, maquinaId, entradas, extra?)` y `registrarAvanceLoteGrupo(...)` pasan también `responsableId` y `unidad`. (Se agrupan los campos "por avance" — `maquinaId, centroCosto, responsableId, unidad` — en un objeto `extra` para no seguir alargando la firma.)
- Registrar el avance de un lote no asignado lo **anexa** al grupo (reutiliza `anexarLotesGrupo`).

### B. Formulario de avance unificado (client) — reemplaza los dos actuales

Un componente compartido usado por estándar y maquinaria. Campos:
- **Día** (Lun–Dom).
- **Responsable** (`<select>` de los responsables del área; por defecto el de la actividad; editable).
- **Unidad** (`<select>`: Ha, Hora, Kg, Cantidad, Bultos, Jornales, **Otro**→input texto). Lista fija (no el enum estricto); valor guardado como texto.
- **Potrero(s)**: **Finca** (`<select>`, por defecto la finca de la actividad) → **Lote** (`<select>` de esa finca, del catálogo) → **Cantidad**; se pueden añadir varios lotes con su cantidad (y anexar potreros no asignados).
- **Solo maquinaria** (`esMaquinaria`): **Tractor** (`<select>` de máquinas) y **Centro de costo** (`CENTROS_COSTO` + "Otras…").
- Al "Guardar avance": los campos día/responsable/unidad/(tractor/centro) son del avance (compartidos), y cada lote lleva su cantidad → se escriben entradas en `avancePorLote` con esos datos.

Los controles `ActividadEstandar` y `ActividadMaquinaria` usan este formulario (con `esMaquinaria` para mostrar tractor/centro); el resto (marcar cumplida, novedad, devolver) no cambia.

### C. Acciones

- La acción de avance (una para estándar, otra para maquinaria, o una con flag) lee día, responsableId, unidad(+otra), lotes+cantidades y —maquinaria— maquinaId + centroCosto; guard de plazo; anexa los lotes elegidos; `registrarAvanceLoteGrupo` con el `extra`; `revalidatePath('/cumplimiento')`.

### D. Excel

- `filasCumplimiento`, fila de avance: **Responsable** = nombre de `e.responsableId` (fallback `a.responsable.nombre`); **Máquina** = `e.maquinaId` (ya); **Unidad** = `e.unidad ?? unidad-catálogo`; **Centro de costo** = `e.centroCosto ?? a.centroCosto` (ya). `ctx` gana un resolver `nombreResponsable(id)`.
- La ruta `exportar/route.ts` construye el mapa `responsableId → nombre` (de los responsables del área/actividades) y lo pasa en `ctx`.

## Testing

- **Dominio (Vitest):** `avance-lote.test.ts` (agregarAvances guarda responsableId/unidad en la entrada); `cumplimiento-export.test.ts` (fila de avance usa el responsable/unidad de la entrada con fallback).
- **Repo/acciones/UI/RSC:** typecheck fiable + verificación en vivo.
- **Manual:** en estándar y maquinaria, registrar un avance eligiendo día, responsable distinto al asignado, unidad (incluida "otro"), finca→lote(s)+cantidad (y un potrero no asignado → se anexa), y —maquinaria— tractor + centro; verificar que el Excel muestra el responsable/tractor/unidad reales del avance por día.

## Fuera de alcance (decisiones A y B confirmadas)

- **A:** un solo componente de avance compartido (tractor/centro ocultos en estándar) reemplaza los dos formularios actuales.
- **B:** la unidad por avance es **texto libre**; el "Realizado" del resumen (solo maquinaria) se mantiene como está (no totaliza las unidades nuevas por ahora).
- No se cambia el enum `Unidad` ni la lista de unidades de Configuración (la lista nueva vive en el selector del avance).
- Resumen/tablero/programar no cambian.

# Avance por lote en actividades parciales

**Fecha:** 2026-06-22

## Contexto

Hoy, cuando una actividad se marca **Parcial** (o cualquier estado ≠ Cumplida) y es
la única fila de su tarea en la semana, la tarea **regresa automáticamente al banco**
(PENDIENTE, sin semana, `vecesReprogramada +1`). No hay forma de registrar que el
trabajo se fue **completando por lotes** a lo largo de varios días.

Este cambio convierte el Parcial en un **seguimiento por lote**: se registra qué lote
se hizo, qué día, con qué máquina y cuánta cantidad; la actividad avanza
proporcionalmente y llega a Cumplida cuando todos sus lotes están realizados.

## Decisiones (acordadas)

1. **Al marcar Parcial, NO se devuelve sola al banco.** Se muestran **dos opciones**:
   - **Devolver al banco** — comportamiento actual (tarea → banco, `vecesReprogramada +1`).
   - **Registrar avance** — abre el formulario de avance por lote; la actividad sigue
     Parcial hasta llegar al 100%.
   *(No cumplida y Reprogramada conservan su comportamiento actual; el cambio es solo
   para PARCIAL.)*
2. **Formulario "Registrar avance"** captura un avance puntual:
   - **Día** del avance.
   - **Máquina** (en maquinaria).
   - Por cada **lote pendiente** de la actividad: casilla "realizado" + **cantidad**
     en la unidad de la actividad (ha / hora / kg / bultos).
3. **El 100% se mide por lotes:** cuando **todos los lotes** de la actividad quedan
   registrados en el avance → la actividad pasa a **Cumplida**. Mientras falten →
   sigue **Parcial**.
4. **El parcial vale proporcional:** una actividad parcial aporta
   `lotes realizados ÷ lotes totales` al % de cumplimiento (en vez de 0.5 fijo);
   Cumplida = 1, No cumplida/Pendiente/Reprogramada = 0.
5. **Se agrega almacenamiento por lote** (cambio en la base de datos): columna
   `avancePorLote` en la actividad.

## A. Modelo de datos

Nueva columna en `Actividad` (Prisma):

```prisma
avancePorLote Json?   // Record<loteId, { dia: number; maquinaId: string | null; cantidad: number }>
```

- Migración de Prisma nueva (el build hace `prisma migrate deploy`).
- Encaja con el patrón existente (`bultosPorLote`, `lotesHechos` también son `Json?`).
- La clave es el `loteId`; el valor es el avance de ese lote. Un lote presente en el
  objeto = realizado.

## B. Dominio — cálculo proporcional

En `src/dominio/metricas.ts`, reemplazar el peso por estado dentro del cálculo de la
fracción de actividad por una **fracción por fila** que considera el avance por lote:

```ts
// Fracción (0..1) de UNA fila-actividad. CUMPLIDA=1; PARCIAL=lotes realizados/total
// (0.5 si la fila no tiene lotes); el resto (No cumplida/Pendiente/Reprogramada)=0.
export function fraccionFila(a: {
  estado: Estado
  lotes?: { id: string }[]
  avancePorLote?: Record<string, unknown> | null
}): number {
  if (a.estado === 'CUMPLIDA') return 1
  if (a.estado === 'PARCIAL') {
    const total = a.lotes?.length ?? 0
    if (total === 0) return 0.5
    const hechos = a.lotes!.filter((l) => !!a.avancePorLote && l.id in a.avancePorLote).length
    return hechos / total
  }
  return 0
}
```

- `fraccionActividad(dias)` (helper interno) promedia `fraccionFila` sobre las filas
  del grupo (antes promediaba `pesoEstado(estado) ?? 0`).
- `porcentajeCumplimiento` no cambia su estructura: agrupa por `tareaId`, promedia
  `fraccionActividad` por grupo y redondea. Como recibe las filas de Prisma (que ya
  traen `lotes` y, tras la migración, `avancePorLote`), el cast actual
  `as unknown as ActividadDominio[]` sigue sirviendo sin enriquecer los datos en los
  puntos de llamada (página, tablero, resumen).
- El tipo de dominio `Actividad` (`src/dominio/tipos.ts`) suma los campos opcionales
  `lotes?: { id: string }[]` y `avancePorLote?: Record<string, ...> | null`.
- `pesoEstado` se mantiene exportado (otros usos / claridad), pero el cálculo del
  cumplimiento ya no lo usa para la fracción.
- **Consistencia en el tablero:** `listarActividadesDeSemanas` (que alimenta el
  tablero) hoy solo incluye `area` y `motivo` — hay que añadir `lotes: { select: { id: true } }`
  para que el parcial proporcional también aplique ahí. (`avancePorLote` es columna
  escalar y ya se devuelve por defecto.) `listarActividades` ya incluye `lotes`.

## C. Datos / acciones

En `src/datos/repositorio.ts`:

1. **`registrarCumplimiento`**: cuando `estado === 'PARCIAL'`, **NO** ejecutar la
   devolución automática al banco (el bloque actual `if (estado !== 'CUMPLIDA' && ...)`
   se restringe a `NO_CUMPLIDA`/`REPROGRAMADA`). El Parcial queda registrado y se
   maneja con los botones de la UI.
2. **`registrarAvanceLote(actividadId, dia, maquinaId, avances)`** (nueva): donde
   `avances: { loteId: string; cantidad: number }[]`. Mezcla los lotes recibidos en
   `avancePorLote` (cada uno con `{ dia, maquinaId, cantidad }`). Luego, si **todos**
   los lotes de la actividad están en `avancePorLote`, fija `estado='CUMPLIDA'`; si
   no, deja `estado='PARCIAL'`.
3. **`devolverAlBanco(actividadId)`** (nueva, o reutilizar la lógica existente de
   devolución): pone la tarea de origen en PENDIENTE, `anioSel/semanaSel = null`,
   `vecesReprogramada +1` (misma lógica que hoy es automática). Solo si la actividad
   tiene `tareaId`.

En `src/app/cumplimiento/acciones.ts`: acciones de servidor `registrarAvanceLoteAccion`
y `devolverAlBancoAccion` que leen el form, llaman al repositorio y revalidan
`/cumplimiento`.

## D. UI

En `/cumplimiento`, cuando una fila está en estado **PARCIAL**:
- Mostrar el progreso por lotes (p. ej. "2 de 3 lotes") y, debajo, **dos botones**:
  **Devolver al banco** y **Registrar avance**.
- **Registrar avance** despliega un formulario (componente cliente nuevo, p. ej.
  `form-avance-lote.tsx`): selector de **día**, **máquina** (si maquinaria), y la lista
  de **lotes pendientes** (los lotes de la actividad que aún no están en
  `avancePorLote`), cada uno con casilla + campo de **cantidad** (unidad por
  `etiquetaMedida`).
- Al guardar, se registra el avance; si quedan lotes, la actividad sigue Parcial con el
  progreso actualizado; si se completaron todos, pasa a Cumplida.
- En el estado registrado se listan los lotes ya realizados con su cantidad (similar a
  `textoBultosPorLote`/`textoLotesHechos`).

## E. Lo que NO cambia

- Agrupación por actividad (`tareaId`), tarjeta por día con responsables dentro,
  maquinaria por avance, multi-responsable: intactos.
- Exportación a Excel: una fila por día (se puede añadir el detalle por lote luego;
  fuera de alcance de esta spec).
- `pesoEstado`, `agruparPorActividad`, firma de `porcentajeCumplimiento`.

## Pruebas

- **Dominio (`metricas.test.ts`):**
  - `fraccionFila`: CUMPLIDA→1; PARCIAL con 1 de 3 lotes→1/3; PARCIAL sin lotes→0.5;
    NO_CUMPLIDA/PENDIENTE/REPROGRAMADA→0.
  - `porcentajeCumplimiento`: una actividad parcial con 2 de 4 lotes hechos aporta 0.5;
    mezcla con otra cumplida da el promedio correcto; los tests existentes (PARCIAL sin
    lotes = 0.5) siguen pasando.
- **UI / datos:** verificación manual (typecheck + lint + navegador): marcar parcial →
  ver los dos botones; registrar avance por lote en varios días; ver el progreso subir;
  completar todos los lotes → Cumplida; "Devolver al banco" → la tarea vuelve al banco.

## Criterios de aceptación

1. Marcar Parcial muestra **Devolver al banco** y **Registrar avance** (ya no se
   devuelve sola).
2. "Registrar avance" guarda por lote { día, máquina, cantidad }; se puede en varios
   días hasta cubrir todos los lotes.
3. La actividad pasa a **Cumplida** solo cuando **todos** sus lotes están registrados.
4. El % de cumplimiento del parcial es **proporcional a los lotes hechos**.
5. "Devolver al banco" reproduce la devolución actual (tarea → banco, reprogramada +1).
6. Se agrega la columna `avancePorLote` con su migración; Excel y el resto del flujo
   no cambian.

# Excel de cumplimiento: registro día a día + columna Finca — Design Spec

**Fecha:** 2026-07-02

## Objetivo

Que el Excel de cumplimiento (`/cumplimiento/exportar`) sea un **registro día a día**: capture, por día, los **avances**, las **culminadas**, las **novedades/cambios** (actividad reemplazada + su reemplazo, no cumplidas, reprogramadas) y las **nuevas**. Hoy colapsa cada actividad en una fila y omite las novedades. Además, añadir una **columna Finca**.

## Contexto (verificado en código)

- `src/dominio/cumplimiento-export.ts`: `filasCumplimiento(a, …)` ya emite **una fila por avance** (recorriendo `avancePorLote`: día·lote·cantidad) y, si no hay avances, **una fila resumen** con `haRealizada`. `filasCumplimientoGrupo(grupo, …)` toma **una fila representativa** del grupo (asume que las hermanas comparten la misma medida).
- `src/app/cumplimiento/exportar/route.ts`: agrupa por `tareaId` (`agruparPorActividad`) y **omite** los grupos cuyo estado no sea CUMPLIDA/PARCIAL (`if (e !== 'CUMPLIDA' && e !== 'PARCIAL') continue`, línea 69) → las NO_CUMPLIDA/REPROGRAMADA (cambios) no salen. `listarActividades`/`listarActividadesSolicitadas` incluyen `finca`, `motivo`, `nota`, `avancePorLote`, `lotes`; las solicitadas incluyen `area` (área ejecutora).
- **Modelos de datos distintos por área** (clave del rediseño):
  - **Maquinaria:** cada (día × responsable) es una **fila propia**, cerrada con su **propia** `haRealizada`/estado/día (o con `avancePorLote` propio). Agrupar y tomar una representativa **pierde los demás días** (el bug).
  - **Estándar (grupo):** las acciones de grupo consolidan el **mismo** `avancePorLote`/`haRealizada` en todas las hermanas → agrupar y emitir una vez es correcto (no duplica).
- Reemplazo (cambio de actividad, `registrarCumplimiento`): la fila original queda con estado (NO_CUMPLIDA/…) y `nota = "Cambiada por: X"`; se crea una **actividad nueva** CUMPLIDA (`noProgramada`) con `nota = "En reemplazo de: Y"`. Ambas direcciones quedan en la **nota**.
- Detección de maquinaria: `esMaquinaria(area, 'cumplimiento')` de `@/dominio/variante` (bandera `maqCumplimiento` del área).

## Diseño

### Columnas (`COLUMNAS_CUMPLIMIENTO`)

Añadir **`Finca`** (tras `Lote(s)`) y **`Observación`** (al final; lleva la `nota` de la actividad, que incluye "Cambiada por…"/"En reemplazo de…"/motivos escritos). Orden nuevo:
`Día, Fecha, Responsable, Actividad, Máquina, Lote(s), Finca, Estado, Medida realizada, Unidad, Bultos por lote, Centro de costo, Potreros realizados, Ejecutada por, Observación`.

`ActividadExport` gana `finca: { nombre: string } | null` y `nota: string | null`; `filasCumplimiento` añade esos dos valores a cada fila (avance y resumen), usando la finca de la actividad. La finca por-fila de avance es la de la actividad (no del lote).

### Modelo de filas (por área)

En `route.ts`, decidir por actividad según `esMaquinaria(areaDeLaActividad, 'cumplimiento')`:

- **Maquinaria → una fila por FILA (día·responsable), sin agrupar.** Por cada fila del grupo cuyo estado **no** sea PENDIENTE, llamar a `filasCumplimiento(fila, …)` (que emite por avance si tiene `avancePorLote`, o una fila resumen con su `haRealizada`). Así cada día/operario queda con su medida real; no se pierde ni se duplica.
- **Estándar → agrupar (como hoy), emitir por avance.** `filasCumplimientoGrupo(grupo, …)` (una vez, responsables unidos, avances del grupo). Incluir también cuando el estado agrupado sea **NO_CUMPLIDA/REPROGRAMADA** (novedad) — sale una fila con su estado + `Observación`.

En ambos casos **se incluyen** CUMPLIDA/PARCIAL/**NO_CUMPLIDA/REPROGRAMADA**; se **omite solo PENDIENTE** (sin evento). Se elimina el filtro de la línea 69 y se reemplaza por “omitir PENDIENTE”.

### Nuevas / reemplazos

Las actividades `noProgramada` (nuevas y los reemplazos CUMPLIDA) ya se exportan como actividades propias por las mismas reglas; con la `Observación` ("En reemplazo de: Y") queda claro el vínculo. La original reemplazada ahora **sí** aparece (al dejar de omitir NO_CUMPLIDA) con "Cambiada por: X".

### Ruta

- Pasar `finca`/`nota` en el mapeo `aExport` (vienen de `listarActividades`/`Solicitadas`).
- Calcular `esMaq` por actividad: propias → `esMaquinaria(area, 'cumplimiento')`; solicitadas → `esMaquinaria(grupo[0].area, 'cumplimiento')`.
- Ramar en `agregarGrupos`: maquinaria itera filas (`filasCumplimiento` por fila), estándar usa `filasCumplimientoGrupo`.

## Testing

- **Dominio (Vitest)** en `src/dominio/cumplimiento-export.test.ts` (ya existe): actualizar por las 2 columnas nuevas; añadir casos:
  - `filasCumplimiento` incluye `Finca` y `Observación` (nota) en filas de avance y en la fila resumen;
  - una actividad NO_CUMPLIDA con `nota="Cambiada por: X"` emite su fila (no se omite en dominio; el filtro de PENDIENTE vive en la ruta).
- **Ruta/RSC:** typecheck fiable + verificación en vivo (sin test unitario de la ruta).
- **Manual:** exportar una semana de **maquinaria** con una actividad de varios días (un día reemplazada por otra, otro día con avance) → aparecen: la fila del día reemplazado (con "Cambiada por…"), el reemplazo (CUMPLIDA, "En reemplazo de…"), y el avance del otro día, cada uno en su fila con su fecha; la columna Finca poblada. Repetir en **estándar** (una fila por avance, sin duplicar por responsable). Verificar que PENDIENTE no aparece.

## Fuera de alcance

- No se añade columna Motivo (la novedad se ve en Observación/nota); posible follow-up.
- No se cambia la captura ni el resumen; solo la exportación a Excel.
- El PDF/imagen del cronograma no cambia.

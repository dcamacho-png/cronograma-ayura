# Cumplimiento de maquinaria por actividad (avances + finalizar) — Design Spec

**Fecha:** 2026-07-02

## Objetivo

Unificar el cumplimiento de **maquinaria** al mismo modelo **por actividad** que el estándar (plan J/S): un solo control por actividad, se registran **avances** (por lote, con máquina, cantidad, centro de costo y día) que se acumulan, y un botón **Finalizar/Cumplida** cierra cuando terminan. Se quita la vista **por día programado** (`DiaMaquinaria`) y el "Registrar cumplimiento" directo. Además: mostrar el selector **"Día" en letras** (Lun–Dom) en el control estándar.

## Contexto (verificado en código)

- `src/app/cumplimiento/page.tsx`: rama `{esMaquinaria && (…)}` renderiza una **lista por día** (`diasOrdenados.map`) con un `DiaMaquinaria` por fila; la rama `{!esMaquinaria && (…)}` usa `ActividadEstandar` **por grupo** (cierre + avances + novedad + devolver).
- `DiaMaquinaria` (por fila) tiene "✓ Registrar cumplimiento" (medida directa, `required`), `FormAvanceLote` (máquina + cantidad + día por lote) y "registrar novedad".
- Grupo (existe): `filasHermanas`, `registrarAvanceLoteGrupo(id, dia, maquinaId, avances)`, `marcarCumplidaGrupo`, `registrarNovedadGrupo`; acciones `registrarAvanceLoteActividadAccion`, `marcarCumplidaActividadAccion`, `registrarNovedadActividadAccion`, `devolverAlBancoAccion`.
- `AvanceEntrada` (`src/dominio/avance-lote.ts`) = `{ dia, maquinaId, cantidad }`. `centroCosto` hoy es columna escalar de `Actividad` (se captura en el "Registrar cumplimiento").
- Unidad de maquinaria: del catálogo (`unidadDe(unidadPorNombre, descripcion)` → ha/hora/kg), mostrada con `etiquetaMedida`/`unidadAbreviada`.
- `CENTROS_COSTO` en `src/dominio/centro-costo.ts` (lista + "Otras…" texto libre), usado hoy en `DiaMaquinaria`.
- Excel (plan T): la ruta rama por área — maquinaria emite **por fila** (porque guarda medida por día). Al unificar, maquinaria guardará la medida en `avancePorLote` (grupo, como estándar) → el Excel de maquinaria debe usar el **mismo camino agrupado**.
- Control estándar (`ActividadEstandar`, plan S): el selector "Día" muestra el **número** (`{d}`), no el nombre.

## Diseño

### A. Centro de costo por avance (dominio + repo)

- `AvanceEntrada` gana `centroCosto?: string | null`.
- `agregarAvances(avance, dia, maquinaId, entradas, centroCosto?)` guarda `centroCosto` en cada entrada nueva; `registrarAvanceLoteGrupo(id, dia, maquinaId, avances, centroCosto?)` lo recibe y lo pasa. (JSON → sin migración.)

### B. Formulario de avance de maquinaria (centro de costo)

- `FormAvanceLote` (modo `esMaquinaria`) añade un selector **Centro de costo** (`CENTROS_COSTO` + "Otras…"→texto), junto a Día/Máquina. Se envía con el avance.
- Nueva acción `registrarAvanceMaquinariaAccion(form)`: lee `id`, `dia`, `maquinaId`, avances por lote (`loteAvance`/`cantidad_<id>`), y `centroCosto`; guard de plazo; `registrarAvanceLoteGrupo(id, dia, maquinaId, avances, centroCosto)`; revalida. (El estándar sigue usando su acción sin máquina/centro.)

### C. Control `ActividadMaquinaria` (por actividad) — nuevo

Client component, por grupo, en estado PENDIENTE/PARCIAL. Espejo estructural de `ActividadEstandar` pero con lo de maquinaria:
- **Unidad:** etiqueta del catálogo (ha/hora/kg), no selector.
- **Avances:** `FormAvanceLote` (esMaquinaria, con máquina + centro de costo) sobre los lotes de la actividad → `registrarAvanceMaquinariaAccion`.
- **Finalizar:** botón "✓ Cumplida" → `marcarCumplidaActividadAccion` (siempre visible, como tras el plan R).
- **Novedad:** toggle → `FormRegistrar` (esMaquinaria) → `registrarNovedadActividadAccion`.
- **Devolver al banco:** cuando PARCIAL.

### D. Página (`page.tsx`)

Reemplazar la rama `{esMaquinaria && (<ul por día>…DiaMaquinaria…</ul>)}` por el mismo patrón por-actividad de la rama estándar, usando `ActividadMaquinaria`: cabecera/estado del grupo, resumen de avances (solo lectura) y el control interactivo cuando PENDIENTE/PARCIAL. Se elimina el uso de `DiaMaquinaria` (y `DiaNoMaquinaria` si queda huérfano) en esa pantalla.

### E. Excel (ajuste del plan T)

- Como maquinaria pasa a guardar en `avancePorLote` (grupo), la ruta `exportar/route.ts` usa `filasCumplimientoGrupo` para **ambas** áreas (se elimina la rama maquinaria-por-fila y el detector `esMaquinaria` de la exportación). Se mantiene el filtro "solo lo que se hizo" (CUMPLIDA/PARCIAL).
- La columna **Centro de costo** por fila de avance sale de la entrada: en `filasCumplimiento`, el centro por fila de avance = `e.centroCosto ?? a.centroCosto ?? ''` (la fila resumen sigue con `a.centroCosto`).

### F. "Día" en letras (estándar)

En `ActividadEstandar` (plan S), el `<select name="dia">` muestra el nombre del día (Lun–Dom) como etiqueta manteniendo el valor 1–7 (usar un arreglo `DIAS` como el de `FormAvanceLote`).

## Testing

- **Dominio (Vitest):** `avance-lote.test.ts` — `agregarAvances` guarda `centroCosto` en la entrada; `cumplimiento-export.test.ts` — el centro por fila de avance usa `e.centroCosto` con fallback a `a.centroCosto`. (Ajustar los casos existentes por el fallback.)
- **Repo/acciones/UI/RSC:** typecheck fiable + verificación en vivo (sin test unitario).
- **Manual:** en un área de **maquinaria**, la actividad se ve como **un solo control** (no por día); registrar avances (máquina/cantidad/centro/día) que se acumulan; "Cumplida" finaliza; novedad y devolver funcionan; el Excel muestra el día a día (avances con su centro de costo) por el camino agrupado. En **estándar**, el selector "Día" muestra Lun–Dom.

## Fuera de alcance

- Resumen/tablero/programar no cambian.
- El estándar no cambia salvo el "Día" en letras.
- No se elimina `centroCosto` escalar de `Actividad` (se conserva; el avance ahora lo lleva por entrada).

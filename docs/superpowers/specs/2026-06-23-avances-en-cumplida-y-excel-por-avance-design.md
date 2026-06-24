# Avances visibles en CUMPLIDA + medida = suma + Excel una fila por avance — Diseño

**Fecha:** 2026-06-23

## Objetivo

Tres ajustes sobre la función de avances por lote (historial), ya en producción:

1. **El listado de avances debe verse también cuando la actividad está CUMPLIDA** (hoy solo se ve en PARCIAL).
2. **La medida final mostrada (ha/horas/bultos/kg) debe ser la suma de los avances** cuando la fila tiene avances, no un valor previo.
3. **En el Excel, una fila específica por cada avance** (hoy van todos concatenados en una sola celda "Avance por lote").

## Contexto del código actual

- `src/app/cumplimiento/page.tsx`
  - La medida de una fila no-pendiente se muestra en ~257: `· {a.haRealizada} {unidadAbreviada(unidad)}`.
  - El bloque de avances (`Progreso: …` + `Avances: …` + formulario + botones) vive **dentro** de `{a.estado === 'PARCIAL' && (() => { … })()}` (~271–311). Por eso desaparece al quedar CUMPLIDA.
  - Helpers ya disponibles en `@/dominio/avance-lote`: `normalizarAvancePorLote`, `textoAvanceConFecha`, `lotesPendientes`, `totalAvance`, `type AvanceEntrada`.
- `src/dominio/cumplimiento-export.ts`
  - `COLUMNAS_CUMPLIMIENTO` (13 columnas, la última es `'Avance por lote'`).
  - `filaCumplimiento(a, fecha, unidadPorNombre, avanceTexto)` devuelve **una** fila `(string|number)[]`.
- `src/app/cumplimiento/exportar/route.ts`
  - Filtra actividades `CUMPLIDA | PARCIAL`, calcula `avanceTexto` con `textoAvanceConFecha`, y agrega **una fila por actividad** con `filaCumplimiento`.

`avancePorLote` es JSON por fila-día (`Actividad`); cada entrada es `{ dia, maquinaId, cantidad }`. La medida realizada se guarda en el campo `haRealizada` (es la medida genérica, sin importar la unidad).

## Parte 1 — Pantalla (`/cumplimiento`)

### Cambios

1. **Extraer el cálculo de avances** fuera del branch PARCIAL, en el cuerpo de la fila no-pendiente, para reusarlo en la medida y en el listado:
   ```tsx
   const avances = normalizarAvancePorLote(
     a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
   )
   const tieneAvances = Object.values(avances).some((es) => es.length > 0)
   const etiquetaDia = (dia: number) =>
     `${DIAS[dia] ?? ''} ${fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}`.trim()
   const resumenAvances = textoAvanceConFecha(a.lotes, avances, unidadAbreviada(unidad), etiquetaDia)
   ```

2. **Medida = suma de avances cuando existan.** En la línea de la medida, si `tieneAvances`, mostrar `totalAvance(avances)` en lugar de `a.haRealizada`:
   ```tsx
   {(tieneAvances || a.haRealizada != null) && (
     <span className="text-gray-500">· {tieneAvances ? totalAvance(avances) : a.haRealizada} {unidadAbreviada(unidad)}</span>
   )}
   ```
   Aplica uniformemente (PARCIAL y CUMPLIDA): cuando hay avances, la medida mostrada es la suma. (`marcarCumplidaDesdeParcial` ya guarda esa suma en `haRealizada`; este cambio garantiza que la pantalla siempre la refleje.)

3. **Listado de avances en CUMPLIDA (solo lectura).** Mostrar el resumen de avances siempre que la fila tenga avances; el formulario y los botones (`FormAvanceLote`, "✓ Marcar cumplida", "Devolver al banco") siguen **solo** en PARCIAL.
   - Si `resumenAvances` (hay avances): mostrar `Avances: {resumenAvances}`.
   - El `Progreso: X de Y lotes` y los controles quedan dentro del branch `a.estado === 'PARCIAL'` como hoy.

### Estructura resultante de la fila no-pendiente

- Línea de estado + medida (medida = suma si hay avances).
- Si hay avances: `Avances: …` (solo lectura) — visible en CUMPLIDA y PARCIAL.
- Si PARCIAL: además `Progreso: …` + formulario + botones (igual que hoy).

## Parte 2 — Excel (`/cumplimiento/exportar`)

### Columnas

Quitar `'Avance por lote'`. Quedan 12:
`Día · Fecha · Responsable · Actividad · Máquina · Lote(s) · Estado · Medida realizada · Unidad · Bultos por lote · Centro de costo · Potreros realizados`

### Nueva función de dominio `filasCumplimiento`

En `src/dominio/cumplimiento-export.ts`, reemplazar `filaCumplimiento` (una fila) por `filasCumplimiento` que devuelve **un arreglo** de filas:

```ts
filasCumplimiento(
  a: ActividadExport,                 // + avancePorLote, lotes con {id, nombre}
  fecha: string,                      // fecha del día de la actividad (caso sin avances)
  unidadPorNombre: Record<string, string>,
  ctx: {
    fechaDeDia: (dia: number) => string,        // fecha corta del día del avance
    nombreMaquina: (maquinaId: string | null) => string,  // resuelve id→nombre
  },
): (string | number)[][]
```

Comportamiento:

- **Con avances** (al menos una entrada): una fila por cada entrada, recorriendo `a.lotes` en orden y dentro de cada lote sus entradas en orden (mismo orden que `textoAvanceConFecha`). Por fila:
  - `Día` = `DIAS[entrada.dia]`, `Fecha` = `ctx.fechaDeDia(entrada.dia)`.
  - `Lote(s)` = nombre del lote de la entrada (de `a.lotes` por id).
  - `Máquina` = `ctx.nombreMaquina(entrada.maquinaId)`; si la entrada no tiene máquina (`null`) y la actividad sí, cae al nombre de la máquina de la actividad (`a.maquina?.nombre ?? ''`).
  - `Medida realizada` = `entrada.cantidad`; `Unidad` = abreviada de la unidad de la actividad.
  - `Responsable`, `Actividad`, `Estado`, `Centro de costo`, `Bultos por lote`, `Potreros realizados` = valor de la actividad, **repetido** en cada fila (cada fila autocontenida y filtrable).
- **Sin avances** → una sola fila, idéntica a la actual (pero sin la columna "Avance por lote").

La función es pura: la resolución de fecha-por-día y de máquina-por-id se inyecta vía `ctx` (igual que hoy se inyecta `etiquetaDia` en `textoAvanceConFecha`). Normaliza internamente con `normalizarAvancePorLote`.

`ActividadExport` se extiende con:
```ts
avancePorLote: Record<string, AvanceEntrada | AvanceEntrada[]> | null
// (lotes ya es { id: string; nombre: string }[])
```

### Ruta `exportar/route.ts`

- Agregar `listarMaquinas` al `Promise.all`; construir `nombreMaquina(id)` desde un `Map<id, nombre>` (`null`/desconocido → `''`).
- Construir `fechaDeDia(dia)` desde `fechas` + `fmtFecha` (ya existe la lógica de `etiquetaDia`/`fmtFecha`).
- Por cada actividad filtrada, hacer *spread* de `filasCumplimiento(a, fecha, unidadPorNombre, { fechaDeDia, nombreMaquina })` en la hoja.
- Quitar el cálculo de `avanceTexto` y el import de `textoAvanceConFecha` si queda sin uso.

## Pruebas

- `src/dominio/cumplimiento-export.test.ts`:
  - Actualizar la prueba existente a la nueva firma (`filasCumplimiento` devuelve arreglo; sin columna "Avance por lote").
  - Actividad **con 2 avances** del mismo lote en días distintos → 2 filas, cada una con la **cantidad** de ese avance, su día/fecha, lote y máquina; columnas de actividad repetidas.
  - Actividad **con avances en 2 lotes** → filas en orden lote→día.
  - Actividad **sin avances** → 1 fila.
  - Verificar que `COLUMNAS_CUMPLIMIENTO` tiene 12 columnas y que cada fila respeta ese ancho.
- `src/dominio/avance-lote.ts`: sin cambios (helpers ya existen y están probados).

## Restricciones

- Sin migración de esquema (`avancePorLote` sigue siendo JSON).
- Comentarios en español; color de marca `#11603a`.
- No tocar el modelo de filas-día, la programación, ni el conteo de actividades.
- No cambiar el flujo de registro de avance ni el de "marcar cumplida"; solo visualización (pantalla) y formato de exportación (Excel).

## Self-Review

- **Cobertura del spec:** (1) listado en CUMPLIDA → Parte 1.3; (2) medida = suma → Parte 1.2; (3) Excel una fila por avance → Parte 2. ✅
- **Consistencia de tipos:** `filasCumplimiento` devuelve `(string|number)[][]`; la ruta hace spread. `ActividadExport` extendido con `avancePorLote`. `ctx.nombreMaquina`/`ctx.fechaDeDia` inyectados. ✅
- **Sin placeholders.** ✅
- **Alcance:** un solo plan de implementación. ✅

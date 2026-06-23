# Resumen de avances en la tarjeta + Excel de cumplidas/parciales sin restricción

**Fecha:** 2026-06-22

## Contexto

Continuación de [avance por lote en parciales](2026-06-22-avance-por-lote-parcial-design.md),
ya en producción. El `avancePorLote` guarda por lote `{ dia, maquinaId, cantidad }`, pero:
1. En la tarjeta, el detalle de avance se muestra sin la **fecha** (solo "lote: cantidad").
2. El Excel exige tener **todo registrado** para descargarse, y exporta **todas** las
   actividades sin el detalle de avance.

## Decisiones (acordadas)

1. **Tarjeta — resumen de avances con fecha.** En una actividad **Parcial**, mostrar una
   línea **"Avances:"** con, por cada lote realizado: **fecha · lote — cantidad unidad**
   (ej. `Lun 22 · R.OSO 3 — 3 ha`). Varios avances separados por `; `.
2. **Excel — quitar la restricción de descarga.** El botón "📥 Descargar Excel" queda
   **siempre disponible** (hoy se bloquea si hay pendientes). La otra restricción (registrar
   todo para **pasar a la siguiente semana**) se **mantiene**.
3. **Excel — solo Cumplidas y Parciales.** El Excel exporta únicamente actividades en
   estado **CUMPLIDA** o **PARCIAL**. Excluye Pendiente, No cumplida y Reprogramada.
4. **Excel — detalle de avance por lote.** Columna nueva con el mismo texto
   *fecha · lote — cantidad* por cada avance registrado de la actividad.

## A. Dominio — helper de texto con fecha

En `src/dominio/avance-lote.ts`, agregar:

```ts
// Resumen de avances con fecha: por cada lote realizado "<etiquetaDia> · <lote> — <cantidad> <unidad>".
// `etiquetaDia` traduce el número de día (1..7) a su etiqueta (ej. "Lun 22"); se inyecta para
// que el helper sea puro/testeable y no dependa del calendario.
export function textoAvanceConFecha(
  lotes: { id: string; nombre: string }[],
  avance: AvancePorLote | null | undefined,
  unidadAbrev: string,
  etiquetaDia: (dia: number) => string,
): string {
  if (!avance) return ''
  return lotes
    .filter((l) => l.id in avance)
    .map((l) => `${etiquetaDia(avance[l.id].dia)} · ${l.nombre} — ${avance[l.id].cantidad} ${unidadAbrev}`)
    .join('; ')
}
```

Pruebas (`avance-lote.test.ts`): con `etiquetaDia = (d) => \`D${d}\`` y unidad `ha`, dos lotes con
avance en días distintos producen `"D1 · L-A — 3 ha; D2 · L-B — 2 ha"`; sin avance devuelve `''`.

## B. Tarjeta (Registrar cumplimiento)

En `src/app/cumplimiento/page.tsx`, dentro de la sección PARCIAL (la que muestra "Progreso:
X de N lotes"), agregar una línea **"Avances:"** cuando haya al menos un avance:

```tsx
{textoAvanceConFecha(a.lotes, a.avancePorLote as AvancePorLote | null, unidadAbreviada(unidad),
  (dia) => `${DIAS[dia] ?? ''} ${fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}`.trim()) && (
  <span className="text-gray-600">
    Avances: {textoAvanceConFecha(a.lotes, a.avancePorLote as AvancePorLote | null, unidadAbreviada(unidad),
      (dia) => `${DIAS[dia] ?? ''} ${fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}`.trim())}
  </span>
)}
```

`DIAS`, `fechas`, `fmtFecha`, `unidadAbreviada`, `unidad` ya están en scope en la tarjeta.
La línea de **"Progreso: X de N lotes"** se mantiene pero se le **quita** el sufijo
`· {textoAvancePorLote}` (el detalle ahora vive en la línea "Avances:" con fecha). La línea
"Avances:" va justo debajo de "Progreso:". `textoAvancePorLote` puede quedar sin uso (se deja
exportado, sin eliminar, para no romper su test).

## C. Excel

### Columna nueva
En `src/dominio/cumplimiento-export.ts`:
- Agregar `'Avance por lote'` a `COLUMNAS_CUMPLIMIENTO` (al final, tras "Potreros realizados").
- `ActividadExport` suma `avancePorLote: AvancePorLote | null`.
- `filaCumplimiento(a, fecha, unidadPorNombre, avanceTexto)` recibe un parámetro nuevo
  `avanceTexto: string` (el texto ya formateado por el llamador) y lo agrega como última celda.
  *(El texto se calcula en la ruta, que tiene el calendario de la semana; mantiene `filaCumplimiento`
  simple y sin dependencia del calendario.)*

### Ruta de exportación
En `src/app/cumplimiento/exportar/route.ts`:
- **Filtrar**: exportar solo `actividades` con `estado === 'CUMPLIDA' || estado === 'PARCIAL'`.
- Para cada una, calcular `avanceTexto = textoAvanceConFecha(a.lotes, a.avancePorLote, unidadAbreviada(unidadDe(unidadPorNombre, a.descripcion)), etiquetaDia)`.
  `etiquetaDia` usa un arreglo local de nombres de día (`['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']`)
  más la fecha: `(dia) => \`${NOMBRES_DIA[dia] ?? ''} ${fechas[dia-1] ? fmtFecha(fechas[dia-1]) : ''}\`.trim()`,
  reutilizando las `fechas`/`fmtFecha` que ya calcula la ruta. (`unidadDe` y `unidadAbreviada` se
  importan de `@/dominio/unidad`.)
- Incluir `lotes` en el objeto (ya vienen de `listarActividades`) y `avancePorLote` en el spread a `filaCumplimiento`.

### Quitar la restricción de descarga (UI)
En `src/app/cumplimiento/page.tsx`, el botón "📥 Descargar Excel" hoy se renderiza como
`<span>` deshabilitado cuando `pendientes > 0`. Cambiarlo para que **siempre** sea el enlace
`<a href="/cumplimiento/exportar?...">`. **No** tocar el bloqueo de "pasar a la siguiente semana".

## Lo que NO cambia

- El cálculo de cumplimiento, el modelo de datos, la agrupación por actividad, el flujo de
  avance por lote (solo se añade su visualización con fecha y su export).
- El bloqueo de avance de semana (se mantiene).

## Pruebas

- **Dominio:** `textoAvanceConFecha` (casos de arriba) en `avance-lote.test.ts`.
- **Excel/UI:** verificación manual (typecheck + lint + navegador): el botón de Excel
  descarga aunque haya pendientes; el archivo trae solo Cumplidas/Parciales con la columna
  "Avance por lote" poblada; la tarjeta parcial muestra la línea "Avances:" con fechas.

## Criterios de aceptación

1. La tarjeta de una actividad parcial muestra "Avances: <fecha · lote — cantidad>".
2. El botón "📥 Descargar Excel" descarga sin importar si hay pendientes.
3. El Excel contiene solo actividades Cumplidas y Parciales.
4. El Excel tiene una columna "Avance por lote" con el detalle por lote (fecha + cantidad).
5. El bloqueo de "pasar a la siguiente semana" sigue vigente.

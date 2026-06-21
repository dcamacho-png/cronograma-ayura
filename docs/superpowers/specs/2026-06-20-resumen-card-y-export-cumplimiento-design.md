# Resumen: tarjeta de nuevas + Cumplimiento: exportar Excel

Estado: APROBADO (2026-06-20)

## Problema / petición

Dos mejoras independientes de reporte:

- **Resumen:** falta una **tarjeta destacada** (como Cumplimiento/Cumplidas/Reprogramadas) con el conteo de **actividades nuevas no programadas** de la semana/área.
- **Cumplimiento:** poder **descargar un Excel** con la información recopilada de la semana, una vez registradas todas las actividades.

## Decisiones acordadas

- El "📊 Detalle por estado" del Resumen **ya existe** y no se toca; solo se agrega la tarjeta de nuevas.
- Excel: formato **`.xlsx` real** (no CSV), generado en el servidor con la librería **exceljs**.
- Alcance del Excel: **área y semana actuales** (las que se ven en pantalla), una sola hoja.
- Botón **visible pero deshabilitado** (gris + tooltip) mientras haya actividades PENDIENTE; se habilita cuando no quedan pendientes (mismo patrón que el botón "Semana siguiente →").
- Columnas del Excel: **Día · Fecha · Responsable · Actividad · Máquina · Lote(s) · Estado · Medida realizada · Unidad**. Incluye todas las actividades del área/semana (programadas y no programadas).

## Parte A — Resumen: tarjeta "Nuevas (no programadas)"

- Archivo: `src/app/resumen/resumen-area.tsx`.
- En la grilla de tarjetas grandes (la del `grid ... lg:grid-cols-4`), agregar una tarjeta con estilo `rounded-2xl border p-5`:
  - Etiqueta: `Nuevas (no programadas)`.
  - Valor: `nuevas.length` (la variable `nuevas = actividades.filter((a) => a.noProgramada)` ya existe).
- Se muestra siempre (incluye `0`). Aparece igual en pantalla y en el PDF de resumen (mismo componente, usado por `resumen/page.tsx` y `resumen/exportar/page.tsx`).
- Nota de layout: con maquinaria ya hay 4 tarjetas (Cumplimiento, Cumplidas, Reprogramadas, Realizado) + esta = 5; el grid `lg:grid-cols-4` las acomoda en dos filas, lo cual es aceptable.

## Parte B — Cumplimiento: exportar Excel (.xlsx)

### Dependencia
- Agregar **`exceljs`** a `dependencies` (pura JS, funciona en funciones serverless de Vercel).

### Helper puro (testeable) — `src/dominio/cumplimiento-export.ts` (NUEVO)
Mapea una actividad a su fila del Excel. Pura → test unitario (TDD).

```ts
import { normalizarUnidad, unidadAbreviada, type Unidad } from './unidad'

export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad',
] as const

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const ESTADO_TXT: Record<string, string> = {
  PENDIENTE: 'Pendiente', CUMPLIDA: 'Cumplida', PARCIAL: 'Parcial',
  NO_CUMPLIDA: 'No cumplida', REPROGRAMADA: 'Reprogramada',
}

export type ActividadExport = {
  dia: number
  descripcion: string
  estado: string
  haRealizada: number | null
  responsable: { nombre: string }
  maquina: { nombre: string } | null
  lotes: { nombre: string }[]
}

// Devuelve la fila como objeto { columna: valor } en el orden de COLUMNAS_CUMPLIMIENTO.
// `fecha` es la fecha (string corto) del día, calculada por el llamador.
// `unidadPorNombre` deriva la unidad por la descripción de la actividad.
export function filaCumplimiento(
  a: ActividadExport,
  fecha: string,
  unidadPorNombre: Record<string, string>,
): (string | number)[] {
  const unidad: Unidad = normalizarUnidad(unidadPorNombre[a.descripcion])
  return [
    DIAS[a.dia] ?? '',
    fecha,
    a.responsable.nombre,
    a.descripcion,
    a.maquina?.nombre ?? '',
    a.lotes.map((l) => l.nombre).join(', '),
    ESTADO_TXT[a.estado] ?? a.estado,
    a.haRealizada ?? '',
    a.haRealizada == null ? '' : unidadAbreviada(unidad),
  ]
}
```

### Route Handler — `src/app/cumplimiento/exportar/route.ts` (NUEVO)
- `GET` con query `?area=&anio=&semana=`.
- Auth: `const u = await usuarioActual(); if (!u) redirect('/login')`. Área: admin cualquiera válida; usuario de área forzado a la suya (misma lógica que `cumplimiento/page.tsx`).
- Trae `listarActividades(areaId, anio, semana)` y `listarActividadesEstipuladas()`; arma `unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))` y `fechas = fechasDeSemana(anio, semana)` (fecha por día con `Intl.DateTimeFormat('es-CO', { day:'numeric', month:'short', timeZone:'UTC' })`).
- Construye el workbook con exceljs: una hoja "Cumplimiento", fila de encabezado = `COLUMNAS_CUMPLIMIENTO` (en negrita), y una fila por actividad usando `filaCumplimiento(a, fechaDelDia, unidadPorNombre)`. Orden: por `dia` asc, luego responsable.
- Responde el buffer con:
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="cumplimiento-<area>-S<semana>-<anio>.xlsx"` (nombre de área saneado: espacios→`-`, sin caracteres raros).
- Runtime Node (por defecto en route handlers; exceljs no corre en edge).

### Botón en `src/app/cumplimiento/page.tsx`
- En la barra de acciones de arriba (donde está "Cumplido: X%" y los contadores), agregar el botón:
  - Si `pendientes === 0`: `<a href="/cumplimiento/exportar?area=${areaId}&anio=${anio}&semana=${semana}">📥 Descargar Excel</a>` (estilo verde/borde como los demás).
  - Si `pendientes > 0`: un `<span>` gris, `cursor-not-allowed`, `title="Registra todas las actividades para descargar el Excel"`.
- `pendientes` ya se calcula en la página.

## Qué NO cambia

- El "Detalle por estado", la lista de nuevas, y el resto del Resumen.
- Los flujos de registro, programar, banco, login.
- No se incluyen columnas de Motivo ni Observación en el Excel (solo Estado, además de las base y la medida).

## Pruebas

- `filaCumplimiento` (pura) → test unitario: cubre actividad de ha con medida, de hora, de kg, sin medida (medida y unidad vacías), descripción fuera del catálogo (unidad ha), máquina/lotes vacíos. La columna Unidad queda vacía cuando no hay medida.
- `npx tsc --noEmit`, `npm run lint`, `npm test` (suite actual 76 → crece) verdes.
- Verificación manual (tras desplegar): con todas las actividades registradas, el botón se habilita y descarga un `.xlsx` que abre en Excel con las columnas acordadas; con pendientes, el botón está gris. La tarjeta de nuevas muestra el conteo correcto en Resumen y en el PDF.

## Despliegue

- `git push` (respaldo) + **deploy manual por CLI**: `npx vercel --prod --yes --scope ayura-llanos` (el auto-deploy GitHub→Vercel no está conectado). El build corre `prisma migrate deploy && next build`; esta feature **no** agrega migraciones.

## Notas

- exceljs aumenta un poco el bundle del route handler, pero no afecta el resto de la app (se importa solo en la ruta de exportar).

# Bultos por lote al crear tareas de fertilización/encalada

Estado: APROBADO (2026-06-20)

## Problema / petición

Las actividades que aplican insumo granulado en varios lotes deben permitir registrar, **al crear la tarea**, la **cantidad de bultos por cada lote**. Ese dato debe verse luego en Cumplimiento, en el cronograma/PDF de Programar y en el Excel de cumplimiento.

## Decisiones acordadas

- **Actividades con bultos** (exactas, del catálogo): `FERTILIZACION GRANULADA`, `ENCALADORA`, `FERTILIZACION POLLINAZA`. Para estas se habilita selección de **varios lotes** (ENCALADORA hoy no lo permite — lo gana) y captura de bultos por lote.
- La captura es **al crear la tarea de maquinaria** (`FormNuevaTareaMaquinaria`), no al asignarla. La asignación solo **propaga** el dato.
- Bultos: **decimales**, **opcional** por lote.
- Se guarda en `bultosPorLote Json?` (mapa `{ loteId: number }`) en **`Tarea`** (al crear) y en **`Actividad`** (copiado al asignar, para mostrarlo donde se muestra la actividad).
- Visible en: **Cumplimiento**, **Excel de cumplimiento** (columna nueva) y **grilla/PDF de Programar** (vía `InfoLotes`). **No** en Resumen.
- UI de captura: **picker dedicado** (finca → lotes como filas con checkbox + input de bultos), solo para las 3 actividades. Las demás siguen con el selector de un lote actual.

## Actividades con bultos (helper)

`src/dominio/bultos.ts` (NUEVO, puro y testeable):

```ts
export const ACTIVIDADES_CON_BULTOS = ['FERTILIZACION GRANULADA', 'ENCALADORA', 'FERTILIZACION POLLINAZA']

export type BultosPorLote = Record<string, number>

export function usaBultos(descripcion: string): boolean {
  return ACTIVIDADES_CON_BULTOS.includes(descripcion.trim().toUpperCase())
}

// Texto "L1: 3, L2: 2.5" (solo lotes con bulto numérico). Vacío si no hay.
export function textoBultosPorLote(
  lotes: { id: string; nombre: string }[],
  bultos: BultosPorLote | null | undefined,
): string {
  if (!bultos) return ''
  return lotes
    .filter((l) => typeof bultos[l.id] === 'number')
    .map((l) => `${l.nombre}: ${bultos[l.id]}`)
    .join(', ')
}
```

- Test: `usaBultos` acepta las 3 (con espacios/minúsculas) y rechaza otras; `textoBultosPorLote` mapea solo lotes con bulto, ignora lotes sin valor, devuelve `''` con `null`.

## Modelo de datos

Migración **aditiva** `prisma/migrations/<ts>_bultos_por_lote/migration.sql`:

```sql
ALTER TABLE "Tarea" ADD COLUMN "bultosPorLote" JSONB;
ALTER TABLE "Actividad" ADD COLUMN "bultosPorLote" JSONB;
```

Schema:

```prisma
model Tarea {
  // ...
  bultosPorLote Json?
}
model Actividad {
  // ...
  bultosPorLote Json?
}
```

- Columnas nullable; null = sin bultos (todas las actividades que no son de las 3, o sin dato).

## Captura — `FormNuevaTareaMaquinaria` + acción + repo

- En `src/app/tareas/form-nueva-tarea-maquinaria.tsx`: cuando `usaBultos(estipulada)` (reemplaza al `esFertilizacion` actual para el control de lotes), en vez de `SelectFincaLote multiple` se usa un **picker dedicado** (componente nuevo, p. ej. `PickerLotesBultos`):
  - `<select>` de finca → muestra los lotes de esa finca como filas con **checkbox** + input numérico **bultos** (`step="0.1"`, `min="0"`, opcional).
  - Por cada lote marcado, emite hidden `<input name="loteId" value={id}>` y `<input name="bultos_{id}" value={bultos}>`. La selección persiste aunque cambie de finca (estado en el componente).
  - Para actividades que NO usan bultos: queda el `SelectFincaLote` de un lote actual.
- `crearTareaAccion` (`src/app/tareas/acciones.ts`): además de `loteIds = form.getAll('loteId')`, arma `bultosPorLote` leyendo `bultos_<loteId>` (numeroOpcional) de cada lote; pasa `bultosPorLote` (o null si vacío) a `crearTarea`.
- `crearTarea(areaId, descripcion, loteIds, bultosPorLote)` (`src/datos/repositorio.ts`): nuevo parámetro `bultosPorLote: BultosPorLote | null`; lo guarda en `data.bultosPorLote`.

## Propagación — `asignarTarea`

- `asignarTarea` ya trae la `tarea`. Al crear cada actividad del día, setear `bultosPorLote: tarea.bultosPorLote ?? undefined` (mismo mapa en todas las actividades creadas). Sin cambios de firma.

## Visualización

### `InfoLotes` (cubre grilla, PDF y Cumplimiento)
`src/app/_componentes/info-lotes.tsx`:
- El tipo de lote pasa a `{ id: string; nombre: string; hectareas: number | null }` (el `id` ya viene en los datos).
- Nueva prop opcional `bultosPorLote?: BultosPorLote | null`.
- Si hay bultos para un lote, se muestra por lote: `📍 L1 (3 bultos) · L2 (2.5 bultos) · 5.0 ha`. Sin `bultosPorLote`, idéntico a hoy (retrocompatible).
- Callers que pasan bultos: `grilla-semana.tsx` y `cumplimiento/page.tsx` agregan `bultosPorLote={a.bultosPorLote as BultosPorLote | null}`. `tareas/page.tsx` se deja igual (sin la prop).

### Excel de cumplimiento
- `COLUMNAS_CUMPLIMIENTO` gana una 10ª columna **"Bultos por lote"**.
- `filaCumplimiento` recibe los lotes con `id` y el `bultosPorLote` de la actividad, y agrega `textoBultosPorLote(lotes, bultosPorLote)` como último valor. Se actualiza el test del helper.
- `ActividadExport.lotes` pasa a `{ id: string; nombre: string }[]` y se agrega `bultosPorLote: BultosPorLote | null`.
- El route handler pasa `a.bultosPorLote` (casteado) al helper.

## Qué NO cambia

- Resumen, login, el flujo de cambio de actividad.
- La asignación desde el banco NO pide bultos (solo propaga el dato de la tarea).
- `form-solicitar.tsx` (solicitudes entre áreas) queda igual: no captura bultos por ahora (se puede agregar después si se necesita).
- No se renombra ni cambia la relación actividad↔lote ni tarea↔lote.

## Pruebas

- `usaBultos` y `textoBultosPorLote` (puros) → tests unitarios.
- `filaCumplimiento`: nuevo caso que verifica la columna "Bultos por lote" (con y sin bultos).
- `npx tsc --noEmit`, `npm run lint`, `npm test` (suite 82 → crece) verdes.
- Verificación manual (tras desplegar): crear una tarea de FERTILIZACION GRANULADA con 2 lotes y bultos distintos; asignarla; ver los bultos por lote en la grilla, en el PDF, en Cumplimiento y en el Excel.

## Despliegue

- `git push` (respaldo) + **deploy manual por CLI**: `npx vercel --prod --yes --scope ayura-llanos`. El build corre `prisma migrate deploy && next build` → aplica la migración aditiva. Sin pérdida de datos.

## Notas

- JSON (`JSONB`) basta porque el dato solo se muestra (no se agrega en SQL; no va en Resumen).
- Tareas/actividades existentes quedan con `bultosPorLote = null` (sin bultos), comportamiento idéntico al actual.

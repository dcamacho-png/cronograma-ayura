# Editar potreros de una actividad estándar (cumplimiento) — Design Spec

**Fecha:** 2026-07-01

## Objetivo

En la versión **estándar** (no maquinaria) del cumplimiento, permitir **editar la lista de potreros** (lotes) de una actividad que ya tiene potreros: agregar, cambiar o quitar. Así, antes de marcar cumplida, la actividad queda apuntando a los potreros reales donde se ejecutó.

## Contexto (verificado en código)

- `src/app/cumplimiento/actividad-estandar.tsx` (Client Component, `useState`) es el control de una actividad estándar. Con potreros usa `FormAvanceLote` (avance por lote) sobre `lotesActividad`; el cierre es `marcarCumplida`. Recibe además `lotesCatalogo: { id; nombre; finca: { nombre } }[]` y `lotesActividad: { id; nombre }[]`.
- Los potreros se fijan al **programar** (Prisma `lotes: { connect }`) en cada fila; **no hay** forma de editarlos en el cumplimiento.
- El cumplimiento opera **por actividad** (grupo `tareaId`): `filasHermanas(id)` (`src/datos/repositorio.ts`) devuelve todas las filas del grupo; las acciones de grupo aplican el cambio a todas dentro de una `$transaction`.
- Las acciones de cumplimiento (`src/app/cumplimiento/acciones.ts`) siguen un patrón: leen `id`, `if (await bloqueadoPorPlazoActividad(id)) return` (guard de plazo), llaman al repositorio y `revalidatePath('/cumplimiento')`.
- Avances: se guardan por `loteId` en `avancePorLote`; `totalAvanceLotes`/`lotesPendientes` recorren **los lotes vigentes de la actividad**, así que quitar un potrero hace que su avance deje de contar y agregar uno lo mete como pendiente — sin limpieza extra.
- La finca de la actividad se deriva del primer lote al crearla (`fincaId`).

## Diseño

### Repositorio — `src/datos/repositorio.ts`

Nueva función que fija los potreros de todo el grupo:

```ts
export async function setLotesGrupo(id: string, loteIds: string[])
```
- Usa `filasHermanas(id)`; si no existe → `null`.
- Exige `loteIds.length >= 1` (debe quedar al menos un potrero); si vacío → `null`.
- Deriva la finca del **primer** `loteId` (busca el lote; si no existe → `null`).
- En una `$transaction`, para **cada fila del grupo**: `lotes: { set: loteIds.map(...) }` (reemplaza el conjunto) y `fincaId` = finca del primer lote.
- Devuelve `true` al terminar.

### Acción — `src/app/cumplimiento/acciones.ts`

```ts
export async function setLotesActividadAccion(form: FormData)
```
- Lee `id` y los `loteId` marcados (`form.getAll('loteId')`).
- `if (!id) return`; `if (await bloqueadoPorPlazoActividad(id)) return` (respeta el plazo); `if (loteIds.length === 0) return` (no permitir dejar sin potreros).
- Llama a `setLotesGrupo(id, loteIds)` y `revalidatePath('/cumplimiento')`.
- Importar `setLotesGrupo` del repositorio.

### UI — `src/app/cumplimiento/actividad-estandar.tsx`

- Nueva prop `editarPotreros: (f: FormData) => void | Promise<void>`.
- Solo cuando `tieneLotes`: un botón **"Editar potreros"** que alterna (con `useState`) un formulario con un **checklist** de `lotesCatalogo` (cada uno con su finca entre paréntesis), con los `lotesActividad` **premarcados** (`defaultChecked`). Checkboxes `name="loteId" value={lote.id}`, `input hidden name="id"`, botón "Guardar potreros" + "cancelar".
- Tras guardar, la actividad queda con esos potreros; el avance y "marcar cumplida" operan sobre la lista nueva.

### Página — `src/app/cumplimiento/page.tsx`

- Pasar `editarPotreros={setLotesActividadAccion}` a `ActividadEstandar` (ya le pasa `lotesCatalogo` y `lotesActividad`). Importar la nueva acción.

## Alcance / límites

- Solo **estándar** (el control `ActividadEstandar`); maquinaria no cambia.
- Solo actividades que **ya tienen potreros** (`tieneLotes`). Activar potreros en una actividad sin ninguno queda fuera de alcance.
- Editar potreros afecta **todas las filas-hermanas** de la actividad esa semana; no toca el catálogo de potreros ni otras semanas.
- Respeta el bloqueo por **plazo vencido** (mismo guard que las demás acciones).

## Testing

- Repositorio/acción/UI: sin tests unitarios (convención del repo); se verifica con **typecheck fiable** (tsconfig que excluye `.next`) + en vivo.
- Manual: en una actividad estándar con potreros, "Editar potreros" → agregar/quitar/cambiar y guardar; confirmar que la actividad queda con los potreros elegidos, que el avance y "marcar cumplida" operan sobre ellos, que exige ≥1 potrero, que respeta el plazo vencido, y que maquinaria no cambia.

## Fuera de alcance

- No se cambia cómo se captura el avance ni el cierre; solo se puede editar el conjunto de potreros.
- No se crea/edita el catálogo de potreros (eso ya vive en Configuración).

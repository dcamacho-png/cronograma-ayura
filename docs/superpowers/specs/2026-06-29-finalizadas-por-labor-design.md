# "Finalizadas por labor" en el resumen — Design Spec

**Fecha:** 2026-06-29

## Objetivo

Cambiar la tarjeta de ranking del resumen (`/resumen`):
- En áreas **estándar** (no maquinaria): **quitarla**.
- En áreas de **maquinaria**: reemplazarla por una lista **"Finalizadas por labor"** que muestra, por cada labor (descripción) con actividades finalizadas, el **tractor** que más la finalizó y el **responsable** que más la completó.

## Contexto (verificado en código)

- `src/app/resumen/resumen-area.tsx` recibe `esMaquinaria: boolean` (ya lo usa para "Realizado" y "Realizado por actividad").
- Hoy la tarjeta "⭐ Ranking (finalizadas)" (≈ líneas 185-203) usa `extremosFinalizadas(dominio)` → `{ mas, menos }` por responsable, y se muestra para **todas** las áreas, dentro de un grid de 2 columnas junto a "⚠️ Motivos más frecuentes".
- `extremosFinalizadas` vive en `src/dominio/resumen.ts`; su único consumidor es `resumen-area.tsx` (más sus tests en `resumen.test.ts`).
- Agrupador por actividad: `agruparPorActividad` (clave `tareaId ?? "solo:${id}"`) y `estadoActividad` (estado común o `PARCIAL` si hay mezcla), en `src/dominio/metricas.ts`.
- El tipo de dominio `Actividad` tiene `responsableId: string`, `maquinaId?: string | null`, `descripcion`, `estado`, `tareaId`. Las filas que llegan al componente (`ActividadResumen`) traen además `responsable.nombre` y `maquina.nombre` (y, en runtime, `maquinaId`).

## Diseño

### Función de dominio nueva — `src/dominio/resumen.ts`

```ts
export interface TopConteo {
  id: string
  conteo: number
}
export interface FilaLabor {
  descripcion: string
  total: number                 // nº de actividades finalizadas de esta labor
  tractor: TopConteo | null     // maquinaId + conteo (null si ninguna finalizada tuvo tractor)
  responsable: TopConteo | null // responsableId + conteo (null si no hay)
}

export function finalizadasPorLabor(actividades: Actividad[]): FilaLabor[]
```

**Lógica:**
- Agrupar por `tareaId` (`agruparPorActividad`). Considerar solo los grupos cuyo `estadoActividad(grupo) === 'CUMPLIDA'` (finalizadas).
- Por cada grupo finalizado (descripción = la del grupo): sumar **1** a esa labor; para cada `responsableId` **distinto** del grupo, +1 al responsable; para cada `maquinaId` **distinto y no nulo** del grupo, +1 al tractor.
- Por cada labor, `tractor` = el de mayor conteo; `responsable` = el de mayor conteo. Empate → menor `id` (determinista). `tractor` es `null` si ninguna finalizada de esa labor tuvo máquina.
- Devolver la lista ordenada por `total` desc; empate → `descripcion` asc.

### Componente — `src/app/resumen/resumen-area.tsx`

- Añadir `maquinaId: string | null` al tipo `ActividadResumen` (existe en runtime; se necesita para resolver el nombre del tractor).
- Construir un mapa `maquinaId → nombre` a partir de `actividades` (filas con `maquina`), análogo al `nombrePorId` de responsables que ya existe.
- Reemplazar la tarjeta "⭐ Ranking (finalizadas)":
  - Si **no** es maquinaria: no renderizar nada en su lugar (el grid queda solo con "Motivos más frecuentes").
  - Si es maquinaria: renderizar **"🏁 Finalizadas por labor"** con `finalizadasPorLabor(dominio)`: una fila por labor, mostrando `descripcion`, y a la derecha `🚜 {nombreTractor} ({tractor.conteo})` (si `tractor` no es null) y `👤 {nombreResp} ({responsable.conteo})`. Si la lista está vacía, un texto "Sin actividades finalizadas.".
- Quitar la llamada a `extremosFinalizadas` y las variables `mas`/`menos`.

### Limpieza

- Eliminar `extremosFinalizadas` y la interfaz `FilaFinalizadas` de `src/dominio/resumen.ts` (quedan sin uso) y sus tests en `src/dominio/resumen.test.ts`.

## Testing

- **Dominio (Vitest)** en `src/dominio/resumen.test.ts`: tests de `finalizadasPorLabor`:
  - cuenta por actividad (una tarea multi-día CUMPLIDA cuenta 1, no por días);
  - una actividad con 2 responsables suma 1 a cada uno; con 2 tractores, 1 a cada uno;
  - ignora actividades no finalizadas (PARCIAL/NO_CUMPLIDA/PENDIENTE/REPROGRAMADA);
  - elige el tractor/responsable de mayor conteo y ordena las labores por total desc;
  - `tractor: null` cuando la labor finalizada no tuvo máquina.
- **Componente/RSC:** typecheck fiable (tsconfig que excluye `.next`) + verificación en vivo.
- **Verificación manual:** en un área estándar, el resumen ya no muestra el ranking; en maquinaria, "Finalizadas por labor" lista las labores con su tractor y responsable top y sus conteos.

## Fuera de alcance

- No se cambian las demás tarjetas (Cumplimiento %, Cumplidas/total, Realizado, Realizado por actividad, Motivos, Cambiadas/reprogramadas, Nuevas).
- No se toca cómo se captura ni almacena nada; es solo presentación + una función de lectura.

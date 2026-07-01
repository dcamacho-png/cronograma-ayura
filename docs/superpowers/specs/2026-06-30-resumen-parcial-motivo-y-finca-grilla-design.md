# Resumen PARCIAL con motivo + finca en grilla de maquinaria — Design Spec

**Fecha:** 2026-06-30

Dos cambios pequeños e independientes. (El tercer pedido del usuario —editar/anexar potreros al marcar cumplida en la versión estándar— se trata en un ciclo aparte.)

---

## #1 — "Cambiadas o reprogramadas" no debe incluir PARCIAL por avance normal

### Problema

La sección "🔄 Actividades cambiadas o reprogramadas" del resumen usa `actividadesConCambio` (`src/dominio/resumen.ts`), que hoy incluye **todas** las actividades cuyo estado agrupado es `PARCIAL`, `NO_CUMPLIDA` o `REPROGRAMADA`. Pero una actividad queda `PARCIAL` simplemente por registrar un **avance normal** (sin motivo), y eso no es un "cambio/reprogramación". Verificado: `registrarAvanceLote(Grupo)` deja `PARCIAL` sin motivo; solo una **novedad** (`registrarNovedad…`, que exige `motivoId`) deja `PARCIAL` con motivo. `NO_CUMPLIDA`/`REPROGRAMADA` siempre llevan motivo.

### Diseño

En `actividadesConCambio` (`src/dominio/resumen.ts`), cambiar el criterio de inclusión por grupo (`agruparPorActividad` + `estadoActividad`):
- `NO_CUMPLIDA` o `REPROGRAMADA` → se incluye siempre (como hoy).
- `PARCIAL` → se incluye **solo si alguna fila del grupo tiene `motivoId`** (novedad registrada).
- Cualquier otro estado → no se incluye.

La fila representativa (menor día) y el orden final (`vecesReprogramada` desc, luego `dia` asc) no cambian.

Implementación de referencia:
```ts
const ESTADOS_CAMBIO_SIEMPRE = ['NO_CUMPLIDA', 'REPROGRAMADA']

export function actividadesConCambio(actividades: Actividad[]): Actividad[] {
  const reps: Actividad[] = []
  for (const filas of agruparPorActividad(actividades).values()) {
    const estado = estadoActividad(filas)
    const esCambio =
      ESTADOS_CAMBIO_SIEMPRE.includes(estado) ||
      (estado === 'PARCIAL' && filas.some((f) => f.motivoId))
    if (!esCambio) continue
    const base = [...filas].sort((a, b) => a.dia - b.dia)[0]
    reps.push(base)
  }
  return reps.sort((a, b) => b.vecesReprogramada - a.vecesReprogramada || a.dia - b.dia)
}
```
(Se elimina la constante `ESTADOS_CON_CAMBIO` anterior.)

### Testing (`src/dominio/resumen.test.ts`)

- Actualizar el test existente "incluye solo PARCIAL / NO_CUMPLIDA / REPROGRAMADA…": la actividad PARCIAL de ese caso (`id '3'`) debe llevar `motivoId` para seguir apareciendo (orden `['4','5','3']`).
- Añadir un caso: una actividad `PARCIAL` **sin** motivo NO aparece; una `PARCIAL` **con** motivo sí.
- Los casos de "no muta" y "una actividad con varias filas aparece una vez" (NO_CUMPLIDA) siguen válidos.

---

## #2 — Finca por actividad en la grilla de maquinaria

### Diseño

En la grilla del cronograma (`src/app/programar/grilla-semana.tsx`), mostrar la **finca** de cada actividad, solo cuando `esMaquinaria`.

- Añadir `finca: { nombre: string } | null` al tipo `ActividadGrilla`. Los datos ya llegan: `listarActividades` incluye `finca`, y `page.tsx` pasa `actividadesCronograma` a la grilla (visible y a la oculta de export).
- En cada celda de actividad, junto a la línea de máquina, añadir (solo si `esMaquinaria` y hay finca) una línea pequeña **🏠 {finca.nombre}**, con el mismo escalado de texto que las demás sub-líneas: `text-xs` normal, `text-sm` en modo export (`paraExportar`).
- Como la grilla de export (imagen y PDF) usa el mismo componente `GrillaSemana`, la finca aparece **también en la imagen descargada y el PDF** (deseado).

Sin cambios de comportamiento: es solo presentación.

### Testing

- Componente/RSC: **typecheck fiable** (tsconfig que excluye `.next`) + verificación en vivo (no lleva tests unitarios).
- Manual: en un área de maquinaria, cada actividad de la grilla muestra 🏠 finca; se ve en pantalla y en la imagen/PDF exportados; en áreas no-maquinaria la grilla no cambia.

---

## Fuera de alcance

- El pedido #3 (cambiar/anexar potreros al marcar cumplida en la versión estándar) — ciclo aparte.
- No se cambia cómo se captura/guarda nada; #1 es un ajuste de criterio de lectura y #2 es presentación.
- La finca en la grilla se muestra solo en maquinaria (según lo pedido); extenderla a áreas estándar sería un cambio aparte.

import type { Actividad } from './tipos'

export type ColorPorcentaje = 'gris' | 'verde' | 'amarillo' | 'rojo'

// Color semáforo para un % de cumplimiento (número grande / barras).
export function colorPorcentaje(pct: number | null): ColorPorcentaje {
  if (pct === null) return 'gris'
  if (pct >= 80) return 'verde'
  if (pct >= 60) return 'amarillo'
  return 'rojo'
}

const ESTADOS_CON_CAMBIO = ['PARCIAL', 'NO_CUMPLIDA', 'REPROGRAMADA']

// Actividades que "cambiaron" en la semana (no cumplidas del todo o reprogramadas),
// ordenadas por veces reprogramada (desc) y luego por día (asc). No muta la entrada.
export function actividadesConCambio(actividades: Actividad[]): Actividad[] {
  return actividades
    .filter((a) => ESTADOS_CON_CAMBIO.includes(a.estado))
    .sort((a, b) => b.vecesReprogramada - a.vecesReprogramada || a.dia - b.dia)
}

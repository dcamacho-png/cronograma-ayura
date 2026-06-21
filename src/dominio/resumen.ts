import type { Actividad } from './tipos'
import type { Unidad } from './unidad'

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

export interface FilaFinalizadas {
  responsableId: string
  finalizadas: number
}

// Entre los responsables con actividades, el que más finalizó (CUMPLIDA) y el que menos.
export function extremosFinalizadas(
  actividades: Actividad[],
): { mas: FilaFinalizadas | null; menos: FilaFinalizadas | null } {
  const conteo = new Map<string, number>()
  for (const a of actividades) {
    const prev = conteo.get(a.responsableId) ?? 0
    conteo.set(a.responsableId, prev + (a.estado === 'CUMPLIDA' ? 1 : 0))
  }
  const filas: FilaFinalizadas[] = [...conteo.entries()].map(([responsableId, finalizadas]) => ({
    responsableId,
    finalizadas,
  }))
  if (filas.length === 0) return { mas: null, menos: null }
  filas.sort((a, b) => b.finalizadas - a.finalizadas)
  return { mas: filas[0], menos: filas[filas.length - 1] }
}

export function conteoPorEstado(actividades: Actividad[]): Record<string, number> {
  const r: Record<string, number> = {
    PENDIENTE: 0,
    CUMPLIDA: 0,
    PARCIAL: 0,
    NO_CUMPLIDA: 0,
    REPROGRAMADA: 0,
  }
  for (const a of actividades) {
    if (a.estado in r) r[a.estado] += 1
  }
  return r
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function hectareasRealizadas(
  filas: { estado: string; haProgramada: number; haRealizada: number | null }[],
): number {
  let total = 0
  for (const f of filas) {
    if (f.estado === 'PENDIENTE') continue
    total += f.haRealizada ?? (f.estado === 'CUMPLIDA' ? f.haProgramada : 0)
  }
  return r1(total)
}

// Totaliza la medida realizada por unidad. La medida explícita (haRealizada)
// gana; si no hay, solo se deriva de la ha programada cuando la unidad es 'ha'
// y la actividad está CUMPLIDA. Las PENDIENTE se ignoran.
export function medidasPorUnidad(
  filas: { estado: string; haProgramada: number; haRealizada: number | null; unidad: Unidad }[],
): Record<Unidad, number> {
  const tot: Record<Unidad, number> = { ha: 0, hora: 0, kg: 0 }
  for (const f of filas) {
    if (f.estado === 'PENDIENTE') continue
    const medida = f.haRealizada ?? (f.unidad === 'ha' && f.estado === 'CUMPLIDA' ? f.haProgramada : 0)
    tot[f.unidad] += medida
  }
  return { ha: r1(tot.ha), hora: r1(tot.hora), kg: r1(tot.kg) }
}

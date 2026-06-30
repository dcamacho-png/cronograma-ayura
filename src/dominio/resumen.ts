import type { Actividad } from './tipos'
import type { Unidad } from './unidad'
import { agruparPorActividad, estadoActividad } from './metricas'

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
  const reps: Actividad[] = []
  for (const filas of agruparPorActividad(actividades).values()) {
    if (!ESTADOS_CON_CAMBIO.includes(estadoActividad(filas))) continue
    // Fila representativa: la de menor día (conserva descripción, responsable, motivo, nota).
    const base = [...filas].sort((a, b) => a.dia - b.dia)[0]
    reps.push(base)
  }
  return reps.sort((a, b) => b.vecesReprogramada - a.vecesReprogramada || a.dia - b.dia)
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
  const tot: Record<Unidad, number> = { ha: 0, hora: 0, kg: 0, cantidad: 0 }
  for (const f of filas) {
    if (f.estado === 'PENDIENTE') continue
    const medida = f.haRealizada ?? (f.unidad === 'ha' && f.estado === 'CUMPLIDA' ? f.haProgramada : 0)
    tot[f.unidad] += medida
  }
  return { ha: r1(tot.ha), hora: r1(tot.hora), kg: r1(tot.kg), cantidad: r1(tot.cantidad) }
}

export interface TopConteo {
  id: string
  conteo: number
}

export interface FilaLabor {
  descripcion: string
  total: number
  tractor: TopConteo | null
  responsable: TopConteo | null
}

// Por cada labor (descripción) con actividades finalizadas (CUMPLIDA), el tractor y el
// responsable que más la finalizaron. Cuenta por actividad (grupo tareaId); cada actividad
// finalizada suma 1 a cada responsable/tractor distinto que participó.
export function finalizadasPorLabor(actividades: Actividad[]): FilaLabor[] {
  const labores = new Map<
    string,
    { total: number; tractores: Map<string, number>; responsables: Map<string, number> }
  >()
  for (const filas of agruparPorActividad(actividades).values()) {
    if (estadoActividad(filas) !== 'CUMPLIDA') continue
    const descripcion = filas[0].descripcion
    const l = labores.get(descripcion) ?? { total: 0, tractores: new Map(), responsables: new Map() }
    l.total += 1
    for (const rid of new Set(filas.map((f) => f.responsableId))) {
      l.responsables.set(rid, (l.responsables.get(rid) ?? 0) + 1)
    }
    for (const mid of new Set(filas.map((f) => f.maquinaId).filter((m): m is string => !!m))) {
      l.tractores.set(mid, (l.tractores.get(mid) ?? 0) + 1)
    }
    labores.set(descripcion, l)
  }
  const top = (m: Map<string, number>): TopConteo | null => {
    let best: TopConteo | null = null
    for (const [id, conteo] of m) {
      if (!best || conteo > best.conteo || (conteo === best.conteo && id < best.id)) best = { id, conteo }
    }
    return best
  }
  return [...labores.entries()]
    .map(([descripcion, l]) => ({ descripcion, total: l.total, tractor: top(l.tractores), responsable: top(l.responsables) }))
    .sort((a, b) => b.total - a.total || a.descripcion.localeCompare(b.descripcion))
}

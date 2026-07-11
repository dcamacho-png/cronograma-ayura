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

const ESTADOS_CAMBIO_SIEMPRE = ['NO_CUMPLIDA', 'REPROGRAMADA']

// Actividades que "cambiaron" en la semana. NO_CUMPLIDA/REPROGRAMADA siempre; PARCIAL
// solo si tuvo una novedad (alguna fila con motivo) — no por un avance normal.
// Ordenadas por veces reprogramada (desc) y luego por día (asc). No muta la entrada.
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

// Total de bultos aplicados del área: suma bultosPorLote de las actividades no pendientes.
// Recibe UNA fila por actividad-grupo (los bultos se comparten entre filas-hermanas).
export function bultosAplicados(
  filas: { estado: string; bultosPorLote: Record<string, number> | null }[],
): number {
  let total = 0
  for (const f of filas) {
    if (f.estado === 'PENDIENTE') continue
    if (!f.bultosPorLote) continue
    for (const n of Object.values(f.bultosPorLote)) total += n
  }
  return r1(total)
}

// Medida realizada por tractor y unidad. Recibe UNA fila por actividad-grupo. Si la
// actividad tiene avances, cada avance se atribuye a su `maquinaId` (o al de la actividad);
// si no, la medida (haRealizada, o haProgramada para ha CUMPLIDA) va al tractor de la
// actividad. Clave '' = "sin tractor".
export function medidasPorTractor(
  filas: {
    estado: string
    unidad: Unidad
    haProgramada: number
    haRealizada: number | null
    maquinaId: string | null
    avances: { maquinaId: string | null; cantidad: number }[]
  }[],
): Map<string, Record<Unidad, number>> {
  const out = new Map<string, Record<Unidad, number>>()
  const bucket = (id: string): Record<Unidad, number> => {
    let r = out.get(id)
    if (!r) { r = { ha: 0, hora: 0, kg: 0, cantidad: 0 }; out.set(id, r) }
    return r
  }
  for (const f of filas) {
    if (f.estado === 'PENDIENTE') continue
    if (f.avances.length > 0) {
      for (const av of f.avances) {
        if (!av.cantidad) continue
        bucket(av.maquinaId ?? f.maquinaId ?? '')[f.unidad] += av.cantidad
      }
    } else {
      const medida = f.haRealizada ?? (f.unidad === 'ha' && f.estado === 'CUMPLIDA' ? f.haProgramada : 0)
      if (medida) bucket(f.maquinaId ?? '')[f.unidad] += medida
    }
  }
  for (const r of out.values()) {
    for (const u of Object.keys(r) as Unidad[]) r[u] = r1(r[u])
  }
  return out
}

// Labores realizadas por cada tractor: qué actividades hizo y con qué medida. Misma atribución
// que `medidasPorTractor` (por avance a su tractor, o el de la actividad; si no hay avances, la
// medida va al tractor de la actividad; ignora PENDIENTE), pero agrupando por (descripción +
// unidad). Devuelve, por tractor (clave '' = sin tractor), la lista ordenada por total desc.
export type LaborTractor = { descripcion: string; unidad: Unidad; total: number }
export function laboresPorTractor(
  filas: {
    estado: string
    descripcion: string
    unidad: Unidad
    haProgramada: number
    haRealizada: number | null
    maquinaId: string | null
    avances: { maquinaId: string | null; cantidad: number }[]
  }[],
): Map<string, LaborTractor[]> {
  const acc = new Map<string, Map<string, LaborTractor>>()
  const add = (tractor: string, descripcion: string, unidad: Unidad, cant: number) => {
    if (!cant) return
    let m = acc.get(tractor)
    if (!m) { m = new Map(); acc.set(tractor, m) }
    const k = `${descripcion}|${unidad}`
    const prev = m.get(k)
    if (prev) prev.total = r1(prev.total + cant)
    else m.set(k, { descripcion, unidad, total: r1(cant) })
  }
  for (const f of filas) {
    if (f.estado === 'PENDIENTE') continue
    if (f.avances.length > 0) {
      for (const av of f.avances) add(av.maquinaId ?? f.maquinaId ?? '', f.descripcion, f.unidad, av.cantidad)
    } else {
      const medida = f.haRealizada ?? (f.unidad === 'ha' && f.estado === 'CUMPLIDA' ? f.haProgramada : 0)
      add(f.maquinaId ?? '', f.descripcion, f.unidad, medida)
    }
  }
  const out = new Map<string, LaborTractor[]>()
  for (const [t, m] of acc) out.set(t, [...m.values()].sort((a, b) => b.total - a.total))
  return out
}

// Escala de actividades que se han arrastrado (reprogramadas/parciales devueltas al banco).
// Recibe filas (una por instancia semanal); deduplica por (descripción + área) tomando el
// MAYOR vecesReprogramada, descarta las que nunca se arrastraron (veces=0) y ordena de más
// a menos arrastrada.
export function actividadesRecurrentes(
  filas: { descripcion: string; areaNombre: string; vecesReprogramada: number }[],
): { descripcion: string; areaNombre: string; veces: number }[] {
  const max = new Map<string, { descripcion: string; areaNombre: string; veces: number }>()
  for (const f of filas) {
    if (f.vecesReprogramada <= 0) continue
    const clave = `${f.descripcion}|${f.areaNombre}`
    const prev = max.get(clave)
    if (!prev || f.vecesReprogramada > prev.veces) {
      max.set(clave, { descripcion: f.descripcion, areaNombre: f.areaNombre, veces: f.vecesReprogramada })
    }
  }
  return [...max.values()].sort((a, b) => b.veces - a.veces || a.descripcion.localeCompare(b.descripcion))
}

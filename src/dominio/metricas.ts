import type { Actividad, Estado } from './tipos'

// Peso de un estado para el cálculo de cumplimiento.
// null = el estado no se evalúa (PENDIENTE, REPROGRAMADA).
export function pesoEstado(estado: Estado): number | null {
  switch (estado) {
    case 'CUMPLIDA': return 1
    case 'PARCIAL': return 0.5
    case 'NO_CUMPLIDA': return 0
    default: return null
  }
}

// % de cumplimiento (0..100) sobre las actividades evaluadas.
// Devuelve null si no hay ninguna actividad evaluada.
export function porcentajeCumplimiento(actividades: Actividad[]): number | null {
  const pesos = actividades
    .map((a) => pesoEstado(a.estado))
    .filter((p): p is number => p !== null)
  if (pesos.length === 0) return null
  const suma = pesos.reduce((acc, p) => acc + p, 0)
  return Math.round((suma / pesos.length) * 100)
}

// Traduce un % (0..100) a estrellas (1..5).
export function estrellas(porcentaje: number): number {
  if (porcentaje >= 90) return 5
  if (porcentaje >= 75) return 4
  if (porcentaje >= 60) return 3
  if (porcentaje >= 40) return 2
  return 1
}

export interface FilaRanking {
  responsableId: string
  porcentaje: number
  estrellas: number
}

// Ranking de responsables por % de cumplimiento.
// Devuelve los 3 mejores y los 3 más bajos (mayor a menor % en cada grupo).
export function rankingResponsables(
  actividades: Actividad[],
): { top: FilaRanking[]; bajos: FilaRanking[] } {
  const porResp = new Map<string, Actividad[]>()
  for (const a of actividades) {
    const lista = porResp.get(a.responsableId) ?? []
    lista.push(a)
    porResp.set(a.responsableId, lista)
  }

  const filas: FilaRanking[] = []
  for (const [responsableId, acts] of porResp) {
    const pct = porcentajeCumplimiento(acts)
    if (pct === null) continue
    filas.push({ responsableId, porcentaje: pct, estrellas: estrellas(pct) })
  }

  filas.sort((a, b) => b.porcentaje - a.porcentaje)
  return {
    top: filas.slice(0, 3),
    bajos: filas.slice(-3),
  }
}

// % de actividades que son reprogramaciones (vecesReprogramada > 0).
export function porcentajeReprogramadas(actividades: Actividad[]): number {
  if (actividades.length === 0) return 0
  const reprog = actividades.filter((a) => a.vecesReprogramada > 0).length
  return Math.round((reprog / actividades.length) * 100)
}

export type ColorSemaforo = 'ninguno' | 'verde' | 'amarillo' | 'naranja' | 'rojo'

// Color de alerta según cuántas veces se ha reprogramado la actividad.
export function colorSemaforo(veces: number): ColorSemaforo {
  if (veces <= 0) return 'ninguno'
  if (veces === 1) return 'verde'
  if (veces === 2) return 'amarillo'
  if (veces === 3) return 'naranja'
  return 'rojo'
}

export interface FilaArea {
  areaId: string
  porcentaje: number | null
}

// % de cumplimiento agrupado por área.
export function cumplimientoPorArea(actividades: Actividad[]): FilaArea[] {
  const porArea = new Map<string, Actividad[]>()
  for (const a of actividades) {
    const lista = porArea.get(a.areaId) ?? []
    lista.push(a)
    porArea.set(a.areaId, lista)
  }
  const filas: FilaArea[] = []
  for (const [areaId, acts] of porArea) {
    filas.push({ areaId, porcentaje: porcentajeCumplimiento(acts) })
  }
  return filas
}

export interface PuntoTendencia {
  anio: number
  semana: number
  porcentaje: number | null
}

// % de cumplimiento por semana, ordenado cronológicamente.
export function tendenciaSemanal(actividades: Actividad[]): PuntoTendencia[] {
  const porSemana = new Map<string, Actividad[]>()
  for (const a of actividades) {
    const clave = `${a.anio}-${a.semana}`
    const lista = porSemana.get(clave) ?? []
    lista.push(a)
    porSemana.set(clave, lista)
  }
  const puntos: PuntoTendencia[] = []
  for (const acts of porSemana.values()) {
    puntos.push({
      anio: acts[0].anio,
      semana: acts[0].semana,
      porcentaje: porcentajeCumplimiento(acts),
    })
  }
  puntos.sort((a, b) => a.anio - b.anio || a.semana - b.semana)
  return puntos
}

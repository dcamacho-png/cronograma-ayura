import type { Actividad, Estado } from './tipos'

// Agrupa actividades por una clave derivada de cada actividad.
function agrupar<K extends string>(
  actividades: Actividad[],
  clave: (a: Actividad) => K,
): Map<K, Actividad[]> {
  const grupos = new Map<K, Actividad[]>()
  for (const a of actividades) {
    const k = clave(a)
    const lista = grupos.get(k) ?? []
    lista.push(a)
    grupos.set(k, lista)
  }
  return grupos
}

// Peso de un estado para el cálculo de cumplimiento.
// null = el estado no se evalúa (PENDIENTE, REPROGRAMADA).
export function pesoEstado(estado: Estado): number | null {
  switch (estado) {
    case 'CUMPLIDA': return 1
    case 'PARCIAL': return 0.5
    case 'NO_CUMPLIDA': return 0
    case 'PENDIENTE':
    case 'REPROGRAMADA':
      return null
    default: {
      // Si se agrega un nuevo Estado y no se decide su peso aquí,
      // esto provoca un error de compilación a propósito.
      const _exhaustivo: never = estado
      return _exhaustivo
    }
  }
}

// Agrupa filas-día en actividades: misma tareaId = una actividad;
// sin tareaId, cada fila es su propia actividad (clave `solo:${id}`).
// Genérico para reutilizarse también sobre filas de Prisma en la UI.
export function agruparPorActividad<T extends { id: string; tareaId?: string | null }>(
  items: T[],
): Map<string, T[]> {
  const grupos = new Map<string, T[]>()
  for (const a of items) {
    const k = a.tareaId ?? `solo:${a.id}`
    const lista = grupos.get(k) ?? []
    lista.push(a)
    grupos.set(k, lista)
  }
  return grupos
}

// Nº de días distintos entre las filas (varias filas pueden compartir día si hay
// varios responsables). Para el contador "N días" de la tarjeta.
export function diasDistintos<T extends { dia: number }>(filas: T[]): number {
  return new Set(filas.map((f) => f.dia)).size
}

// Nº de responsables distintos entre las filas. Si es > 1, la tarjeta muestra el
// nombre del responsable en cada fila.
export function responsablesDistintos<T extends { responsableId: string }>(filas: T[]): number {
  return new Set(filas.map((f) => f.responsableId)).size
}

// Fracción de cumplimiento (0..1) de UNA actividad: promedio del peso de sus
// días. Pendiente/Reprogramada cuentan 0; el denominador son todos los días.
function fraccionActividad(dias: { estado: Estado }[]): number {
  const suma = dias.reduce((acc, a) => acc + (pesoEstado(a.estado) ?? 0), 0)
  return suma / dias.length
}

// % de cumplimiento contando cada actividad como UNA (no por días).
// Agrupa por tareaId, calcula la fracción de cada actividad y las promedia.
// Devuelve null solo si no hay actividades.
export function porcentajeCumplimiento(actividades: Actividad[]): number | null {
  if (actividades.length === 0) return null
  const grupos = agruparPorActividad(actividades)
  let suma = 0
  for (const dias of grupos.values()) suma += fraccionActividad(dias)
  return Math.round((suma / grupos.size) * 100)
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
// Devuelve los 3 mejores y los 3 más bajos, SIN que una persona
// aparezca en ambos grupos (importante cuando hay pocos responsables).
export function rankingResponsables(
  actividades: Actividad[],
): { top: FilaRanking[]; bajos: FilaRanking[] } {
  const filas: FilaRanking[] = []
  for (const [responsableId, acts] of agrupar(actividades, (a) => a.responsableId)) {
    const pct = porcentajeCumplimiento(acts)
    if (pct === null) continue
    filas.push({ responsableId, porcentaje: pct, estrellas: estrellas(pct) })
  }
  filas.sort((a, b) => b.porcentaje - a.porcentaje)
  const top = filas.slice(0, 3)
  const idsTop = new Set(top.map((f) => f.responsableId))
  const bajos = filas.filter((f) => !idsTop.has(f.responsableId)).slice(-3)
  return { top, bajos }
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
  const filas: FilaArea[] = []
  for (const [areaId, acts] of agrupar(actividades, (a) => a.areaId)) {
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
  const puntos: PuntoTendencia[] = []
  for (const acts of agrupar(actividades, (a) => `${a.anio}-${a.semana}`).values()) {
    puntos.push({
      anio: acts[0].anio,
      semana: acts[0].semana,
      porcentaje: porcentajeCumplimiento(acts),
    })
  }
  puntos.sort((a, b) => a.anio - b.anio || a.semana - b.semana)
  return puntos
}

export interface ConteoMotivo {
  motivoId: string
  conteo: number
}

// Cuenta las actividades por motivo (ignora las que no tienen), de mayor a menor.
export function motivosFrecuentes(actividades: Actividad[]): ConteoMotivo[] {
  const conteo = new Map<string, number>()
  for (const a of actividades) {
    if (!a.motivoId) continue
    conteo.set(a.motivoId, (conteo.get(a.motivoId) ?? 0) + 1)
  }
  return [...conteo.entries()]
    .map(([motivoId, c]) => ({ motivoId, conteo: c }))
    .sort((a, b) => b.conteo - a.conteo)
}

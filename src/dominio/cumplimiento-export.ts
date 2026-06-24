import { normalizarUnidad, unidadAbreviada, type Unidad } from './unidad'
import { textoBultosPorLote, type BultosPorLote } from './bultos'
import { textoLotesHechos } from './lotes-hechos'
import { normalizarAvancePorLote, type AvanceEntrada } from './avance-lote'

export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados',
] as const

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADO_TXT: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CUMPLIDA: 'Cumplida',
  PARCIAL: 'Parcial',
  NO_CUMPLIDA: 'No cumplida',
  REPROGRAMADA: 'Reprogramada',
}

export type ActividadExport = {
  dia: number
  descripcion: string
  estado: string
  haRealizada: number | null
  responsable: { nombre: string }
  maquina: { nombre: string } | null
  lotes: { id: string; nombre: string }[]
  bultosPorLote: BultosPorLote | null
  centroCosto: string | null
  lotesHechos: string[] | null
  avancePorLote: Record<string, AvanceEntrada | AvanceEntrada[]> | null
}

// Filas del Excel para una actividad, en el orden de COLUMNAS_CUMPLIMIENTO.
// Si la actividad tiene avances, devuelve UNA FILA POR AVANCE (recorriendo los
// lotes en orden y dentro de cada lote sus entradas en orden): día/fecha/lote/
// máquina/medida son los del avance, y los datos de actividad se repiten. Si no
// tiene avances, devuelve una sola fila con la medida total (`haRealizada`).
// `fecha` (día de la actividad) y los resolvers de `ctx` los provee el llamador
// para mantener la función pura.
export function filasCumplimiento(
  a: ActividadExport,
  fecha: string,
  unidadPorNombre: Record<string, string>,
  ctx: { fechaDeDia: (dia: number) => string; nombreMaquina: (maquinaId: string | null) => string },
): (string | number)[][] {
  const unidad: Unidad = normalizarUnidad(unidadPorNombre[a.descripcion])
  const unidadAbrev = unidadAbreviada(unidad)
  const estado = ESTADO_TXT[a.estado] ?? a.estado
  const bultos = textoBultosPorLote(a.lotes, a.bultosPorLote)
  const centro = a.centroCosto ?? ''
  const potreros = textoLotesHechos(a.lotes, a.lotesHechos)
  const avances = normalizarAvancePorLote(a.avancePorLote)

  const filas: (string | number)[][] = []
  for (const l of a.lotes) {
    for (const e of avances[l.id] ?? []) {
      filas.push([
        DIAS[e.dia] ?? '',
        ctx.fechaDeDia(e.dia),
        a.responsable.nombre,
        a.descripcion,
        ctx.nombreMaquina(e.maquinaId) || (a.maquina?.nombre ?? ''),
        l.nombre,
        estado,
        e.cantidad,
        unidadAbrev,
        bultos,
        centro,
        potreros,
      ])
    }
  }
  if (filas.length > 0) return filas

  // Sin avances: una sola fila con la medida total (como antes).
  return [[
    DIAS[a.dia] ?? '',
    fecha,
    a.responsable.nombre,
    a.descripcion,
    a.maquina?.nombre ?? '',
    a.lotes.map((l) => l.nombre).join(', '),
    estado,
    a.haRealizada ?? '',
    a.haRealizada == null ? '' : unidadAbrev,
    bultos,
    centro,
    potreros,
  ]]
}

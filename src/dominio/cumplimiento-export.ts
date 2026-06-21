import { normalizarUnidad, unidadAbreviada, type Unidad } from './unidad'
import { textoBultosPorLote, type BultosPorLote } from './bultos'
import { textoLotesHechos } from './lotes-hechos'

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
}

// Fila del Excel para una actividad, en el orden de COLUMNAS_CUMPLIMIENTO.
// `fecha` la calcula el llamador (fecha corta del día). La unidad se deriva de
// la descripción contra el catálogo; medida y unidad quedan vacías sin haRealizada.
export function filaCumplimiento(
  a: ActividadExport,
  fecha: string,
  unidadPorNombre: Record<string, string>,
): (string | number)[] {
  const unidad: Unidad = normalizarUnidad(unidadPorNombre[a.descripcion])
  return [
    DIAS[a.dia] ?? '',
    fecha,
    a.responsable.nombre,
    a.descripcion,
    a.maquina?.nombre ?? '',
    a.lotes.map((l) => l.nombre).join(', '),
    ESTADO_TXT[a.estado] ?? a.estado,
    a.haRealizada ?? '',
    a.haRealizada == null ? '' : unidadAbreviada(unidad),
    textoBultosPorLote(a.lotes, a.bultosPorLote),
    a.centroCosto ?? '',
    textoLotesHechos(a.lotes, a.lotesHechos),
  ]
}

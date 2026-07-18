import { normalizarUnidad, unidadAbreviada, type Unidad } from './unidad'
import { textoBultosPorLote, type BultosPorLote } from './bultos'
import { textoLotesHechos } from './lotes-hechos'
import { normalizarAvancePorLote, type AvanceEntrada } from './avance-lote'
import { estadoActividad } from './metricas'
import type { Estado } from './tipos'

export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Finca', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados', 'Ejecutada por', 'Observación', 'Detalle (banco)',
] as const

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADO_TXT: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CUMPLIDA: 'Cumplida',
  PARCIAL: 'Parcial',
  NO_CUMPLIDA: 'No se hizo',
  REPROGRAMADA: 'No se hizo',
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
  finca: { nombre: string } | null
  nota: string | null
  unidadRealizada?: string | null
  detalle?: string | null
}

// Filas del Excel para una actividad, en el orden de COLUMNAS_CUMPLIMIENTO.
// Si la actividad tiene avances, devuelve UNA FILA POR AVANCE (recorriendo los
// lotes en orden y dentro de cada lote sus entradas en orden): día/fecha/lote/
// máquina/medida son los del avance, y los datos de actividad se repiten. Si no
// tiene avances, devuelve una sola fila con la medida total (`haRealizada`).
// `fecha` (día de la actividad) y los resolvers de `ctx` los provee el llamador
// para mantener la función pura.
// `ejecutadaPor`: nombre del área que ejecutó la actividad cuando fue SOLICITADA a
// otra área (vacío en las actividades propias del área que exporta).
export function filasCumplimiento(
  a: ActividadExport,
  fecha: string,
  unidadPorNombre: Record<string, string>,
  ctx: { fechaDeDia: (dia: number) => string; nombreMaquina: (maquinaId: string | null) => string; nombreResponsable?: (id: string | null) => string },
  ejecutadaPor = '',
): (string | number)[][] {
  const catalogUnidad = unidadPorNombre[a.descripcion]
  const unidad: Unidad = normalizarUnidad(catalogUnidad)
  const unidadAbrev = unidadAbreviada(unidad)
  // Respaldo cuando no hay unidad realizada: si el catálogo trae una unidad NO estándar
  // (jornales/bultos/otro), se muestra cruda en vez de forzarla a "ha". La unidad
  // realizada (la que se guardó al programar/registrar) siempre tiene prioridad.
  const noEstandar = catalogUnidad != null && !['ha', 'hora', 'kg', 'cantidad'].includes(catalogUnidad)
  const unidadDisplay = a.unidadRealizada ?? (noEstandar ? catalogUnidad : unidadAbrev)
  const estado = ESTADO_TXT[a.estado] ?? a.estado
  const bultos = textoBultosPorLote(a.lotes, a.bultosPorLote)
  const centro = a.centroCosto ?? ''
  const detalle = a.detalle ?? ''
  const potreros = textoLotesHechos(a.lotes, a.lotesHechos)
  const avances = normalizarAvancePorLote(a.avancePorLote)

  const filas: (string | number)[][] = []
  for (const l of a.lotes) {
    const entradas = avances[l.id] ?? []
    entradas.forEach((e, idx) => {
      filas.push([
        DIAS[e.dia] ?? '',
        ctx.fechaDeDia(e.dia),
        (ctx.nombreResponsable?.(e.responsableId ?? null)) || a.responsable.nombre,
        a.descripcion,
        ctx.nombreMaquina(e.maquinaId) || (a.maquina?.nombre ?? ''),
        l.nombre,
        a.finca?.nombre ?? '',
        estado,
        e.cantidad,
        unidadDisplay,
        // Los bultos son por lote (total), no por avance: se ponen SOLO en la primera fila
        // del lote para que la columna no se duplique cuando el lote tiene varios avances.
        idx === 0 ? (a.bultosPorLote?.[l.id] ?? '') : '',
        e.centroCosto ?? centro,
        potreros,
        ejecutadaPor,
        e.observacion ?? a.nota ?? '',
        detalle,
      ])
    })
  }
  if (filas.length > 0) return filas

  // Una actividad PARCIAL sin avances (p. ej. la actividad inicial que se cambió) no
  // aporta día a día real: no se emite fila. Solo las CUMPLIDAS (incluidas las de
  // reemplazo) generan la fila-resumen sin avances.
  if (a.estado === 'PARCIAL') return []

  // Sin avances (cumplida): una sola fila con la medida total (como antes).
  return [[
    DIAS[a.dia] ?? '',
    fecha,
    a.responsable.nombre,
    a.descripcion,
    a.maquina?.nombre ?? '',
    a.lotes.map((l) => l.nombre).join(', '),
    a.finca?.nombre ?? '',
    estado,
    a.haRealizada ?? '',
    a.haRealizada == null ? '' : unidadDisplay,
    bultos,
    centro,
    potreros,
    ejecutadaPor,
    a.nota ?? '',
    detalle,
  ]]
}

// Filas del Excel para UNA actividad agrupada (filas-hermanas con el mismo `tareaId`).
// Una actividad es una sola aunque tenga varios responsables: las acciones de grupo
// consolidan la MISMA medida/avance en cada hermana, así que tomamos una fila
// representativa (la primera, que por el orden de la query es el día más temprano),
// unimos los nombres de los responsables y dejamos que `filasCumplimiento` arme las
// filas. Esto evita duplicar la medida una vez por responsable.
export function filasCumplimientoGrupo(
  grupo: ActividadExport[],
  fecha: string,
  unidadPorNombre: Record<string, string>,
  ctx: { fechaDeDia: (dia: number) => string; nombreMaquina: (maquinaId: string | null) => string; nombreResponsable?: (id: string | null) => string },
  ejecutadaPor = '',
): (string | number)[][] {
  if (grupo.length === 0) return []
  const base = grupo[0]
  const responsables = [...new Set(grupo.map((a) => a.responsable.nombre))].join(', ')
  const estado = estadoActividad(grupo.map((a) => ({ estado: a.estado as Estado })))
  const centroCosto = grupo.map((a) => a.centroCosto).find((c) => c) ?? base.centroCosto
  const representativa: ActividadExport = {
    ...base,
    responsable: { nombre: responsables },
    estado,
    centroCosto,
  }
  return filasCumplimiento(representativa, fecha, unidadPorNombre, ctx, ejecutadaPor)
}

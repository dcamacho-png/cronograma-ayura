export type TipoNovedad = 'VACACIONES' | 'PERMISO' | 'CUMPLEAÑOS' | 'OTRO'

// Emoji + etiqueta para mostrar una novedad de responsable de forma consistente.
export function etiquetaNovedad(tipo: string): { emoji: string; label: string } {
  switch (tipo) {
    case 'VACACIONES': return { emoji: '🌴', label: 'Vacaciones' }
    case 'PERMISO': return { emoji: '📄', label: 'Permiso' }
    case 'CUMPLEAÑOS': return { emoji: '🎂', label: 'Cumpleaños' }
    default: return { emoji: '📌', label: 'Otro' }
  }
}

export type NovedadRango = {
  id: string
  responsableId: string
  tipo: TipoNovedad
  fechaInicio: Date
  fechaFin: Date
  horario: string | null
  nota: string | null
}

export type AusenciaResumen = {
  responsableId: string
  nombre: string
  vacaciones: number
  permiso: number
  detalle: {
    tipo: TipoNovedad
    fechaInicio: Date
    fechaFin: Date
    horario: string | null
    nota: string | null
  }[]
}

const MS_DIA = 86_400_000

// Milisegundos del día UTC (ignora hora/zona) para comparar fechas por día.
function diaUTC(f: Date): number {
  return Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate())
}

export function diasCubiertos(nov: NovedadRango, fechas: Date[]): number[] {
  const ini = diaUTC(nov.fechaInicio)
  const fin = diaUTC(nov.fechaFin)
  const dias: number[] = []
  fechas.forEach((f, i) => {
    const cur = diaUTC(f)
    if (cur >= ini && cur <= fin) dias.push(i + 1)
  })
  return dias
}

export function resumenAusenciasMes(
  novedades: (NovedadRango & { nombre: string })[],
  primerDia: Date,
  ultimoDia: Date,
): AusenciaResumen[] {
  const ini = diaUTC(primerDia)
  const fin = diaUTC(ultimoDia)
  const porResp = new Map<string, AusenciaResumen>()
  for (const n of novedades) {
    const desde = Math.max(diaUTC(n.fechaInicio), ini)
    const hasta = Math.min(diaUTC(n.fechaFin), fin)
    if (hasta < desde) continue // no intersecta el mes
    const dias = Math.round((hasta - desde) / MS_DIA) + 1
    let r = porResp.get(n.responsableId)
    if (!r) {
      r = { responsableId: n.responsableId, nombre: n.nombre, vacaciones: 0, permiso: 0, detalle: [] }
      porResp.set(n.responsableId, r)
    }
    // Cumpleaños/Otro no suman a los contadores de vacaciones/permiso; solo van al detalle.
    if (n.tipo === 'VACACIONES') r.vacaciones += dias
    else if (n.tipo === 'PERMISO') r.permiso += dias
    r.detalle.push({ tipo: n.tipo, fechaInicio: n.fechaInicio, fechaFin: n.fechaFin, horario: n.horario, nota: n.nota })
  }
  return [...porResp.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
}

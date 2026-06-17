import type { Actividad } from './tipos'

// Datos necesarios para crear una actividad nueva (sin seguimiento ni id).
export interface BorradorActividad {
  anio: number
  semana: number
  dia: number
  areaId: string
  fincaId: string
  responsableId: string
  descripcion: string
  turno: string
  maquinaId: string | null
  areaTareaId: string | null
  horas: number | null
  hectareas: number | null
  planB: string | null
}

// Crea borradores para una semana destino a partir de actividades existentes.
// Conserva la planeación; el seguimiento (estado, motivo, nota, reprogramación)
// se reinicia al crear (toma los valores por defecto).
export function duplicarActividades(
  actividades: Actividad[],
  anioDestino: number,
  semanaDestino: number,
): BorradorActividad[] {
  return actividades.map((a) => ({
    anio: anioDestino,
    semana: semanaDestino,
    dia: a.dia,
    areaId: a.areaId,
    fincaId: a.fincaId,
    responsableId: a.responsableId,
    descripcion: a.descripcion,
    turno: a.turno,
    maquinaId: a.maquinaId ?? null,
    areaTareaId: a.areaTareaId ?? null,
    horas: a.horas ?? null,
    hectareas: a.hectareas ?? null,
    planB: a.planB ?? null,
  }))
}

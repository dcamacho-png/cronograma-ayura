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

// Datos para crear la copia reprogramada de una actividad en otra semana.
export interface DatosReprogramacion {
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
  estado: 'REPROGRAMADA'
  vecesReprogramada: number
  origenId: string
}

// Copia una actividad hacia la semana destino como REPROGRAMADA, subiendo el
// contador de veces reprogramada y guardando de qué actividad proviene.
export function datosReprogramacion(
  actividad: Actividad,
  anioDestino: number,
  semanaDestino: number,
): DatosReprogramacion {
  return {
    anio: anioDestino,
    semana: semanaDestino,
    dia: actividad.dia,
    areaId: actividad.areaId,
    fincaId: actividad.fincaId,
    responsableId: actividad.responsableId,
    descripcion: actividad.descripcion,
    turno: actividad.turno,
    maquinaId: actividad.maquinaId ?? null,
    areaTareaId: actividad.areaTareaId ?? null,
    horas: actividad.horas ?? null,
    hectareas: actividad.hectareas ?? null,
    planB: actividad.planB ?? null,
    estado: 'REPROGRAMADA',
    vecesReprogramada: actividad.vecesReprogramada + 1,
    origenId: actividad.id,
  }
}

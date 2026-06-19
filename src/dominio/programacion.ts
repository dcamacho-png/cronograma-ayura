import type { Actividad } from './tipos'
import { turnoPorDia } from './turno'

// El turno que realmente queda en una actividad: el escrito a mano o, si está
// vacío, el turno por defecto del día.
export function turnoEfectivo(turno: string, dia: number): string {
  return turno.trim() || turnoPorDia(dia)
}

// Una actividad ya existente en la semana, vista como "casilla ocupada".
export interface CasillaOcupada {
  dia: number
  turno: string
  maquinaId: string | null
  responsableId: string
}

export type TipoConflicto = 'maquina' | 'responsable'
export interface Conflicto {
  dia: number
  tipo: TipoConflicto
}

// Detecta choques al asignar: una máquina no puede repetirse en el mismo
// día+turno, y un responsable no puede tener dos tareas en el mismo día+turno.
// `existentes` son las actividades ya guardadas en la semana destino.
export function detectarConflictosAsignacion(
  existentes: CasillaOcupada[],
  dias: number[],
  responsableId: string,
  maquinaPorDia: Record<number, string | null>,
  turno: string,
): Conflicto[] {
  const conflictos: Conflicto[] = []
  for (const dia of dias) {
    const turno_ = turnoEfectivo(turno, dia)
    const enCasilla = existentes.filter((e) => e.dia === dia && e.turno === turno_)
    if (enCasilla.some((e) => e.responsableId === responsableId)) {
      conflictos.push({ dia, tipo: 'responsable' })
    }
    const maqId = maquinaPorDia[dia] ?? null
    if (maqId && enCasilla.some((e) => e.maquinaId === maqId)) {
      conflictos.push({ dia, tipo: 'maquina' })
    }
  }
  return conflictos
}

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

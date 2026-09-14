import type { Actividad } from './tipos'
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
  responsableId?: string
}

// Tractores ya tomados en los días que se van a asignar. Es un AVISO, no un bloqueo: la
// asignación se hace igual y quien programa decide.
//
// Se mira POR DÍA, no por franja horaria. El horario es texto libre que se escribe después en
// la grilla y puede ser cualquier hora; comparar franjas daba falsos "libre" (dos textos
// distintos no significan que no se pisen) y falsos "ocupado" (dos textos iguales por venir de
// un horario de referencia que nadie puso).
//
// Del responsable no se avisa nada: una persona puede tener varias tareas en un mismo día —en
// las áreas estándar siempre se pudo—, así que avisarlo sería ruido.
export function tractoresOcupados(
  existentes: CasillaOcupada[],
  dias: number[],
  responsableId: string,
  maquinaPorDia: Record<number, string | null>,
): Conflicto[] {
  const avisos: Conflicto[] = []
  for (const dia of dias) {
    const maqId = maquinaPorDia[dia] ?? null
    if (!maqId) continue
    if (existentes.some((e) => e.dia === dia && e.maquinaId === maqId)) {
      avisos.push({ dia, tipo: 'maquina', responsableId })
    }
  }
  return avisos
}

// Una asignación por responsable: sus días y su máquina por día. Sin turno: el horario ya no
// se fija al asignar, se escribe día a día en la grilla.
export interface Asignacion {
  responsableId: string
  dias: number[]
  maquinaPorDia: Record<number, string | null>
}

// Aviso de máquina repetida ENTRE responsables del mismo envío: dos asignaciones que usan la
// misma máquina (no nula) el mismo DÍA. Igual que `tractoresOcupados`: recomendación, no bloqueo.
export function conflictosMaquinaEntreResponsables(asignaciones: Asignacion[]): Conflicto[] {
  const conflictos: Conflicto[] = []
  const vistas = new Set<string>()
  for (const a of asignaciones) {
    for (const dia of a.dias) {
      const maqId = a.maquinaPorDia[dia] ?? null
      if (!maqId) continue
      const key = `${dia}-${maqId}`
      if (vistas.has(key)) {
        conflictos.push({ dia, tipo: 'maquina', responsableId: a.responsableId })
      } else {
        vistas.add(key)
      }
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


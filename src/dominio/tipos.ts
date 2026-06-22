// Estados posibles de una actividad.
export type Estado =
  | 'PENDIENTE'
  | 'CUMPLIDA'
  | 'PARCIAL'
  | 'NO_CUMPLIDA'
  | 'REPROGRAMADA'

// Una actividad del cronograma.
export interface Actividad {
  id: string
  anio: number
  semana: number          // número de semana del año (1..53)
  dia: number             // 1 = lunes ... 7 = domingo
  areaId: string          // área a la que pertenece la programación
  fincaId: string         // etiqueta de ubicación
  responsableId: string
  descripcion: string
  turno: string
  estado: Estado
  motivoId: string | null
  nota: string | null
  vecesReprogramada: number   // 0 si nunca se ha arrastrado
  origenId: string | null     // id de la actividad de la que proviene (reprogramación)
  tareaId: string | null      // tarea de origen; null si es una actividad suelta

  // Campos específicos de maquinaria (opcionales en otras áreas):
  maquinaId?: string | null
  areaTareaId?: string | null // a qué área de producción le sirve la tarea
  horas?: number | null
  hectareas?: number | null
  planB?: string | null
}

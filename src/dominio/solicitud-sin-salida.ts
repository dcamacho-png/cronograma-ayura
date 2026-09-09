// ¿Una solicitud entre áreas quedó SIN SALIDA, es decir sin ninguna acción posible
// para nadie?
//
// Pasa cuando el área ejecutora la programó, no registró nada, y la semana venció: el
// cumplimiento de una semana pasada es solo lectura para las áreas, así que la ejecutora
// ya no puede marcarla cumplida, ni cerrarla como parcial, **ni siquiera notificar una
// novedad** (tanto el botón como la server action se bloquean por `plazoCumplimientoVencido`).
// Y el solicitante tampoco puede editarla ni borrarla porque está PROGRAMADA. Se queda
// pegada para siempre en "Mis solicitudes" esperando un registro que nadie puede hacer.
//
// Estas se ocultan de la lista del solicitante. No se borran: la tarea y sus actividades
// quedan en la base como constancia de que ese trabajo se pidió y nunca se resolvió.
//
// Sigue habiendo salida —y por lo tanto se siguen mostrando— cuando:
//  - hay alguna actividad en la semana en curso o futura (todavía se puede registrar),
//  - la solicitud está en el banco sin programar (la otra área puede tomarla),
//  - está DEVUELTA (el solicitante puede reenviarla o editarla).
import { esSemanaPasada, type Semana } from './semana'

export type SolicitudSeguimiento = {
  estado: string
  actividades: { anio: number; semana: number }[]
}

export function solicitudSinSalida(
  solicitud: SolicitudSeguimiento,
  trabajadas: number,
  hoy: Semana,
): boolean {
  // Con trabajo registrado la oculta el otro criterio (ver `trabajo-registrado.ts`).
  if (trabajadas > 0) return false
  if (solicitud.estado === 'DEVUELTA') return false
  if (solicitud.actividades.length === 0) return false
  return solicitud.actividades.every((a) => esSemanaPasada(a.anio, a.semana, hoy))
}

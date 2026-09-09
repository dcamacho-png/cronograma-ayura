// Una actividad "vencida sin registrar": su semana ya pasó y nadie reportó nada.
//
// El cumplimiento de una semana pasada es solo lectura para las áreas
// (`plazoCumplimientoVencido`), así que estas no pueden marcarse cumplidas, ni cerrarse
// como parciales, ni recibir una novedad: quedaban PENDIENTE para siempre. El cierre
// semanal las pasa a `SIN_REGISTRAR` + `cerrada`, que dice la verdad —la semana venció y
// nadie reportó— en vez de sostener un "pendiente" que ya no puede resolverse.
//
// Es idempotente a propósito: una actividad ya marcada no vuelve a entrar, así que el
// cron puede correr las veces que sea.
import { esSemanaPasada, esSemanaFutura, type Semana } from './semana'

export function quedoSinRegistrar(
  a: { anio: number; semana: number; estado: string; cerrada: boolean },
  hoy: Semana,
): boolean {
  if (a.cerrada) return false
  if (a.estado !== 'PENDIENTE') return false
  return esSemanaPasada(a.anio, a.semana, hoy)
}

// ¿Esta vencida sin registrar todavía espera que alguien haga algo con ella?
//
// La única salida de una vencida es devolver su tarea al banco para programarla de nuevo
// (registrarla no se puede: el plazo de esa semana venció). Así que "por atender" se
// deduce de dónde está la tarea, sin marcar nada en la actividad:
//   - la tarea ya volvió al banco (`anioSel` vacío) ⇒ alguien la retomó, no estorba;
//   - la tarea ya está programada para una semana POSTERIOR ⇒ idem;
//   - la tarea sigue apuntando a la semana que se venció (o a una anterior) ⇒ por atender.
// Sin tarea de origen no hay nada que devolver: la actividad suelta queda como constancia
// en su semana (/resumen, Excel) y fuera de la bandeja, que solo lista lo accionable.
export function vencidaPorAtender(v: {
  anio: number
  semana: number
  tarea: { estado: string; anioSel: number | null; semanaSel: number | null } | null
}): boolean {
  if (!v.tarea) return false
  const { anioSel, semanaSel } = v.tarea
  if (anioSel === null || semanaSel === null) return false
  return !esSemanaFutura(anioSel, semanaSel, { anio: v.anio, semana: v.semana })
}

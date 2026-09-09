// ¿Hay que avisarle al área que su plazo está por vencer?
//
// El cumplimiento de una semana se cierra el domingo a medianoche y después no se puede
// registrar nada (`plazoCumplimientoVencido`). El aviso sale el fin de semana, cuando
// todavía hay tiempo de hacer algo, y solo sobre la semana EN CURSO: en una pasada el
// plazo ya venció y en una futura todavía no corre.
import type { Semana } from './semana'

export function avisarPlazoPorVencer(
  semanaVista: Semana,
  hoy: Semana,
  diaIso: number,     // 1 = lunes … 7 = domingo
  pendientes: number,
): boolean {
  if (pendientes <= 0) return false
  if (semanaVista.anio !== hoy.anio || semanaVista.semana !== hoy.semana) return false
  return diaIso >= 6
}

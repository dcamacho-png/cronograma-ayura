// El horario es del DÍA de cada trabajador, no de cada actividad, y es TEXTO LIBRE: cualquier
// hora que quien programa escriba. No hay turnos de referencia — antes existía un `turnoPorDia`
// (lun-jue 7am-4pm, vie 7am-3pm, sáb 7am-12pm) que se estampaba solo al asignar, y hacía
// parecer que hubiera jornadas predefinidas.

// El horario que muestra la casilla al pie del día: el que comparten las actividades de ese
// día. Si difieren —pasa con lo programado antes, cuando cada actividad llevaba el suyo—
// devuelve vacío, y escribir uno los unifica.
//
// Las actividades SIN horario no cuentan como discrepancia: una tarea recién asignada entra
// sin horario, y si contara, la franja del día se vaciaría sola en pantalla.
export function horarioComun(turnos: string[]): string {
  const conHorario = turnos.map((t) => t.trim()).filter(Boolean)
  if (conHorario.length === 0) return ''
  return conHorario.every((t) => t === conHorario[0]) ? conHorario[0] : ''
}

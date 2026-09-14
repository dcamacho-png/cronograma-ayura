// Turno (horario) por defecto según el día: 1=lunes … 7=domingo.
export function turnoPorDia(dia: number): string {
  if (dia >= 1 && dia <= 4) return '7am-4pm'
  if (dia === 5) return '7am-3pm'
  if (dia === 6) return '7am-12pm'
  return ''
}

// El horario es del DÍA de cada trabajador, no de cada actividad: la casilla al pie de la
// casilla de la grilla muestra el que comparten todas las actividades de ese día. Si difieren
// —pasa con lo programado antes, cuando cada actividad llevaba el suyo— devuelve vacío, y
// escribir uno los unifica.
export function horarioComun(turnos: string[]): string {
  const limpios = turnos.map((t) => t.trim())
  if (limpios.length === 0) return ''
  return limpios.every((t) => t === limpios[0]) ? limpios[0] : ''
}

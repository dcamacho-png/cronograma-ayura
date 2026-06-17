// Turno (horario) por defecto según el día: 1=lunes … 7=domingo.
export function turnoPorDia(dia: number): string {
  if (dia >= 1 && dia <= 4) return '7am-4pm'
  if (dia === 5) return '7am-3pm'
  if (dia === 6) return '7am-12pm'
  return ''
}

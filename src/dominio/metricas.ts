import type { Actividad, Estado } from './tipos'

// Peso de un estado para el cálculo de cumplimiento.
// null = el estado no se evalúa (PENDIENTE, REPROGRAMADA).
export function pesoEstado(estado: Estado): number | null {
  switch (estado) {
    case 'CUMPLIDA': return 1
    case 'PARCIAL': return 0.5
    case 'NO_CUMPLIDA': return 0
    default: return null
  }
}

// % de cumplimiento (0..100) sobre las actividades evaluadas.
// Devuelve null si no hay ninguna actividad evaluada.
export function porcentajeCumplimiento(actividades: Actividad[]): number | null {
  const pesos = actividades
    .map((a) => pesoEstado(a.estado))
    .filter((p): p is number => p !== null)
  if (pesos.length === 0) return null
  const suma = pesos.reduce((acc, p) => acc + p, 0)
  return Math.round((suma / pesos.length) * 100)
}

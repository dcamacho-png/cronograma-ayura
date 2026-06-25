export type UsuarioPermiso = { rol: string; pantallas: string | null }

export const PANTALLAS_ASIGNABLES = ['tareas', 'programar', 'cumplimiento', 'resumen', 'tablero'] as const
export const DEFAULT_AREA = ['tareas', 'programar', 'cumplimiento', 'resumen'] as const

const ASIGNABLES = new Set<string>(PANTALLAS_ASIGNABLES)

export function pantallasDe(u: UsuarioPermiso): Set<string> {
  if (u.rol === 'ADMIN') return new Set<string>([...PANTALLAS_ASIGNABLES, 'configuracion'])
  if (u.pantallas == null) return new Set<string>(DEFAULT_AREA)
  const claves = u.pantallas
    .split(',')
    .map((c) => c.trim())
    .filter((c) => ASIGNABLES.has(c))
  return new Set<string>(claves)
}

export function puedeVer(u: UsuarioPermiso, clave: string): boolean {
  return pantallasDe(u).has(clave)
}

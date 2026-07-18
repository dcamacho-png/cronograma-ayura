export type UsuarioPermiso = { rol: string; pantallas: string | null }

export const PANTALLAS_ASIGNABLES = ['tareas', 'programar', 'cumplimiento', 'resumen', 'tablero', 'consulta', 'conservatorio'] as const
export const DEFAULT_AREA = ['tareas', 'programar', 'cumplimiento', 'resumen', 'consulta', 'conservatorio'] as const
export const PANTALLAS_VISOR = ['resumen', 'programar', 'tablero', 'conservatorio'] as const

const ASIGNABLES = new Set<string>(PANTALLAS_ASIGNABLES)

export function pantallasDe(u: UsuarioPermiso): Set<string> {
  if (u.rol === 'ADMIN') return new Set<string>([...PANTALLAS_ASIGNABLES, 'configuracion'])
  if (u.rol === 'VISOR') return new Set<string>(PANTALLAS_VISOR)
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

// El Visor es un usuario de solo consulta (todas las áreas, sin editar).
export function esSoloLectura(u: UsuarioPermiso): boolean {
  return u.rol === 'VISOR'
}

// ¿Puede el usuario mutar datos de un área concreta?
// ADMIN: cualquier área. VISOR: nunca (solo lectura). AREA: solo la suya.
// `areaId` null (área no resuelta / entidad inexistente) siempre se deniega salvo ADMIN.
export function puedeMutarArea(
  u: { rol: string; areaId: string | null },
  areaId: string | null,
): boolean {
  if (u.rol === 'ADMIN') return true
  if (u.rol === 'VISOR') return false
  return u.areaId != null && areaId != null && u.areaId === areaId
}

// Marcar/reabrir temas del Conservatorio: solo gerencia (Visor) y admin.
export function puedeMarcarConservatorio(u: UsuarioPermiso): boolean {
  return u.rol === 'ADMIN' || u.rol === 'VISOR'
}

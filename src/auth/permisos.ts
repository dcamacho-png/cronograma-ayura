import { esMaquinaria, type AreaVariante } from '@/dominio/variante'

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

// ¿Puede dedicar (o quitar) un tractor a `areaObjetivo` un día? Maquinaria es la dueña de los
// tractores: los reparte a cualquier área, y la lista de su grilla por tractor solo trae las
// OTRAS áreas — con `puedeMutarArea` a secas nunca podía guardar nada (el área elegida nunca
// era la suya) y la selección se perdía sin aviso. Las demás áreas siguen pudiendo solo la suya.
export function puedeDedicarTractor(
  u: { rol: string; areaId: string | null; area: AreaVariante | null },
  areaObjetivo: string | null,
): boolean {
  if (u.rol === 'AREA' && u.area && esMaquinaria(u.area, 'programar') && areaObjetivo != null) return true
  return puedeMutarArea(u, areaObjetivo)
}

// Marcar/reabrir temas del Conservatorio: solo gerencia (Visor) y admin.
export function puedeMarcarConservatorio(u: UsuarioPermiso): boolean {
  return u.rol === 'ADMIN' || u.rol === 'VISOR'
}

import { puedeVer, type UsuarioPermiso } from '@/auth/permisos'

export type Seccion = {
  clave: string
  href: string
  texto: string
  icono: string
  descripcion: string
}

export const SECCIONES: Seccion[] = [
  { clave: 'tareas', href: '/tareas', texto: 'Tareas', icono: '📋', descripcion: 'Banco de actividades por área' },
  { clave: 'programar', href: '/programar', texto: 'Programar', icono: '🗓️', descripcion: 'Cronograma de la semana' },
  { clave: 'cumplimiento', href: '/cumplimiento', texto: 'Cumplimiento', icono: '✅', descripcion: 'Registrar lo cumplido' },
  { clave: 'resumen', href: '/resumen', texto: 'Resumen', icono: '📊', descripcion: 'Indicadores de la semana' },
  { clave: 'tablero', href: '/tablero', texto: 'Tablero', icono: '📈', descripcion: 'Vista mensual' },
  { clave: 'configuracion', href: '/configuracion', texto: 'Configuración', icono: '⚙️', descripcion: 'Catálogos y usuarios (solo admin)' },
]

// Secciones visibles según los permisos del usuario.
export function seccionesVisibles(usuario: UsuarioPermiso): Seccion[] {
  return SECCIONES.filter((s) => puedeVer(usuario, s.clave))
}

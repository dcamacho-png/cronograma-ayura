export type Seccion = {
  href: string
  texto: string
  icono: string
  descripcion: string
  soloAdmin?: boolean
}

export const SECCIONES: Seccion[] = [
  { href: '/tareas', texto: 'Tareas', icono: '📋', descripcion: 'Banco de actividades por área' },
  { href: '/programar', texto: 'Programar', icono: '🗓️', descripcion: 'Cronograma de la semana' },
  { href: '/cumplimiento', texto: 'Cumplimiento', icono: '✅', descripcion: 'Registrar lo cumplido' },
  { href: '/resumen', texto: 'Resumen', icono: '📊', descripcion: 'Indicadores de la semana' },
  { href: '/tablero', texto: 'Tablero', icono: '📈', descripcion: 'Vista mensual (solo admin)', soloAdmin: true },
  { href: '/configuracion', texto: 'Configuración', icono: '⚙️', descripcion: 'Catálogos y usuarios (solo admin)', soloAdmin: true },
]

// Secciones visibles según el rol.
export function seccionesVisibles(rol: string): Seccion[] {
  return rol === 'ADMIN' ? SECCIONES : SECCIONES.filter((s) => !s.soloAdmin)
}

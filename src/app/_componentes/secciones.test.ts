import { describe, it, expect } from 'vitest'
import { seccionesVisibles } from './secciones'

describe('seccionesVisibles', () => {
  it('AREA por defecto ve 4 (sin tablero ni configuracion)', () => {
    const claves = seccionesVisibles({ rol: 'AREA', pantallas: null }).map((s) => s.clave)
    expect(claves.sort()).toEqual(['cumplimiento', 'programar', 'resumen', 'tareas'])
  })

  it('ADMIN ve también tablero y configuracion', () => {
    const claves = seccionesVisibles({ rol: 'ADMIN', pantallas: null }).map((s) => s.clave)
    expect(claves).toContain('tablero')
    expect(claves).toContain('configuracion')
  })

  it('AREA con tablero concedido lo ve', () => {
    const claves = seccionesVisibles({ rol: 'AREA', pantallas: 'tareas,tablero' }).map((s) => s.clave)
    expect(claves).toContain('tablero')
    expect(claves).not.toContain('configuracion')
  })
})

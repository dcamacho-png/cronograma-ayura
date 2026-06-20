import { describe, it, expect } from 'vitest'
import { SECCIONES, seccionesVisibles } from './secciones'

describe('seccionesVisibles', () => {
  it('ADMIN ve todas las secciones', () => {
    expect(seccionesVisibles('ADMIN')).toEqual(SECCIONES)
    expect(seccionesVisibles('ADMIN')).toHaveLength(6)
  })

  it('AREA no ve Tablero ni Configuración', () => {
    const v = seccionesVisibles('AREA')
    const hrefs = v.map((s) => s.href)
    expect(hrefs).not.toContain('/tablero')
    expect(hrefs).not.toContain('/configuracion')
    expect(v).toHaveLength(4)
  })

  it('cualquier rol no-admin excluye las soloAdmin', () => {
    const v = seccionesVisibles('OTRO')
    expect(v.every((s) => !s.soloAdmin)).toBe(true)
  })
})

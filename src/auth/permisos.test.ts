import { describe, it, expect } from 'vitest'
import { pantallasDe, puedeVer, esSoloLectura } from './permisos'

describe('pantallasDe', () => {
  it('ADMIN ve todo, incluida configuracion', () => {
    const s = pantallasDe({ rol: 'ADMIN', pantallas: null })
    for (const k of ['tareas', 'programar', 'cumplimiento', 'resumen', 'tablero', 'configuracion']) {
      expect(s.has(k)).toBe(true)
    }
  })

  it('AREA sin pantallas usa el set por defecto (sin tablero)', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: null })
    expect([...s].sort()).toEqual(['consulta', 'cumplimiento', 'programar', 'resumen', 'tareas'])
    expect(s.has('tablero')).toBe(false)
    expect(s.has('configuracion')).toBe(false)
  })

  it('AREA con CSV parsea e intersecta con las asignables', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: 'tareas,resumen,tablero' })
    expect([...s].sort()).toEqual(['resumen', 'tablero', 'tareas'])
  })

  it('AREA nunca obtiene configuracion aunque esté en el CSV', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: 'configuracion,tareas' })
    expect(s.has('configuracion')).toBe(false)
    expect(s.has('tareas')).toBe(true)
  })

  it('AREA con CSV vacío => set vacío de asignables', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: '' })
    expect(s.size).toBe(0)
  })

  it('ignora claves desconocidas y espacios', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: ' tareas , inventada ,resumen ' })
    expect([...s].sort()).toEqual(['resumen', 'tareas'])
  })

  it('VISOR ve exactamente las 4 pantallas de solo lectura', () => {
    const s = pantallasDe({ rol: 'VISOR', pantallas: null })
    expect([...s].sort()).toEqual(['cumplimiento', 'programar', 'resumen', 'tablero'])
    expect(s.has('tareas')).toBe(false)
    expect(s.has('consulta')).toBe(false)
    expect(s.has('configuracion')).toBe(false)
  })

  it('VISOR ignora el CSV de pantallas', () => {
    const s = pantallasDe({ rol: 'VISOR', pantallas: 'tareas,configuracion' })
    expect([...s].sort()).toEqual(['cumplimiento', 'programar', 'resumen', 'tablero'])
  })
})

describe('puedeVer', () => {
  it('refleja el set', () => {
    expect(puedeVer({ rol: 'AREA', pantallas: null }, 'tareas')).toBe(true)
    expect(puedeVer({ rol: 'AREA', pantallas: null }, 'tablero')).toBe(false)
    expect(puedeVer({ rol: 'ADMIN', pantallas: null }, 'configuracion')).toBe(true)
  })
})

describe('esSoloLectura', () => {
  it('solo el VISOR es de solo lectura', () => {
    expect(esSoloLectura({ rol: 'VISOR', pantallas: null })).toBe(true)
    expect(esSoloLectura({ rol: 'ADMIN', pantallas: null })).toBe(false)
    expect(esSoloLectura({ rol: 'AREA', pantallas: null })).toBe(false)
  })
})

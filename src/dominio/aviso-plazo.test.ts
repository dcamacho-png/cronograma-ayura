import { describe, it, expect } from 'vitest'
import { avisarPlazoPorVencer } from './aviso-plazo'

const HOY = { anio: 2026, semana: 37 }

describe('avisarPlazoPorVencer', () => {
  it('sábado, semana en curso y con pendientes: avisa', () => {
    expect(avisarPlazoPorVencer(HOY, HOY, 6, 3)).toBe(true)
  })
  it('domingo también', () => {
    expect(avisarPlazoPorVencer(HOY, HOY, 7, 1)).toBe(true)
  })
  it('de lunes a viernes no: falta mucho y sería ruido', () => {
    for (const d of [1, 2, 3, 4, 5]) {
      expect(avisarPlazoPorVencer(HOY, HOY, d, 3)).toBe(false)
    }
  })
  it('sin pendientes no hay nada que avisar', () => {
    expect(avisarPlazoPorVencer(HOY, HOY, 6, 0)).toBe(false)
  })
  it('mirando una semana pasada no avisa: su plazo ya venció', () => {
    expect(avisarPlazoPorVencer({ anio: 2026, semana: 33 }, HOY, 6, 5)).toBe(false)
  })
  it('mirando una semana futura tampoco: su plazo no corre', () => {
    expect(avisarPlazoPorVencer({ anio: 2026, semana: 38 }, HOY, 6, 5)).toBe(false)
  })
  it('otro año con el mismo número de semana no es la semana en curso', () => {
    expect(avisarPlazoPorVencer({ anio: 2025, semana: 37 }, HOY, 6, 5)).toBe(false)
  })
})

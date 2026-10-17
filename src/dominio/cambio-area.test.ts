import { describe, it, expect } from 'vitest'
import { desdeHoy, esDeHoyEnAdelante } from './cambio-area'

const hoy = { anio: 2026, semana: 42, dia: 3 } // miércoles

describe('esDeHoyEnAdelante', () => {
  it('hoy y los días que siguen de la semana sí', () => {
    expect(esDeHoyEnAdelante({ anio: 2026, semana: 42, dia: 3 }, hoy)).toBe(true)
    expect(esDeHoyEnAdelante({ anio: 2026, semana: 42, dia: 6 }, hoy)).toBe(true)
  })

  it('los días que ya pasaron de la semana no', () => {
    expect(esDeHoyEnAdelante({ anio: 2026, semana: 42, dia: 2 }, hoy)).toBe(false)
  })

  it('semanas futuras sí, aunque el día sea menor; semanas pasadas no', () => {
    expect(esDeHoyEnAdelante({ anio: 2026, semana: 43, dia: 1 }, hoy)).toBe(true)
    expect(esDeHoyEnAdelante({ anio: 2027, semana: 1, dia: 1 }, hoy)).toBe(true)
    expect(esDeHoyEnAdelante({ anio: 2026, semana: 41, dia: 7 }, hoy)).toBe(false)
    expect(esDeHoyEnAdelante({ anio: 2025, semana: 52, dia: 7 }, hoy)).toBe(false)
  })
})

describe('desdeHoy (filtro para la base de datos)', () => {
  it('arma las tres condiciones: años futuros, semanas futuras del año, y de hoy en adelante esta semana', () => {
    expect(desdeHoy(hoy)).toEqual([
      { anio: { gt: 2026 } },
      { anio: 2026, semana: { gt: 42 } },
      { anio: 2026, semana: 42, dia: { gte: 3 } },
    ])
  })
})

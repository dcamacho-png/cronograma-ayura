import { describe, it, expect } from 'vitest'
import { isoSemanaDeFecha, siguienteSemana, semanaAnterior } from './semana'

describe('isoSemanaDeFecha', () => {
  it('calcula la semana ISO de una fecha conocida', () => {
    // 2026-06-15 (lunes) es la semana 25 de 2026.
    expect(isoSemanaDeFecha(new Date(Date.UTC(2026, 5, 15)))).toEqual({ anio: 2026, semana: 25 })
    // 1 de enero de 2026 (jueves) es semana 1 de 2026.
    expect(isoSemanaDeFecha(new Date(Date.UTC(2026, 0, 1)))).toEqual({ anio: 2026, semana: 1 })
  })
})

describe('siguienteSemana', () => {
  it('avanza una semana', () => {
    expect(siguienteSemana(2026, 25)).toEqual({ anio: 2026, semana: 26 })
  })
  it('2026 tiene 53 semanas', () => {
    expect(siguienteSemana(2026, 52)).toEqual({ anio: 2026, semana: 53 })
  })
  it('cruza el cambio de año (2026 s53 -> 2027 s1)', () => {
    expect(siguienteSemana(2026, 53)).toEqual({ anio: 2027, semana: 1 })
  })
})

describe('semanaAnterior', () => {
  it('retrocede una semana', () => {
    expect(semanaAnterior(2026, 26)).toEqual({ anio: 2026, semana: 25 })
  })
  it('cruza el cambio de año (2027 s1 -> 2026 s53)', () => {
    expect(semanaAnterior(2027, 1)).toEqual({ anio: 2026, semana: 53 })
  })
})

import { describe, it, expect } from 'vitest'
import { turnoPorDia, horarioComun } from './turno'

describe('turnoPorDia', () => {
  it('lunes a jueves es 7am-4pm', () => {
    expect(turnoPorDia(1)).toBe('7am-4pm')
    expect(turnoPorDia(2)).toBe('7am-4pm')
    expect(turnoPorDia(3)).toBe('7am-4pm')
    expect(turnoPorDia(4)).toBe('7am-4pm')
  })
  it('viernes es 7am-3pm', () => {
    expect(turnoPorDia(5)).toBe('7am-3pm')
  })
  it('sábado es 7am-12pm', () => {
    expect(turnoPorDia(6)).toBe('7am-12pm')
  })
  it('domingo no tiene turno por defecto', () => {
    expect(turnoPorDia(7)).toBe('')
  })
})

describe('horarioComun', () => {
  it('devuelve el horario que comparten las actividades del día', () => {
    expect(horarioComun(['7am-12pm', '7am-12pm'])).toBe('7am-12pm')
    expect(horarioComun(['1pm-5pm'])).toBe('1pm-5pm')
  })

  it('queda vacío si las actividades del día traen horarios distintos', () => {
    // Pasa con lo programado ANTES de que el horario fuera del día: cada actividad tenía el
    // suyo. La casilla arranca vacía y, al escribir uno, los unifica.
    expect(horarioComun(['7am-12pm', '1pm-5pm'])).toBe('')
  })

  it('ignora espacios de más al comparar', () => {
    expect(horarioComun([' 7am-12pm', '7am-12pm '])).toBe('7am-12pm')
  })

  it('sin actividades no hay horario', () => {
    expect(horarioComun([])).toBe('')
  })

  it('varias actividades sin horario dan vacío, no un falso conflicto', () => {
    expect(horarioComun(['', ''])).toBe('')
  })
})

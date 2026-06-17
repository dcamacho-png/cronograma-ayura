import { describe, it, expect } from 'vitest'
import { turnoPorDia } from './turno'

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

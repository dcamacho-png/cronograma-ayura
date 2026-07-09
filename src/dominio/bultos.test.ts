import { describe, it, expect } from 'vitest'
import { usaBultos, textoBultosPorLote, type BultosPorLote } from './bultos'

describe('usaBultos', () => {
  it('acepta las actividades con bultos (con espacios/minúsculas) y rechaza otras', () => {
    expect(usaBultos('FERTILIZACION GRANULADA')).toBe(true)
    expect(usaBultos('ENCALADORA')).toBe(true)
    expect(usaBultos('FERTILIZACION POLLINAZA')).toBe(true)
    expect(usaBultos('ESTERCOLERO')).toBe(true)
    expect(usaBultos('ESPARCIDOR')).toBe(true)
    expect(usaBultos('REGAR COMPOST')).toBe(true)
    expect(usaBultos('GRANEL')).toBe(true)
    expect(usaBultos('  esparcidor  ')).toBe(true)
    expect(usaBultos('SIEMBRA PASTOS')).toBe(false)
    expect(usaBultos('')).toBe(false)
    expect(usaBultos('Riego')).toBe(false)
  })
})

describe('textoBultosPorLote', () => {
  const lotes = [{ id: 'a', nombre: 'L1' }, { id: 'b', nombre: 'L2' }, { id: 'c', nombre: 'L3' }]
  it('lista solo los lotes con bulto, en el orden de lotes', () => {
    const b: BultosPorLote = { a: 3, b: 2.5 }
    expect(textoBultosPorLote(lotes, b)).toBe('L1: 3, L2: 2.5')
  })
  it('ignora lotes sin bulto', () => {
    expect(textoBultosPorLote(lotes, { b: 4 })).toBe('L2: 4')
  })
  it('devuelve cadena vacía sin mapa', () => {
    expect(textoBultosPorLote(lotes, null)).toBe('')
    expect(textoBultosPorLote(lotes, undefined)).toBe('')
    expect(textoBultosPorLote(lotes, {})).toBe('')
  })
})

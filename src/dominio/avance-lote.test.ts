import { describe, it, expect } from 'vitest'
import { lotesPendientes, textoAvancePorLote, type AvancePorLote } from './avance-lote'

const lotes = [{ id: 'a', nombre: 'L-A' }, { id: 'b', nombre: 'L-B' }, { id: 'c', nombre: 'L-C' }]
const avance: AvancePorLote = { a: { dia: 1, maquinaId: null, cantidad: 3 }, b: { dia: 2, maquinaId: 'm1', cantidad: 2 } }

describe('lotesPendientes', () => {
  it('devuelve los lotes sin avance', () => {
    expect(lotesPendientes(lotes, avance).map((l) => l.id)).toEqual(['c'])
  })
  it('sin avance devuelve todos', () => {
    expect(lotesPendientes(lotes, null).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('textoAvancePorLote', () => {
  it('lista los lotes con avance y su cantidad, en orden', () => {
    expect(textoAvancePorLote(lotes, avance)).toBe('L-A: 3, L-B: 2')
  })
  it('vacío si no hay avance', () => {
    expect(textoAvancePorLote(lotes, null)).toBe('')
  })
})

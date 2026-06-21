import { describe, it, expect } from 'vitest'
import { textoLotesHechos } from './lotes-hechos'

describe('textoLotesHechos', () => {
  const lotes = [{ id: 'a', nombre: 'L1' }, { id: 'b', nombre: 'L2' }, { id: 'c', nombre: 'L3' }]
  it('lista los nombres marcados en el orden de lotes', () => {
    expect(textoLotesHechos(lotes, ['c', 'a'])).toBe('L1, L3')
  })
  it('ignora ids que no están en lotes', () => {
    expect(textoLotesHechos(lotes, ['b', 'zzz'])).toBe('L2')
  })
  it('devuelve cadena vacía sin ids', () => {
    expect(textoLotesHechos(lotes, null)).toBe('')
    expect(textoLotesHechos(lotes, undefined)).toBe('')
    expect(textoLotesHechos(lotes, [])).toBe('')
  })
})

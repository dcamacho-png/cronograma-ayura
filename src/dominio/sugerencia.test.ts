import { describe, it, expect } from 'vitest'
import { parseCsv, etiquetaDias, etiquetaResponsables, textoSugerencia } from './sugerencia'

describe('parseCsv', () => {
  it('parsea, trim y descarta vacíos', () => {
    expect(parseCsv(' a , b ,, c ')).toEqual(['a', 'b', 'c'])
    expect(parseCsv(null)).toEqual([])
    expect(parseCsv('')).toEqual([])
  })
})

describe('etiquetaDias', () => {
  it('CSV de días → nombres', () => {
    expect(etiquetaDias('1,3,5')).toBe('Lun, Mié, Vie')
  })
  it('vacío → ""', () => {
    expect(etiquetaDias(null)).toBe('')
    expect(etiquetaDias('')).toBe('')
  })
})

describe('etiquetaResponsables', () => {
  const mapa = new Map([['r1', 'Juan'], ['r2', 'Ana']])
  it('CSV de ids → nombres, omite ids sin nombre', () => {
    expect(etiquetaResponsables('r1,r2', mapa)).toBe('Juan, Ana')
    expect(etiquetaResponsables('r1,rX', mapa)).toBe('Juan')
  })
  it('vacío → ""', () => {
    expect(etiquetaResponsables(null, mapa)).toBe('')
  })
})

describe('textoSugerencia', () => {
  const mapa = new Map([['r1', 'Juan']])
  it('días + personas', () => {
    expect(textoSugerencia('Ganadería', '1,2', 'r1', mapa)).toBe('Sugerido por Ganadería: días Lun, Mar · personas Juan')
  })
  it('solo días (caso maquinaria, sin colaboradores)', () => {
    expect(textoSugerencia('Maíz', '4', null, mapa)).toBe('Sugerido por Maíz: días Jue')
  })
  it('null si no hay nada que sugerir', () => {
    expect(textoSugerencia('Ganadería', null, null, mapa)).toBeNull()
    expect(textoSugerencia('Ganadería', '', '', mapa)).toBeNull()
  })
})

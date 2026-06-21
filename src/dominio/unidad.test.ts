import { describe, it, expect } from 'vitest'
import { normalizarUnidad, unidadDe, etiquetaMedida, unidadAbreviada } from './unidad'

describe('normalizarUnidad', () => {
  it('respeta hora y kg, y cae a ha en cualquier otro caso', () => {
    expect(normalizarUnidad('hora')).toBe('hora')
    expect(normalizarUnidad('kg')).toBe('kg')
    expect(normalizarUnidad('ha')).toBe('ha')
    expect(normalizarUnidad('')).toBe('ha')
    expect(normalizarUnidad(undefined)).toBe('ha')
    expect(normalizarUnidad('litros')).toBe('ha')
  })
})

describe('unidadDe', () => {
  const mapa = { ESTERCOLERO: 'hora', GRANEL: 'kg', ENCALADORA: 'ha' }
  it('busca por descripción y cae a ha si no está en el catálogo', () => {
    expect(unidadDe(mapa, 'ESTERCOLERO')).toBe('hora')
    expect(unidadDe(mapa, 'GRANEL')).toBe('kg')
    expect(unidadDe(mapa, 'ENCALADORA')).toBe('ha')
    expect(unidadDe(mapa, 'Texto libre')).toBe('ha')
  })
})

describe('etiquetaMedida', () => {
  it('da la etiqueta del campo según la unidad', () => {
    expect(etiquetaMedida('ha')).toBe('Hectáreas realizadas')
    expect(etiquetaMedida('hora')).toBe('Horas realizadas')
    expect(etiquetaMedida('kg')).toBe('Kg cosechados')
  })
})

describe('unidadAbreviada', () => {
  it('da la abreviatura para listas y totales', () => {
    expect(unidadAbreviada('ha')).toBe('ha')
    expect(unidadAbreviada('hora')).toBe('horas')
    expect(unidadAbreviada('kg')).toBe('kg')
  })
})

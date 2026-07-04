import { describe, it, expect } from 'vitest'
import { normalizarNovedades, agregarNovedad, eliminarNovedad, type NovedadEntrada } from './novedades'

describe('normalizarNovedades', () => {
  it('null/no-array → []', () => {
    expect(normalizarNovedades(null)).toEqual([])
    expect(normalizarNovedades(undefined)).toEqual([])
    expect(normalizarNovedades({})).toEqual([])
  })
  it('filtra entradas mal formadas y conserva las válidas', () => {
    const raw = [{ dia: 2, motivoId: 'm1', observacion: 'x' }, { foo: 1 }]
    expect(normalizarNovedades(raw)).toEqual([{ dia: 2, motivoId: 'm1', observacion: 'x' }])
  })
})

describe('agregarNovedad', () => {
  it('agrega al final sin mutar', () => {
    const base: NovedadEntrada[] = [{ dia: 1, motivoId: null, observacion: 'a' }]
    const out = agregarNovedad(base, { dia: 2, motivoId: 'm1', observacion: 'b' })
    expect(out).toHaveLength(2)
    expect(out[1]).toEqual({ dia: 2, motivoId: 'm1', observacion: 'b' })
    expect(base).toHaveLength(1)
  })
})

describe('eliminarNovedad', () => {
  it('quita el índice indicado', () => {
    const base: NovedadEntrada[] = [
      { dia: 1, motivoId: null, observacion: 'a' },
      { dia: 2, motivoId: 'm1', observacion: 'b' },
    ]
    expect(eliminarNovedad(base, 0)).toEqual([{ dia: 2, motivoId: 'm1', observacion: 'b' }])
  })
  it('índice fuera de rango → sin cambios', () => {
    const base: NovedadEntrada[] = [{ dia: 1, motivoId: null, observacion: 'a' }]
    expect(eliminarNovedad(base, 5)).toBe(base)
  })
})

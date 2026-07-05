import { describe, it, expect } from 'vitest'
import { separarNotas, agruparPorArea } from './conservatorio'

describe('separarNotas', () => {
  it('divide en pendientes y hablados', () => {
    const notas = [
      { id: 'a', hablado: false },
      { id: 'b', hablado: true },
      { id: 'c', hablado: false },
    ]
    const { pendientes, hablados } = separarNotas(notas)
    expect(pendientes.map((n) => n.id)).toEqual(['a', 'c'])
    expect(hablados.map((n) => n.id)).toEqual(['b'])
  })

  it('listas vacías si no hay notas', () => {
    expect(separarNotas([])).toEqual({ pendientes: [], hablados: [] })
  })
})

describe('agruparPorArea', () => {
  it('agrupa por nombre de área, ordenado alfabéticamente', () => {
    const notas = [
      { id: '1', area: { nombre: 'Maíz' } },
      { id: '2', area: { nombre: 'Ganadería' } },
      { id: '3', area: { nombre: 'Maíz' } },
    ]
    const grupos = agruparPorArea(notas)
    expect(grupos.map(([nombre]) => nombre)).toEqual(['Ganadería', 'Maíz'])
    expect(grupos[1][1].map((n) => n.id)).toEqual(['1', '3'])
  })

  it('lista vacía => sin grupos', () => {
    expect(agruparPorArea([])).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { agruparOrdenAseoPorDia } from './orden-aseo'

describe('agruparOrdenAseoPorDia', () => {
  it('devuelve 7 días en orden, vacíos cuando no hay encargados', () => {
    const r = agruparOrdenAseoPorDia([])
    expect(r.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(r.every((d) => d.encargados.length === 0)).toBe(true)
  })

  it('agrupa varios encargados en el mismo día, ordenados por nombre', () => {
    const r = agruparOrdenAseoPorDia([
      { dia: 3, responsableId: 'b', nombre: 'Bruno' },
      { dia: 3, responsableId: 'a', nombre: 'Ana' },
      { dia: 1, responsableId: 'c', nombre: 'Carla' },
    ])
    expect(r[0]).toEqual({ dia: 1, encargados: [{ responsableId: 'c', nombre: 'Carla' }] })
    expect(r[2].encargados.map((e) => e.nombre)).toEqual(['Ana', 'Bruno'])
    expect(r[1].encargados).toEqual([])
  })

  it('ignora asignaciones con día fuera de 1..7', () => {
    const r = agruparOrdenAseoPorDia([
      { dia: 0, responsableId: 'x', nombre: 'X' },
      { dia: 8, responsableId: 'y', nombre: 'Y' },
      { dia: 5, responsableId: 'z', nombre: 'Z' },
    ])
    expect(r[4].encargados).toEqual([{ responsableId: 'z', nombre: 'Z' }])
    expect(r.flatMap((d) => d.encargados)).toHaveLength(1)
  })
})

import { describe, it, expect } from 'vitest'
import { construirFilasTractor, type ActividadTractor } from './tractor'

const act = (over: Partial<ActividadTractor> & { id: string; maquinaId: string; dia: number }): ActividadTractor => ({
  descripcion: 'Labor',
  turno: '',
  maquina: { nombre: 'x' },
  responsable: { nombre: 'Pedro' },
  ...over,
})

describe('construirFilasTractor', () => {
  it('devuelve una fila por máquina aunque no tenga actividad ni dedicación', () => {
    const filas = construirFilasTractor(
      [{ id: 'm1', nombre: 'Tractor 1' }, { id: 'm2', nombre: 'Tractor 2' }],
      [],
      [],
    )
    expect(filas.map((f) => f.maquinaId)).toEqual(['m1', 'm2'])
    expect(filas[0].actividades).toEqual([])
    expect(filas[0].dedicadasPorDia).toEqual({})
  })

  it('adjunta la dedicación de un día con área a la máquina correcta', () => {
    const filas = construirFilasTractor(
      [{ id: 'm1', nombre: 'Tractor 1' }],
      [],
      [{ maquinaId: 'm1', dia: 3, areaId: 'a1', areaNombre: 'Ganadería' }],
    )
    expect(filas[0].dedicadasPorDia).toEqual({ 3: { areaId: 'a1', areaNombre: 'Ganadería' } })
  })

  it('un mismo tractor puede tener días distintos dedicados a áreas distintas', () => {
    const filas = construirFilasTractor(
      [{ id: 'm1', nombre: 'Tractor 1' }],
      [],
      [
        { maquinaId: 'm1', dia: 1, areaId: 'a1', areaNombre: 'Ganadería' },
        { maquinaId: 'm1', dia: 2, areaId: 'a2', areaNombre: 'Maíz-Riego' },
      ],
    )
    expect(filas[0].dedicadasPorDia).toEqual({
      1: { areaId: 'a1', areaNombre: 'Ganadería' },
      2: { areaId: 'a2', areaNombre: 'Maíz-Riego' },
    })
  })

  it('conserva las actividades de cada tractor y no mezcla entre máquinas', () => {
    const filas = construirFilasTractor(
      [{ id: 'm1', nombre: 'Tractor 1' }, { id: 'm2', nombre: 'Tractor 2' }],
      [act({ id: 't1', maquinaId: 'm1', dia: 1 }), act({ id: 't2', maquinaId: 'm2', dia: 1 })],
      [],
    )
    expect(filas[0].actividades.map((a) => a.id)).toEqual(['t1'])
    expect(filas[1].actividades.map((a) => a.id)).toEqual(['t2'])
  })

  it('ordena las filas por nombre de máquina', () => {
    const filas = construirFilasTractor(
      [{ id: 'm1', nombre: 'Zeta' }, { id: 'm2', nombre: 'Alfa' }],
      [],
      [],
    )
    expect(filas.map((f) => f.nombre)).toEqual(['Alfa', 'Zeta'])
  })
})

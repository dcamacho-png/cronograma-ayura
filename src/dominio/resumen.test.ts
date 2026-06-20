import { describe, it, expect } from 'vitest'
import { colorPorcentaje, actividadesConCambio } from './resumen'
import type { Actividad } from './tipos'

function act(parcial: Partial<Actividad>): Actividad {
  return {
    id: 'x', anio: 2026, semana: 25, dia: 1,
    areaId: 'a', fincaId: 'f', responsableId: 'r',
    descripcion: '', turno: '', estado: 'PENDIENTE',
    motivoId: null, nota: null, vecesReprogramada: 0, origenId: null,
    maquinaId: null, areaTareaId: null, horas: null, hectareas: null, planB: null,
    ...parcial,
  }
}

describe('colorPorcentaje', () => {
  it('asigna color por umbrales', () => {
    expect(colorPorcentaje(null)).toBe('gris')
    expect(colorPorcentaje(95)).toBe('verde')
    expect(colorPorcentaje(80)).toBe('verde')
    expect(colorPorcentaje(79)).toBe('amarillo')
    expect(colorPorcentaje(60)).toBe('amarillo')
    expect(colorPorcentaje(59)).toBe('rojo')
    expect(colorPorcentaje(0)).toBe('rojo')
  })
})

describe('actividadesConCambio', () => {
  it('incluye solo PARCIAL / NO_CUMPLIDA / REPROGRAMADA, ordenadas por veces reprogramada desc y luego día asc', () => {
    const acts = [
      act({ id: '1', estado: 'CUMPLIDA' }),
      act({ id: '2', estado: 'PENDIENTE' }),
      act({ id: '3', estado: 'PARCIAL', vecesReprogramada: 0, dia: 5 }),
      act({ id: '4', estado: 'NO_CUMPLIDA', vecesReprogramada: 2, dia: 1 }),
      act({ id: '5', estado: 'REPROGRAMADA', vecesReprogramada: 1, dia: 3 }),
    ]
    const r = actividadesConCambio(acts)
    expect(r.map((a) => a.id)).toEqual(['4', '5', '3'])
  })

  it('no muta el arreglo de entrada', () => {
    const acts = [act({ id: 'a', estado: 'NO_CUMPLIDA' }), act({ id: 'b', estado: 'CUMPLIDA' })]
    const copia = [...acts]
    actividadesConCambio(acts)
    expect(acts).toEqual(copia)
  })
})

import { extremosFinalizadas, conteoPorEstado, hectareasRealizadas } from './resumen'

describe('extremosFinalizadas', () => {
  it('devuelve quien más y quien menos finalizó (CUMPLIDA)', () => {
    const acts = [
      act({ responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ responsableId: 'B', estado: 'CUMPLIDA' }),
      act({ responsableId: 'B', estado: 'PARCIAL' }),
      act({ responsableId: 'C', estado: 'NO_CUMPLIDA' }),
    ]
    const { mas, menos } = extremosFinalizadas(acts)
    expect(mas).toEqual({ responsableId: 'A', finalizadas: 2 })
    expect(menos).toEqual({ responsableId: 'C', finalizadas: 0 })
  })
  it('devuelve null si no hay actividades', () => {
    expect(extremosFinalizadas([])).toEqual({ mas: null, menos: null })
  })
})

describe('conteoPorEstado', () => {
  it('cuenta por estado', () => {
    const acts = [
      act({ estado: 'CUMPLIDA' }),
      act({ estado: 'CUMPLIDA' }),
      act({ estado: 'PARCIAL' }),
      act({ estado: 'PENDIENTE' }),
    ]
    expect(conteoPorEstado(acts)).toEqual({ PENDIENTE: 1, CUMPLIDA: 2, PARCIAL: 1, NO_CUMPLIDA: 0, REPROGRAMADA: 0 })
  })
})


describe('hectareasRealizadas', () => {
  it('suma realizadas; cumplida sin valor = programada; pendiente se ignora; no cumplida sin valor = 0', () => {
    const filas = [
      { estado: 'CUMPLIDA', haProgramada: 10, haRealizada: null }, // 10 (cae a programada)
      { estado: 'PARCIAL', haProgramada: 8, haRealizada: 5 }, // 5
      { estado: 'NO_CUMPLIDA', haProgramada: 4, haRealizada: null }, // 0
      { estado: 'PENDIENTE', haProgramada: 6, haRealizada: null }, // ignorado
    ]
    expect(hectareasRealizadas(filas)).toBe(15)
  })
  it('usa el valor realizado explícito aunque sea cumplida', () => {
    expect(hectareasRealizadas([{ estado: 'CUMPLIDA', haProgramada: 10, haRealizada: 7 }])).toBe(7)
  })
})

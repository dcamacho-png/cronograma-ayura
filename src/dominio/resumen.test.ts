import { describe, it, expect } from 'vitest'
import { colorPorcentaje, actividadesConCambio } from './resumen'
import type { Actividad } from './tipos'

function act(parcial: Partial<Actividad>): Actividad {
  return {
    id: 'x', anio: 2026, semana: 25, dia: 1,
    areaId: 'a', fincaId: 'f', responsableId: 'r',
    descripcion: '', turno: '', estado: 'PENDIENTE',
    motivoId: null, nota: null, vecesReprogramada: 0, origenId: null,
    tareaId: null,
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

  it('una actividad con varias filas aparece UNA sola vez', () => {
    const acts = [
      act({ id: 'a1', tareaId: 'T1', dia: 1, estado: 'NO_CUMPLIDA' }),
      act({ id: 'a2', tareaId: 'T1', dia: 2, estado: 'NO_CUMPLIDA' }),
      act({ id: 'b1', tareaId: 'T2', dia: 1, estado: 'CUMPLIDA' }),
    ]
    const r = actividadesConCambio(acts)
    expect(r.length).toBe(1)
    expect(r[0].tareaId).toBe('T1')
  })
})

import { extremosFinalizadas, conteoPorEstado, hectareasRealizadas, medidasPorUnidad } from './resumen'

describe('extremosFinalizadas', () => {
  it('cuenta ACTIVIDADES finalizadas por responsable (no filas)', () => {
    const acts = [
      act({ id: 'a', tareaId: 'T1', responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ id: 'b', tareaId: 'T2', responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ id: 'c', tareaId: 'T3', responsableId: 'B', estado: 'CUMPLIDA' }),
      act({ id: 'd', tareaId: 'T4', responsableId: 'B', estado: 'PARCIAL' }),
      act({ id: 'e', tareaId: 'T5', responsableId: 'C', estado: 'NO_CUMPLIDA' }),
    ]
    const { mas, menos } = extremosFinalizadas(acts)
    expect(mas).toEqual({ responsableId: 'A', finalizadas: 2 })
    expect(menos).toEqual({ responsableId: 'C', finalizadas: 0 })
  })
  it('una actividad multi-día cumplida cuenta UNA vez para su responsable', () => {
    const acts = [
      act({ id: 'a1', tareaId: 'T1', dia: 1, responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ id: 'a2', tareaId: 'T1', dia: 2, responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ id: 'a3', tareaId: 'T1', dia: 3, responsableId: 'A', estado: 'CUMPLIDA' }),
    ]
    const { mas } = extremosFinalizadas(acts)
    expect(mas).toEqual({ responsableId: 'A', finalizadas: 1 }) // por fila daría 3
  })
  it('una actividad con 2 responsables cumplida suma 1 a cada uno', () => {
    const acts = [
      act({ id: 'p1', tareaId: 'T1', dia: 1, responsableId: 'P', estado: 'CUMPLIDA' }),
      act({ id: 'j1', tareaId: 'T1', dia: 1, responsableId: 'J', estado: 'CUMPLIDA' }),
    ]
    const { mas, menos } = extremosFinalizadas(acts)
    expect(mas?.finalizadas).toBe(1)
    expect(menos?.finalizadas).toBe(1)
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

describe('medidasPorUnidad', () => {
  it('totaliza por unidad, ignora PENDIENTE y solo deriva de ha programada en ha CUMPLIDA', () => {
    const tot = medidasPorUnidad([
      { estado: 'CUMPLIDA', haProgramada: 3, haRealizada: null, unidad: 'ha' },   // 3 ha (derivada)
      { estado: 'CUMPLIDA', haProgramada: 3, haRealizada: 2, unidad: 'ha' },      // 2 ha (medida gana)
      { estado: 'CUMPLIDA', haProgramada: 5, haRealizada: 6, unidad: 'hora' },    // 6 horas
      { estado: 'CUMPLIDA', haProgramada: 5, haRealizada: null, unidad: 'hora' }, // 0 (no se deriva en hora)
      { estado: 'CUMPLIDA', haProgramada: 0, haRealizada: 100, unidad: 'kg' },    // 100 kg
      { estado: 'PENDIENTE', haProgramada: 9, haRealizada: 9, unidad: 'ha' },     // ignorada
      { estado: 'PARCIAL', haProgramada: 4, haRealizada: 1, unidad: 'ha' },       // 1 ha
    ])
    expect(tot).toEqual({ ha: 6, hora: 6, kg: 100 })
  })
})

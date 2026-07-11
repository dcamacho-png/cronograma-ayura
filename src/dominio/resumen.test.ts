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
      act({ id: '3', estado: 'PARCIAL', vecesReprogramada: 0, dia: 5, motivoId: 'm1' }),
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

  it('PARCIAL sin motivo NO aparece; con motivo sí', () => {
    const acts = [
      act({ id: 'p0', tareaId: 'P0', estado: 'PARCIAL', motivoId: null }),
      act({ id: 'p1', tareaId: 'P1', estado: 'PARCIAL', motivoId: 'm1' }),
    ]
    const r = actividadesConCambio(acts)
    expect(r.map((a) => a.tareaId)).toEqual(['P1'])
  })
})

import { conteoPorEstado, hectareasRealizadas, medidasPorUnidad, finalizadasPorLabor } from './resumen'

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
    expect(tot).toEqual({ ha: 6, hora: 6, kg: 100, cantidad: 0 })
  })

  it('totaliza la unidad cantidad desde la medida explícita', () => {
    const tot = medidasPorUnidad([
      { estado: 'CUMPLIDA', haProgramada: 0, haRealizada: 12, unidad: 'cantidad' },
      { estado: 'PARCIAL', haProgramada: 0, haRealizada: 3, unidad: 'cantidad' },
      { estado: 'PENDIENTE', haProgramada: 9, haRealizada: 9, unidad: 'cantidad' }, // ignorada
    ])
    expect(tot).toEqual({ ha: 0, hora: 0, kg: 0, cantidad: 15 })
  })
})

describe('finalizadasPorLabor', () => {
  it('cuenta por actividad: una tarea multi-día CUMPLIDA cuenta 1', () => {
    const acts = [1, 2, 3].map((dia) =>
      act({ id: `a${dia}`, tareaId: 'T1', dia, descripcion: 'Arada', estado: 'CUMPLIDA', maquinaId: 'M1', responsableId: 'R1' }))
    expect(finalizadasPorLabor(acts)).toEqual([
      { descripcion: 'Arada', total: 1, tractor: { id: 'M1', conteo: 1 }, responsable: { id: 'R1', conteo: 1 } },
    ])
  })
  it('una actividad con 2 responsables y 2 tractores suma 1 a cada uno (empate → menor id)', () => {
    const acts = [
      act({ id: 'p1', tareaId: 'T1', dia: 1, descripcion: 'Arada', estado: 'CUMPLIDA', responsableId: 'P', maquinaId: 'M1' }),
      act({ id: 'j1', tareaId: 'T1', dia: 2, descripcion: 'Arada', estado: 'CUMPLIDA', responsableId: 'J', maquinaId: 'M2' }),
    ]
    const r = finalizadasPorLabor(acts)
    expect(r[0].total).toBe(1)
    expect(r[0].tractor).toEqual({ id: 'M1', conteo: 1 })      // M1 < M2
    expect(r[0].responsable).toEqual({ id: 'J', conteo: 1 })   // J < P
  })
  it('ignora actividades no finalizadas', () => {
    const acts = [
      act({ id: 'a', tareaId: 'T1', descripcion: 'Arada', estado: 'PARCIAL', maquinaId: 'M1', responsableId: 'R1' }),
      act({ id: 'b', tareaId: 'T2', descripcion: 'Rastrillo', estado: 'CUMPLIDA', maquinaId: 'M2', responsableId: 'R2' }),
    ]
    expect(finalizadasPorLabor(acts)).toEqual([
      { descripcion: 'Rastrillo', total: 1, tractor: { id: 'M2', conteo: 1 }, responsable: { id: 'R2', conteo: 1 } },
    ])
  })
  it('elige el de mayor conteo y ordena labores por total desc', () => {
    const acts = [
      act({ id: 'a1', tareaId: 'A1', descripcion: 'Arada', estado: 'CUMPLIDA', maquinaId: 'M1', responsableId: 'R1' }),
      act({ id: 'a2', tareaId: 'A2', descripcion: 'Arada', estado: 'CUMPLIDA', maquinaId: 'M1', responsableId: 'R1' }),
      act({ id: 'r1', tareaId: 'RT', descripcion: 'Rastrillo', estado: 'CUMPLIDA', maquinaId: 'M2', responsableId: 'R2' }),
    ]
    const r = finalizadasPorLabor(acts)
    expect(r.map((x) => x.descripcion)).toEqual(['Arada', 'Rastrillo'])
    expect(r[0]).toEqual({ descripcion: 'Arada', total: 2, tractor: { id: 'M1', conteo: 2 }, responsable: { id: 'R1', conteo: 2 } })
  })
  it('tractor null cuando la labor finalizada no tuvo máquina', () => {
    const acts = [act({ id: 'e1', tareaId: 'E1', descripcion: 'Estercolero', estado: 'CUMPLIDA', maquinaId: null, responsableId: 'R1' })]
    const r = finalizadasPorLabor(acts)
    expect(r[0].tractor).toBeNull()
    expect(r[0].responsable).toEqual({ id: 'R1', conteo: 1 })
  })
})

import { bultosAplicados, medidasPorTractor } from './resumen'
import type { Unidad } from './unidad'

describe('bultosAplicados', () => {
  it('suma los bultos por lote de las actividades no pendientes', () => {
    expect(bultosAplicados([
      { estado: 'CUMPLIDA', bultosPorLote: { l1: 3, l2: 2 } },
      { estado: 'PARCIAL', bultosPorLote: { l1: 5 } },
    ])).toBe(10)
  })
  it('ignora PENDIENTE y bultosPorLote nulo', () => {
    expect(bultosAplicados([
      { estado: 'PENDIENTE', bultosPorLote: { l1: 9 } },
      { estado: 'CUMPLIDA', bultosPorLote: null },
    ])).toBe(0)
  })
})

describe('medidasPorTractor', () => {
  const fila = (over: Partial<Parameters<typeof medidasPorTractor>[0][number]>) => ({
    estado: 'CUMPLIDA', unidad: 'ha' as Unidad, haProgramada: 0, haRealizada: null, maquinaId: null, avances: [], ...over,
  })
  it('atribuye cada avance a su tractor y unidad', () => {
    const m = medidasPorTractor([
      fila({ unidad: 'ha', avances: [{ maquinaId: 'A', cantidad: 3 }, { maquinaId: 'B', cantidad: 2 }] }),
    ])
    expect(m.get('A')).toEqual({ ha: 3, hora: 0, kg: 0, cantidad: 0 })
    expect(m.get('B')).toEqual({ ha: 2, hora: 0, kg: 0, cantidad: 0 })
  })
  it('sin avances usa haRealizada y el tractor de la actividad', () => {
    const m = medidasPorTractor([fila({ unidad: 'hora', haRealizada: 5, maquinaId: 'A' })])
    expect(m.get('A')).toEqual({ ha: 0, hora: 5, kg: 0, cantidad: 0 })
  })
  it('sin avances, unidad ha CUMPLIDA sin haRealizada usa haProgramada', () => {
    const m = medidasPorTractor([fila({ unidad: 'ha', haProgramada: 4, haRealizada: null, maquinaId: 'A' })])
    expect(m.get('A')).toEqual({ ha: 4, hora: 0, kg: 0, cantidad: 0 })
  })
  it('tractor nulo cae en la clave vacía', () => {
    const m = medidasPorTractor([fila({ unidad: 'kg', haRealizada: 7, maquinaId: null })])
    expect(m.get('')).toEqual({ ha: 0, hora: 0, kg: 7, cantidad: 0 })
  })
  it('ignora PENDIENTE', () => {
    const m = medidasPorTractor([fila({ estado: 'PENDIENTE', haRealizada: 9, maquinaId: 'A' })])
    expect(m.size).toBe(0)
  })
})

import { actividadesRecurrentes } from './resumen'

describe('actividadesRecurrentes', () => {
  it('dedup por (descripción+área) tomando el mayor nº de arrastres', () => {
    expect(actividadesRecurrentes([
      { descripcion: 'Fumigar', areaNombre: 'Nelore', vecesReprogramada: 1 },
      { descripcion: 'Fumigar', areaNombre: 'Nelore', vecesReprogramada: 3 },
    ])).toEqual([{ descripcion: 'Fumigar', areaNombre: 'Nelore', veces: 3 }])
  })
  it('ignora las que nunca se arrastraron (veces=0)', () => {
    expect(actividadesRecurrentes([
      { descripcion: 'Regar', areaNombre: 'Maiz', vecesReprogramada: 0 },
    ])).toEqual([])
  })
  it('misma descripción en distinta área son filas separadas', () => {
    const r = actividadesRecurrentes([
      { descripcion: 'Fumigar', areaNombre: 'Nelore', vecesReprogramada: 2 },
      { descripcion: 'Fumigar', areaNombre: 'Maiz', vecesReprogramada: 1 },
    ])
    expect(r).toEqual([
      { descripcion: 'Fumigar', areaNombre: 'Nelore', veces: 2 },
      { descripcion: 'Fumigar', areaNombre: 'Maiz', veces: 1 },
    ])
  })
  it('ordena por veces desc y luego descripción asc', () => {
    const r = actividadesRecurrentes([
      { descripcion: 'Bbb', areaNombre: 'A', vecesReprogramada: 2 },
      { descripcion: 'Aaa', areaNombre: 'A', vecesReprogramada: 2 },
      { descripcion: 'Ccc', areaNombre: 'A', vecesReprogramada: 5 },
    ])
    expect(r.map((x) => x.descripcion)).toEqual(['Ccc', 'Aaa', 'Bbb'])
  })
})

import { laboresPorTractor } from './resumen'

describe('laboresPorTractor', () => {
  const fila = (over: Partial<Parameters<typeof laboresPorTractor>[0][number]>) => ({
    estado: 'CUMPLIDA', descripcion: 'Fumigación', unidad: 'ha' as Unidad, haProgramada: 0, haRealizada: null as number | null, maquinaId: null as string | null, avances: [] as { maquinaId: string | null; cantidad: number }[], ...over,
  })
  it('lista las labores de cada tractor (por avance) con su medida', () => {
    const m = laboresPorTractor([
      fila({ descripcion: 'Fumigación', unidad: 'ha', avances: [{ maquinaId: 'A', cantidad: 30 }] }),
      fila({ descripcion: 'Rastra', unidad: 'ha', avances: [{ maquinaId: 'A', cantidad: 9.5 }] }),
      fila({ descripcion: 'Movimientos', unidad: 'hora', haRealizada: 5, maquinaId: 'A' }),
    ])
    expect(m.get('A')).toEqual([
      { descripcion: 'Fumigación', unidad: 'ha', total: 30 },
      { descripcion: 'Rastra', unidad: 'ha', total: 9.5 },
      { descripcion: 'Movimientos', unidad: 'hora', total: 5 },
    ])
  })
  it('suma la misma labor+unidad y ordena por total desc', () => {
    const m = laboresPorTractor([
      fila({ descripcion: 'Rastra', unidad: 'ha', avances: [{ maquinaId: 'A', cantidad: 2 }] }),
      fila({ descripcion: 'Fumigación', unidad: 'ha', avances: [{ maquinaId: 'A', cantidad: 30 }] }),
      fila({ descripcion: 'Rastra', unidad: 'ha', avances: [{ maquinaId: 'A', cantidad: 3 }] }),
    ])
    expect(m.get('A')).toEqual([
      { descripcion: 'Fumigación', unidad: 'ha', total: 30 },
      { descripcion: 'Rastra', unidad: 'ha', total: 5 },
    ])
  })
  it('tractor nulo cae en clave vacía; ignora PENDIENTE', () => {
    const m = laboresPorTractor([
      fila({ descripcion: 'Siembra', unidad: 'ha', haRealizada: 4.5, maquinaId: null }),
      fila({ estado: 'PENDIENTE', descripcion: 'X', haRealizada: 9, maquinaId: 'A' }),
    ])
    expect(m.get('')).toEqual([{ descripcion: 'Siembra', unidad: 'ha', total: 4.5 }])
    expect(m.has('A')).toBe(false)
  })
})

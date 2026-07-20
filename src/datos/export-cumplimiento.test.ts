import { describe, it, expect } from 'vitest'
import { construirFilasCumplimiento, type ActExportRaw, type CtxFilas } from './export-cumplimiento'

const ctx: CtxFilas = {
  unidadPorNombre: {},
  nombreMaquina: () => '',
  nombreResponsable: () => '',
  fechaDeDia: (d) => `d${d}`,
}

const base: ActExportRaw = {
  id: 'a1', tareaId: 't1', dia: 2, descripcion: 'Fumigar', estado: 'CUMPLIDA',
  haRealizada: 3, centroCosto: null, nota: null, unidadRealizada: null,
  responsable: { nombre: 'Ana' }, maquina: null, finca: { nombre: 'F1' },
  lotes: [{ id: 'l1', nombre: 'L1' }],
  bultosPorLote: null, lotesHechos: null, avancePorLote: null,
  tarea: { detalle: null }, area: { nombre: 'Ganadería' },
}

describe('construirFilasCumplimiento', () => {
  it('emite una fila para una actividad CUMPLIDA', () => {
    const filas = construirFilasCumplimiento([base], ctx, () => '')
    expect(filas).toHaveLength(1)
    expect(filas[0][3]).toBe('Fumigar') // col Actividad (índice 3 en COLUMNAS_CUMPLIMIENTO)
  })

  it('descarta estados que no son CUMPLIDA/PARCIAL', () => {
    const noCumplida = { ...base, id: 'a2', tareaId: 't2', estado: 'NO_CUMPLIDA' }
    expect(construirFilasCumplimiento([noCumplida], ctx, () => '')).toEqual([])
  })

  it('agrupa filas-hermanas del mismo tareaId en una sola actividad', () => {
    const hermana = { ...base, id: 'a1b', responsable: { nombre: 'Beto' } }
    const filas = construirFilasCumplimiento([base, hermana], ctx, () => '')
    expect(filas).toHaveLength(1) // una actividad, no una por responsable
    expect(filas[0][2]).toBe('Ana, Beto') // col Responsable
  })

  it('pasa la etiqueta ejecutadaPor a la columna correspondiente', () => {
    const filas = construirFilasCumplimiento([base], ctx, () => 'Maquinaria')
    expect(filas[0][13]).toBe('Maquinaria') // col "Ejecutada por"
  })
})

import { construirLibrosPorArea, type ActMaestro } from './export-cumplimiento'

const actMaestro = (over: Partial<ActMaestro>): ActMaestro => ({
  ...base, areaId: 'ar1', anio: 2026, semana: 30, area: { nombre: 'Ganadería' }, ...over,
})

describe('construirLibrosPorArea', () => {
  it('un libro por área, ordenado por nombre; área sin datos (no CUMPLIDA/PARCIAL) omitida', () => {
    const gan = actMaestro({ id: 'g1', tareaId: 'tg1' })
    const nel = actMaestro({ id: 'n1', tareaId: 'tn1', areaId: 'ar2', area: { nombre: 'Nelore' } })
    const noData = actMaestro({ id: 'x', tareaId: 'tx', areaId: 'ar3', area: { nombre: 'Zzz' }, estado: 'NO_CUMPLIDA' })
    const libros = construirLibrosPorArea([nel, gan, noData], [], [], [])
    expect(libros.map((l) => l.area)).toEqual(['Ganadería', 'Nelore'])
  })

  it('hoja General con columnas [Mes, Semana, ...] y hojas por mes del más reciente al más viejo', () => {
    const jul = actMaestro({ id: 'j', tareaId: 'tj', semana: 27 }) // W27 → 2026-07
    const ago = actMaestro({ id: 'a', tareaId: 'ta', semana: 35 }) // W35 → 2026-08
    const [libro] = construirLibrosPorArea([jul, ago], [], [], [])
    expect(libro.hojas.map((h) => h.nombre)).toEqual(['General', '2026-08', '2026-07'])
    const general = libro.hojas[0]
    expect(general.columnas[0]).toBe('Mes')
    expect(general.columnas[1]).toBe('Semana')
    expect(general.filas).toHaveLength(2)
    expect(general.filas[0][0]).toBe('2026-08') // más reciente primero
    expect(general.filas[1][0]).toBe('2026-07')
  })

  it('cada hoja de mes tiene columnas [Semana, ...] y solo las filas de ese mes', () => {
    const jul = actMaestro({ id: 'j', tareaId: 'tj', semana: 27 })
    const ago = actMaestro({ id: 'a', tareaId: 'ta', semana: 35 })
    const [libro] = construirLibrosPorArea([jul, ago], [], [], [])
    const hojaJul = libro.hojas.find((h) => h.nombre === '2026-07')!
    expect(hojaJul.columnas[0]).toBe('Semana')
    expect(hojaJul.filas).toHaveLength(1)
    expect(hojaJul.filas[0][0]).toBe('2026-S27')
    const hojaAgo = libro.hojas.find((h) => h.nombre === '2026-08')!
    expect(hojaAgo.filas).toHaveLength(1)
    expect(hojaAgo.filas[0][0]).toBe('2026-S35')
  })

  it('dentro de una semana ordena por día del más reciente al más viejo', () => {
    const mar = actMaestro({ id: 'd2', tareaId: 'td2', dia: 2, semana: 30 }) // Mar
    const vie = actMaestro({ id: 'd5', tareaId: 'td5', dia: 5, semana: 30 }) // Vie
    const [libro] = construirLibrosPorArea([mar, vie], [], [], [])
    const hoja = libro.hojas.find((h) => h.nombre === '2026-07')! // W30 → julio
    // columnas [Semana, Día, ...] → fila[1] = día; Vie (5) antes que Mar (2)
    expect(hoja.filas.map((f) => f[1])).toEqual(['Vie', 'Mar'])
  })
})

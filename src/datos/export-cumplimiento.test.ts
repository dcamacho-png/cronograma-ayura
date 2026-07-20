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

import { construirFilasMaestro, COLUMNAS_MAESTRO, type ActMaestro } from './export-cumplimiento'

const actMaestro = (over: Partial<ActMaestro>): ActMaestro => ({
  ...base, areaId: 'ar1', anio: 2026, semana: 29, area: { nombre: 'Ganadería' }, ...over,
})

describe('construirFilasMaestro', () => {
  it('antepone Semana y Área a cada fila', () => {
    const filas = construirFilasMaestro([actMaestro({})], [], [], [])
    expect(filas).toHaveLength(1)
    expect(filas[0][0]).toBe('2026-S29') // Semana
    expect(filas[0][1]).toBe('Ganadería') // Área
    expect(filas[0][5]).toBe('Fumigar') // Actividad = 3 + 2 columnas antepuestas
  })

  it('ordena por Área, luego Semana', () => {
    const filas = construirFilasMaestro([
      actMaestro({ id: 'x', tareaId: 'tx', area: { nombre: 'Nelore' }, areaId: 'ar2', semana: 28 }),
      actMaestro({ id: 'y', tareaId: 'ty', area: { nombre: 'Ganadería' }, areaId: 'ar1', semana: 30 }),
      actMaestro({ id: 'z', tareaId: 'tz', area: { nombre: 'Ganadería' }, areaId: 'ar1', semana: 29 }),
    ], [], [], [])
    expect(filas.map((f) => [f[1], f[0]])).toEqual([
      ['Ganadería', '2026-S29'],
      ['Ganadería', '2026-S30'],
      ['Nelore', '2026-S28'],
    ])
  })

  it('el header maestro tiene Semana y Área al frente', () => {
    expect(COLUMNAS_MAESTRO[0]).toBe('Semana')
    expect(COLUMNAS_MAESTRO[1]).toBe('Área')
    expect(COLUMNAS_MAESTRO.length).toBe(18) // 2 + 16 columnas de cumplimiento
  })
})

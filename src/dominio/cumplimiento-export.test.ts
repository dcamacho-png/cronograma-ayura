import { describe, it, expect } from 'vitest'
import { filaCumplimiento, COLUMNAS_CUMPLIMIENTO, type ActividadExport } from './cumplimiento-export'

const mapa: Record<string, string> = { ESTERCOLERO: 'hora', GRANEL: 'kg', ENCALADORA: 'ha' }

function act(p: Partial<ActividadExport>): ActividadExport {
  return {
    dia: 1,
    descripcion: 'ENCALADORA',
    estado: 'CUMPLIDA',
    haRealizada: 3,
    responsable: { nombre: 'Ana' },
    maquina: { nombre: '6603' },
    lotes: [{ id: 'l1', nombre: 'L1' }],
    bultosPorLote: null,
    centroCosto: null,
    lotesHechos: null,
    ...p,
  }
}

describe('COLUMNAS_CUMPLIMIENTO', () => {
  it('tiene las 13 columnas en el orden acordado', () => {
    expect([...COLUMNAS_CUMPLIMIENTO]).toEqual([
      'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados', 'Avance por lote',
    ])
  })
})

describe('filaCumplimiento', () => {
  it('actividad de ha con medida', () => {
    expect(filaCumplimiento(act({}), '15 jun', mapa)).toEqual(
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 3, 'ha', '', '', '', ''],
    )
  })
  it('actividad de hora usa "horas"', () => {
    expect(filaCumplimiento(act({ descripcion: 'ESTERCOLERO', haRealizada: 6 }), '16 jun', mapa)).toEqual(
      ['Lun', '16 jun', 'Ana', 'ESTERCOLERO', '6603', 'L1', 'Cumplida', 6, 'horas', '', '', '', ''],
    )
  })
  it('actividad de kg', () => {
    expect(filaCumplimiento(act({ descripcion: 'GRANEL', haRealizada: 100 }), '', mapa)).toEqual(
      ['Lun', '', 'Ana', 'GRANEL', '6603', 'L1', 'Cumplida', 100, 'kg', '', '', '', ''],
    )
  })
  it('sin medida deja medida y unidad vacías; traduce el estado', () => {
    expect(filaCumplimiento(act({ haRealizada: null, estado: 'NO_CUMPLIDA' }), '', mapa)).toEqual(
      ['Lun', '', 'Ana', 'ENCALADORA', '6603', 'L1', 'No cumplida', '', '', '', '', '', ''],
    )
  })
  it('descripción fuera del catálogo → ha; máquina y lotes vacíos; día 3 = Mié', () => {
    expect(filaCumplimiento(act({ descripcion: 'Algo libre', haRealizada: 2, maquina: null, lotes: [], dia: 3 }), '', mapa)).toEqual(
      ['Mié', '', 'Ana', 'Algo libre', '', '', 'Cumplida', 2, 'ha', '', '', '', ''],
    )
  })
  it('incluye el avance por lote (texto pre-formateado) en la última columna', () => {
    expect(filaCumplimiento(act({}), '15 jun', mapa, 'Lun 22 · L1 — 3 ha')[12]).toBe('Lun 22 · L1 — 3 ha')
  })
  it('incluye los bultos por lote cuando existen', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }, { id: 'l2', nombre: 'L2' }],
      bultosPorLote: { l1: 3, l2: 2.5 },
    })
    expect(filaCumplimiento(a, '15 jun', mapa)[9]).toBe('L1: 3, L2: 2.5')
  })
  it('incluye el centro de costo cuando existe', () => {
    expect(filaCumplimiento(act({ centroCosto: 'Biodigestor' }), '15 jun', mapa)[10]).toBe('Biodigestor')
  })
  it('incluye los potreros realizados cuando existen', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }, { id: 'l2', nombre: 'L2' }, { id: 'l3', nombre: 'L3' }],
      lotesHechos: ['l1', 'l3'],
    })
    expect(filaCumplimiento(a, '15 jun', mapa)[11]).toBe('L1, L3')
  })
})

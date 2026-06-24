import { describe, it, expect } from 'vitest'
import { filasCumplimiento, COLUMNAS_CUMPLIMIENTO, type ActividadExport } from './cumplimiento-export'

const mapa: Record<string, string> = { ESTERCOLERO: 'hora', GRANEL: 'kg', ENCALADORA: 'ha' }
const ctx = {
  fechaDeDia: (d: number) => `D${d}`,
  nombreMaquina: (id: string | null) => (id ? `MAQ-${id}` : ''),
}

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
    avancePorLote: null,
    ...p,
  }
}

describe('COLUMNAS_CUMPLIMIENTO', () => {
  it('tiene las 12 columnas en el orden acordado (sin "Avance por lote")', () => {
    expect([...COLUMNAS_CUMPLIMIENTO]).toEqual([
      'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados',
    ])
  })
})

describe('filasCumplimiento — sin avances (una fila, como antes)', () => {
  it('actividad de ha con medida', () => {
    expect(filasCumplimiento(act({}), '15 jun', mapa, ctx)).toEqual([
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 3, 'ha', '', '', ''],
    ])
  })
  it('sin medida deja medida y unidad vacías; traduce el estado', () => {
    expect(filasCumplimiento(act({ haRealizada: null, estado: 'NO_CUMPLIDA' }), '', mapa, ctx)).toEqual([
      ['Lun', '', 'Ana', 'ENCALADORA', '6603', 'L1', 'No cumplida', '', '', '', '', ''],
    ])
  })
  it('descripción fuera del catálogo → ha; máquina y lotes vacíos; día 3 = Mié', () => {
    expect(filasCumplimiento(act({ descripcion: 'Algo libre', haRealizada: 2, maquina: null, lotes: [], dia: 3 }), '', mapa, ctx)).toEqual([
      ['Mié', '', 'Ana', 'Algo libre', '', '', 'Cumplida', 2, 'ha', '', '', ''],
    ])
  })
})

describe('filasCumplimiento — con avances (una fila por avance)', () => {
  it('dos avances del mismo lote en días distintos → dos filas con la cantidad de cada avance', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }],
      avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 2 }, { dia: 2, maquinaId: 'm9', cantidad: 3 }] },
    })
    expect(filasCumplimiento(a, '15 jun', mapa, ctx)).toEqual([
      // máquina null → cae a la máquina de la actividad (6603)
      ['Lun', 'D1', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 2, 'ha', '', '', ''],
      // máquina del avance → MAQ-m9
      ['Mar', 'D2', 'Ana', 'ENCALADORA', 'MAQ-m9', 'L1', 'Cumplida', 3, 'ha', '', '', ''],
    ])
  })
  it('avances en dos lotes → filas en orden lote→día (según a.lotes), no según las claves del JSON', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }, { id: 'l2', nombre: 'L2' }],
      avancePorLote: { l2: [{ dia: 3, maquinaId: null, cantidad: 1 }], l1: [{ dia: 1, maquinaId: null, cantidad: 2 }] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    expect(filas.map((f) => [f[5], f[7]])).toEqual([['L1', 2], ['L2', 1]])
  })
  it('repite los datos de actividad (bultos, centro de costo, potreros) en cada fila de avance', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }, { id: 'l2', nombre: 'L2' }],
      bultosPorLote: { l1: 3, l2: 2 },
      centroCosto: 'Ceba',
      lotesHechos: ['l1'],
      avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 2 }, { dia: 2, maquinaId: null, cantidad: 4 }] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    expect(filas.length).toBe(2)
    for (const f of filas) {
      expect(f[9]).toBe('L1: 3, L2: 2') // bultos por lote
      expect(f[10]).toBe('Ceba')         // centro de costo
      expect(f[11]).toBe('L1')           // potreros realizados
    }
  })
})

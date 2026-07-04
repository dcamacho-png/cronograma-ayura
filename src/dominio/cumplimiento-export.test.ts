import { describe, it, expect } from 'vitest'
import { filasCumplimiento, filasCumplimientoGrupo, COLUMNAS_CUMPLIMIENTO, type ActividadExport } from './cumplimiento-export'

const mapa: Record<string, string> = { ESTERCOLERO: 'hora', GRANEL: 'kg', ENCALADORA: 'ha' }
const ctx = {
  fechaDeDia: (d: number) => `D${d}`,
  nombreMaquina: (id: string | null) => (id ? `MAQ-${id}` : ''),
  nombreResponsable: (id: string | null) => (id ? `RESP-${id}` : ''),
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
    finca: null,
    nota: null,
    unidadRealizada: null,
    detalle: null,
    ...p,
  }
}

describe('COLUMNAS_CUMPLIMIENTO', () => {
  it('tiene las 16 columnas en el orden acordado (Finca tras Lote(s), Observación, Detalle (banco) al final)', () => {
    expect([...COLUMNAS_CUMPLIMIENTO]).toEqual([
      'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Finca', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados', 'Ejecutada por', 'Observación', 'Detalle (banco)',
    ])
  })
})

describe('filasCumplimiento — sin avances (una fila, como antes)', () => {
  it('actividad de ha con medida; "Ejecutada por" vacía cuando es propia', () => {
    expect(filasCumplimiento(act({}), '15 jun', mapa, ctx)).toEqual([
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', '', 'Cumplida', 3, 'ha', '', '', '', '', '', ''],
    ])
  })
  it('sin medida deja medida y unidad vacías; traduce el estado', () => {
    expect(filasCumplimiento(act({ haRealizada: null, estado: 'NO_CUMPLIDA' }), '', mapa, ctx)).toEqual([
      ['Lun', '', 'Ana', 'ENCALADORA', '6603', 'L1', '', 'No se hizo', '', '', '', '', '', '', '', ''],
    ])
  })
  it('descripción fuera del catálogo → ha; máquina y lotes vacíos; día 3 = Mié', () => {
    expect(filasCumplimiento(act({ descripcion: 'Algo libre', haRealizada: 2, maquina: null, lotes: [], dia: 3 }), '', mapa, ctx)).toEqual([
      ['Mié', '', 'Ana', 'Algo libre', '', '', '', 'Cumplida', 2, 'ha', '', '', '', '', '', ''],
    ])
  })
  it('rellena "Ejecutada por" con el área ejecutora cuando se pasa (actividad solicitada a otra área)', () => {
    expect(filasCumplimiento(act({}), '15 jun', mapa, ctx, 'Maquinaria')).toEqual([
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', '', 'Cumplida', 3, 'ha', '', '', '', 'Maquinaria', '', ''],
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
      ['Lun', 'D1', 'Ana', 'ENCALADORA', '6603', 'L1', '', 'Cumplida', 2, 'ha', '', '', '', '', '', ''],
      // máquina del avance → MAQ-m9
      ['Mar', 'D2', 'Ana', 'ENCALADORA', 'MAQ-m9', 'L1', '', 'Cumplida', 3, 'ha', '', '', '', '', '', ''],
    ])
  })
  it('avances en dos lotes → filas en orden lote→día (según a.lotes), no según las claves del JSON', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }, { id: 'l2', nombre: 'L2' }],
      avancePorLote: { l2: [{ dia: 3, maquinaId: null, cantidad: 1 }], l1: [{ dia: 1, maquinaId: null, cantidad: 2 }] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    expect(filas.map((f) => [f[5], f[8]])).toEqual([['L1', 2], ['L2', 1]])
  })
  it('la observación de la entrada va a la columna 14; sin ella cae a la nota de la actividad; detalle va a la columna 15', () => {
    const a = act({
      nota: 'nota actividad',
      lotes: [{ id: 'l1', nombre: 'L1' }],
      avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 2, observacion: 'obs avance' }, { dia: 2, maquinaId: null, cantidad: 3 }] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    expect(filas[0][14]).toBe('obs avance')
    expect(filas[1][14]).toBe('nota actividad')
    expect(filas[0][15]).toBe('')
    expect(filas[1][15]).toBe('')
  })
})

describe('filasCumplimiento — parcial sin avances no se emite', () => {
  it('PARCIAL sin avances → ninguna fila (p. ej. la actividad inicial que se cambió)', () => {
    expect(filasCumplimiento(act({ estado: 'PARCIAL', avancePorLote: null }), '15 jun', mapa, ctx)).toEqual([])
  })
  it('CUMPLIDA sin avances → una fila (como antes)', () => {
    expect(filasCumplimiento(act({ estado: 'CUMPLIDA', avancePorLote: null }), '15 jun', mapa, ctx)).toEqual([
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', '', 'Cumplida', 3, 'ha', '', '', '', '', '', ''],
    ])
  })
  it('PARCIAL con avances → sí emite las filas de avance', () => {
    const a = act({ estado: 'PARCIAL', avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 2 }] } })
    expect(filasCumplimiento(a, '15 jun', mapa, ctx)).toHaveLength(1)
  })
})

describe('filasCumplimientoGrupo — una sola fila por actividad aunque tenga varios responsables', () => {
  it('grupo de 2 responsables sin avances → UNA fila, nombres unidos, medida NO duplicada', () => {
    // Las acciones de grupo consolidan la misma medida en cada hermana: aquí ambas
    // traen haRealizada=3. El export debe mostrar 3 una sola vez, no 6.
    const grupo = [
      act({ responsable: { nombre: 'Ana' }, haRealizada: 3 }),
      act({ responsable: { nombre: 'Beto' }, haRealizada: 3 }),
    ]
    expect(filasCumplimientoGrupo(grupo, '15 jun', mapa, ctx)).toEqual([
      ['Lun', '15 jun', 'Ana, Beto', 'ENCALADORA', '6603', 'L1', '', 'Cumplida', 3, 'ha', '', '', '', '', '', ''],
    ])
  })

  it('un solo responsable → igual que filasCumplimiento', () => {
    const grupo = [act({})]
    expect(filasCumplimientoGrupo(grupo, '15 jun', mapa, ctx)).toEqual(
      filasCumplimiento(act({}), '15 jun', mapa, ctx),
    )
  })

  it('estados mezclados entre hermanas → la actividad es Parcial (con avance, para que emita fila)', () => {
    const grupo = [
      act({ responsable: { nombre: 'Ana' }, estado: 'CUMPLIDA', avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 2 }] } }),
      act({ responsable: { nombre: 'Beto' }, estado: 'PENDIENTE' }),
    ]
    const filas = filasCumplimientoGrupo(grupo, '15 jun', mapa, ctx)
    expect(filas).toHaveLength(1)
    expect(filas[0][7]).toBe('Parcial')        // Estado
    expect(filas[0][2]).toBe('Ana, Beto')      // Responsable
  })

  it('propaga "Ejecutada por" (actividad solicitada a otra área)', () => {
    const grupo = [act({ responsable: { nombre: 'Ana' } }), act({ responsable: { nombre: 'Beto' } })]
    const filas = filasCumplimientoGrupo(grupo, '15 jun', mapa, ctx, 'Maquinaria')
    expect(filas[0][13]).toBe('Maquinaria')
  })

  it('no repite responsables duplicados', () => {
    const grupo = [act({ responsable: { nombre: 'Ana' } }), act({ responsable: { nombre: 'Ana' } })]
    expect(filasCumplimientoGrupo(grupo, '15 jun', mapa, ctx)[0][2]).toBe('Ana')
  })
})

describe('filasCumplimiento — con avances extra', () => {
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
      expect(f[10]).toBe('L1: 3, L2: 2') // bultos por lote
      expect(f[11]).toBe('Ceba')          // centro de costo
      expect(f[12]).toBe('L1')            // potreros realizados
    }
  })
})

describe('filasCumplimiento — centro de costo por avance', () => {
  it('usa el centroCosto de la entrada; si no, el de la actividad', () => {
    const a = act({
      centroCosto: 'ActNivel',
      avancePorLote: {
        l1: [
          { dia: 1, maquinaId: null, cantidad: 2, centroCosto: 'Ceba' },
          { dia: 2, maquinaId: null, cantidad: 3 },
        ],
      },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    // Columna "Centro de costo" = índice 11
    expect(filas[0][11]).toBe('Ceba')
    expect(filas[1][11]).toBe('ActNivel')
  })
})

describe('filasCumplimiento — Finca y Observación (columnas nuevas)', () => {
  it('incluye la finca de la actividad y la nota (novedad) en la fila', () => {
    expect(
      filasCumplimiento(act({ estado: 'NO_CUMPLIDA', haRealizada: null, finca: { nombre: 'La Esperanza' }, nota: 'Cambiada por: Riego' }), '', mapa, ctx),
    ).toEqual([
      ['Lun', '', 'Ana', 'ENCALADORA', '6603', 'L1', 'La Esperanza', 'No se hizo', '', '', '', '', '', '', 'Cambiada por: Riego', ''],
    ])
  })
  it('finca en cada fila de avance', () => {
    const a = act({
      finca: { nombre: 'La Esperanza' },
      avancePorLote: { l1: [{ dia: 2, maquinaId: null, cantidad: 4 }] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    expect(filas[0][6]).toBe('La Esperanza')
    expect(filas[0][14]).toBe('') // Observación vacía (nota null)
    expect(filas[0][15]).toBe('') // Detalle vacío (detalle null)
  })
})

describe('filasCumplimiento — responsable del avance + unidad de actividad', () => {
  it('usa el responsable de la entrada (fallback al de la actividad) y la unidad de la actividad', () => {
    const a = act({
      unidadRealizada: 'jornales',
      avancePorLote: { l1: [
        { dia: 1, maquinaId: null, cantidad: 2, responsableId: 'R2' },
        { dia: 2, maquinaId: null, cantidad: 3 },
      ] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    // Responsable = índice 2, Unidad = índice 9
    expect(filas[0][2]).toBe('RESP-R2')
    expect(filas[1][2]).toBe('Ana')       // fallback al responsable de la actividad
    expect(filas[0][9]).toBe('jornales')  // unidad de la actividad (verbatim)
  })
})

describe('filasCumplimiento — Detalle (banco)', () => {
  it('incluye el detalle del banco como última columna', () => {
    const base = {
      dia: 1, descripcion: 'Fertilización', estado: 'CUMPLIDA', haRealizada: 5,
      responsable: { nombre: 'Ana' }, maquina: null, lotes: [{ id: 'l1', nombre: 'L1' }],
      bultosPorLote: null, centroCosto: null, lotesHechos: null, avancePorLote: null,
      finca: null, nota: 'obs', unidadRealizada: null, detalle: null,
    }
    const ctx2 = { fechaDeDia: () => '01/07', nombreMaquina: () => '' }
    const conDetalle = filasCumplimiento({ ...base, detalle: 'aplicar urea' }, '01/07', {}, ctx2)
    expect(conDetalle[0][conDetalle[0].length - 1]).toBe('aplicar urea')
    const sinDetalle = filasCumplimiento(base, '01/07', {}, ctx2)
    expect(sinDetalle[0][sinDetalle[0].length - 1]).toBe('')
  })
})

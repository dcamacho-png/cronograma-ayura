import { describe, it, expect } from 'vitest'
import {
  lotesPendientes, textoAvancePorLote, textoAvanceConFecha,
  normalizarAvancePorLote, totalAvanceLotes, agregarAvances, type AvancePorLote,
} from './avance-lote'

const lotes = [{ id: 'a', nombre: 'L-A' }, { id: 'b', nombre: 'L-B' }, { id: 'c', nombre: 'L-C' }]
// Forma nueva: lista por lote. L-A con dos avances (lun 3, mar 2), L-B con uno (mar 2).
const avance: AvancePorLote = {
  a: [{ dia: 1, maquinaId: null, cantidad: 3 }, { dia: 2, maquinaId: null, cantidad: 2 }],
  b: [{ dia: 2, maquinaId: 'm1', cantidad: 2 }],
}

describe('normalizarAvancePorLote', () => {
  it('envuelve la forma vieja (un objeto por lote) en lista', () => {
    const viejo = { a: { dia: 1, maquinaId: null, cantidad: 3 } }
    expect(normalizarAvancePorLote(viejo)).toEqual({ a: [{ dia: 1, maquinaId: null, cantidad: 3 }] })
  })
  it('deja intacta la forma nueva (lista)', () => {
    expect(normalizarAvancePorLote(avance)).toEqual(avance)
  })
  it('null/undefined -> {}', () => {
    expect(normalizarAvancePorLote(null)).toEqual({})
    expect(normalizarAvancePorLote(undefined)).toEqual({})
  })
})

describe('lotesPendientes', () => {
  it('devuelve los lotes sin ninguna entrada', () => {
    expect(lotesPendientes(lotes, avance).map((l) => l.id)).toEqual(['c'])
  })
  it('sin avance devuelve todos', () => {
    expect(lotesPendientes(lotes, null).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('textoAvancePorLote', () => {
  it('lista la SUMA por lote con avance, en orden', () => {
    expect(textoAvancePorLote(lotes, avance)).toBe('L-A: 5, L-B: 2')
  })
  it('vacío si no hay avance', () => {
    expect(textoAvancePorLote(lotes, null)).toBe('')
  })
})

describe('textoAvanceConFecha', () => {
  it('arma una entrada por cada avance (varias por lote), en orden lote→día', () => {
    expect(textoAvanceConFecha(lotes, avance, 'ha', (d) => `D${d}`))
      .toBe('D1 · L-A — 3 ha; D2 · L-A — 2 ha; D2 · L-B — 2 ha')
  })
  it('vacío si no hay avance', () => {
    expect(textoAvanceConFecha([{ id: 'a', nombre: 'L-A' }], null, 'ha', (d) => `D${d}`)).toBe('')
  })
})

describe('totalAvanceLotes', () => {
  it('suma las cantidades de los lotes dados (todas sus entradas)', () => {
    expect(totalAvanceLotes(lotes, avance)).toBe(7) // a: 3+2, b: 2, c: sin avance
  })
  it('ignora entradas de lotes ausentes de la lista', () => {
    expect(totalAvanceLotes([{ id: 'a' }], avance)).toBe(5) // solo a (3+2); b se ignora
  })
  it('0 si no hay avance', () => {
    expect(totalAvanceLotes(lotes, null)).toBe(0)
  })
})

describe('agregarAvances', () => {
  it('agrega una entrada nueva a la lista del lote (sin mutar la entrada original)', () => {
    const base: AvancePorLote = { a: [{ dia: 1, maquinaId: null, cantidad: 3 }] }
    const out = agregarAvances(base, 2, 'm1', [{ loteId: 'a', cantidad: 2 }, { loteId: 'b', cantidad: 4 }])
    expect(out).toEqual({
      a: [{ dia: 1, maquinaId: null, cantidad: 3 }, { dia: 2, maquinaId: 'm1', cantidad: 2 }],
      b: [{ dia: 2, maquinaId: 'm1', cantidad: 4 }],
    })
    expect(base).toEqual({ a: [{ dia: 1, maquinaId: null, cantidad: 3 }] }) // intacto
  })
})

describe('agregarAvances — centro de costo', () => {
  it('guarda el centroCosto en cada entrada nueva', () => {
    const out = agregarAvances({}, 2, 'M1', [{ loteId: 'l1', cantidad: 3 }], 'Ceba')
    expect(out.l1).toEqual([{ dia: 2, maquinaId: 'M1', cantidad: 3, centroCosto: 'Ceba' }])
  })
  it('sin centroCosto → entrada sin ese campo (o null)', () => {
    const out = agregarAvances({}, 1, null, [{ loteId: 'l1', cantidad: 2 }])
    expect(out.l1[0]).toMatchObject({ dia: 1, maquinaId: null, cantidad: 2 })
    expect(out.l1[0].centroCosto ?? null).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import {
  lotesPendientes, textoAvancePorLote, textoAvanceConFecha,
  normalizarAvancePorLote, totalAvanceLotes, agregarAvances, completarAvancesCumplida, type AvancePorLote,
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
  const lotesSimples = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('devuelve los lotes sin ninguna entrada', () => {
    expect(lotesPendientes(lotes, avance).map((l) => l.id)).toEqual(['c'])
  })
  it('sin avance devuelve todos', () => {
    expect(lotesPendientes(lotes, null).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })

  it('sin avances: todos pendientes', () => {
    expect(lotesPendientes(lotesSimples, null).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })

  it('un lote con cantidad > 0 deja de ser pendiente', () => {
    const av = { a: [{ dia: 1, maquinaId: null, cantidad: 5 }] }
    expect(lotesPendientes(lotesSimples, av).map((l) => l.id)).toEqual(['b', 'c'])
  })

  it('entrada con cantidad 0 sigue pendiente', () => {
    const av = { a: [{ dia: 1, maquinaId: null, cantidad: 0 }] }
    expect(lotesPendientes(lotesSimples, av).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })

  it('acepta la forma vieja (objeto por lote)', () => {
    const av = { b: { dia: 2, maquinaId: null, cantidad: 3 } }
    expect(lotesPendientes(lotesSimples, av).map((l) => l.id)).toEqual(['a', 'c'])
  })

  it('un lote en lotesHechos no es pendiente aunque no tenga entrada de avance', () => {
    expect(lotesPendientes(lotesSimples, null, ['a']).map((l) => l.id)).toEqual(['b', 'c'])
  })

  it('un lote que ni está en lotesHechos ni tiene avance sigue pendiente', () => {
    expect(lotesPendientes(lotesSimples, null, ['b']).map((l) => l.id)).toEqual(['a', 'c'])
  })

  it('omitir el tercer argumento preserva el comportamiento anterior', () => {
    expect(lotesPendientes(lotes, avance).map((l) => l.id)).toEqual(['c'])
    expect(lotesPendientes(lotesSimples, null).map((l) => l.id)).toEqual(['a', 'b', 'c'])
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
  it('incluye la observación del avance cuando existe', () => {
    const conObs: AvancePorLote = {
      a: [{ dia: 1, maquinaId: null, cantidad: 3, observacion: 'llovió' }],
      b: [{ dia: 2, maquinaId: null, cantidad: 2 }],
    }
    expect(textoAvanceConFecha(lotes, conObs, 'ha', (d) => `D${d}`))
      .toBe('D1 · L-A — 3 ha · llovió; D2 · L-B — 2 ha')
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

describe('agregarAvances — responsable', () => {
  it('guarda responsableId en la entrada', () => {
    const out = agregarAvances({}, 3, 'M1', [{ loteId: 'l1', cantidad: 4 }], 'Ceba', 'R9')
    expect(out.l1).toEqual([{ dia: 3, maquinaId: 'M1', cantidad: 4, centroCosto: 'Ceba', responsableId: 'R9' }])
  })
  it('sin responsableId → entrada sin ese campo', () => {
    const out = agregarAvances({}, 1, null, [{ loteId: 'l1', cantidad: 2 }])
    expect(out.l1[0].responsableId ?? null).toBeNull()
  })
})

describe('agregarAvances — observación', () => {
  it('guarda la observación en cada entrada nueva', () => {
    const out = agregarAvances({}, 2, 'M1', [{ loteId: 'l1', cantidad: 3 }, { loteId: 'l2', cantidad: 1 }], 'Ceba', 'R9', 'llovió a media mañana')
    expect(out.l1[0]).toMatchObject({ dia: 2, maquinaId: 'M1', cantidad: 3, centroCosto: 'Ceba', responsableId: 'R9', observacion: 'llovió a media mañana' })
    expect(out.l2[0].observacion).toBe('llovió a media mañana')
  })
  it('sin observación → entrada sin ese campo', () => {
    const out = agregarAvances({}, 1, null, [{ loteId: 'l1', cantidad: 2 }])
    expect(out.l1[0].observacion ?? null).toBeNull()
  })
})

import { editarAvanceEntrada, eliminarAvanceEntrada } from './avance-lote'

describe('editarAvanceEntrada', () => {
  const base = () => ({ a: [{ dia: 1, maquinaId: null, cantidad: 5 }, { dia: 2, maquinaId: null, cantidad: 3, observacion: 'x' }] })

  it('cambia solo los campos dados de la entrada indicada', () => {
    const out = editarAvanceEntrada(base(), 'a', 0, { cantidad: 8, dia: 4 })
    expect(out.a[0]).toEqual({ dia: 4, maquinaId: null, cantidad: 8 })
    expect(out.a[1]).toEqual({ dia: 2, maquinaId: null, cantidad: 3, observacion: 'x' })
  })

  it('observación vacía elimina el campo', () => {
    const out = editarAvanceEntrada(base(), 'a', 1, { observacion: '' })
    expect('observacion' in out.a[1]).toBe(false)
  })

  it('no muta el original', () => {
    const orig = base()
    editarAvanceEntrada(orig, 'a', 0, { cantidad: 99 })
    expect(orig.a[0].cantidad).toBe(5)
  })

  it('índice fuera de rango o lote inexistente: sin cambios', () => {
    const orig = base()
    expect(editarAvanceEntrada(orig, 'a', 9, { cantidad: 1 })).toBe(orig)
    expect(editarAvanceEntrada(orig, 'z', 0, { cantidad: 1 })).toBe(orig)
  })
})

describe('eliminarAvanceEntrada', () => {
  const base = () => ({ a: [{ dia: 1, maquinaId: null, cantidad: 5 }, { dia: 2, maquinaId: null, cantidad: 3 }], b: [{ dia: 1, maquinaId: null, cantidad: 2 }] })

  it('quita la entrada indicada', () => {
    const out = eliminarAvanceEntrada(base(), 'a', 0)
    expect(out.a).toEqual([{ dia: 2, maquinaId: null, cantidad: 3 }])
  })

  it('si el lote queda vacío, borra la clave', () => {
    const out = eliminarAvanceEntrada(base(), 'b', 0)
    expect('b' in out).toBe(false)
  })

  it('índice fuera de rango: sin cambios', () => {
    const orig = base()
    expect(eliminarAvanceEntrada(orig, 'a', 9)).toBe(orig)
  })
})

describe('completarAvancesCumplida', () => {
  const lotesHa = [
    { id: 'a', nombre: 'L-A', hectareas: 5 },
    { id: 'b', nombre: 'L-B', hectareas: 3 },
    { id: 'c', nombre: 'L-C', hectareas: null },
  ]

  it('sin avances: cada lote recibe una entrada con su área (hectáreas) en el día dado', () => {
    const out = completarAvancesCumplida(lotesHa, {}, 4)
    expect(out.a).toEqual([{ dia: 4, maquinaId: null, cantidad: 5 }])
    expect(out.b).toEqual([{ dia: 4, maquinaId: null, cantidad: 3 }])
    // lote sin hectáreas: entrada con cantidad 0 (para que igual aparezca por lote)
    expect(out.c).toEqual([{ dia: 4, maquinaId: null, cantidad: 0 }])
    expect(totalAvanceLotes(lotesHa, out)).toBe(8)
  })

  it('respeta los lotes que ya tienen avances; solo completa los faltantes', () => {
    const previo: AvancePorLote = { a: [{ dia: 1, maquinaId: null, cantidad: 2 }] }
    const out = completarAvancesCumplida(lotesHa, previo, 3)
    expect(out.a).toEqual([{ dia: 1, maquinaId: null, cantidad: 2 }]) // intacto
    expect(out.b).toEqual([{ dia: 3, maquinaId: null, cantidad: 3 }])
    expect(out.c).toEqual([{ dia: 3, maquinaId: null, cantidad: 0 }])
  })

  it('todos los lotes ya tienen avance: devuelve el mismo objeto', () => {
    const previo: AvancePorLote = {
      a: [{ dia: 1, maquinaId: null, cantidad: 2 }],
      b: [{ dia: 1, maquinaId: null, cantidad: 1 }],
      c: [{ dia: 1, maquinaId: null, cantidad: 1 }],
    }
    expect(completarAvancesCumplida(lotesHa, previo, 3)).toBe(previo)
  })
})

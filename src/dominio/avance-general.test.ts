import { describe, it, expect } from 'vitest'
import {
  normalizarAvanceGeneral, agregarAvanceGeneral, totalAvanceGeneral,
  editarAvanceGeneral, eliminarAvanceGeneral, textoAvanceGeneral,
  type AvanceGeneralEntrada,
} from './avance-general'

const e = (dia: number, cantidad: number, extra: Partial<AvanceGeneralEntrada> = {}): AvanceGeneralEntrada => ({
  dia, cantidad, maquinaId: null, centroCosto: null, responsableId: null, observacion: null, ...extra,
})

describe('normalizarAvanceGeneral', () => {
  it('null/indefinido/no-arreglo da lista vacía', () => {
    expect(normalizarAvanceGeneral(null)).toEqual([])
    expect(normalizarAvanceGeneral(undefined)).toEqual([])
    expect(normalizarAvanceGeneral({ dia: 1 })).toEqual([])
  })

  it('descarta entradas mal formadas y completa los opcionales', () => {
    expect(normalizarAvanceGeneral([{ dia: 2, cantidad: 4 }, { cantidad: 3 }, null, 'x'])).toEqual([
      e(2, 4),
    ])
  })

  it('conserva máquina, centro de costo, responsable y observación', () => {
    expect(normalizarAvanceGeneral([
      { dia: 3, cantidad: 8, maquinaId: 'm1', centroCosto: 'Ceba', responsableId: 'r1', observacion: 'taller' },
    ])).toEqual([e(3, 8, { maquinaId: 'm1', centroCosto: 'Ceba', responsableId: 'r1', observacion: 'taller' })])
  })

  it('una cantidad no numérica cuenta como 0 (la entrada del día no se pierde)', () => {
    expect(normalizarAvanceGeneral([{ dia: 5 }])).toEqual([e(5, 0)])
  })
})

describe('agregarAvanceGeneral', () => {
  it('acumula días distintos en el orden en que se registran', () => {
    const l1 = agregarAvanceGeneral([], e(1, 4))
    const l2 = agregarAvanceGeneral(l1, e(3, 2))
    expect(l2).toEqual([e(1, 4), e(3, 2)])
  })

  it('re-registrar el mismo día REEMPLAZA en su posición (no acumula)', () => {
    const lista = [e(1, 4), e(3, 2)]
    expect(agregarAvanceGeneral(lista, e(1, 9, { observacion: 'corregido' }))).toEqual([
      e(1, 9, { observacion: 'corregido' }),
      e(3, 2),
    ])
  })

  it('no muta la lista recibida', () => {
    const lista = [e(1, 4)]
    agregarAvanceGeneral(lista, e(2, 1))
    expect(lista).toEqual([e(1, 4)])
  })
})

describe('totalAvanceGeneral', () => {
  it('suma las cantidades de todos los días', () => {
    expect(totalAvanceGeneral([e(1, 4), e(2, 2.5), e(3, 0)])).toBe(6.5)
  })

  it('lista vacía suma 0', () => {
    expect(totalAvanceGeneral([])).toBe(0)
  })
})

describe('editarAvanceGeneral', () => {
  it('cambia día, cantidad y observación de una entrada', () => {
    const lista = [e(1, 4), e(2, 1)]
    expect(editarAvanceGeneral(lista, 0, { dia: 5, cantidad: 7, observacion: 'nueva' })).toEqual([
      e(5, 7, { observacion: 'nueva' }),
      e(2, 1),
    ])
  })

  it('observación vacía la borra; los campos no enviados se conservan', () => {
    const lista = [e(1, 4, { observacion: 'vieja', maquinaId: 'm1' })]
    expect(editarAvanceGeneral(lista, 0, { observacion: null })).toEqual([e(1, 4, { maquinaId: 'm1' })])
  })

  it('índice fuera de rango devuelve la misma lista', () => {
    const lista = [e(1, 4)]
    expect(editarAvanceGeneral(lista, 3, { cantidad: 9 })).toBe(lista)
    expect(editarAvanceGeneral(lista, -1, { cantidad: 9 })).toBe(lista)
  })
})

describe('eliminarAvanceGeneral', () => {
  it('quita la entrada del índice', () => {
    expect(eliminarAvanceGeneral([e(1, 4), e(2, 1)], 0)).toEqual([e(2, 1)])
  })

  it('índice fuera de rango devuelve la misma lista', () => {
    const lista = [e(1, 4)]
    expect(eliminarAvanceGeneral(lista, 9)).toBe(lista)
  })
})

describe('textoAvanceGeneral', () => {
  const etiqueta = (d: number) => ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][d]

  it('una entrada por día, con unidad y observación', () => {
    expect(textoAvanceGeneral([e(1, 4), e(3, 2, { observacion: 'cambio de aceite' })], 'hora', etiqueta))
      .toBe('Lun — 4 hora; Mié — 2 hora · cambio de aceite')
  })

  it('lista vacía da texto vacío', () => {
    expect(textoAvanceGeneral([], 'hora', etiqueta)).toBe('')
  })
})

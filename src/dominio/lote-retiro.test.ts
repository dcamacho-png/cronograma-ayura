import { describe, it, expect } from 'vitest'
import {
  totalReferencias, puedeBorrarse, textoReferencias, type ReferenciasLote,
} from './lote-retiro'

const refs = (p: Partial<ReferenciasLote> = {}): ReferenciasLote =>
  ({ actividades: 0, tareas: 0, tareasMulti: 0, notas: 0, ...p })

describe('totalReferencias', () => {
  it('suma las cuatro relaciones', () => {
    expect(totalReferencias(refs({ actividades: 2, tareas: 1, tareasMulti: 3, notas: 1 }))).toBe(7)
  })
  it('sin referencias suma 0', () => {
    expect(totalReferencias(refs())).toBe(0)
  })
})

describe('puedeBorrarse', () => {
  it('un potrero sin ninguna referencia se puede borrar', () => {
    expect(puedeBorrarse(refs())).toBe(true)
  })
  it('una sola referencia de cualquier tipo lo bloquea', () => {
    expect(puedeBorrarse(refs({ actividades: 1 }))).toBe(false)
    expect(puedeBorrarse(refs({ tareas: 1 }))).toBe(false)
    expect(puedeBorrarse(refs({ tareasMulti: 1 }))).toBe(false)
    expect(puedeBorrarse(refs({ notas: 1 }))).toBe(false)
  })
})

describe('textoReferencias', () => {
  it('singular y plural de actividades', () => {
    expect(textoReferencias(refs({ actividades: 1 }))).toBe('1 actividad')
    expect(textoReferencias(refs({ actividades: 3 }))).toBe('3 actividades')
  })
  it('las dos relaciones de tarea se suman en un solo término', () => {
    expect(textoReferencias(refs({ tareas: 1, tareasMulti: 2 }))).toBe('3 tareas')
    expect(textoReferencias(refs({ tareasMulti: 1 }))).toBe('1 tarea')
  })
  it('nota en singular y plural', () => {
    expect(textoReferencias(refs({ notas: 1 }))).toBe('1 nota del conversatorio')
    expect(textoReferencias(refs({ notas: 2 }))).toBe('2 notas del conversatorio')
  })
  it('varias clases se enumeran separadas por coma, en orden fijo', () => {
    expect(textoReferencias(refs({ actividades: 2, tareas: 3, notas: 1 })))
      .toBe('2 actividades, 3 tareas, 1 nota del conversatorio')
  })
  it('sin referencias da texto vacío', () => {
    expect(textoReferencias(refs())).toBe('')
  })
})

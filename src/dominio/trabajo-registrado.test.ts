import { describe, it, expect } from 'vitest'
import { trabajoRegistrado, grupoTrabajado, type FilaTrabajo } from './trabajo-registrado'

const fila = (p: Partial<FilaTrabajo> = {}): FilaTrabajo => ({
  estado: 'PENDIENTE', cerrada: false, avancePorLote: null, avanceGeneral: null, ...p,
})

describe('trabajoRegistrado', () => {
  it('una actividad CUMPLIDA cuenta como trabajada', () => {
    expect(trabajoRegistrado(fila({ estado: 'CUMPLIDA' }))).toBe(true)
  })

  it('una actividad cerrada cuenta, sea cual sea su estado', () => {
    expect(trabajoRegistrado(fila({ estado: 'PARCIAL', cerrada: true }))).toBe(true)
    expect(trabajoRegistrado(fila({ estado: 'NO_CUMPLIDA', cerrada: true }))).toBe(true)
  })

  it('una PARCIAL con avances por potrero cuenta', () => {
    expect(trabajoRegistrado(fila({
      estado: 'PARCIAL',
      avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 3 }] },
    }))).toBe(true)
  })

  it('una PARCIAL con bitácora de días cuenta', () => {
    expect(trabajoRegistrado(fila({
      estado: 'PARCIAL',
      avanceGeneral: [{ dia: 2, cantidad: 4 }],
    }))).toBe(true)
  })

  it('una PARCIAL SIN avances no cuenta (se marcó parcial sin registrar nada)', () => {
    expect(trabajoRegistrado(fila({ estado: 'PARCIAL' }))).toBe(false)
    expect(trabajoRegistrado(fila({ estado: 'PARCIAL', avancePorLote: {}, avanceGeneral: [] }))).toBe(false)
  })

  it('PENDIENTE no cuenta aunque traiga un JSON vacío', () => {
    expect(trabajoRegistrado(fila())).toBe(false)
    expect(trabajoRegistrado(fila({ avancePorLote: {} }))).toBe(false)
  })

  it('"No se hizo" y "Reprogramada" NO cuentan: son justamente lo no hecho', () => {
    expect(trabajoRegistrado(fila({ estado: 'NO_CUMPLIDA' }))).toBe(false)
    expect(trabajoRegistrado(fila({ estado: 'REPROGRAMADA' }))).toBe(false)
  })

  it('una NO_CUMPLIDA con avances viejos tampoco cuenta (el cierre manda)', () => {
    expect(trabajoRegistrado(fila({
      estado: 'NO_CUMPLIDA',
      avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 3 }] },
    }))).toBe(false)
  })
})

describe('grupoTrabajado', () => {
  it('basta una fila-hermana trabajada', () => {
    expect(grupoTrabajado([fila(), fila({ estado: 'CUMPLIDA' })])).toBe(true)
  })

  it('ninguna trabajada ⇒ false', () => {
    expect(grupoTrabajado([fila(), fila({ estado: 'PENDIENTE' })])).toBe(false)
  })

  it('sin filas ⇒ false (solicitud que la otra área ni programó)', () => {
    expect(grupoTrabajado([])).toBe(false)
  })
})

describe('SIN_REGISTRAR no es trabajo registrado', () => {
  it('aunque esté cerrada, nadie reportó nada', () => {
    expect(trabajoRegistrado({ estado: 'SIN_REGISTRAR', cerrada: true })).toBe(false)
  })
  it('y con avances viejos tampoco: el estado manda', () => {
    expect(trabajoRegistrado({
      estado: 'SIN_REGISTRAR', cerrada: true,
      avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 3 }] },
    })).toBe(false)
  })
  it('el grupo tampoco cuenta si todas sus filas quedaron sin registrar', () => {
    expect(grupoTrabajado([
      { estado: 'SIN_REGISTRAR', cerrada: true },
      { estado: 'SIN_REGISTRAR', cerrada: true },
    ])).toBe(false)
  })
  it('pero si una hermana sí se trabajó, el grupo cuenta', () => {
    expect(grupoTrabajado([
      { estado: 'SIN_REGISTRAR', cerrada: true },
      { estado: 'CUMPLIDA', cerrada: true },
    ])).toBe(true)
  })
})

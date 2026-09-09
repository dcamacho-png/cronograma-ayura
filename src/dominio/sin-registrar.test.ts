import { describe, it, expect } from 'vitest'
import { quedoSinRegistrar, vencidaPorAtender } from './sin-registrar'

const HOY = { anio: 2026, semana: 37 }
const act = (p: Partial<Parameters<typeof quedoSinRegistrar>[0]> = {}) =>
  ({ anio: 2026, semana: 33, estado: 'PENDIENTE', cerrada: false, ...p })

describe('quedoSinRegistrar', () => {
  it('semana vencida, PENDIENTE y sin cerrar: quedó sin registrar', () => {
    expect(quedoSinRegistrar(act(), HOY)).toBe(true)
  })
  it('la semana en curso todavía se puede registrar', () => {
    expect(quedoSinRegistrar(act({ semana: 37 }), HOY)).toBe(false)
  })
  it('una semana futura tampoco', () => {
    expect(quedoSinRegistrar(act({ semana: 38 }), HOY)).toBe(false)
  })
  it('si ya está cerrada, no se toca', () => {
    expect(quedoSinRegistrar(act({ cerrada: true }), HOY)).toBe(false)
  })
  it('cualquier otro estado ya fue registrado', () => {
    for (const estado of ['CUMPLIDA', 'PARCIAL', 'NO_CUMPLIDA', 'REPROGRAMADA', 'SIN_REGISTRAR']) {
      expect(quedoSinRegistrar(act({ estado }), HOY)).toBe(false)
    }
  })
  it('es idempotente: una ya marcada no vuelve a entrar', () => {
    expect(quedoSinRegistrar(act({ estado: 'SIN_REGISTRAR', cerrada: true }), HOY)).toBe(false)
  })
  it('cruce de año: la semana 52 del año anterior está vencida', () => {
    expect(quedoSinRegistrar(act({ anio: 2025, semana: 52 }), HOY)).toBe(true)
  })
})

// La vencida vive en la semana 33; su tarea puede estar en varios sitios.
const venc = (tarea: { estado: string; anioSel: number | null; semanaSel: number | null } | null) =>
  ({ anio: 2026, semana: 33, tarea })

describe('vencidaPorAtender', () => {
  it('la tarea sigue clavada en la semana que se venció: hay que atenderla', () => {
    expect(vencidaPorAtender(venc({ estado: 'PROGRAMADA', anioSel: 2026, semanaSel: 33 }))).toBe(true)
  })
  it('si la tarea volvió al banco, alguien ya la retomó', () => {
    expect(vencidaPorAtender(venc({ estado: 'PENDIENTE', anioSel: null, semanaSel: null }))).toBe(false)
  })
  it('si ya está programada para una semana posterior, tampoco', () => {
    expect(vencidaPorAtender(venc({ estado: 'PROGRAMADA', anioSel: 2026, semanaSel: 40 }))).toBe(false)
  })
  it('cruce de año: la semana 1 del año siguiente es posterior', () => {
    expect(vencidaPorAtender(venc({ estado: 'PROGRAMADA', anioSel: 2027, semanaSel: 1 }))).toBe(false)
  })
  it('una semana anterior a la vencida no cuenta como retomada', () => {
    expect(vencidaPorAtender(venc({ estado: 'PROGRAMADA', anioSel: 2026, semanaSel: 30 }))).toBe(true)
  })
  it('sin tarea de origen no hay nada que devolver al banco', () => {
    expect(vencidaPorAtender(venc(null))).toBe(false)
  })
})

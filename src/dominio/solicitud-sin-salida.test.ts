import { describe, it, expect } from 'vitest'
import { solicitudSinSalida, type SolicitudSeguimiento } from './solicitud-sin-salida'

const HOY = { anio: 2026, semana: 37 }
const sol = (p: Partial<SolicitudSeguimiento> = {}): SolicitudSeguimiento =>
  ({ estado: 'PROGRAMADA', actividades: [], ...p })

const sem = (semana: number, anio = 2026) => ({ anio, semana })

describe('solicitudSinSalida', () => {
  it('programada en semanas vencidas y sin nada trabajado: nadie puede resolverla', () => {
    expect(solicitudSinSalida(sol({ actividades: [sem(33), sem(33)] }), 0, HOY)).toBe(true)
  })

  it('la semana en curso NO cuenta como vencida: todavía se puede registrar y notificar', () => {
    expect(solicitudSinSalida(sol({ actividades: [sem(37)] }), 0, HOY)).toBe(false)
  })

  it('una semana futura tampoco', () => {
    expect(solicitudSinSalida(sol({ actividades: [sem(38)] }), 0, HOY)).toBe(false)
  })

  it('basta UNA actividad en semana viva para que siga habiendo salida', () => {
    expect(solicitudSinSalida(sol({ actividades: [sem(33), sem(37)] }), 0, HOY)).toBe(false)
  })

  it('si ya hay trabajo registrado no aplica: la oculta la otra regla', () => {
    expect(solicitudSinSalida(sol({ actividades: [sem(33)] }), 1, HOY)).toBe(false)
  })

  it('sin actividades (en banco) sigue habiendo salida: la otra área puede programarla', () => {
    expect(solicitudSinSalida(sol({ actividades: [] }), 0, HOY)).toBe(false)
  })

  it('una devuelta nunca queda sin salida: el solicitante puede reenviarla', () => {
    expect(solicitudSinSalida(sol({ estado: 'DEVUELTA', actividades: [sem(33)] }), 0, HOY)).toBe(false)
  })

  it('cruce de año: la semana 52 del año anterior está vencida', () => {
    expect(solicitudSinSalida(sol({ actividades: [sem(52, 2025)] }), 0, HOY)).toBe(true)
  })

  it('la semana 1 del año siguiente no está vencida', () => {
    expect(solicitudSinSalida(sol({ actividades: [sem(1, 2027)] }), 0, HOY)).toBe(false)
  })
})

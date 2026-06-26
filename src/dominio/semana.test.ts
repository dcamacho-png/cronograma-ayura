import { describe, it, expect } from 'vitest'
import { isoSemanaDeFecha, siguienteSemana, semanaAnterior, esSemanaFutura, plazoCumplimientoVencido } from './semana'

describe('isoSemanaDeFecha', () => {
  it('calcula la semana ISO de una fecha conocida', () => {
    // 2026-06-15 (lunes) es la semana 25 de 2026.
    expect(isoSemanaDeFecha(new Date(Date.UTC(2026, 5, 15)))).toEqual({ anio: 2026, semana: 25 })
    // 1 de enero de 2026 (jueves) es semana 1 de 2026.
    expect(isoSemanaDeFecha(new Date(Date.UTC(2026, 0, 1)))).toEqual({ anio: 2026, semana: 1 })
  })
})

describe('siguienteSemana', () => {
  it('avanza una semana', () => {
    expect(siguienteSemana(2026, 25)).toEqual({ anio: 2026, semana: 26 })
  })
  it('2026 tiene 53 semanas', () => {
    expect(siguienteSemana(2026, 52)).toEqual({ anio: 2026, semana: 53 })
  })
  it('cruza el cambio de año (2026 s53 -> 2027 s1)', () => {
    expect(siguienteSemana(2026, 53)).toEqual({ anio: 2027, semana: 1 })
  })
})

describe('semanaAnterior', () => {
  it('retrocede una semana', () => {
    expect(semanaAnterior(2026, 26)).toEqual({ anio: 2026, semana: 25 })
  })
  it('cruza el cambio de año (2027 s1 -> 2026 s53)', () => {
    expect(semanaAnterior(2027, 1)).toEqual({ anio: 2026, semana: 53 })
  })
})

import { semanasDelMes } from './semana'

describe('semanasDelMes', () => {
  it('junio 2026 = semanas ISO 23 a 26', () => {
    expect(semanasDelMes(2026, 6)).toEqual([
      { anio: 2026, semana: 23 },
      { anio: 2026, semana: 24 },
      { anio: 2026, semana: 25 },
      { anio: 2026, semana: 26 },
    ])
  })
  it('enero 2026 = semanas ISO 1 a 5', () => {
    expect(semanasDelMes(2026, 1)).toEqual([
      { anio: 2026, semana: 1 },
      { anio: 2026, semana: 2 },
      { anio: 2026, semana: 3 },
      { anio: 2026, semana: 4 },
      { anio: 2026, semana: 5 },
    ])
  })
})

import { fechasDeSemana } from './semana'

describe('fechasDeSemana', () => {
  it('devuelve lunes a domingo de la semana ISO', () => {
    const f = fechasDeSemana(2026, 25)
    expect(f).toHaveLength(7)
    // Lunes 15 jun 2026 .. Domingo 21 jun 2026
    expect(f[0].toISOString().slice(0, 10)).toBe('2026-06-15')
    expect(f[6].toISOString().slice(0, 10)).toBe('2026-06-21')
  })
})

import { esSemanaPasada } from './semana'

describe('esSemanaPasada', () => {
  const ref = { anio: 2026, semana: 25 }
  it('una semana anterior del mismo año es pasada', () => {
    expect(esSemanaPasada(2026, 24, ref)).toBe(true)
  })
  it('la semana actual no es pasada', () => {
    expect(esSemanaPasada(2026, 25, ref)).toBe(false)
  })
  it('una semana futura no es pasada', () => {
    expect(esSemanaPasada(2026, 26, ref)).toBe(false)
  })
  it('un año anterior es pasada', () => {
    expect(esSemanaPasada(2025, 52, ref)).toBe(true)
  })
  it('un año futuro no es pasada', () => {
    expect(esSemanaPasada(2027, 1, ref)).toBe(false)
  })
})

describe('esSemanaFutura', () => {
  const ref = { anio: 2026, semana: 25 }
  it('semana posterior del mismo año es futura', () => {
    expect(esSemanaFutura(2026, 26, ref)).toBe(true)
  })
  it('la misma semana NO es futura', () => {
    expect(esSemanaFutura(2026, 25, ref)).toBe(false)
  })
  it('semana anterior NO es futura', () => {
    expect(esSemanaFutura(2026, 24, ref)).toBe(false)
  })
  it('año siguiente es futura', () => {
    expect(esSemanaFutura(2027, 1, ref)).toBe(true)
  })
  it('año anterior NO es futura', () => {
    expect(esSemanaFutura(2025, 52, ref)).toBe(false)
  })
})

import { diaIsoDeFecha, esDiaPasado } from './semana'

describe('diaIsoDeFecha', () => {
  it('da el día ISO (lunes=1 .. domingo=7) en UTC', () => {
    // 2026-06-15 es lunes, 2026-06-21 es domingo.
    expect(diaIsoDeFecha(new Date(Date.UTC(2026, 5, 15)))).toBe(1)
    expect(diaIsoDeFecha(new Date(Date.UTC(2026, 5, 17)))).toBe(3) // miércoles
    expect(diaIsoDeFecha(new Date(Date.UTC(2026, 5, 21)))).toBe(7) // domingo
  })
})

describe('esDiaPasado', () => {
  // Hoy: miércoles (día 3) de la semana 25 de 2026.
  const hoy = { anio: 2026, semana: 25, dia: 3 }
  it('un día anterior de la semana actual es pasado', () => {
    expect(esDiaPasado(2026, 25, 1, hoy)).toBe(true) // lunes
    expect(esDiaPasado(2026, 25, 2, hoy)).toBe(true) // martes
  })
  it('hoy no es pasado', () => {
    expect(esDiaPasado(2026, 25, 3, hoy)).toBe(false)
  })
  it('un día futuro de la semana actual no es pasado', () => {
    expect(esDiaPasado(2026, 25, 4, hoy)).toBe(false) // jueves
    expect(esDiaPasado(2026, 25, 7, hoy)).toBe(false) // domingo
  })
  it('cualquier día de una semana anterior es pasado', () => {
    expect(esDiaPasado(2026, 24, 7, hoy)).toBe(true)
    expect(esDiaPasado(2025, 52, 7, hoy)).toBe(true)
  })
  it('cualquier día de una semana futura no es pasado', () => {
    expect(esDiaPasado(2026, 26, 1, hoy)).toBe(false)
    expect(esDiaPasado(2027, 1, 1, hoy)).toBe(false)
  })
})

import { aHoraColombia } from './semana'

describe('aHoraColombia (UTC-5, sin horario de verano)', () => {
  it('domingo 23:00 Colombia (= lunes 04:00 UTC) sigue siendo domingo de la semana 25', () => {
    // 2026-06-22T04:00Z = 2026-06-21 23:00 en Colombia → domingo, semana 25.
    const instante = new Date('2026-06-22T04:00:00Z')
    expect(isoSemanaDeFecha(aHoraColombia(instante))).toEqual({ anio: 2026, semana: 25 })
    expect(diaIsoDeFecha(aHoraColombia(instante))).toBe(7) // domingo
    // Sin ajuste, en UTC ya sería lunes de la semana 26 (el bug):
    expect(isoSemanaDeFecha(instante)).toEqual({ anio: 2026, semana: 26 })
  })
  it('lunes 00:00 Colombia (= lunes 05:00 UTC) ya es lunes de la semana 26', () => {
    const instante = new Date('2026-06-22T05:00:00Z')
    expect(isoSemanaDeFecha(aHoraColombia(instante))).toEqual({ anio: 2026, semana: 26 })
    expect(diaIsoDeFecha(aHoraColombia(instante))).toBe(1) // lunes
  })
})

describe('plazoCumplimientoVencido', () => {
  it('una semana pasada está vencida', () => {
    expect(plazoCumplimientoVencido(2026, 24, { anio: 2026, semana: 25 })).toBe(true)
  })
  it('la semana en curso NO está vencida (se puede hasta el domingo)', () => {
    expect(plazoCumplimientoVencido(2026, 25, { anio: 2026, semana: 25 })).toBe(false)
  })
  it('una semana futura NO está vencida', () => {
    expect(plazoCumplimientoVencido(2026, 26, { anio: 2026, semana: 25 })).toBe(false)
  })
  it('cruza el cambio de año: 2026 s53 está vencida frente a 2027 s1', () => {
    expect(plazoCumplimientoVencido(2026, 53, { anio: 2027, semana: 1 })).toBe(true)
  })
})

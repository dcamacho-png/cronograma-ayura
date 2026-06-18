import { describe, it, expect } from 'vitest'
import { pesoEstado, porcentajeCumplimiento } from './metricas'
import type { Actividad } from './tipos'

// Ayuda para crear actividades de prueba con valores por defecto.
function act(parcial: Partial<Actividad>): Actividad {
  return {
    id: 'x', anio: 2026, semana: 25, dia: 1,
    areaId: 'a', fincaId: 'f', responsableId: 'r',
    descripcion: '', turno: '', estado: 'PENDIENTE',
    motivoId: null, nota: null, vecesReprogramada: 0, origenId: null,
    ...parcial,
  }
}

describe('pesoEstado', () => {
  it('asigna 1 a CUMPLIDA, 0.5 a PARCIAL, 0 a NO_CUMPLIDA', () => {
    expect(pesoEstado('CUMPLIDA')).toBe(1)
    expect(pesoEstado('PARCIAL')).toBe(0.5)
    expect(pesoEstado('NO_CUMPLIDA')).toBe(0)
  })
  it('devuelve null para PENDIENTE y REPROGRAMADA (no se evalúan)', () => {
    expect(pesoEstado('PENDIENTE')).toBeNull()
    expect(pesoEstado('REPROGRAMADA')).toBeNull()
  })
})

describe('porcentajeCumplimiento', () => {
  it('promedia los pesos de las actividades evaluadas', () => {
    const acts = [
      act({ estado: 'CUMPLIDA' }),
      act({ estado: 'PARCIAL' }),
      act({ estado: 'NO_CUMPLIDA' }),
    ]
    // (1 + 0.5 + 0) / 3 = 0.5 -> 50
    expect(porcentajeCumplimiento(acts)).toBe(50)
  })
  it('PENDIENTE y REPROGRAMADA cuentan como 0 sobre el total', () => {
    const acts = [
      act({ estado: 'CUMPLIDA' }),
      act({ estado: 'PENDIENTE' }),
      act({ estado: 'REPROGRAMADA' }),
    ]
    // (1 + 0 + 0) / 3 = 0.333 -> 33
    expect(porcentajeCumplimiento(acts)).toBe(33)
  })
  it('devuelve null solo con lista vacía; una pendiente sola devuelve 0', () => {
    expect(porcentajeCumplimiento([act({ estado: 'PENDIENTE' })])).toBe(0)
    expect(porcentajeCumplimiento([])).toBeNull()
  })
})

import { estrellas, rankingResponsables } from './metricas'

describe('estrellas', () => {
  it('traduce el % a escala de 1 a 5', () => {
    expect(estrellas(100)).toBe(5)
    expect(estrellas(90)).toBe(5)
    expect(estrellas(80)).toBe(4)
    expect(estrellas(60)).toBe(3)
    expect(estrellas(45)).toBe(2)
    expect(estrellas(10)).toBe(1)
  })
})

describe('rankingResponsables', () => {
  it('agrupa por responsable, ordena y separa top 3 y 3 más bajos', () => {
    const acts: Actividad[] = [
      act({ responsableId: 'A', estado: 'CUMPLIDA' }),   // A = 100
      act({ responsableId: 'B', estado: 'CUMPLIDA' }),
      act({ responsableId: 'B', estado: 'NO_CUMPLIDA' }), // B = 50
      act({ responsableId: 'C', estado: 'NO_CUMPLIDA' }), // C = 0
      act({ responsableId: 'D', estado: 'PARCIAL' }),     // D = 50
    ]
    const { top, bajos } = rankingResponsables(acts)
    expect(top.map((f) => f.responsableId)).toEqual(['A', 'B', 'D'])
    expect(top[0]).toEqual({ responsableId: 'A', porcentaje: 100, estrellas: 5 })
    // bajos excluye a quienes ya están en top
    expect(bajos.map((f) => f.responsableId)).toEqual(['C'])
    expect(bajos[0]).toEqual({ responsableId: 'C', porcentaje: 0, estrellas: 1 })
  })

  it('responsables con solo PENDIENTE aparecen con porcentaje 0', () => {
    const acts: Actividad[] = [
      act({ responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ responsableId: 'Z', estado: 'PENDIENTE' }),
    ]
    const { top } = rankingResponsables(acts)
    // Z tiene 0% (1 pendiente sobre total), ya no se excluye
    expect(top.map((f) => f.responsableId)).toEqual(['A', 'Z'])
    expect(top[1]).toEqual({ responsableId: 'Z', porcentaje: 0, estrellas: 1 })
  })
})

import { porcentajeReprogramadas, colorSemaforo } from './metricas'

describe('porcentajeReprogramadas', () => {
  it('calcula el % de actividades con vecesReprogramada > 0', () => {
    const acts = [
      act({ vecesReprogramada: 0 }),
      act({ vecesReprogramada: 1 }),
      act({ vecesReprogramada: 3 }),
      act({ vecesReprogramada: 0 }),
    ]
    // 2 de 4 -> 50
    expect(porcentajeReprogramadas(acts)).toBe(50)
  })
  it('devuelve 0 con lista vacía', () => {
    expect(porcentajeReprogramadas([])).toBe(0)
  })
})

describe('colorSemaforo', () => {
  it('asigna color según las veces reprogramada', () => {
    expect(colorSemaforo(0)).toBe('ninguno')
    expect(colorSemaforo(1)).toBe('verde')
    expect(colorSemaforo(2)).toBe('amarillo')
    expect(colorSemaforo(3)).toBe('naranja')
    expect(colorSemaforo(4)).toBe('rojo')
    expect(colorSemaforo(7)).toBe('rojo')
  })
})

import { cumplimientoPorArea, tendenciaSemanal } from './metricas'

describe('cumplimientoPorArea', () => {
  it('calcula el % por cada área', () => {
    const acts = [
      act({ areaId: 'maiz', estado: 'CUMPLIDA' }),
      act({ areaId: 'maiz', estado: 'NO_CUMPLIDA' }),  // maiz = 50
      act({ areaId: 'riego', estado: 'CUMPLIDA' }),    // riego = 100
    ]
    const filas = cumplimientoPorArea(acts)
    expect(filas).toContainEqual({ areaId: 'maiz', porcentaje: 50 })
    expect(filas).toContainEqual({ areaId: 'riego', porcentaje: 100 })
  })
})

describe('tendenciaSemanal', () => {
  it('calcula el % por semana, ordenado cronológicamente', () => {
    const acts = [
      act({ anio: 2026, semana: 24, estado: 'CUMPLIDA' }),
      act({ anio: 2026, semana: 24, estado: 'NO_CUMPLIDA' }), // S24 = 50
      act({ anio: 2026, semana: 25, estado: 'CUMPLIDA' }),    // S25 = 100
    ]
    const puntos = tendenciaSemanal(acts)
    expect(puntos).toEqual([
      { anio: 2026, semana: 24, porcentaje: 50 },
      { anio: 2026, semana: 25, porcentaje: 100 },
    ])
  })
})

describe('rankingResponsables (sin solapamiento)', () => {
  it('una misma persona no aparece en top y en bajos a la vez', () => {
    const acts: Actividad[] = [
      act({ responsableId: 'A', estado: 'CUMPLIDA' }),     // A = 100
      act({ responsableId: 'B', estado: 'CUMPLIDA' }),     // B = 100
      act({ responsableId: 'C', estado: 'PARCIAL' }),      // C = 50
      act({ responsableId: 'D', estado: 'PARCIAL' }),      // D = 50
      act({ responsableId: 'E', estado: 'NO_CUMPLIDA' }),  // E = 0
    ]
    const { top, bajos } = rankingResponsables(acts)
    expect(top.map((f) => f.responsableId)).toEqual(['A', 'B', 'C'])
    expect(bajos.map((f) => f.responsableId)).toEqual(['D', 'E'])
    const idsTop = new Set(top.map((f) => f.responsableId))
    expect(bajos.some((f) => idsTop.has(f.responsableId))).toBe(false)
  })
})

describe('estrellas (borde inferior)', () => {
  it('estrellas(0) es 1', () => {
    expect(estrellas(0)).toBe(1)
  })
})

describe('cumplimientoPorArea (porcentaje null)', () => {
  it('áreas con solo PENDIENTE devuelven porcentaje 0 (no null)', () => {
    const acts = [act({ areaId: 'admin', estado: 'PENDIENTE' })]
    const filas = cumplimientoPorArea(acts)
    expect(filas).toContainEqual({ areaId: 'admin', porcentaje: 0 })
  })
})

import { motivosFrecuentes } from './metricas'

describe('motivosFrecuentes', () => {
  it('cuenta por motivoId e ignora actividades sin motivo, ordenado desc', () => {
    const acts = [
      act({ motivoId: 'clima' }),
      act({ motivoId: 'clima' }),
      act({ motivoId: 'maquina' }),
      act({ motivoId: null }),
    ]
    expect(motivosFrecuentes(acts)).toEqual([
      { motivoId: 'clima', conteo: 2 },
      { motivoId: 'maquina', conteo: 1 },
    ])
  })
  it('devuelve lista vacía si no hay motivos', () => {
    expect(motivosFrecuentes([act({ motivoId: null })])).toEqual([])
  })
})

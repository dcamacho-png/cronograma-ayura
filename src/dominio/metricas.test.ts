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
  it('excluye PENDIENTE y REPROGRAMADA del cálculo', () => {
    const acts = [
      act({ estado: 'CUMPLIDA' }),
      act({ estado: 'PENDIENTE' }),
      act({ estado: 'REPROGRAMADA' }),
    ]
    // solo cuenta la CUMPLIDA -> 100
    expect(porcentajeCumplimiento(acts)).toBe(100)
  })
  it('devuelve null cuando no hay actividades evaluadas', () => {
    expect(porcentajeCumplimiento([act({ estado: 'PENDIENTE' })])).toBeNull()
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
    // los 3 más bajos en orden de mayor a menor %
    expect(bajos.map((f) => f.responsableId)).toEqual(['B', 'D', 'C'])
    expect(bajos[2]).toEqual({ responsableId: 'C', porcentaje: 0, estrellas: 1 })
  })

  it('ignora responsables sin actividades evaluadas', () => {
    const acts: Actividad[] = [
      act({ responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ responsableId: 'Z', estado: 'PENDIENTE' }),
    ]
    const { top } = rankingResponsables(acts)
    expect(top.map((f) => f.responsableId)).toEqual(['A'])
  })
})

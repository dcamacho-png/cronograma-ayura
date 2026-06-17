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

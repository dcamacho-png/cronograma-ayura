import { describe, it, expect } from 'vitest'
import { duplicarActividades, detectarConflictosAsignacion, turnoEfectivo } from './programacion'
import type { CasillaOcupada } from './programacion'
import type { Actividad } from './tipos'

function act(parcial: Partial<Actividad>): Actividad {
  return {
    id: 'x', anio: 2026, semana: 25, dia: 1,
    areaId: 'a', fincaId: 'f', responsableId: 'r',
    descripcion: 'Siembra', turno: '7am-4pm', estado: 'CUMPLIDA',
    motivoId: 'm1', nota: 'ok', vecesReprogramada: 2, origenId: 'viejo',
    tareaId: null,
    maquinaId: null, areaTareaId: null, horas: null, hectareas: null, planB: null,
    ...parcial,
  }
}

describe('duplicarActividades', () => {
  it('copia la planeación a la semana destino y reinicia el seguimiento', () => {
    const origen = [act({ id: '1', descripcion: 'Siembra', dia: 2, turno: '7am-4pm' })]
    const [b] = duplicarActividades(origen, 2026, 26)
    expect(b).toEqual({
      anio: 2026,
      semana: 26,
      dia: 2,
      areaId: 'a',
      fincaId: 'f',
      responsableId: 'r',
      descripcion: 'Siembra',
      turno: '7am-4pm',
      maquinaId: null,
      areaTareaId: null,
      horas: null,
      hectareas: null,
      planB: null,
    })
  })

  it('conserva los campos de maquinaria', () => {
    const origen = [
      act({ maquinaId: 'maq1', areaTareaId: 'maiz', horas: 8, hectareas: 10, planB: 'Estercolero' }),
    ]
    const [b] = duplicarActividades(origen, 2027, 1)
    expect(b.maquinaId).toBe('maq1')
    expect(b.areaTareaId).toBe('maiz')
    expect(b.horas).toBe(8)
    expect(b.hectareas).toBe(10)
    expect(b.planB).toBe('Estercolero')
    expect(b.anio).toBe(2027)
    expect(b.semana).toBe(1)
  })

  it('duplica todas las actividades de la lista', () => {
    const origen = [act({ id: '1' }), act({ id: '2' }), act({ id: '3' })]
    expect(duplicarActividades(origen, 2026, 26)).toHaveLength(3)
  })
})

function ocupada(p: Partial<CasillaOcupada>): CasillaOcupada {
  return { dia: 1, turno: '7am-4pm', maquinaId: null, responsableId: 'r1', ...p }
}

describe('turnoEfectivo', () => {
  it('usa el turno escrito si no está vacío', () => {
    expect(turnoEfectivo('  noche  ', 1)).toBe('noche')
  })
  it('cae al turno por defecto del día si está vacío', () => {
    expect(turnoEfectivo('', 6)).toBe('7am-12pm')
  })
})

describe('detectarConflictosAsignacion', () => {
  it('sin choques no devuelve conflictos', () => {
    const exist = [ocupada({ dia: 1, turno: '7am-4pm', maquinaId: 'm1', responsableId: 'r1' })]
    const c = detectarConflictosAsignacion(exist, [2], 'r2', { 2: 'm2' }, '7am-4pm')
    expect(c).toEqual([])
  })

  it('detecta máquina ocupada en el mismo día+turno', () => {
    const exist = [ocupada({ dia: 1, turno: '7am-4pm', maquinaId: 'm1', responsableId: 'rX' })]
    const c = detectarConflictosAsignacion(exist, [1], 'rNueva', { 1: 'm1' }, '7am-4pm')
    expect(c).toEqual([{ dia: 1, tipo: 'maquina', responsableId: 'rNueva' }])
  })

  it('la misma máquina está libre si es otro turno', () => {
    const exist = [ocupada({ dia: 1, turno: '7am-4pm', maquinaId: 'm1', responsableId: 'rX' })]
    const c = detectarConflictosAsignacion(exist, [1], 'rNueva', { 1: 'm1' }, 'noche')
    expect(c).toEqual([])
  })

  it('detecta responsable con otra tarea en el mismo día+turno', () => {
    const exist = [ocupada({ dia: 3, turno: '7am-4pm', maquinaId: null, responsableId: 'r1' })]
    const c = detectarConflictosAsignacion(exist, [3], 'r1', {}, '7am-4pm')
    expect(c).toEqual([{ dia: 3, tipo: 'responsable', responsableId: 'r1' }])
  })

  it('el mismo responsable está libre en otro turno', () => {
    const exist = [ocupada({ dia: 3, turno: 'mañana', responsableId: 'r1' })]
    const c = detectarConflictosAsignacion(exist, [3], 'r1', {}, 'tarde')
    expect(c).toEqual([])
  })

  it('usa el turno por defecto del día cuando el turno va vacío', () => {
    // sábado por defecto = 7am-12pm
    const exist = [ocupada({ dia: 6, turno: '7am-12pm', responsableId: 'r1' })]
    const c = detectarConflictosAsignacion(exist, [6], 'r1', {}, '')
    expect(c).toEqual([{ dia: 6, tipo: 'responsable', responsableId: 'r1' }])
  })

  it('puede reportar máquina y responsable el mismo día', () => {
    const exist = [
      ocupada({ dia: 2, turno: '7am-4pm', maquinaId: 'm1', responsableId: 'rA' }),
      ocupada({ dia: 2, turno: '7am-4pm', maquinaId: 'm9', responsableId: 'r1' }),
    ]
    const c = detectarConflictosAsignacion(exist, [2], 'r1', { 2: 'm1' }, '7am-4pm')
    expect(c).toContainEqual({ dia: 2, tipo: 'responsable', responsableId: 'r1' })
    expect(c).toContainEqual({ dia: 2, tipo: 'maquina', responsableId: 'r1' })
  })
})

import { conflictosMaquinaEntreResponsables } from './programacion'
import type { Asignacion } from './programacion'

describe('detectarConflictosAsignacion — responsableId', () => {
  it('rellena responsableId en los conflictos', () => {
    const exist: CasillaOcupada[] = [{ dia: 1, turno: '7am-4pm', maquinaId: 'm1', responsableId: 'r1' }]
    const c = detectarConflictosAsignacion(exist, [1], 'r1', {}, '7am-4pm')
    expect(c).toEqual([{ dia: 1, tipo: 'responsable', responsableId: 'r1' }])
  })
})

describe('conflictosMaquinaEntreResponsables', () => {
  const base = (over: Partial<Asignacion>): Asignacion => ({ responsableId: 'r', dias: [], turno: '7am-4pm', maquinaPorDia: {}, ...over })

  it('sin conflicto si usan máquinas distintas el mismo día+turno', () => {
    const a = [base({ responsableId: 'r1', dias: [1], maquinaPorDia: { 1: 'm1' } }), base({ responsableId: 'r2', dias: [1], maquinaPorDia: { 1: 'm2' } })]
    expect(conflictosMaquinaEntreResponsables(a)).toEqual([])
  })

  it('conflicto si dos responsables usan la misma máquina el mismo día+turno', () => {
    const a = [base({ responsableId: 'r1', dias: [1], maquinaPorDia: { 1: 'm1' } }), base({ responsableId: 'r2', dias: [1], maquinaPorDia: { 1: 'm1' } })]
    expect(conflictosMaquinaEntreResponsables(a)).toEqual([{ dia: 1, tipo: 'maquina', responsableId: 'r2' }])
  })

  it('sin conflicto si es la misma máquina pero en días distintos', () => {
    const a = [base({ responsableId: 'r1', dias: [1], maquinaPorDia: { 1: 'm1' } }), base({ responsableId: 'r2', dias: [2], maquinaPorDia: { 2: 'm1' } })]
    expect(conflictosMaquinaEntreResponsables(a)).toEqual([])
  })

  it('ignora máquina nula', () => {
    const a = [base({ responsableId: 'r1', dias: [1], maquinaPorDia: { 1: null } }), base({ responsableId: 'r2', dias: [1], maquinaPorDia: { 1: null } })]
    expect(conflictosMaquinaEntreResponsables(a)).toEqual([])
  })

  it('con 3 responsables en la misma máquina/día/turno marca al 2º y al 3º (el 1º queda libre)', () => {
    const a = [
      base({ responsableId: 'r1', dias: [1], maquinaPorDia: { 1: 'm1' } }),
      base({ responsableId: 'r2', dias: [1], maquinaPorDia: { 1: 'm1' } }),
      base({ responsableId: 'r3', dias: [1], maquinaPorDia: { 1: 'm1' } }),
    ]
    expect(conflictosMaquinaEntreResponsables(a)).toEqual([
      { dia: 1, tipo: 'maquina', responsableId: 'r2' },
      { dia: 1, tipo: 'maquina', responsableId: 'r3' },
    ])
  })
})

import { describe, it, expect } from 'vitest'
import { duplicarActividades, tractoresOcupados, conflictosMaquinaEntreResponsables } from './programacion'
import type { CasillaOcupada, Asignacion } from './programacion'
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

describe('tractoresOcupados', () => {
  // El aviso es POR DÍA, no por hora: el horario es texto libre que se escribe después, en la
  // grilla, así que comparar franjas no dice nada. Y es una recomendación: no bloquea.
  it('sin choques no avisa nada', () => {
    const exist = [ocupada({ dia: 1, maquinaId: 'm1' })]
    expect(tractoresOcupados(exist, [2], 'r2', { 2: 'm2' })).toEqual([])
  })

  it('avisa si el tractor ya está tomado ESE DÍA, sin importar la hora', () => {
    const exist = [ocupada({ dia: 1, turno: '7am-4pm', maquinaId: 'm1', responsableId: 'rX' })]
    expect(tractoresOcupados(exist, [1], 'rNueva', { 1: 'm1' })).toEqual([
      { dia: 1, tipo: 'maquina', responsableId: 'rNueva' },
    ])
    // Antes, con otra franja horaria, el tractor se daba por libre y no avisaba.
    const otraHora = [ocupada({ dia: 1, turno: '1pm-5pm', maquinaId: 'm1', responsableId: 'rX' })]
    expect(tractoresOcupados(otraHora, [1], 'rNueva', { 1: 'm1' })).toEqual([
      { dia: 1, tipo: 'maquina', responsableId: 'rNueva' },
    ])
    const sinHora = [ocupada({ dia: 1, turno: '', maquinaId: 'm1', responsableId: 'rX' })]
    expect(tractoresOcupados(sinHora, [1], 'rNueva', { 1: 'm1' })).toEqual([
      { dia: 1, tipo: 'maquina', responsableId: 'rNueva' },
    ])
  })

  it('no avisa por el responsable: una persona puede tener varias tareas el mismo día', () => {
    const exist = [ocupada({ dia: 3, maquinaId: null, responsableId: 'r1' })]
    expect(tractoresOcupados(exist, [3], 'r1', {})).toEqual([])
  })

  it('sin tractor elegido no hay nada que avisar', () => {
    const exist = [ocupada({ dia: 1, maquinaId: 'm1' })]
    expect(tractoresOcupados(exist, [1], 'r2', { 1: null })).toEqual([])
  })

  it('avisa un día por cada día tomado', () => {
    const exist = [
      ocupada({ dia: 2, maquinaId: 'm1', responsableId: 'rA' }),
      ocupada({ dia: 4, maquinaId: 'm1', responsableId: 'rB' }),
    ]
    expect(tractoresOcupados(exist, [2, 3, 4], 'r1', { 2: 'm1', 3: 'm1', 4: 'm1' })).toEqual([
      { dia: 2, tipo: 'maquina', responsableId: 'r1' },
      { dia: 4, tipo: 'maquina', responsableId: 'r1' },
    ])
  })
})

describe('conflictosMaquinaEntreResponsables', () => {
  const base = (over: Partial<Asignacion>): Asignacion => ({ responsableId: 'r', dias: [], maquinaPorDia: {}, ...over })

  it('sin conflicto si usan máquinas distintas el mismo día', () => {
    const a = [base({ responsableId: 'r1', dias: [1], maquinaPorDia: { 1: 'm1' } }), base({ responsableId: 'r2', dias: [1], maquinaPorDia: { 1: 'm2' } })]
    expect(conflictosMaquinaEntreResponsables(a)).toEqual([])
  })

  it('conflicto si dos responsables usan la misma máquina el mismo día', () => {
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

  it('con 3 responsables en la misma máquina/día marca al 2º y al 3º (el 1º queda libre)', () => {
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

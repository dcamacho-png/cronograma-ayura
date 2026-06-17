import { describe, it, expect } from 'vitest'
import { duplicarActividades } from './programacion'
import type { Actividad } from './tipos'

function act(parcial: Partial<Actividad>): Actividad {
  return {
    id: 'x', anio: 2026, semana: 25, dia: 1,
    areaId: 'a', fincaId: 'f', responsableId: 'r',
    descripcion: 'Siembra', turno: '7am-4pm', estado: 'CUMPLIDA',
    motivoId: 'm1', nota: 'ok', vecesReprogramada: 2, origenId: 'viejo',
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

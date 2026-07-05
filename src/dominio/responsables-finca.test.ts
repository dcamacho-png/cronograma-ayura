import { describe, it, expect } from 'vitest'
import { agruparResponsablesPorFinca, hayFincasAsignadas } from './responsables-finca'

const r = (nombre: string, finca: string | null) => ({ id: nombre, nombre, finca: finca ? { nombre: finca } : null })

describe('agruparResponsablesPorFinca', () => {
  it('lista vacía → sin grupos', () => {
    expect(agruparResponsablesPorFinca([])).toEqual([])
  })

  it('todos sin finca → un solo grupo null ordenado por nombre', () => {
    const g = agruparResponsablesPorFinca([r('Zoe', null), r('Ana', null)])
    expect(g).toHaveLength(1)
    expect(g[0].finca).toBeNull()
    expect(g[0].responsables.map((x) => x.nombre)).toEqual(['Ana', 'Zoe'])
  })

  it('agrupa por finca (alfabético) y deja "sin finca" al final', () => {
    const g = agruparResponsablesPorFinca([
      r('Beto', 'La Esperanza'),
      r('Aldo', 'Bella Vista'),
      r('Nadie', null),
      r('Carlos', 'Bella Vista'),
    ])
    expect(g.map((x) => x.finca)).toEqual(['Bella Vista', 'La Esperanza', null])
    expect(g[0].responsables.map((x) => x.nombre)).toEqual(['Aldo', 'Carlos'])
    expect(g[2].responsables.map((x) => x.nombre)).toEqual(['Nadie'])
  })
})

describe('hayFincasAsignadas', () => {
  it('true si algún grupo tiene finca, false si solo hay grupo null', () => {
    expect(hayFincasAsignadas([{ finca: null }])).toBe(false)
    expect(hayFincasAsignadas([{ finca: 'X' }, { finca: null }])).toBe(true)
    expect(hayFincasAsignadas([])).toBe(false)
  })
})

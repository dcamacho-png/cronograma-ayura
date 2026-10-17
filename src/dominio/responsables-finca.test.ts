import { describe, it, expect } from 'vitest'
import { agruparResponsablesPorFinca, hayFincasAsignadas, repartirEnFotos } from './responsables-finca'

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

describe('repartirEnFotos', () => {
  const nombres = (n: number, finca: string | null) => Array.from({ length: n }, (_, i) => r(`${finca ?? 'x'}${String(i).padStart(2, '0')}`, finca))

  it('sin responsables → sin fotos', () => {
    expect(repartirEnFotos([], 4)).toEqual([])
  })

  it('sin tope (ganadería): una foto por finca, 6 en Acajure + 5 en Entremontes → 2 fotos', () => {
    const fotos = repartirEnFotos([...nombres(6, 'Acajure'), ...nombres(5, 'Entremontes')], Infinity)
    expect(fotos.map((f) => [f.finca, f.responsables.length])).toEqual([['Acajure', 6], ['Entremontes', 5]])
  })

  it('hasta el máximo → una sola foto', () => {
    const fotos = repartirEnFotos(nombres(4, null), 4)
    expect(fotos).toHaveLength(1)
    expect(fotos[0].responsables).toHaveLength(4)
  })

  it('nunca mezcla fincas: 1 en Acajure + 11 en Entremontes → 1 foto + 3 fotos parejas', () => {
    const fotos = repartirEnFotos([...nombres(1, 'Acajure'), ...nombres(11, 'Entremontes')], 4)
    expect(fotos.map((f) => f.finca)).toEqual(['Acajure', 'Entremontes', 'Entremontes', 'Entremontes'])
    expect(fotos[0].responsables).toHaveLength(1)
    expect(fotos.slice(1).map((f) => f.responsables.length).sort()).toEqual([3, 4, 4])
    for (const f of fotos) expect(f.responsables.every((x) => x.finca?.nombre === f.finca)).toBe(true)
  })

  it('tamaños equilibrados: 9 con máximo 4 → 3, 3, 3 (no 4, 4, 1)', () => {
    expect(repartirEnFotos(nombres(9, null), 4).map((f) => f.responsables.length)).toEqual([3, 3, 3])
  })

  it('con peso: el trabajador cargado queda en una foto con menos compañeros', () => {
    const rs = [r('A', null), r('B', null), r('C', null), r('D', null), r('E', null), r('F', null)]
    const peso = (x: { nombre: string }) => (x.nombre === 'A' ? 3 : 1)
    const fotos = repartirEnFotos(rs, 3, peso)
    expect(fotos.map((f) => f.responsables.map((x) => x.nombre))).toEqual([['A', 'B'], ['C', 'D', 'E', 'F']])
  })

  it('conserva el orden: finca alfabética, "sin finca" al final', () => {
    const fotos = repartirEnFotos([r('Zoe', null), r('Beto', 'B'), r('Ana', 'A')], 2)
    expect(fotos.flatMap((f) => f.responsables.map((x) => x.nombre))).toEqual(['Ana', 'Beto', 'Zoe'])
    expect(fotos.map((f) => f.finca)).toEqual(['A', 'B', null])
  })
})

describe('hayFincasAsignadas', () => {
  it('true si algún grupo tiene finca, false si solo hay grupo null', () => {
    expect(hayFincasAsignadas([{ finca: null }])).toBe(false)
    expect(hayFincasAsignadas([{ finca: 'X' }, { finca: null }])).toBe(true)
    expect(hayFincasAsignadas([])).toBe(false)
  })
})

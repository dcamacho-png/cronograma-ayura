import { describe, it, expect } from 'vitest'
import { diasCubiertos, resumenAusenciasMes, type NovedadRango } from './ausencias'

const d = (s: string) => new Date(s + 'T00:00:00.000Z')
// Semana con lunes 2026-07-06 … domingo 2026-07-12.
const semana = Array.from({ length: 7 }, (_, i) => d(`2026-07-${String(6 + i).padStart(2, '0')}`))

const nov = (over: Partial<NovedadRango>): NovedadRango => ({
  id: 'n1', responsableId: 'r1', tipo: 'VACACIONES',
  fechaInicio: d('2026-07-06'), fechaFin: d('2026-07-06'), horario: null, nota: null, ...over,
})

describe('diasCubiertos', () => {
  it('permiso de un día cae en su día', () => {
    expect(diasCubiertos(nov({ tipo: 'PERMISO', fechaInicio: d('2026-07-08'), fechaFin: d('2026-07-08') }), semana)).toEqual([3])
  })

  it('rango que empieza antes del lunes y termina el miércoles cubre lun-mié', () => {
    expect(diasCubiertos(nov({ fechaInicio: d('2026-07-01'), fechaFin: d('2026-07-08') }), semana)).toEqual([1, 2, 3])
  })

  it('rango totalmente fuera de la semana no cubre nada', () => {
    expect(diasCubiertos(nov({ fechaInicio: d('2026-07-20'), fechaFin: d('2026-07-25') }), semana)).toEqual([])
  })

  it('rango que abarca toda la semana cubre los 7 días', () => {
    expect(diasCubiertos(nov({ fechaInicio: d('2026-07-01'), fechaFin: d('2026-07-31') }), semana)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('resumenAusenciasMes', () => {
  const primer = d('2026-07-01')
  const ultimo = d('2026-07-31')

  it('suma días de vacaciones y permisos por persona', () => {
    const r = resumenAusenciasMes(
      [
        { ...nov({ id: 'a', fechaInicio: d('2026-07-05'), fechaFin: d('2026-07-09') }), nombre: 'Ana' }, // 5 días vac
        { ...nov({ id: 'b', tipo: 'PERMISO', fechaInicio: d('2026-07-10'), fechaFin: d('2026-07-10'), horario: '8-12' }), nombre: 'Ana' }, // 1 día permiso
      ],
      primer, ultimo,
    )
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ nombre: 'Ana', vacaciones: 5, permiso: 1 })
    expect(r[0].detalle).toHaveLength(2)
  })

  it('recorta al mes una novedad que cruza el fin de mes', () => {
    const r = resumenAusenciasMes(
      [{ ...nov({ fechaInicio: d('2026-07-30'), fechaFin: d('2026-08-05') }), nombre: 'Beto' }],
      primer, ultimo,
    )
    // 30 y 31 de julio = 2 días dentro del mes.
    expect(r[0]).toMatchObject({ nombre: 'Beto', vacaciones: 2 })
  })

  it('Cumpleaños/Otro no suman a vacaciones/permiso, pero sí aparecen en el detalle', () => {
    const r = resumenAusenciasMes(
      [
        { ...nov({ id: 'c', tipo: 'CUMPLEAÑOS', fechaInicio: d('2026-07-08'), fechaFin: d('2026-07-08') }), nombre: 'Ana' },
        { ...nov({ id: 'o', tipo: 'OTRO', fechaInicio: d('2026-07-09'), fechaFin: d('2026-07-09'), nota: 'capacitación' }), nombre: 'Ana' },
      ],
      primer, ultimo,
    )
    expect(r[0]).toMatchObject({ nombre: 'Ana', vacaciones: 0, permiso: 0 })
    expect(r[0].detalle).toHaveLength(2)
    expect(r[0].detalle.map((x) => x.tipo)).toEqual(['CUMPLEAÑOS', 'OTRO'])
  })

  it('excluye novedades que no intersectan el mes y ordena por nombre', () => {
    const r = resumenAusenciasMes(
      [
        { ...nov({ fechaInicio: d('2026-06-01'), fechaFin: d('2026-06-10') }), nombre: 'Zoe' }, // fuera de julio
        { ...nov({ fechaInicio: d('2026-07-03'), fechaFin: d('2026-07-03') }), nombre: 'Carlos' },
      ],
      primer, ultimo,
    )
    expect(r.map((x) => x.nombre)).toEqual(['Carlos'])
  })
})

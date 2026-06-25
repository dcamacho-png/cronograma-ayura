import { describe, it, expect } from 'vitest'
import { esMaquinaria } from './variante'

const base = { maqTareas: false, maqProgramar: false, maqCumplimiento: false, maqResumen: false }

describe('esMaquinaria', () => {
  it('default (todo false) => estándar en toda pantalla', () => {
    expect(esMaquinaria(base, 'tareas')).toBe(false)
    expect(esMaquinaria(base, 'resumen')).toBe(false)
  })

  it('cada bandera mapea a su pantalla', () => {
    expect(esMaquinaria({ ...base, maqTareas: true }, 'tareas')).toBe(true)
    expect(esMaquinaria({ ...base, maqTareas: true }, 'programar')).toBe(false)
    expect(esMaquinaria({ ...base, maqProgramar: true }, 'programar')).toBe(true)
    expect(esMaquinaria({ ...base, maqCumplimiento: true }, 'cumplimiento')).toBe(true)
    expect(esMaquinaria({ ...base, maqResumen: true }, 'resumen')).toBe(true)
  })
})

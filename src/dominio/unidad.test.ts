import { describe, it, expect } from 'vitest'
import { normalizarUnidad, unidadDe, etiquetaMedida, unidadAbreviada, opcionesConActual, unidadInicial } from './unidad'

describe('normalizarUnidad', () => {
  it('conserva cualquier unidad del catálogo, en minúscula y sin espacios', () => {
    expect(normalizarUnidad('hora')).toBe('hora')
    expect(normalizarUnidad('kg')).toBe('kg')
    expect(normalizarUnidad('ha')).toBe('ha')
    expect(normalizarUnidad('cantidad')).toBe('cantidad')
    // Las unidades que el usuario agrega en Configuración ya NO se aplastan a 'ha':
    // antes 'jornales' se guardaba como 'ha' y el resumen las sumaba como hectáreas.
    expect(normalizarUnidad('jornales')).toBe('jornales')
    expect(normalizarUnidad('Bultos')).toBe('bultos')
    expect(normalizarUnidad('  Viajes  ')).toBe('viajes')
  })

  it('cae a ha solo cuando no hay unidad', () => {
    expect(normalizarUnidad('')).toBe('ha')
    expect(normalizarUnidad('   ')).toBe('ha')
    expect(normalizarUnidad(undefined)).toBe('ha')
    expect(normalizarUnidad(null)).toBe('ha')
  })
})

describe('unidadDe', () => {
  const mapa = { ESTERCOLERO: 'hora', GRANEL: 'kg', ENCALADORA: 'ha', SIEMBRA: 'jornales' }
  it('busca por descripción y cae a ha si no está en el catálogo', () => {
    expect(unidadDe(mapa, 'ESTERCOLERO')).toBe('hora')
    expect(unidadDe(mapa, 'GRANEL')).toBe('kg')
    expect(unidadDe(mapa, 'ENCALADORA')).toBe('ha')
    expect(unidadDe(mapa, 'SIEMBRA')).toBe('jornales')
    expect(unidadDe(mapa, 'Texto libre')).toBe('ha')
  })
})

describe('etiquetaMedida', () => {
  it('da la etiqueta del campo según la unidad', () => {
    expect(etiquetaMedida('ha')).toBe('Hectáreas realizadas')
    expect(etiquetaMedida('hora')).toBe('Horas realizadas')
    expect(etiquetaMedida('kg')).toBe('Kg cosechados')
    expect(etiquetaMedida('cantidad')).toBe('Cantidad realizada')
  })

  it('para una unidad agregada por el usuario, la nombra sin inventarle género', () => {
    expect(etiquetaMedida('jornales')).toBe('Medida realizada (jornales)')
  })
})

describe('unidadAbreviada', () => {
  it('da la abreviatura para listas y totales', () => {
    expect(unidadAbreviada('ha')).toBe('ha')
    expect(unidadAbreviada('hora')).toBe('horas')
    expect(unidadAbreviada('kg')).toBe('kg')
    expect(unidadAbreviada('cantidad')).toBe('cantidad')
    expect(unidadAbreviada('jornales')).toBe('jornales')
  })
})

describe('opcionesConActual', () => {
  const cat = [{ valor: 'ha', nombre: 'Ha' }, { valor: 'jornales', nombre: 'Jornales' }]

  it('deja el catálogo igual cuando la unidad actual sigue vigente', () => {
    expect(opcionesConActual(cat, 'ha')).toEqual(cat)
    expect(opcionesConActual(cat, null)).toEqual(cat)
    expect(opcionesConActual(cat, '')).toEqual(cat)
  })

  it('agrega la unidad ya registrada si fue retirada del catálogo', () => {
    // Sin esto, abrir el formulario de una actividad medida en "viajes" le cambiaría la
    // unidad a la primera de la lista solo por haberla retirado en Configuración.
    expect(opcionesConActual(cat, 'viajes')).toEqual([
      { valor: 'viajes', nombre: 'Viajes (retirada)' },
      ...cat,
    ])
  })
})

describe('unidadInicial', () => {
  const cat = [{ valor: 'ha', nombre: 'Ha' }, { valor: 'jornales', nombre: 'Jornales' }]

  it('usa la preferida cuando está en la lista', () => {
    expect(unidadInicial(cat, 'jornales')).toBe('jornales')
    expect(unidadInicial(cat, 'Jornales')).toBe('jornales')
  })

  it('cae a la primera de la lista cuando la preferida no está o no hay', () => {
    expect(unidadInicial(cat, 'viajes')).toBe('ha')
    expect(unidadInicial(cat, null)).toBe('ha')
    expect(unidadInicial(cat, undefined)).toBe('ha')
  })

  it('con el catálogo vacío cae a ha', () => {
    expect(unidadInicial([], 'jornales')).toBe('ha')
  })
})

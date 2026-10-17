import { describe, it, expect } from 'vitest'
import { opcionesActividad } from './opciones-actividad'

const lista = ['ALQUILER MAQUINAS', 'RASTRA SIEMBRA', 'RENOVADOR']

describe('opcionesActividad', () => {
  it('si el nombre actual está en la lista, la lista queda igual', () => {
    expect(opcionesActividad(lista, 'RASTRA SIEMBRA')).toEqual(lista)
  })

  it('si el nombre actual NO está en la lista, va primero para no perderse al guardar', () => {
    expect(opcionesActividad(lista, 'Reunion virtual')).toEqual(['Reunion virtual', ...lista])
  })

  it('un nombre vacío no agrega nada', () => {
    expect(opcionesActividad(lista, '')).toEqual(lista)
  })
})

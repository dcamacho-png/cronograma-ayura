import { describe, it, expect } from 'vitest'
import { buscarLotes } from './buscar-lotes'

const l = (id: string, nombre: string) => ({ id, nombre })
const LOTES = [l('1', 'MARACOS1'), l('2', 'MARACOS2'), l('3', 'Clínica Caño Colorado'), l('4', 'MATICAS3'), l('5', 'Pista Cuerda')]

describe('buscarLotes', () => {
  it('sin texto muestra todos (hasta el máximo)', () => {
    const r = buscarLotes(LOTES, '', new Set(), 3)
    expect(r.visibles.map((x) => x.id)).toEqual(['1', '2', '3'])
    expect(r.total).toBe(5)
  })

  it('busca por parte del nombre, sin importar mayúsculas', () => {
    expect(buscarLotes(LOTES, 'mara', new Set(), 8).visibles.map((x) => x.nombre)).toEqual(['MARACOS1', 'MARACOS2'])
  })

  it('ignora tildes en lo que se escribe y en el nombre', () => {
    expect(buscarLotes(LOTES, 'clinica cano', new Set(), 8).visibles.map((x) => x.id)).toEqual(['3'])
    expect(buscarLotes(LOTES, 'MATÍCAS', new Set(), 8).visibles.map((x) => x.id)).toEqual(['4'])
  })

  it('deja fuera los ya marcados', () => {
    const r = buscarLotes(LOTES, 'mara', new Set(['1']), 8)
    expect(r.visibles.map((x) => x.id)).toEqual(['2'])
    expect(r.total).toBe(1)
  })

  it('sin coincidencias → vacío', () => {
    expect(buscarLotes(LOTES, 'zzz', new Set(), 8)).toEqual({ visibles: [], total: 0 })
  })
})

import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password', () => {
  it('verifica una contraseña correcta', () => {
    const h = hashPassword('secreta123')
    expect(verifyPassword('secreta123', h)).toBe(true)
  })
  it('rechaza una contraseña incorrecta', () => {
    const h = hashPassword('secreta123')
    expect(verifyPassword('otra', h)).toBe(false)
  })
  it('rechaza un hash inválido', () => {
    expect(verifyPassword('x', 'basura')).toBe(false)
  })
})

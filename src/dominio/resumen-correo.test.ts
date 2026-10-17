import { describe, it, expect } from 'vitest'
import { semanaDelResumen, nombrePdfResumen, asuntoResumen, destinatariosResumen } from './resumen-correo'

describe('semanaDelResumen', () => {
  it('el lunes se manda la semana que terminó el domingo', () => {
    expect(semanaDelResumen({ anio: 2026, semana: 43 })).toEqual({ anio: 2026, semana: 42 })
  })

  it('la primera semana del año manda la última del año anterior', () => {
    expect(semanaDelResumen({ anio: 2027, semana: 1 })).toEqual({ anio: 2026, semana: 53 })
  })
})

describe('nombrePdfResumen y asuntoResumen', () => {
  it('nombran la semana y el año', () => {
    expect(nombrePdfResumen({ anio: 2026, semana: 42 })).toBe('resumen-semana-42-2026.pdf')
    expect(asuntoResumen({ anio: 2026, semana: 42 })).toBe('Resumen semana 42 · 2026 — Cronograma Ayurá')
  })
})

describe('destinatariosResumen', () => {
  it('separa por comas y quita espacios y vacíos', () => {
    expect(destinatariosResumen(' a@x.co , b@x.co,, ')).toEqual(['a@x.co', 'b@x.co'])
  })

  it('sin configurar → ninguno', () => {
    expect(destinatariosResumen(undefined)).toEqual([])
    expect(destinatariosResumen('')).toEqual([])
  })

  it('descarta lo que no parece un correo', () => {
    expect(destinatariosResumen('a@x.co, no-es-correo')).toEqual(['a@x.co'])
  })
})

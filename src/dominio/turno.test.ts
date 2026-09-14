import { describe, it, expect } from 'vitest'
import { horarioComun } from './turno'

describe('horarioComun', () => {
  it('devuelve el horario que comparten las actividades del día', () => {
    expect(horarioComun(['7am-12pm', '7am-12pm'])).toBe('7am-12pm')
    expect(horarioComun(['1pm-5pm'])).toBe('1pm-5pm')
  })

  it('queda vacío si las actividades del día traen horarios distintos', () => {
    // Pasa con lo programado ANTES de que el horario fuera del día: cada actividad tenía el
    // suyo. La casilla arranca vacía y, al escribir uno, los unifica.
    expect(horarioComun(['7am-12pm', '1pm-5pm'])).toBe('')
  })

  it('ignora espacios de más al comparar', () => {
    expect(horarioComun([' 7am-12pm', '7am-12pm '])).toBe('7am-12pm')
  })

  it('sin actividades no hay horario', () => {
    expect(horarioComun([])).toBe('')
  })

  it('varias actividades sin horario dan vacío, no un falso conflicto', () => {
    expect(horarioComun(['', ''])).toBe('')
  })

  it('ignora las actividades sin horario en vez de tomarlas como discrepancia', () => {
    // Al asignar una tarea nueva a un día que ya tenía horario, la nueva entra sin él.
    // Si contara como distinta, la franja del día se vaciaría sola en pantalla.
    expect(horarioComun(['7am-12pm', ''])).toBe('7am-12pm')
    expect(horarioComun(['', '1pm-5pm', ''])).toBe('1pm-5pm')
  })
})

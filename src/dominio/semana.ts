export interface Semana {
  anio: number
  semana: number
}

const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000

// Semana ISO 8601 de una fecha (en UTC).
export function isoSemanaDeFecha(fecha: Date): Semana {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()))
  // Día de la semana con lunes = 0 ... domingo = 6.
  const diaLunes0 = (d.getUTCDay() + 6) % 7
  // Mover al jueves de esta semana (el jueves define el año ISO).
  d.setUTCDate(d.getUTCDate() - diaLunes0 + 3)
  const jueves = d.getTime()
  // Jueves de la semana 1 del año ISO: usar el 4 de enero (siempre en semana 1).
  const cuatroEnero = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const diaLunes0Ene = (cuatroEnero.getUTCDay() + 6) % 7
  cuatroEnero.setUTCDate(cuatroEnero.getUTCDate() - diaLunes0Ene + 3)
  const semana = 1 + Math.round((jueves - cuatroEnero.getTime()) / MS_POR_SEMANA)
  return { anio: d.getUTCFullYear(), semana }
}

// Lunes (fecha UTC) de una semana ISO dada.
function lunesDeIsoSemana(anio: number, semana: number): Date {
  const cuatroEnero = new Date(Date.UTC(anio, 0, 4))
  const diaLunes0 = (cuatroEnero.getUTCDay() + 6) % 7
  const lunesSemana1 = new Date(cuatroEnero)
  lunesSemana1.setUTCDate(cuatroEnero.getUTCDate() - diaLunes0)
  const lunes = new Date(lunesSemana1)
  lunes.setUTCDate(lunesSemana1.getUTCDate() + (semana - 1) * 7)
  return lunes
}

export function siguienteSemana(anio: number, semana: number): Semana {
  const lunes = lunesDeIsoSemana(anio, semana)
  lunes.setUTCDate(lunes.getUTCDate() + 7)
  return isoSemanaDeFecha(lunes)
}

export function semanaAnterior(anio: number, semana: number): Semana {
  const lunes = lunesDeIsoSemana(anio, semana)
  lunes.setUTCDate(lunes.getUTCDate() - 7)
  return isoSemanaDeFecha(lunes)
}

// Semana ISO actual (usa la fecha del sistema; no es determinista, por eso no se prueba).
export function semanaActual(): Semana {
  return isoSemanaDeFecha(new Date())
}

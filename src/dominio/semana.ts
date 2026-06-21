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

// Semanas ISO cuyo jueves cae en el mes calendario dado (mes: 1-12), en orden.
export function semanasDelMes(anio: number, mes: number): Semana[] {
  const resultado: Semana[] = []
  const vistas = new Set<string>()
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const fecha = new Date(Date.UTC(anio, mes - 1, dia))
    // Jueves de la semana de esta fecha.
    const diaLunes0 = (fecha.getUTCDay() + 6) % 7
    const jueves = new Date(fecha)
    jueves.setUTCDate(fecha.getUTCDate() - diaLunes0 + 3)
    if (jueves.getUTCFullYear() === anio && jueves.getUTCMonth() === mes - 1) {
      const s = isoSemanaDeFecha(fecha)
      const clave = `${s.anio}-${s.semana}`
      if (!vistas.has(clave)) {
        vistas.add(clave)
        resultado.push(s)
      }
    }
  }
  return resultado
}

// Mes calendario actual (usa la fecha del sistema; no determinista, por eso no se prueba).
export function mesActual(): { anio: number; mes: number } {
  const d = new Date()
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 }
}

// Las 7 fechas (UTC) de una semana ISO: lunes a domingo.
export function fechasDeSemana(anio: number, semana: number): Date[] {
  const lunes = lunesDeIsoSemana(anio, semana)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setUTCDate(lunes.getUTCDate() + i)
    return d
  })
}

// ¿La semana (anio, semana) es estrictamente anterior a la semana de referencia?
export function esSemanaPasada(anio: number, semana: number, referencia: Semana): boolean {
  return anio < referencia.anio || (anio === referencia.anio && semana < referencia.semana)
}

// Día ISO de una fecha en UTC: lunes = 1 ... domingo = 7.
export function diaIsoDeFecha(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()))
  return ((d.getUTCDay() + 6) % 7) + 1
}

// Día ISO de hoy (lunes = 1 ... domingo = 7), en UTC (misma convención que semanaActual).
export function diaActual(): number {
  return diaIsoDeFecha(new Date())
}

// ¿El día (anio, semana, dia) ya pasó respecto a hoy? Considera año, semana y día.
export function esDiaPasado(
  anio: number,
  semana: number,
  dia: number,
  hoy: { anio: number; semana: number; dia: number },
): boolean {
  if (anio !== hoy.anio) return anio < hoy.anio
  if (semana !== hoy.semana) return semana < hoy.semana
  return dia < hoy.dia
}

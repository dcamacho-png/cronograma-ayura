// Cambio de área de un trabajador: lo que todavía no ha hecho (de HOY en adelante, también
// semanas futuras) se va con él a la nueva área; lo que ya pasó se queda en la anterior para
// que los resúmenes viejos no cambien.
export type Dia = { anio: number; semana: number; dia: number }

export function esDeHoyEnAdelante(a: Dia, hoy: Dia): boolean {
  if (a.anio !== hoy.anio) return a.anio > hoy.anio
  if (a.semana !== hoy.semana) return a.semana > hoy.semana
  return a.dia >= hoy.dia
}

// El mismo criterio que esDeHoyEnAdelante, como condiciones OR para Prisma.
export function desdeHoy(hoy: Dia) {
  return [
    { anio: { gt: hoy.anio } },
    { anio: hoy.anio, semana: { gt: hoy.semana } },
    { anio: hoy.anio, semana: hoy.semana, dia: { gte: hoy.dia } },
  ]
}

// Un potrero se puede BORRAR solo si nada lo referencia. Si tiene historial se
// RETIRA (bandera `activo`), que lo saca de los selectores conservando el pasado.
//
// Importa contar las cuatro relaciones: `actividades` y `tareasMulti` son
// muchos-a-muchos IMPLÍCITAS, así que borrar el potrero no falla — Prisma elimina
// las filas intermedias y el potrero desaparece del historial sin aviso.
export type ReferenciasLote = {
  actividades: number
  tareas: number
  tareasMulti: number
  notas: number
}

export function totalReferencias(r: ReferenciasLote): number {
  return r.actividades + r.tareas + r.tareasMulti + r.notas
}

export function puedeBorrarse(r: ReferenciasLote): boolean {
  return totalReferencias(r) === 0
}

const termino = (n: number, singular: string, plural: string) =>
  n === 0 ? null : `${n} ${n === 1 ? singular : plural}`

// "2 actividades, 3 tareas, 1 nota del conversatorio". Las dos relaciones de tarea
// (lote único y multi-lote) son la misma cosa para quien lee, así que se suman.
export function textoReferencias(r: ReferenciasLote): string {
  return [
    termino(r.actividades, 'actividad', 'actividades'),
    termino(r.tareas + r.tareasMulti, 'tarea', 'tareas'),
    termino(r.notas, 'nota del conversatorio', 'notas del conversatorio'),
  ].filter(Boolean).join(', ')
}

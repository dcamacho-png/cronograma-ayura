export type AsignacionOrdenAseo = { dia: number; responsableId: string; nombre: string }
export type DiaOrdenAseo = { dia: number; encargados: { responsableId: string; nombre: string }[] }

// Agrupa las asignaciones planas (una fila por responsable-día) en 7 días fijos
// (1=lunes … 7=domingo), cada uno con sus encargados ordenados por nombre.
export function agruparOrdenAseoPorDia(asignaciones: AsignacionOrdenAseo[]): DiaOrdenAseo[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dia) => ({
    dia,
    encargados: asignaciones
      .filter((a) => a.dia === dia)
      .map((a) => ({ responsableId: a.responsableId, nombre: a.nombre }))
      .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')),
  }))
}

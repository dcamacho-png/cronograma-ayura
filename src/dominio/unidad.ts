export type Unidad = 'ha' | 'hora' | 'kg' | 'cantidad'

// Normaliza un valor de texto a una Unidad válida; cualquier cosa distinta de
// 'hora' o 'kg' (incluido undefined / vacío / texto libre) cae a 'ha'.
export function normalizarUnidad(u: string | null | undefined): Unidad {
  return u === 'hora' || u === 'kg' || u === 'cantidad' ? u : 'ha'
}

// Deriva la unidad de una actividad buscando su descripción en el catálogo.
export function unidadDe(unidadPorNombre: Record<string, string>, descripcion: string): Unidad {
  return normalizarUnidad(unidadPorNombre[descripcion])
}

// Etiqueta del campo de "medida realizada" según la unidad.
export function etiquetaMedida(unidad: Unidad): string {
  if (unidad === 'hora') return 'Horas realizadas'
  if (unidad === 'kg') return 'Kg cosechados'
  if (unidad === 'cantidad') return 'Cantidad realizada'
  return 'Hectáreas realizadas'
}

// Abreviatura para listas y totales (ej. "6 horas").
export function unidadAbreviada(unidad: Unidad): string {
  if (unidad === 'hora') return 'horas'
  return unidad // 'ha' | 'kg' | 'cantidad'
}

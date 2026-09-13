// Una unidad de medida es texto libre del catálogo que el ADMIN administra en Configuración
// ('ha', 'hora', 'kg', 'cantidad', 'jornales', 'bultos', …). NO es un conjunto cerrado: antes
// lo era, y `normalizarUnidad` aplastaba a 'ha' todo lo que no reconocía, así que una actividad
// medida en jornales terminaba sumando hectáreas en el resumen.
export type Unidad = string

// Forma canónica de una unidad: minúscula y sin espacios de más. Sin unidad ⇒ 'ha'
// (la medida por defecto del campo).
export function normalizarUnidad(u: string | null | undefined): Unidad {
  return (u ?? '').trim().toLowerCase() || 'ha'
}

// Deriva la unidad de una actividad buscando su descripción en el catálogo.
export function unidadDe(unidadPorNombre: Record<string, string>, descripcion: string): Unidad {
  return normalizarUnidad(unidadPorNombre[descripcion])
}

// Etiqueta del campo de "medida realizada" según la unidad. Las cuatro de siempre tienen su
// frase; una unidad agregada por el usuario se nombra entre paréntesis para no inventarle
// género ni plural ("Jornales realizadas" estaría mal).
export function etiquetaMedida(unidad: Unidad): string {
  if (unidad === 'hora') return 'Horas realizadas'
  if (unidad === 'kg') return 'Kg cosechados'
  if (unidad === 'cantidad') return 'Cantidad realizada'
  if (unidad === 'ha') return 'Hectáreas realizadas'
  return `Medida realizada (${unidad})`
}

// Abreviatura para listas y totales (ej. "6 horas").
export function unidadAbreviada(unidad: Unidad): string {
  if (unidad === 'hora') return 'horas'
  return unidad
}

// Rótulo para mostrar una unidad en un desplegable ("ha" ⇒ "Ha", "jornales" ⇒ "Jornales").
export function etiquetaUnidad(unidad: Unidad): string {
  return unidad.charAt(0).toUpperCase() + unidad.slice(1)
}

// Una opción del desplegable de unidad: el valor que se guarda y el rótulo que se muestra.
export type OpcionUnidad = { valor: Unidad; nombre: string }

// Opciones para el desplegable: las del catálogo, más la unidad ya registrada cuando fue
// retirada. Sin ese agregado, abrir el formulario de una actividad medida con una unidad
// retirada le cambiaría la unidad a la primera de la lista sin que nadie lo pida.
export function opcionesConActual(opciones: OpcionUnidad[], actual?: string | null): OpcionUnidad[] {
  const a = (actual ?? '').trim().toLowerCase()
  if (!a || opciones.some((o) => o.valor === a)) return opciones
  return [{ valor: a, nombre: `${etiquetaUnidad(a)} (retirada)` }, ...opciones]
}

// Valor inicial del desplegable: la unidad preferida (la del catálogo de la actividad o la ya
// registrada) si está disponible; si no, la primera del catálogo.
export function unidadInicial(opciones: OpcionUnidad[], preferida?: string | null): Unidad {
  const p = normalizarUnidad(preferida)
  if (preferida && opciones.some((o) => o.valor === p)) return p
  return opciones[0]?.valor ?? 'ha'
}

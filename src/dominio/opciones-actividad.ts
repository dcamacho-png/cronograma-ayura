// Opciones de la lista "Actividad" al EDITAR una tarea de maquinaria. Si su nombre no está en
// el catálogo (se escribió con "Otra…" o el catálogo cambió), se agrega primero: sin esto la
// lista caía sola en la primera opción y, al guardar cualquier otro cambio (los lotes, por
// ejemplo), la tarea quedaba renombrada sin que nadie lo notara.
export function opcionesActividad(catalogo: string[], actual: string): string[] {
  if (!actual || catalogo.includes(actual)) return catalogo
  return [actual, ...catalogo]
}

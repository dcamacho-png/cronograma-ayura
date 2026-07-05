// Helpers puros del Conservatorio: separar pendientes/hablados y agrupar por área.

export function separarNotas<T extends { hablado: boolean }>(
  notas: T[],
): { pendientes: T[]; hablados: T[] } {
  const pendientes: T[] = []
  const hablados: T[] = []
  for (const n of notas) (n.hablado ? hablados : pendientes).push(n)
  return { pendientes, hablados }
}

export function agruparPorArea<T extends { area: { nombre: string } }>(
  notas: T[],
): [string, T[]][] {
  const mapa = new Map<string, T[]>()
  for (const n of notas) {
    const arr = mapa.get(n.area.nombre) ?? []
    arr.push(n)
    mapa.set(n.area.nombre, arr)
  }
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
}

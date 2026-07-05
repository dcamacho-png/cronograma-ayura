// Agrupa responsables por su finca (fija). Fincas en orden alfabético; el grupo
// "sin finca" (finca=null) siempre al final. Responsables ordenados por nombre
// dentro de cada grupo. Función pura: no depende del orden de entrada.
type ConFinca = { nombre: string; finca: { nombre: string } | null }

export function agruparResponsablesPorFinca<T extends ConFinca>(
  rs: T[],
): { finca: string | null; responsables: T[] }[] {
  const map = new Map<string | null, T[]>()
  for (const r of rs) {
    const k = r.finca?.nombre ?? null
    const arr = map.get(k)
    if (arr) arr.push(r)
    else map.set(k, [r])
  }
  const ordenNombre = (a: T, b: T) => a.nombre.localeCompare(b.nombre, 'es')
  const conFinca = [...map.entries()]
    .filter(([k]) => k !== null)
    .sort((a, b) => (a[0] as string).localeCompare(b[0] as string, 'es'))
    .map(([finca, responsables]) => ({ finca, responsables: [...responsables].sort(ordenNombre) }))
  const sinFinca = map.get(null)
  if (sinFinca) conFinca.push({ finca: null, responsables: [...sinFinca].sort(ordenNombre) })
  return conFinca
}

export function hayFincasAsignadas(grupos: { finca: string | null }[]): boolean {
  return grupos.some((g) => g.finca !== null)
}

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

// Reparte a los responsables en fotos para compartir. Cada foto es de UNA sola finca (mezclar
// fincas confunde de cuál es cada trabajador), y una finca con muchos trabajadores se parte en
// varias fotos parejas. Antes era una foto por finca sin más, y maquinaria (11 en Entremontes)
// sacaba una foto larguísima que WhatsApp dejaba borrosa.
export function repartirEnFotos<T extends ConFinca>(
  rs: T[],
  maxPorFoto: number,
  peso: (r: T) => number = () => 1,
): { finca: string | null; responsables: T[] }[] {
  return agruparResponsablesPorFinca(rs).flatMap((g) =>
    partirParejo(g.responsables, maxPorFoto, peso).map((responsables) => ({ finca: g.finca, responsables })),
  )
}

// Cuántas partes: las justas para que no pasen de `maxPorParte` en promedio.
// Cómo se cortan: por `peso` (lo alto que sale la fila de cada uno), buscando que la parte más
// pesada pese lo menos posible — así no queda una foto el doble de alta que las otras porque le
// tocaron los de muchas actividades. Sin `peso`, todos pesan igual (9 con máximo 4 → 3+3+3).
// Conserva el orden.
function partirParejo<T>(orden: T[], maxPorParte: number, peso: (r: T) => number): T[][] {
  const n = orden.length
  if (n === 0) return []
  const k = Math.ceil(n / Math.max(1, maxPorParte))
  const pesos = orden.map(peso)
  const acum = [0]
  for (const p of pesos) acum.push(acum[acum.length - 1] + p)
  const suma = (i: number, j: number) => acum[j] - acum[i]

  // Partición lineal (programación dinámica): mejor[f][j] = menor "foto más pesada" posible
  // repartiendo los primeros j en f fotos, cada una con al menos un trabajador. Empates: se
  // prefiere el corte más parejo en cantidad de trabajadores.
  const mejor: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(Infinity))
  const corte: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(0))
  mejor[0][0] = 0
  for (let f = 1; f <= k; f++) {
    for (let j = f; j <= n; j++) {
      const ideal = (j * (f - 1)) / f
      for (let i = f - 1; i < j; i++) {
        const v = Math.max(mejor[f - 1][i], suma(i, j))
        const eps = 1e-9
        if (v < mejor[f][j] - eps || (Math.abs(v - mejor[f][j]) <= eps && Math.abs(i - ideal) < Math.abs(corte[f][j] - ideal))) {
          mejor[f][j] = v
          corte[f][j] = i
        }
      }
    }
  }
  const limites: number[] = [n]
  for (let f = k, j = n; f > 0; f--) {
    j = corte[f][j]
    limites.unshift(j)
  }
  return limites.slice(1).map((hasta, i) => orden.slice(limites[i], hasta))
}

export function hayFincasAsignadas(grupos: { finca: string | null }[]): boolean {
  return grupos.some((g) => g.finca !== null)
}

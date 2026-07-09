export const ACTIVIDADES_CON_BULTOS = ['FERTILIZACION GRANULADA', 'ENCALADORA', 'FERTILIZACION POLLINAZA', 'ESTERCOLERO', 'ESPARCIDOR', 'REGAR COMPOST', 'GRANEL']

export type BultosPorLote = Record<string, number>

// ¿La actividad (por su descripción del catálogo) captura bultos por lote?
export function usaBultos(descripcion: string): boolean {
  return ACTIVIDADES_CON_BULTOS.includes(descripcion.trim().toUpperCase())
}

// Texto "L1: 3, L2: 2.5" con los lotes que tienen un bulto numérico, en el orden dado.
export function textoBultosPorLote(
  lotes: { id: string; nombre: string }[],
  bultos: BultosPorLote | null | undefined,
): string {
  if (!bultos) return ''
  return lotes
    .filter((l) => typeof bultos[l.id] === 'number')
    .map((l) => `${l.nombre}: ${bultos[l.id]}`)
    .join(', ')
}

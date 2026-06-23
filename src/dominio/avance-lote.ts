export type AvancePorLote = Record<string, { dia: number; maquinaId: string | null; cantidad: number }>

// Lotes de la actividad que aún no tienen avance registrado.
export function lotesPendientes<T extends { id: string }>(
  lotes: T[],
  avance: AvancePorLote | null | undefined,
): T[] {
  if (!avance) return lotes
  return lotes.filter((l) => !(l.id in avance))
}

// Texto "L-A: 3, L-B: 2" con los lotes que tienen avance, en el orden dado.
export function textoAvancePorLote(
  lotes: { id: string; nombre: string }[],
  avance: AvancePorLote | null | undefined,
): string {
  if (!avance) return ''
  return lotes
    .filter((l) => l.id in avance)
    .map((l) => `${l.nombre}: ${avance[l.id].cantidad}`)
    .join(', ')
}

// Resumen de avances con fecha: por cada lote realizado "<etiquetaDia> · <lote> — <cantidad> <unidad>".
// `etiquetaDia` traduce el día (1..7) a su etiqueta (ej. "Lun 22"); se inyecta para mantener el
// helper puro (sin depender del calendario). Entradas separadas por "; ".
export function textoAvanceConFecha(
  lotes: { id: string; nombre: string }[],
  avance: AvancePorLote | null | undefined,
  unidadAbrev: string,
  etiquetaDia: (dia: number) => string,
): string {
  if (!avance) return ''
  return lotes
    .filter((l) => l.id in avance)
    .map((l) => `${etiquetaDia(avance[l.id].dia)} · ${l.nombre} — ${avance[l.id].cantidad} ${unidadAbrev}`)
    .join('; ')
}

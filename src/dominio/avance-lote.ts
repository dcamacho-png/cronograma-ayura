// Un avance puntual de un lote en un día (cantidad incremental de ese día).
export type AvanceEntrada = { dia: number; maquinaId: string | null; cantidad: number }
// Historial de avances por lote: una lista de entradas por cada loteId.
export type AvancePorLote = Record<string, AvanceEntrada[]>

// Normaliza el JSON guardado: acepta la forma vieja (un objeto por lote) y la
// nueva (lista por lote); devuelve siempre la nueva. Un valor que no es arreglo
// se envuelve en [valor].
export function normalizarAvancePorLote(
  raw: Record<string, AvanceEntrada | AvanceEntrada[]> | null | undefined,
): AvancePorLote {
  if (!raw) return {}
  const out: AvancePorLote = {}
  for (const [loteId, v] of Object.entries(raw)) {
    out[loteId] = Array.isArray(v) ? v : [v]
  }
  return out
}

// Lotes de la actividad que aún no tienen ninguna entrada de avance.
export function lotesPendientes<T extends { id: string }>(
  lotes: T[],
  avance: AvancePorLote | null | undefined,
): T[] {
  if (!avance) return lotes
  return lotes.filter((l) => !(l.id in avance) || avance[l.id].length === 0)
}

// Texto "L-A: 5, L-B: 2" con la SUMA por lote, en el orden dado.
export function textoAvancePorLote(
  lotes: { id: string; nombre: string }[],
  avance: AvancePorLote | null | undefined,
): string {
  if (!avance) return ''
  return lotes
    .filter((l) => l.id in avance && avance[l.id].length > 0)
    .map((l) => `${l.nombre}: ${avance[l.id].reduce((s, e) => s + e.cantidad, 0)}`)
    .join(', ')
}

// Resumen con fecha: una entrada por cada avance "<etiquetaDia> · <lote> — <cantidad> <unidad>",
// recorriendo los lotes en orden y, dentro de cada lote, sus entradas en orden.
// `etiquetaDia` traduce el día (1..7) a su etiqueta; se inyecta para mantener el helper puro.
export function textoAvanceConFecha(
  lotes: { id: string; nombre: string }[],
  avance: AvancePorLote | null | undefined,
  unidadAbrev: string,
  etiquetaDia: (dia: number) => string,
): string {
  if (!avance) return ''
  const partes: string[] = []
  for (const l of lotes) {
    for (const e of avance[l.id] ?? []) {
      partes.push(`${etiquetaDia(e.dia)} · ${l.nombre} — ${e.cantidad} ${unidadAbrev}`)
    }
  }
  return partes.join('; ')
}

// Suma de todas las cantidades de todas las entradas (total de la actividad).
export function totalAvance(avance: AvancePorLote | null | undefined): number {
  if (!avance) return 0
  let total = 0
  for (const entradas of Object.values(avance)) {
    for (const e of entradas) total += e.cantidad
  }
  return total
}

// Devuelve una copia de `avance` con una entrada nueva agregada a cada lote indicado.
// No muta la entrada recibida.
export function agregarAvances(
  avance: AvancePorLote,
  dia: number,
  maquinaId: string | null,
  entradas: { loteId: string; cantidad: number }[],
): AvancePorLote {
  const out: AvancePorLote = { ...avance }
  for (const { loteId, cantidad } of entradas) {
    out[loteId] = [...(out[loteId] ?? []), { dia, maquinaId, cantidad }]
  }
  return out
}

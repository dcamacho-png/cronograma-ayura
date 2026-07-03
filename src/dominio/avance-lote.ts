// Un avance puntual de un lote en un día (cantidad incremental de ese día).
export type AvanceEntrada = { dia: number; maquinaId: string | null; cantidad: number; centroCosto?: string | null; responsableId?: string | null; observacion?: string | null }
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

// Lotes "pendientes": los que no tienen ninguna entrada de avance con cantidad > 0
// y tampoco están marcados como hechos en la novedad "Potreros realizados".
export function lotesPendientes<T extends { id: string }>(
  lotes: T[],
  avance: Record<string, AvanceEntrada | AvanceEntrada[]> | null | undefined,
  lotesHechos?: string[] | null,
): T[] {
  const av = normalizarAvancePorLote(avance)
  const hechos = new Set(lotesHechos ?? [])
  return lotes.filter((l) => !hechos.has(l.id) && !(av[l.id] ?? []).some((e) => e.cantidad > 0))
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

// Suma de las cantidades de los avances, ACOTADA a los lotes dados (los
// vigentes de la actividad). Ignora entradas de lotes que ya no pertenecen.
// Mismo recorrido que textoAvanceConFecha/filasCumplimiento.
export function totalAvanceLotes(
  lotes: { id: string }[],
  avance: AvancePorLote | null | undefined,
): number {
  if (!avance) return 0
  let total = 0
  for (const l of lotes) {
    for (const e of avance[l.id] ?? []) total += e.cantidad
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
  centroCosto?: string | null,
  responsableId?: string | null,
  observacion?: string | null,
): AvancePorLote {
  const out: AvancePorLote = { ...avance }
  for (const { loteId, cantidad } of entradas) {
    out[loteId] = [...(out[loteId] ?? []), { dia, maquinaId, cantidad, ...(centroCosto ? { centroCosto } : {}), ...(responsableId ? { responsableId } : {}), ...(observacion ? { observacion } : {}) }]
  }
  return out
}

// Devuelve una copia de `avance` con la entrada (loteId, index) modificada en los campos
// dados. `observacion` vacía elimina el campo. Fuera de rango ⇒ devuelve el mismo objeto.
export function editarAvanceEntrada(
  avance: AvancePorLote,
  loteId: string,
  index: number,
  cambios: { cantidad?: number; dia?: number; observacion?: string | null },
): AvancePorLote {
  const lista = avance[loteId]
  if (!lista || index < 0 || index >= lista.length) return avance
  const siguiente: AvanceEntrada = { ...lista[index] }
  if (cambios.cantidad !== undefined) siguiente.cantidad = cambios.cantidad
  if (cambios.dia !== undefined) siguiente.dia = cambios.dia
  if (cambios.observacion !== undefined) {
    if (cambios.observacion) siguiente.observacion = cambios.observacion
    else delete siguiente.observacion
  }
  return { ...avance, [loteId]: lista.map((e, i) => (i === index ? siguiente : e)) }
}

// Devuelve una copia de `avance` sin la entrada (loteId, index). Si el lote queda sin
// entradas, se elimina la clave. Fuera de rango ⇒ devuelve el mismo objeto.
export function eliminarAvanceEntrada(avance: AvancePorLote, loteId: string, index: number): AvancePorLote {
  const lista = avance[loteId]
  if (!lista || index < 0 || index >= lista.length) return avance
  const restante = lista.filter((_, i) => i !== index)
  const out = { ...avance }
  if (restante.length) out[loteId] = restante
  else delete out[loteId]
  return out
}

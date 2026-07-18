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
      partes.push(`${etiquetaDia(e.dia)} · ${l.nombre} — ${e.cantidad} ${unidadAbrev}${e.observacion ? ` · ${e.observacion}` : ''}`)
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

// Devuelve una copia de `avance` con el registro de cada lote indicado en el día dado.
// Una sola entrada por (lote, día): si ya existe una de ese día se REEMPLAZA en su
// posición (y se descartan duplicados viejos del mismo día); un día distinto se agrega
// aparte. Así, al reabrir y volver a registrar el mismo día, el Excel deja solo el
// último valor en vez de acumular el viejo y el nuevo. No muta lo recibido.
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
    const nueva: AvanceEntrada = { dia, maquinaId, cantidad, ...(centroCosto ? { centroCosto } : {}), ...(responsableId ? { responsableId } : {}), ...(observacion ? { observacion } : {}) }
    const lista = out[loteId] ?? []
    const idx = lista.findIndex((e) => e.dia === dia)
    out[loteId] = idx === -1
      ? [...lista, nueva]
      : lista.map((e, i) => (i === idx ? nueva : e)).filter((e, i) => i === idx || e.dia !== dia)
  }
  return out
}

// Al marcar CUMPLIDA, ¿qué lotes deben desglosarse (aparecer con medida) en el Excel?
// Un lote cuenta como "realizado" si tiene algún avance con cantidad > 0, o si está
// marcado en la lista "Potreros realizados" (lotesHechos). Si hay al menos una señal,
// se devuelven SOLO esos lotes; si no hay ninguna (cumplida directa), se devuelven
// TODOS (se asume que la actividad se hizo completa — comportamiento histórico).
export function lotesRealizadosCumplida<T extends { id: string }>(
  lotes: T[],
  avance: AvancePorLote,
  lotesHechos?: string[] | null,
): T[] {
  const hechos = new Set<string>(lotesHechos ?? [])
  for (const [id, entradas] of Object.entries(avance)) {
    if (entradas.some((e) => e.cantidad > 0)) hechos.add(id)
  }
  if (hechos.size === 0) return lotes
  return lotes.filter((l) => hechos.has(l.id))
}

// Al marcar una actividad como CUMPLIDA directamente (sin registrar avances), completa el
// historial para que los datos queden completos: a cada lote SIN ninguna entrada de avance le
// agrega una entrada con su área completa (hectáreas del potrero) en el día dado. Los lotes que
// ya tienen avances se dejan intactos. Un lote sin hectáreas recibe cantidad 0 (para que igual
// aparezca por lote en el Excel). Si no falta ninguno, devuelve el mismo objeto.
export function completarAvancesCumplida(
  lotes: { id: string; hectareas?: number | null }[],
  avance: AvancePorLote,
  dia: number,
  responsableId?: string | null,
): AvancePorLote {
  const faltantes = lotes
    .filter((l) => !(avance[l.id] ?? []).length)
    .map((l) => ({ loteId: l.id, cantidad: l.hectareas ?? 0 }))
  if (faltantes.length === 0) return avance
  return agregarAvances(avance, dia, null, faltantes, null, responsableId)
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

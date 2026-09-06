// Bitácora de avance de una actividad SIN potreros (taller, movimientos, coordinación,
// biodigestor…): lo que se hizo en UN día. Es el equivalente de `avance-lote` cuando el
// trabajo no ocurre en un potrero, y se acumula día a día durante la semana.
export type AvanceGeneralEntrada = {
  dia: number
  cantidad: number
  maquinaId?: string | null
  centroCosto?: string | null
  responsableId?: string | null
  observacion?: string | null
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

// Coerción del JSON guardado a una lista válida (descarta lo mal formado). Una entrada
// sin cantidad numérica cuenta como 0: el día trabajado no se pierde por no tener medida.
export function normalizarAvanceGeneral(raw: unknown): AvanceGeneralEntrada[] {
  if (!Array.isArray(raw)) return []
  const out: AvanceGeneralEntrada[] = []
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue
    const x = v as { dia?: unknown; cantidad?: unknown; maquinaId?: unknown; centroCosto?: unknown; responsableId?: unknown; observacion?: unknown }
    if (typeof x.dia !== 'number') continue
    out.push({
      dia: x.dia,
      cantidad: typeof x.cantidad === 'number' && Number.isFinite(x.cantidad) ? x.cantidad : 0,
      maquinaId: texto(x.maquinaId),
      centroCosto: texto(x.centroCosto),
      responsableId: texto(x.responsableId),
      observacion: texto(x.observacion),
    })
  }
  return out
}

// Agrega el avance de un día. Una sola entrada por día: si ya existe la de ese día se
// REEMPLAZA en su posición (misma invariante que el avance por lote, para que reabrir y
// volver a registrar el mismo día no duplique filas en el Excel). No muta lo recibido.
export function agregarAvanceGeneral(
  lista: AvanceGeneralEntrada[],
  entrada: AvanceGeneralEntrada,
): AvanceGeneralEntrada[] {
  const idx = lista.findIndex((e) => e.dia === entrada.dia)
  if (idx === -1) return [...lista, entrada]
  return lista.map((e, i) => (i === idx ? entrada : e))
}

// Suma de lo realizado en la semana.
export function totalAvanceGeneral(lista: AvanceGeneralEntrada[]): number {
  return lista.reduce((s, e) => s + e.cantidad, 0)
}

// Devuelve una copia con la entrada `index` modificada en los campos dados. `observacion`
// vacía la borra. Fuera de rango ⇒ devuelve la misma lista.
export function editarAvanceGeneral(
  lista: AvanceGeneralEntrada[],
  index: number,
  cambios: { dia?: number; cantidad?: number; observacion?: string | null },
): AvanceGeneralEntrada[] {
  if (index < 0 || index >= lista.length) return lista
  return lista.map((e, i) => (i === index ? {
    ...e,
    dia: cambios.dia ?? e.dia,
    cantidad: cambios.cantidad ?? e.cantidad,
    observacion: cambios.observacion !== undefined ? cambios.observacion : e.observacion,
  } : e))
}

// Devuelve una copia sin la entrada `index`. Fuera de rango ⇒ devuelve la misma lista.
export function eliminarAvanceGeneral(lista: AvanceGeneralEntrada[], index: number): AvanceGeneralEntrada[] {
  if (index < 0 || index >= lista.length) return lista
  return lista.filter((_, i) => i !== index)
}

// Resumen de solo lectura: "Lun — 4 hora; Mié — 2 hora · cambio de aceite".
// `etiquetaDia` traduce el día (1..7) a su etiqueta; se inyecta para mantener el helper puro.
export function textoAvanceGeneral(
  lista: AvanceGeneralEntrada[],
  unidadAbrev: string,
  etiquetaDia: (dia: number) => string,
): string {
  return lista
    .map((e) => `${etiquetaDia(e.dia)} — ${e.cantidad} ${unidadAbrev}${e.observacion ? ` · ${e.observacion}` : ''}`)
    .join('; ')
}

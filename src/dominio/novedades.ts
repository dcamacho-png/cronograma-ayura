// Una novedad = una razón registrada en un día (motivo + observación). Se acumulan
// en una lista (log) por actividad. No cambian el estado.
export type NovedadEntrada = { dia: number; motivoId: string | null; observacion: string | null }

// Coerción del JSON guardado a una lista de novedades válidas (descarta lo mal formado).
export function normalizarNovedades(raw: unknown): NovedadEntrada[] {
  if (!Array.isArray(raw)) return []
  const out: NovedadEntrada[] = []
  for (const e of raw) {
    if (e && typeof e === 'object' && typeof (e as { dia?: unknown }).dia === 'number') {
      const x = e as { dia: number; motivoId?: unknown; observacion?: unknown }
      out.push({
        dia: x.dia,
        motivoId: typeof x.motivoId === 'string' ? x.motivoId : null,
        observacion: typeof x.observacion === 'string' ? x.observacion : null,
      })
    }
  }
  return out
}

export function agregarNovedad(lista: NovedadEntrada[], entrada: NovedadEntrada): NovedadEntrada[] {
  return [...lista, entrada]
}

export function eliminarNovedad(lista: NovedadEntrada[], index: number): NovedadEntrada[] {
  if (index < 0 || index >= lista.length) return lista
  return lista.filter((_, i) => i !== index)
}

// Devuelve una copia de la lista con la entrada `index` modificada en los campos dados.
// Fuera de rango ⇒ devuelve la misma lista.
export function editarNovedad(
  lista: NovedadEntrada[],
  index: number,
  cambios: { dia?: number; motivoId?: string | null; observacion?: string | null },
): NovedadEntrada[] {
  if (index < 0 || index >= lista.length) return lista
  return lista.map((e, i) => (i === index ? {
    dia: cambios.dia ?? e.dia,
    motivoId: cambios.motivoId !== undefined ? cambios.motivoId : e.motivoId,
    observacion: cambios.observacion !== undefined ? cambios.observacion : e.observacion,
  } : e))
}

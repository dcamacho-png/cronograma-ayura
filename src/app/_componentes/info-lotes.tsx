import type { BultosPorLote } from '@/dominio/bultos'

type LoteInfo = { id: string; nombre: string; hectareas: number | null }

export function InfoLotes({
  lotes,
  bultosPorLote,
  medidaPorLote,
  unidad,
  className = '',
  tamano = 'text-xs',
}: {
  lotes: LoteInfo[]
  bultosPorLote?: BultosPorLote | null
  medidaPorLote?: Record<string, number> | null
  unidad?: string | null
  className?: string
  tamano?: string
}) {
  if (lotes.length === 0) return null
  const ha = lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)
  const etiqueta = (l: LoteInfo) => {
    const b = bultosPorLote?.[l.id]
    if (typeof b === 'number') return `${l.nombre} (${b} bultos)`
    const m = medidaPorLote?.[l.id]
    if (typeof m === 'number') return `${l.nombre} (${m}${unidad ? ` ${unidad}` : ''})`
    return l.nombre
  }
  const nombres = lotes.map(etiqueta).join(', ')
  return (
    <div className={`${tamano} text-tierra ${className}`}>
      📍 {nombres}
      {ha > 0 ? <> · <b>{ha.toFixed(1)} ha</b></> : null}
    </div>
  )
}

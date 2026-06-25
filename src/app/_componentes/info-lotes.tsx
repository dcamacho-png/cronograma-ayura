import type { BultosPorLote } from '@/dominio/bultos'

type LoteInfo = { id: string; nombre: string; hectareas: number | null }

export function InfoLotes({
  lotes,
  bultosPorLote,
  className = '',
}: {
  lotes: LoteInfo[]
  bultosPorLote?: BultosPorLote | null
  className?: string
}) {
  if (lotes.length === 0) return null
  const ha = lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)
  const etiqueta = (l: LoteInfo) => {
    const b = bultosPorLote?.[l.id]
    return typeof b === 'number' ? `${l.nombre} (${b} bultos)` : l.nombre
  }
  const nombres = lotes.map(etiqueta).join(', ')
  return (
    <div className={`text-xs text-tierra ${className}`}>
      📍 {nombres}
      {ha > 0 ? <> · <b>{ha.toFixed(1)} ha</b></> : null}
    </div>
  )
}

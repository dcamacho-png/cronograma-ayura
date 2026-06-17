type LoteInfo = { nombre: string; hectareas: number | null }

export function InfoLotes({ lotes, className = '' }: { lotes: LoteInfo[]; className?: string }) {
  if (lotes.length === 0) return null
  const ha = lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)
  const nombres = lotes.map((l) => l.nombre).join(', ')
  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      📍 {nombres}
      {ha > 0 ? <> · <b>{ha.toFixed(1)} ha</b></> : null}
    </div>
  )
}

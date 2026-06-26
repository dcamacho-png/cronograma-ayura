'use client'

import { DIAS_SEMANA } from '@/dominio/sugerencia'

export function CasillasDias({ seleccion = [] }: { seleccion?: string[] }) {
  const set = new Set(seleccion)
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <label key={d} className="flex items-center gap-1">
          <input type="checkbox" name="diaSugerido" value={d} defaultChecked={set.has(String(d))} className="accent-bosque" />
          {DIAS_SEMANA[d]}
        </label>
      ))}
    </div>
  )
}

export function CasillasColaboradores({
  responsables,
  seleccion = [],
}: {
  responsables: { id: string; nombre: string }[]
  seleccion?: string[]
}) {
  const set = new Set(seleccion)
  if (responsables.length === 0) return <p className="text-xs text-tierra">El área elegida no tiene responsables.</p>
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {responsables.map((r) => (
        <label key={r.id} className="flex items-center gap-1">
          <input type="checkbox" name="responsableSugerido" value={r.id} defaultChecked={set.has(r.id)} className="accent-bosque" />
          {r.nombre}
        </label>
      ))}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { buscarLotes } from '@/dominio/buscar-lotes'

type Inactivo = { id: string; nombre: string; areaNombre: string; fincaNombre: string | null }

// Responsables dados de baja: guardados en una sección cerrada para que no alarguen la lista
// de activos, con buscador por nombre para encontrar a quien haya que reactivar.
export function ResponsablesInactivos({
  inactivos,
  reactivar,
}: {
  inactivos: Inactivo[]
  reactivar: (form: FormData) => void | Promise<void>
}) {
  const [busqueda, setBusqueda] = useState('')
  if (inactivos.length === 0) return null
  // Misma búsqueda que la de lotes: sin mayúsculas ni tildes; sin tope de resultados.
  const { visibles } = buscarLotes(inactivos, busqueda, new Set(), inactivos.length)

  return (
    <details className="mb-3 rounded-lg border border-borde bg-marfil">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-tierra">
        Inactivos ({inactivos.length}) — dados de baja
      </summary>
      <div className="flex flex-col gap-2 px-3 pb-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar por nombre…"
          aria-label="Buscar responsable inactivo"
          className="rounded-lg border border-borde bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
        />
        {visibles.length === 0 && <span className="text-xs text-tierra">Nadie coincide.</span>}
        <ul className="flex flex-col gap-1">
          {visibles.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded bg-arena/60 px-2 py-1 text-sm text-tierra">
              <span>
                {r.nombre} · {r.areaNombre} · 🏠 {r.fincaNombre ?? 'sin finca'}
              </span>
              <form action={reactivar}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="activo" value="1" />
                <button className="text-xs font-semibold text-bosque hover:underline">Reactivar</button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

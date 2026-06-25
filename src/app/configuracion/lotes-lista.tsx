'use client'

import { useState } from 'react'
import { FormEliminar } from './form-eliminar'

type Lote = {
  id: string
  nombre: string
  hectareas: number | null
  tipoPasto: string | null
  finca: { nombre: string }
}

// Lista de lotes con buscador por nombre o finca.
export function LotesLista({
  lotes,
  eliminar,
}: {
  lotes: Lote[]
  eliminar: (formData: FormData) => void | Promise<void>
}) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const filtrados = term
    ? lotes.filter(
        (l) => l.nombre.toLowerCase().includes(term) || l.finca.nombre.toLowerCase().includes(term),
      )
    : lotes

  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar lote por nombre o finca…"
        className="mb-2 w-full rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
      />
      <p className="mb-2 text-xs text-tierra">
        {filtrados.length} de {lotes.length} lotes
      </p>
      <ul className="mb-3 max-h-72 space-y-1 overflow-y-auto">
        {filtrados.map((l) => (
          <li key={l.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">
              {l.nombre}
              <span className="text-tierra">
                {' · '}
                {l.finca.nombre}
                {l.hectareas ? ` · ${l.hectareas} ha` : ''}
                {l.tipoPasto ? ` · ${l.tipoPasto}` : ''}
              </span>
            </span>
            <FormEliminar accion={eliminar} id={l.id} etiqueta={l.nombre} />
          </li>
        ))}
        {filtrados.length === 0 && <li className="text-sm text-tierra/60">Sin resultados.</li>}
      </ul>
    </>
  )
}

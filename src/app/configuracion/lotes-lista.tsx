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
        className="mb-2 w-full rounded border p-2 text-sm"
      />
      <p className="mb-2 text-xs text-gray-500">
        {filtrados.length} de {lotes.length} lotes
      </p>
      <ul className="mb-3 max-h-72 space-y-1 overflow-y-auto">
        {filtrados.map((l) => (
          <li key={l.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">
              {l.nombre}
              <span className="text-gray-500">
                {' · '}
                {l.finca.nombre}
                {l.hectareas ? ` · ${l.hectareas} ha` : ''}
                {l.tipoPasto ? ` · ${l.tipoPasto}` : ''}
              </span>
            </span>
            <FormEliminar accion={eliminar} id={l.id} etiqueta={l.nombre} />
          </li>
        ))}
        {filtrados.length === 0 && <li className="text-sm text-gray-400">Sin resultados.</li>}
      </ul>
    </>
  )
}

'use client'

import { useState } from 'react'
import { FormEliminar } from './form-eliminar'

type Lote = {
  id: string
  nombre: string
  hectareas: number | null
  tipoPasto: string | null
  activo: boolean
  referencias: number
  finca: { nombre: string }
}

// Lista de potreros con buscador. Los retirados (no se ofrecen al programar) van
// atenuados y con su marca; eliminar solo se ofrece cuando nada los referencia,
// porque borrar un potrero usado lo saca del historial.
export function LotesLista({
  lotes,
  eliminar,
  retirar,
  reactivar,
}: {
  lotes: Lote[]
  eliminar: (formData: FormData) => void | Promise<void>
  retirar: (formData: FormData) => void | Promise<void>
  reactivar: (formData: FormData) => void | Promise<void>
}) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const filtrados = term
    ? lotes.filter(
        (l) => l.nombre.toLowerCase().includes(term) || l.finca.nombre.toLowerCase().includes(term),
      )
    : lotes
  const activos = lotes.filter((l) => l.activo).length

  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar potrero por nombre o finca…"
        className="mb-2 w-full rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
      />
      <p className="mb-2 text-xs text-tierra">
        {filtrados.length} de {lotes.length} · {activos} activos · {lotes.length - activos} retirados
      </p>
      <ul className="mb-3 max-h-72 space-y-1 overflow-y-auto">
        {filtrados.map((l) => (
          <li key={l.id} className={`flex items-center gap-2 text-sm ${l.activo ? '' : 'opacity-60'}`}>
            <span className="flex-1">
              {l.nombre}
              {!l.activo && (
                <span className="ml-2 rounded-full bg-arena px-2 py-0.5 text-xs font-semibold text-tierra">
                  retirado
                </span>
              )}
              <span className="text-tierra">
                {' · '}
                {l.finca.nombre}
                {l.hectareas ? ` · ${l.hectareas} ha` : ''}
                {l.tipoPasto ? ` · ${l.tipoPasto}` : ''}
              </span>
            </span>
            {l.activo ? (
              <form action={retirar}>
                <input type="hidden" name="id" value={l.id} />
                <button className="text-xs text-tierra hover:text-tinta hover:underline">retirar</button>
              </form>
            ) : (
              <form action={reactivar}>
                <input type="hidden" name="id" value={l.id} />
                <button className="text-xs font-semibold text-bosque hover:underline">reactivar</button>
              </form>
            )}
            {l.referencias === 0 ? (
              <FormEliminar accion={eliminar} id={l.id} etiqueta={l.nombre} />
            ) : (
              <span
                className="text-xs text-tierra/50"
                title={`Tiene ${l.referencias} registro(s) en el historial: retíralo en vez de eliminarlo.`}
              >
                en uso
              </span>
            )}
          </li>
        ))}
        {filtrados.length === 0 && <li className="text-sm text-tierra/60">Sin resultados.</li>}
      </ul>
    </>
  )
}

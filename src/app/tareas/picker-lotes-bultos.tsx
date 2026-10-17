'use client'

import { useState } from 'react'
import { buscarLotes } from '@/dominio/buscar-lotes'

type Lote = { id: string; nombre: string; finca: { nombre: string } }

// Cuántos resultados de búsqueda se ven a la vez: la lista entera de una finca era demasiado larga.
const MAX_RESULTADOS = 8

// Selector de varios lotes con cantidad de bultos por lote. Envía un <input name="loteId">
// por lote marcado y, si tiene cantidad, <input name="bultos_<id>">. La selección persiste
// aunque se cambie de finca (estado por id de lote).
//
// Arriba se BUSCA el lote (en vez de recorrer la lista larga de la finca) y abajo se van
// juntando los marcados, cada uno con su cuadrito: desmarcarlo lo quita.
export function PickerLotesBultos({ lotes, seleccionInicial = {}, campo = 'bultos', placeholder = 'bultos', sinCantidad = false }: { lotes: Lote[]; seleccionInicial?: Record<string, string>; campo?: string; placeholder?: string; sinCantidad?: boolean }) {
  const [finca, setFinca] = useState('')
  const [sel, setSel] = useState<Record<string, string>>(seleccionInicial) // loteId -> bultos (texto); presencia = marcado
  const [busqueda, setBusqueda] = useState('')

  const fincas = [...new Set(lotes.map((l) => l.finca.nombre))].sort()
  const seleccionados = lotes.filter((l) => l.id in sel)
  // Una tarea = una sola finca: al marcar el primer lote la finca queda fija en la de
  // ese lote y no se puede cambiar hasta desmarcar todo (evita mezclar fincas).
  const fincaBloqueada = seleccionados.length > 0 ? seleccionados[0].finca.nombre : null
  const fincaActiva = fincaBloqueada ?? finca
  const deLaFinca = fincaActiva ? lotes.filter((l) => l.finca.nombre === fincaActiva) : []
  const { visibles, total } = buscarLotes(deLaFinca, busqueda, new Set(Object.keys(sel)), MAX_RESULTADOS)

  const marcar = (id: string) => setSel((prev) => ({ ...prev, [id]: '' }))
  const quitar = (id: string) =>
    setSel((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  const setBultos = (id: string, v: string) => setSel((prev) => ({ ...prev, [id]: v }))

  return (
    <div className="flex flex-col gap-1">
      {/* Persiste la finca elegida aunque no se marque ningún lote (una finca por tarea). */}
      {fincaActiva && <input type="hidden" name="fincaNombre" value={fincaActiva} />}
      <select value={fincaActiva} onChange={(e) => { setFinca(e.target.value); setBusqueda('') }} disabled={!!fincaBloqueada} className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40 disabled:opacity-70">
        <option value="">— elegir finca —</option>
        {fincas.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      {fincaBloqueada && (
        <span className="text-xs text-tierra">Finca fija: {fincaBloqueada} — desmarca los lotes para cambiarla</span>
      )}
      {fincaActiva && (
        <>
          {/* Sin name: la búsqueda no se envía. Enter no debe mandar el formulario a medias. */}
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
            placeholder="🔍 Buscar lote… ej: mara"
            aria-label="Buscar lote"
            autoComplete="off"
            className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
          />
          {visibles.length > 0 && (
            <div className="flex flex-col rounded-lg border border-borde bg-white">
              {visibles.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-2 border-b border-borde/60 px-2 py-1.5 text-sm last:border-b-0 hover:bg-arena/40">
                  <input type="checkbox" checked={false} onChange={() => marcar(l.id)} className="accent-bosque" />
                  {l.nombre}
                </label>
              ))}
            </div>
          )}
          <span className="text-xs text-tierra">
            {total === 0
              ? (busqueda ? 'Ningún lote coincide.' : 'Ya marcaste todos los lotes de esta finca.')
              : total > visibles.length ? `Mostrando ${visibles.length} de ${total}. Escribe para afinar la búsqueda.` : ''}
          </span>
        </>
      )}
      {seleccionados.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 border-t-2 border-borde pt-2">
          <span className="text-xs font-semibold text-tinta">✅ Lotes seleccionados ({seleccionados.length})</span>
          {seleccionados.map((l) => (
            <div key={l.id} className="flex items-center gap-2 rounded-lg bg-green-50 px-2 py-1 text-sm">
              <label className="flex flex-1 cursor-pointer items-center gap-1">
                <input type="checkbox" checked onChange={() => quitar(l.id)} className="accent-bosque" aria-label={`Quitar ${l.nombre}`} />
                {l.nombre}
              </label>
              {!sinCantidad && (
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder={placeholder}
                  value={sel[l.id]}
                  onChange={(e) => setBultos(l.id, e.target.value)}
                  className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
                />
              )}
            </div>
          ))}
        </div>
      )}
      {seleccionados.map((l) => (
        <span key={l.id}>
          <input type="hidden" name="loteId" value={l.id} />
          {!sinCantidad && sel[l.id] !== '' && <input type="hidden" name={`${campo}_${l.id}`} value={sel[l.id]} />}
        </span>
      ))}
    </div>
  )
}

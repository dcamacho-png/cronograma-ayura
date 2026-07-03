'use client'

import { useState } from 'react'

type Lote = { id: string; nombre: string; finca: { nombre: string } }

// Selector de varios lotes con cantidad de bultos por lote. Envía un <input name="loteId">
// por lote marcado y, si tiene cantidad, <input name="bultos_<id>">. La selección persiste
// aunque se cambie de finca (estado por id de lote).
export function PickerLotesBultos({ lotes, seleccionInicial = {}, campo = 'bultos', placeholder = 'bultos' }: { lotes: Lote[]; seleccionInicial?: Record<string, string>; campo?: string; placeholder?: string }) {
  const [finca, setFinca] = useState('')
  const [sel, setSel] = useState<Record<string, string>>(seleccionInicial) // loteId -> bultos (texto); presencia = marcado

  const fincas = [...new Set(lotes.map((l) => l.finca.nombre))].sort()
  const filtrados = finca ? lotes.filter((l) => l.finca.nombre === finca) : []
  const seleccionados = lotes.filter((l) => l.id in sel)

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = { ...prev }
      if (id in next) delete next[id]
      else next[id] = ''
      return next
    })
  const setBultos = (id: string, v: string) => setSel((prev) => ({ ...prev, [id]: v }))

  return (
    <div className="flex flex-col gap-1">
      <select value={finca} onChange={(e) => setFinca(e.target.value)} className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
        <option value="">— elegir finca —</option>
        {fincas.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      {finca && (
        <div className="flex max-h-48 flex-col gap-1 overflow-auto rounded-lg border border-borde bg-marfil p-2">
          {filtrados.map((l) => {
            const checked = l.id in sel
            return (
              <div key={l.id} className="flex items-center gap-2 text-sm">
                <label className="flex flex-1 items-center gap-1">
                  <input type="checkbox" checked={checked} onChange={() => toggle(l.id)} className="accent-bosque" />
                  {l.nombre}
                </label>
                {checked && (
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
            )
          })}
        </div>
      )}
      {seleccionados.map((l) => (
        <span key={l.id}>
          <input type="hidden" name="loteId" value={l.id} />
          {sel[l.id] !== '' && <input type="hidden" name={`${campo}_${l.id}`} value={sel[l.id]} />}
        </span>
      ))}
      {seleccionados.length > 0 && (
        <div className="text-xs text-tierra">Lotes: {seleccionados.map((l) => l.nombre).join(', ')}</div>
      )}
    </div>
  )
}

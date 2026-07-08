'use client'

import { useState } from 'react'

type Lote = { id: string; nombre: string; hectareas?: number | null; finca: { nombre: string } }

// Multiselección de potreros por finca para el reemplazo (motivo = cambio). Cada potrero
// marcado lleva un valor de medida y —en fertilización— sus bultos. Emite por lote marcado
// <input name="reemplazoLoteId"> y, cuando tienen valor, <input name="reemplazoMedida_<id>">
// y <input name="reemplazoBultos_<id>">. La selección persiste al cambiar de finca (por id).
export function PickerReemplazoPotreros({ lotes, conBultos, unidadLabel }: { lotes: Lote[]; conBultos: boolean; unidadLabel: string }) {
  const [finca, setFinca] = useState('')
  const [sel, setSel] = useState<Record<string, { medida: string; bultos: string }>>({})

  const fincas = [...new Set(lotes.map((l) => l.finca.nombre))].sort()
  const seleccionados = lotes.filter((l) => l.id in sel)
  // Una sola finca: al marcar el primer potrero la finca queda fija hasta desmarcar todo.
  const fincaBloqueada = seleccionados.length > 0 ? seleccionados[0].finca.nombre : null
  const fincaActiva = fincaBloqueada ?? finca
  const filtrados = fincaActiva ? lotes.filter((l) => l.finca.nombre === fincaActiva) : []

  // Al marcar un potrero, precargar la medida con sus hectáreas (de la lista de potreros);
  // queda editable. Si se desmarca y vuelve a marcar, se repuebla con las ha.
  const toggle = (id: string) =>
    setSel((prev) => {
      const next = { ...prev }
      if (id in next) delete next[id]
      else {
        const ha = lotes.find((l) => l.id === id)?.hectareas
        next[id] = { medida: ha != null ? String(ha) : '', bultos: '' }
      }
      return next
    })
  const setValor = (id: string, campo: 'medida' | 'bultos', v: string) =>
    setSel((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: v } }))

  return (
    <div className="flex w-full flex-col gap-1">
      <select value={fincaActiva} onChange={(e) => setFinca(e.target.value)} disabled={!!fincaBloqueada} className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40 disabled:opacity-70">
        <option value="">— elegir finca —</option>
        {fincas.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      {fincaBloqueada && (
        <span className="text-xs text-tierra">Finca fija: {fincaBloqueada} — desmarca los potreros para cambiarla</span>
      )}
      {fincaActiva && (
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
                  <>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder={unidadLabel}
                      value={sel[l.id].medida}
                      onChange={(e) => setValor(l.id, 'medida', e.target.value)}
                      className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
                    />
                    {conBultos && (
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="bultos"
                        value={sel[l.id].bultos}
                        onChange={(e) => setValor(l.id, 'bultos', e.target.value)}
                        className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
                      />
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      {seleccionados.map((l) => (
        <span key={l.id}>
          <input type="hidden" name="reemplazoLoteId" value={l.id} />
          {sel[l.id].medida !== '' && <input type="hidden" name={`reemplazoMedida_${l.id}`} value={sel[l.id].medida} />}
          {conBultos && sel[l.id].bultos !== '' && <input type="hidden" name={`reemplazoBultos_${l.id}`} value={sel[l.id].bultos} />}
        </span>
      ))}
      {seleccionados.length > 0 && (
        <div className="text-xs text-tierra">Potreros: {seleccionados.map((l) => l.nombre).join(', ')}</div>
      )}
    </div>
  )
}

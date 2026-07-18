'use client'

import { useState } from 'react'

type Lote = { id: string; nombre: string; finca: { nombre: string } }

/**
 * Selector en dos pasos: primero la FINCA y luego solo los LOTES de esa finca,
 * para que la lista de lotes no sea tan larga. El segundo <select> es el que se
 * envía (name="loteId"); el de finca es solo un filtro de interfaz.
 */
export function SelectFincaLote({
  lotes,
  name = 'loteId',
  required = false,
  multiple = false,
  valorInicial = '',
  emitirFinca = false,
}: {
  lotes: Lote[]
  name?: string
  required?: boolean
  multiple?: boolean
  // Solo modo simple: id de lote a preseleccionar (deriva la finca automáticamente).
  valorInicial?: string
  // Envía la finca elegida (name="fincaNombre") para persistirla aunque no se elija lote.
  emitirFinca?: boolean
}) {
  const fincaInicial = valorInicial ? (lotes.find((l) => l.id === valorInicial)?.finca.nombre ?? '') : ''
  const [finca, setFinca] = useState(fincaInicial)
  const [lote, setLote] = useState(valorInicial)

  const fincas = [...new Set(lotes.map((l) => l.finca.nombre))].sort()
  const filtrados = finca ? lotes.filter((l) => l.finca.nombre === finca) : []

  return (
    <div className="flex flex-col gap-1">
      {emitirFinca && finca && <input type="hidden" name="fincaNombre" value={finca} />}
      <select
        value={finca}
        onChange={(e) => { setFinca(e.target.value); setLote('') }}
        className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
      >
        <option value="">— elegir finca —</option>
        {fincas.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <select
        name={name}
        required={required}
        multiple={multiple}
        size={multiple ? 6 : undefined}
        disabled={!finca}
        {...(multiple ? {} : { value: lote, onChange: (e) => setLote(e.target.value) })}
        className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40 disabled:bg-arena disabled:text-tierra/60"
      >
        {!multiple && (
          <option value="">{finca ? '— elegir lote —' : '— elige la finca primero —'}</option>
        )}
        {filtrados.map((l) => (
          <option key={l.id} value={l.id}>{l.nombre}</option>
        ))}
      </select>
    </div>
  )
}

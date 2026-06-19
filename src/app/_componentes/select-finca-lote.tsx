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
}: {
  lotes: Lote[]
  name?: string
  required?: boolean
  multiple?: boolean
}) {
  const [finca, setFinca] = useState('')

  const fincas = [...new Set(lotes.map((l) => l.finca.nombre))].sort()
  const filtrados = finca ? lotes.filter((l) => l.finca.nombre === finca) : []

  return (
    <div className="flex flex-col gap-1">
      <select
        value={finca}
        onChange={(e) => setFinca(e.target.value)}
        className="rounded border p-2 text-sm"
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
        className="rounded border p-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
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

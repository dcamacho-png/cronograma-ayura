'use client'

import { useState } from 'react'
import { SelectFincaLote } from '../_componentes/select-finca-lote'

type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string }

export function FormNuevaTareaMaquinaria({
  areaId,
  estipuladas,
  lotes,
  accion,
}: {
  areaId: string
  estipuladas: Estipulada[]
  lotes: Lote[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [estipulada, setEstipulada] = useState('')
  const esFertilizacion = estipulada.toUpperCase().includes('FERTILIZA')

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2 rounded-xl border p-4">
      <input type="hidden" name="areaId" value={areaId} />
      <label className="flex flex-col text-sm">
        Actividad (lista)
        <select
          name="estipulada"
          value={estipulada}
          onChange={(e) => setEstipulada(e.target.value)}
          className="rounded border p-2"
        >
          <option value="">— elegir —</option>
          {estipuladas.map((e) => (
            <option key={e.id} value={e.nombre}>{e.nombre}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col text-sm">
        Otra (opcional)
        <input name="otra" placeholder="Escribe otra si no está en la lista" className="rounded border p-2" />
      </label>
      <label className="flex flex-col text-sm">
        {esFertilizacion ? 'Finca y lotes (fertilización — mantén Ctrl/⌘ para varios)' : 'Finca y lote'}
        <SelectFincaLote lotes={lotes} name="loteId" multiple={esFertilizacion} />
      </label>
      <button className="rounded bg-[#11603a] px-4 py-2 text-sm font-semibold text-white">+ Agregar al banco</button>
    </form>
  )
}

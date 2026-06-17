'use client'

import { useState } from 'react'

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

  const grupos = new Map<string, Lote[]>()
  for (const l of lotes) {
    const arr = grupos.get(l.finca.nombre) ?? []
    arr.push(l)
    grupos.set(l.finca.nombre, arr)
  }

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
        {esFertilizacion ? 'Lotes (fertilización — mantén Ctrl/⌘ para varios)' : 'Lote'}
        <select
          name="loteId"
          multiple={esFertilizacion}
          size={esFertilizacion ? 6 : undefined}
          className="rounded border p-2 text-sm"
        >
          {!esFertilizacion && <option value="">— elegir lote —</option>}
          {[...grupos.entries()].map(([finca, ls]) => (
            <optgroup key={finca} label={finca}>
              {ls.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <button className="rounded bg-[#11603a] px-4 py-2 text-sm font-semibold text-white">+ Agregar al banco</button>
    </form>
  )
}

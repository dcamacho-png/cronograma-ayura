'use client'

import { useState } from 'react'
import { SelectFincaLote } from '../_componentes/select-finca-lote'
import { PickerLotesBultos } from './picker-lotes-bultos'
import { usaBultos } from '@/dominio/bultos'

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
  const conBultos = usaBultos(estipulada)

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
          <option value="__otra__">Otra…</option>
        </select>
      </label>
      {estipulada === '__otra__' && (
        <label className="flex flex-1 flex-col text-sm">
          Otra (escribe la actividad)
          <input name="otra" placeholder="¿Qué actividad?" className="rounded border p-2" />
        </label>
      )}
      <label className="flex flex-col text-sm">
        {conBultos ? 'Lotes y bultos por lote' : 'Finca y lote'}
        {conBultos ? (
          <PickerLotesBultos lotes={lotes} />
        ) : (
          <SelectFincaLote lotes={lotes} name="loteId" />
        )}
      </label>
      <label className="flex w-full flex-col text-sm">
        Detalle / instrucciones (opcional)
        <textarea name="detalle" rows={2} placeholder="Ej: aplicar urea, 2 bultos/ha" className="rounded border p-2 text-sm" />
      </label>
      <button className="rounded bg-[#11603a] px-4 py-2 text-sm font-semibold text-white">+ Agregar al banco</button>
    </form>
  )
}

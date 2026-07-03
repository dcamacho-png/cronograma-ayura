'use client'

import { useState } from 'react'
import { PickerLotesBultos } from './picker-lotes-bultos'

const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro" (texto libre)
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string }

// Alta de tarea estándar (espejo del de maquinaria): actividad del catálogo estándar +
// "Otra…", unidad de la lista ampliada, y uno o varios lotes con su valor de medida.
export function FormNuevaTareaEstandar({
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
  const [unidadSel, setUnidadSel] = useState('Jornales')

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2 rounded-xl border border-borde p-4">
      <input type="hidden" name="areaId" value={areaId} />
      <label className="flex flex-col text-sm">
        Actividad (lista)
        <select
          name="estipulada"
          value={estipulada}
          onChange={(e) => setEstipulada(e.target.value)}
          className="rounded-lg border border-borde bg-marfil p-2 focus:outline-none focus:ring-2 focus:ring-bosque/40"
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
          <input name="otra" placeholder="¿Qué actividad?" className="rounded-lg border border-borde bg-marfil p-2 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      <label className="flex flex-col text-sm">
        Unidad
        <select
          name="unidad"
          value={unidadSel === 'Otro' ? 'otro' : unidadSel.toLowerCase()}
          onChange={(e) => setUnidadSel(e.target.value === 'otro' ? 'Otro' : e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
          className="rounded-lg border border-borde bg-marfil p-2 focus:outline-none focus:ring-2 focus:ring-bosque/40"
        >
          {UNIDADES.map((u) => (<option key={u} value={u.toLowerCase()}>{u}</option>))}
          <option value="otro">Otro…</option>
        </select>
      </label>
      {unidadSel === 'Otro' && (
        <label className="flex flex-col text-sm">
          Unidad (texto)
          <input name="unidadOtra" placeholder="ej. viajes" className="w-28 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      <label className="flex flex-col text-sm">
        Lotes y medida por lote
        <PickerLotesBultos lotes={lotes} campo="medida" placeholder="medida" />
      </label>
      <label className="flex w-full flex-col text-sm">
        Detalle / instrucciones (opcional)
        <textarea name="detalle" rows={2} placeholder="Ej: 2 jornales por lote" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
      </label>
      <button className="rounded-lg bg-bosque px-4 py-2 text-sm font-semibold text-white">+ Agregar al banco</button>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { SelectFincaLote } from '../_componentes/select-finca-lote'
import { PickerLotesBultos } from './picker-lotes-bultos'
import { CasillasDias, CasillasColaboradores } from './campos-sugerencia'

type Estipulada = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }

export function FormEditarSolicitud({
  id,
  esMaquinaria,
  descripcion,
  detalle,
  diasSeleccion,
  responsablesSeleccion,
  responsablesB,
  estipuladas,
  lotes,
  lotesActuales,
  accion,
}: {
  id: string
  esMaquinaria: boolean
  descripcion: string
  detalle: string | null
  diasSeleccion: string[]
  responsablesSeleccion: string[]
  responsablesB: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  lotes: Lote[]
  lotesActuales: { nombre: string }[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-sm text-bosque hover:underline">
        ✏️ Editar
      </button>
    )
  }
  return (
    <form action={accion} className="mt-1 flex w-full flex-col gap-2 rounded-lg border border-borde bg-arena p-2 text-sm">
      <input type="hidden" name="id" value={id} />
      {esMaquinaria ? (
        <label className="flex flex-col text-xs">
          Actividad
          <select name="estipulada" defaultValue={descripcion} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
            {estipuladas.map((e) => (
              <option key={e.id} value={e.nombre}>{e.nombre}</option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col text-xs">
          Descripción
          <input name="descripcion" defaultValue={descripcion} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      <label className="flex flex-col text-xs">
        Descripción (opcional)
        <textarea name="detalle" rows={2} defaultValue={detalle ?? ''} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
      </label>
      <label className="flex flex-col text-xs">
        Finca y lote
        {lotesActuales.length > 0 && (
          <span className="text-xs text-tierra">
            Lotes actuales: {lotesActuales.map((l) => l.nombre).join(', ')} (elige nuevos solo si quieres reemplazarlos)
          </span>
        )}
        {esMaquinaria ? <PickerLotesBultos lotes={lotes} /> : <SelectFincaLote lotes={lotes} name="loteId" />}
      </label>
      <div className="flex flex-col gap-1 text-xs">
        <span>Día sugerido</span>
        <CasillasDias seleccion={diasSeleccion} />
      </div>
      {!esMaquinaria && (
        <div className="flex flex-col gap-1 text-xs">
          <span>Colaboradores sugeridos</span>
          <CasillasColaboradores responsables={responsablesB} seleccion={responsablesSeleccion} />
        </div>
      )}
      <div className="flex gap-2">
        <button className="rounded-lg bg-bosque px-3 py-1 text-xs font-semibold text-white">Guardar cambios</button>
        <button type="button" onClick={() => setAbierto(false)} className="text-tierra underline">cancelar</button>
      </div>
    </form>
  )
}

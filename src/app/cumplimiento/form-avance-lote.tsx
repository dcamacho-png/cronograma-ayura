'use client'

import { useState } from 'react'
import { etiquetaMedida, type Unidad } from '@/dominio/unidad'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Formulario para registrar el avance de uno o varios lotes de una actividad
// parcial: día, máquina (maquinaria) y, por lote, casilla + cantidad.
export function FormAvanceLote({
  actividadId,
  diaActividad,
  esMaquinaria,
  maquinas,
  unidad,
  lotes,
  accion,
}: {
  actividadId: string
  diaActividad: number
  esMaquinaria: boolean
  maquinas: { id: string; nombre: string }[]
  unidad: Unidad
  lotes: { id: string; nombre: string }[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded border border-bosque px-2 py-1 text-xs font-semibold text-bosque hover:bg-green-50"
      >
        Registrar avance
      </button>
    )
  }

  return (
    <form action={accion} className="flex w-full flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs">
      <input type="hidden" name="id" value={actividadId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col">
          Día
          <select name="dia" defaultValue={diaActividad} className="rounded border p-1">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>{DIAS[d]}</option>
            ))}
          </select>
        </label>
        {esMaquinaria && (
          <label className="flex flex-col">
            Máquina
            <select name="maquinaId" className="rounded border p-1">
              <option value="">— sin máquina —</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-gray-700">Lotes realizados — {etiquetaMedida(unidad)}</span>
        {lotes.map((l) => (
          <div key={l.id} className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              <input type="checkbox" name="loteAvance" value={l.id} className="accent-bosque" />
              {l.nombre}
            </label>
            <input name={`cantidad_${l.id}`} type="number" step="any" min="0" placeholder="cantidad" className="w-24 rounded border p-1" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="rounded bg-bosque px-3 py-1 font-semibold text-white">Guardar avance</button>
        <button type="button" onClick={() => setAbierto(false)} className="text-gray-500 underline">cancelar</button>
      </div>
    </form>
  )
}

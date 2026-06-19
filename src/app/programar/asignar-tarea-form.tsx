'use client'

import { useState } from 'react'
import { turnoPorDia } from '@/dominio/turno'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Lote = { id: string; nombre: string; finca: { nombre: string } }

export function AsignarTareaForm({
  tareaId,
  descripcion,
  lotesTarea,
  responsables,
  lotes,
  accion,
}: {
  tareaId: string
  descripcion: string
  lotesTarea: { nombre: string }[]
  responsables: { id: string; nombre: string }[]
  lotes: Lote[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [turno, setTurno] = useState(turnoPorDia(1))
  const tieneLotes = lotesTarea.length > 0

  const grupos = new Map<string, Lote[]>()
  for (const l of lotes) {
    const arr = grupos.get(l.finca.nombre) ?? []
    arr.push(l)
    grupos.set(l.finca.nombre, arr)
  }

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tareaId" value={tareaId} />
      <span className="min-w-[160px] flex-1 font-medium">{descripcion}</span>
      <label className="flex flex-col text-xs">
        Responsable
        <select name="responsableId" required className="rounded border p-1 text-sm">
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-col text-xs">
        Días
        <div className="flex gap-1">
          {DIAS.map((d, i) => (
            <label
              key={d}
              className="flex cursor-pointer flex-col items-center rounded border px-1.5 py-0.5 has-[:checked]:border-[#11603a] has-[:checked]:bg-green-50"
            >
              <span>{d}</span>
              <input type="checkbox" name="dia" value={i + 1} className="accent-[#11603a]" />
            </label>
          ))}
        </div>
      </div>
      <label className="flex flex-col text-xs">
        Turno
        <input
          name="turno"
          value={turno}
          onChange={(e) => setTurno(e.target.value)}
          className="w-28 rounded border p-1 text-sm"
        />
      </label>
      {tieneLotes ? (
        <span className="text-xs text-gray-600">Lote(s): {lotesTarea.map((l) => l.nombre).join(', ')}</span>
      ) : (
        <label className="flex flex-col text-xs">
          Lote
          <select name="loteId" className="rounded border p-1 text-sm">
            <option value="">— sin lote —</option>
            {[...grupos.entries()].map(([finca, ls]) => (
              <optgroup key={finca} label={finca}>
                {ls.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Asignar →</button>
    </form>
  )
}

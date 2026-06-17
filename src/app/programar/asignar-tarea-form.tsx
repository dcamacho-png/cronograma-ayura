'use client'

import { useState } from 'react'
import { turnoPorDia } from '@/dominio/turno'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

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
  const [dia, setDia] = useState(1)
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
      <label className="flex flex-col text-xs">
        Día
        <select
          name="dia"
          required
          value={dia}
          onChange={(e) => {
            const d = Number(e.target.value)
            setDia(d)
            setTurno(turnoPorDia(d))
          }}
          className="rounded border p-1 text-sm"
        >
          {DIAS.map((d, i) => (
            <option key={d} value={i + 1}>{d}</option>
          ))}
        </select>
      </label>
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

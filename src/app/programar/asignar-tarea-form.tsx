'use client'

import { useState } from 'react'
import { turnoPorDia } from '@/dominio/turno'
import { SelectFincaLote } from '../_componentes/select-finca-lote'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Lote = { id: string; nombre: string; finca: { nombre: string } }

export function AsignarTareaForm({
  tareaId,
  descripcion,
  lotesTarea,
  responsables,
  lotes,
  esMaquinaria,
  maquinas,
  accion,
}: {
  tareaId: string
  descripcion: string
  lotesTarea: { nombre: string }[]
  responsables: { id: string; nombre: string }[]
  lotes: Lote[]
  esMaquinaria: boolean
  maquinas: { id: string; nombre: string }[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [turno, setTurno] = useState(turnoPorDia(1))
  const [dias, setDias] = useState<number[]>([])
  const tieneLotes = lotesTarea.length > 0

  const toggleDia = (d: number) =>
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

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
              <input
                type="checkbox"
                name="dia"
                value={i + 1}
                checked={dias.includes(i + 1)}
                onChange={() => toggleDia(i + 1)}
                className="accent-[#11603a]"
              />
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
      {esMaquinaria && dias.length > 0 && (
        <div className="flex w-full flex-col gap-1 text-xs">
          <span className="text-gray-500">Máquina por día (opcional)</span>
          {[...dias].sort((a, b) => a - b).map((d) => (
            <label key={d} className="flex items-center gap-1">
              <span className="w-8">{DIAS[d - 1]}</span>
              <select name={`maquina_${d}`} className="rounded border p-1 text-sm">
                <option value="">— sin máquina —</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {tieneLotes ? (
        <span className="text-xs text-gray-600">Lote(s): {lotesTarea.map((l) => l.nombre).join(', ')}</span>
      ) : (
        <label className="flex flex-col text-xs">
          Finca y lote
          <SelectFincaLote lotes={lotes} name="loteId" />
        </label>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Asignar →</button>
    </form>
  )
}

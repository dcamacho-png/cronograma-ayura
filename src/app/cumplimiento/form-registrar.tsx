'use client'

import { useState } from 'react'

type Motivo = { id: string; nombre: string }

export function FormRegistrar({
  actividadId,
  esMaquinaria,
  motivos,
  accion,
}: {
  actividadId: string
  esMaquinaria: boolean
  motivos: Motivo[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [estado, setEstado] = useState('')
  const requiereMotivo = estado !== '' && estado !== 'CUMPLIDA'
  const requiereHa = esMaquinaria && requiereMotivo

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={actividadId} />
      <label className="flex flex-col text-xs">
        Estado
        <select
          name="estado"
          required
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="rounded border p-1 text-sm"
        >
          <option value="">— marcar —</option>
          <option value="CUMPLIDA">✅ Cumplida</option>
          <option value="NO_CUMPLIDA">🔴 No cumplida</option>
          <option value="PARCIAL">🟡 Parcial</option>
          <option value="REPROGRAMADA">🔄 Reprogramada</option>
        </select>
      </label>
      <label className="flex flex-col text-xs">
        Motivo{requiereMotivo ? ' *' : ''}
        <select name="motivoId" required={requiereMotivo} className="rounded border p-1 text-sm">
          <option value="">—</option>
          {motivos.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col text-xs">
        Observación / lo que faltó
        <input name="nota" placeholder="(para parcial o reprogramada)" className="rounded border p-1 text-sm" />
      </label>
      {esMaquinaria && (
        <label className="flex flex-col text-xs">
          Ha faltantes{requiereHa ? ' *' : ''}
          <input
            name="haFaltante"
            type="number"
            step="0.1"
            min="0"
            required={requiereHa}
            className="w-24 rounded border p-1 text-sm"
          />
        </label>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Registrar</button>
    </form>
  )
}

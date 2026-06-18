'use client'

import { useState } from 'react'

type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string }
type Area = { id: string; nombre: string }

export function FormSolicitar({
  solicitanteAreaId,
  areas,
  maquinariaAreaId,
  estipuladas,
  lotes,
  accion,
}: {
  solicitanteAreaId: string
  areas: Area[]
  maquinariaAreaId: string
  estipuladas: Estipulada[]
  lotes: Lote[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [areaEjecutoraId, setAreaEjecutoraId] = useState('')
  const [estipulada, setEstipulada] = useState('')
  const esMaquinaria = areaEjecutoraId !== '' && areaEjecutoraId === maquinariaAreaId
  const esFert = estipulada.toUpperCase().includes('FERTILIZA')

  const grupos = new Map<string, Lote[]>()
  for (const l of lotes) {
    const arr = grupos.get(l.finca.nombre) ?? []
    arr.push(l)
    grupos.set(l.finca.nombre, arr)
  }

  return (
    <form action={accion} className="flex flex-col gap-2 rounded-xl border border-purple-200 bg-purple-50 p-4">
      <h2 className="font-semibold text-purple-900">📨 Solicitar a otra área</h2>
      <input type="hidden" name="solicitanteAreaId" value={solicitanteAreaId} />
      <label className="flex flex-col text-sm">
        Área que la ejecuta
        <select
          name="areaEjecutoraId"
          required
          value={areaEjecutoraId}
          onChange={(e) => setAreaEjecutoraId(e.target.value)}
          className="rounded border p-2 text-sm"
        >
          <option value="">— elegir área —</option>
          {areas.filter((a) => a.id !== solicitanteAreaId).map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
      </label>
      {esMaquinaria ? (
        <>
          <label className="flex flex-col text-sm">
            Actividad (lista)
            <select name="estipulada" value={estipulada} onChange={(e) => setEstipulada(e.target.value)} className="rounded border p-2 text-sm">
              <option value="">— elegir —</option>
              {estipuladas.map((e) => (
                <option key={e.id} value={e.nombre}>{e.nombre}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            Otra (opcional)
            <input name="otra" placeholder="Escribe otra si no está en la lista" className="rounded border p-2 text-sm" />
          </label>
          <label className="flex flex-col text-sm">
            {esFert ? 'Lotes (fertilización — varios, mantén Ctrl/⌘)' : 'Lote'}
            <select name="loteId" multiple={esFert} size={esFert ? 6 : undefined} className="rounded border p-2 text-sm">
              {!esFert && <option value="">— elegir lote —</option>}
              {[...grupos.entries()].map(([finca, ls]) => (
                <optgroup key={finca} label={finca}>
                  {ls.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label className="flex flex-col text-sm">
          Descripción
          <input name="descripcion" placeholder="Ej: pasar renovador en lote X" className="rounded border p-2 text-sm" />
        </label>
      )}
      <button className="self-start rounded bg-purple-700 px-4 py-2 text-sm font-semibold text-white">📨 Solicitar</button>
    </form>
  )
}

'use client'

import { useState } from 'react'

type Entrada = { index: number; dia: number; motivoId: string; motivo: string; observacion: string }

// Log de novedades (razones) de una actividad. Muestra la lista con ✏️ para editar y × para
// borrar y, si es editable, un "+ Novedad" que abre un mini-form (día + motivo + observación).
// Agregar/editar una novedad NO cambia el estado de la actividad.
export function NovedadesLista({
  actividadId,
  entradas,
  editable,
  motivos,
  diaLabels,
  agregar,
  editar,
  eliminar,
}: {
  actividadId: string
  entradas: Entrada[]
  editable: boolean
  motivos: { id: string; nombre: string }[]
  diaLabels: string[]
  agregar: (f: FormData) => void | Promise<void>
  editar: (f: FormData) => void | Promise<void>
  eliminar: (f: FormData) => void | Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  if (entradas.length === 0 && !editable) return null

  return (
    <div className="flex flex-col gap-1 text-xs">
      {entradas.length > 0 && <span className="text-tierra">Novedades:</span>}
      {entradas.map((e) => (
        <div key={e.index}>
          {editable && editando === e.index ? (
            <form action={editar} onSubmit={() => setEditando(null)} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={actividadId} />
              <input type="hidden" name="index" value={e.index} />
              <label className="flex flex-col">Día
                <select name="dia" defaultValue={e.dia} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{diaLabels[d]}</option>))}
                </select>
              </label>
              <label className="flex flex-col">Motivo
                <select name="motivoId" defaultValue={e.motivoId} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                  <option value="">—</option>
                  {motivos.map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
                </select>
              </label>
              <label className="flex flex-1 flex-col">Observación
                <input name="observacion" defaultValue={e.observacion} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
              </label>
              <button className="rounded-lg border border-bosque px-2 py-1 font-semibold text-bosque hover:bg-arena/40">Guardar</button>
              <button type="button" onClick={() => setEditando(null)} className="text-tierra underline">cancelar</button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span>{[diaLabels[e.dia] ?? '', e.motivo].filter(Boolean).join(' · ')}{e.observacion ? ` — ${e.observacion}` : ''}</span>
              {editable && (
                <>
                  <button type="button" onClick={() => setEditando(e.index)} className="text-tierra hover:text-tinta" title="editar novedad">✏️</button>
                  <form action={eliminar} className="inline">
                    <input type="hidden" name="id" value={actividadId} />
                    <input type="hidden" name="index" value={e.index} />
                    <button className="text-tierra hover:text-rose-700" title="borrar novedad">×</button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      ))}
      {editable && (
        abierto ? (
          <form action={agregar} onSubmit={() => setAbierto(false)} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={actividadId} />
            <label className="flex flex-col">
              Día
              <select name="dia" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{diaLabels[d]}</option>))}
              </select>
            </label>
            <label className="flex flex-col">
              Motivo
              <select name="motivoId" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                <option value="">—</option>
                {motivos.map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
              </select>
            </label>
            <label className="flex flex-1 flex-col">
              Observación
              <input name="observacion" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
            <button className="rounded-lg border border-bosque px-2 py-1 font-semibold text-bosque hover:bg-arena/40">Agregar</button>
            <button type="button" onClick={() => setAbierto(false)} className="text-tierra underline">cancelar</button>
          </form>
        ) : (
          <button type="button" onClick={() => setAbierto(true)} className="self-start text-tierra underline">+ Novedad</button>
        )
      )}
    </div>
  )
}

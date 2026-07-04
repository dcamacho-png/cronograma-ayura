'use client'

import { useState } from 'react'

type Entrada = { loteId: string; loteNombre: string; index: number; dia: number; cantidad: number; observacion: string }

// Lista de avances registrados con editar (✏️, mini-form en línea: día + cantidad + observación)
// y borrar (×). Cada avance se ubica por loteId + index. Solo se usa en actividades abiertas.
export function AvancesEditables({
  actividadId,
  entradas,
  unidad,
  etiquetaPorDia,
  diaLabels,
  editar,
  eliminar,
}: {
  actividadId: string
  entradas: Entrada[]
  unidad: string
  etiquetaPorDia: string[]
  diaLabels: string[]
  editar: (f: FormData) => void | Promise<void>
  eliminar: (f: FormData) => void | Promise<void>
}) {
  const [editando, setEditando] = useState<string | null>(null)
  if (entradas.length === 0) return null

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-tierra">Avances:</span>
      {entradas.map((e) => {
        const clave = `${e.loteId}:${e.index}`
        if (editando === clave) {
          return (
            <form key={clave} action={editar} onSubmit={() => setEditando(null)} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={actividadId} />
              <input type="hidden" name="loteId" value={e.loteId} />
              <input type="hidden" name="index" value={e.index} />
              <label className="flex flex-col text-xs">
                Día
                <select name="dia" defaultValue={e.dia} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{diaLabels[d]}</option>))}
                </select>
              </label>
              <label className="flex flex-col text-xs">
                Cantidad
                <input name="cantidad" type="number" step="any" min="0" defaultValue={e.cantidad} className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
              </label>
              <label className="flex flex-1 flex-col text-xs">
                Observación
                <input name="observacion" defaultValue={e.observacion} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
              </label>
              <button className="rounded-lg bg-bosque px-3 py-1 text-xs font-semibold text-white">Guardar</button>
              <button type="button" onClick={() => setEditando(null)} className="text-xs text-tierra underline">cancelar</button>
            </form>
          )
        }
        return (
          <div key={clave} className="flex flex-wrap items-center gap-2">
            <span>{etiquetaPorDia[e.dia]} · {e.loteNombre} — {e.cantidad} {unidad}{e.observacion ? ` · ${e.observacion}` : ''}</span>
            <button type="button" onClick={() => setEditando(clave)} className="text-xs text-tierra hover:text-tinta" title="editar">✏️</button>
            <form action={eliminar} className="inline">
              <input type="hidden" name="id" value={actividadId} />
              <input type="hidden" name="loteId" value={e.loteId} />
              <input type="hidden" name="index" value={e.index} />
              <button className="text-xs text-tierra hover:text-rose-700" title="borrar">×</button>
            </form>
          </div>
        )
      })}
    </div>
  )
}

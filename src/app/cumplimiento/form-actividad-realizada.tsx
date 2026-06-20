'use client'

import { SelectFincaLote } from '../_componentes/select-finca-lote'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Lote = { id: string; nombre: string; finca: { nombre: string } }

export function FormActividadRealizada({
  areaId,
  anio,
  semana,
  esMaquinaria,
  responsables,
  lotes,
  maquinas,
  accion,
}: {
  areaId: string
  anio: number
  semana: number
  esMaquinaria: boolean
  responsables: { id: string; nombre: string }[]
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  return (
    <form action={accion} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <span className="w-full text-sm font-semibold text-blue-900">➕ Agregar actividad realizada (no programada)</span>
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
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
        <select name="dia" required defaultValue="" className="rounded border p-1 text-sm">
          <option value="" disabled>—</option>
          {DIAS.map((d, i) => (
            <option key={d} value={i + 1}>{d}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col text-xs">
        Descripción
        <input name="descripcion" required placeholder="¿Qué se hizo?" className="rounded border p-1 text-sm" />
      </label>
      <label className="flex flex-col text-xs">
        Finca y lote
        <SelectFincaLote lotes={lotes} name="loteId" />
      </label>
      {esMaquinaria && (
        <label className="flex flex-col text-xs">
          Máquina
          <select name="maquinaId" className="rounded border p-1 text-sm">
            <option value="">— sin máquina —</option>
            {maquinas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </label>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Agregar</button>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { SelectFincaLote } from '../_componentes/select-finca-lote'
import { etiquetaMedida, normalizarUnidad, type Unidad } from '@/dominio/unidad'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

export function FormActividadRealizada({
  areaId,
  anio,
  semana,
  esMaquinaria,
  responsables,
  lotes,
  maquinas,
  estipuladas,
  accion,
}: {
  areaId: string
  anio: number
  semana: number
  esMaquinaria: boolean
  responsables: { id: string; nombre: string }[]
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  // Para maquinaria, la descripción se elige del catálogo (o "Otra").
  const [desc, setDesc] = useState('')
  const unidadPorNombre = new Map(estipuladas.map((e) => [e.nombre, normalizarUnidad(e.unidad)]))
  const esOtra = desc === '__otra__'
  const unidadSel: Unidad = esOtra || desc === '' ? 'ha' : unidadPorNombre.get(desc) ?? 'ha'

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
      {esMaquinaria ? (
        <>
          <label className="flex flex-1 flex-col text-xs">
            Actividad
            <select
              name="descripcion"
              required
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="rounded border p-1 text-sm"
            >
              <option value="" disabled>— elige —</option>
              {estipuladas.map((e) => (
                <option key={e.id} value={e.nombre}>{e.nombre}</option>
              ))}
              <option value="__otra__">Otra…</option>
            </select>
          </label>
          {esOtra && (
            <label className="flex flex-1 flex-col text-xs">
              Otra (texto libre)
              <input name="descripcionOtra" required placeholder="¿Qué se hizo?" className="rounded border p-1 text-sm" />
            </label>
          )}
        </>
      ) : (
        <label className="flex flex-1 flex-col text-xs">
          Descripción
          <input name="descripcion" required placeholder="¿Qué se hizo?" className="rounded border p-1 text-sm" />
        </label>
      )}
      <label className="flex flex-col text-xs">
        Finca y lote
        <SelectFincaLote lotes={lotes} name="loteId" />
      </label>
      {esMaquinaria && (
        <>
          <label className="flex flex-col text-xs">
            Máquina
            <select name="maquinaId" className="rounded border p-1 text-sm">
              <option value="">— sin máquina —</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            {etiquetaMedida(unidadSel)} (opcional)
            <input name="medida" type="number" step="0.1" min="0" className="w-28 rounded border p-1 text-sm" />
          </label>
        </>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Agregar</button>
    </form>
  )
}

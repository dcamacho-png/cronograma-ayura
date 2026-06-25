'use client'

import { useState } from 'react'
import { SelectFincaLote } from '../_componentes/select-finca-lote'
import { etiquetaMedida, normalizarUnidad, type Unidad } from '@/dominio/unidad'
import { CENTROS_COSTO } from '@/dominio/centro-costo'

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
  const [centroCosto, setCentroCosto] = useState('')
  const unidadPorNombre = new Map(estipuladas.map((e) => [e.nombre, normalizarUnidad(e.unidad)]))
  const esOtra = desc === '__otra__'
  const unidadSel: Unidad = esOtra || desc === '' ? 'ha' : unidadPorNombre.get(desc) ?? 'ha'

  return (
    <form action={accion} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-borde bg-arena p-3">
      <span className="w-full text-sm font-semibold text-bosque">➕ Agregar actividad realizada (no programada)</span>
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <label className="flex flex-col text-xs">
        Responsable
        <select name="responsableId" required className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs">
        Día
        <select name="dia" required defaultValue="" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
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
              className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
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
              <input name="descripcionOtra" required placeholder="¿Qué se hizo?" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
        </>
      ) : (
        <label className="flex flex-1 flex-col text-xs">
          Descripción
          <input name="descripcion" required placeholder="¿Qué se hizo?" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
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
            <select name="maquinaId" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— sin máquina —</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            {etiquetaMedida(unidadSel)} (opcional)
            <input name="medida" type="number" step="any" min="0" className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
          <label className="flex flex-col text-xs">
            Centro de costo
            <select
              name="centroCosto"
              value={centroCosto}
              onChange={(e) => setCentroCosto(e.target.value)}
              className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
            >
              <option value="">— sin centro —</option>
              {CENTROS_COSTO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__otra__">Otras…</option>
            </select>
          </label>
          {centroCosto === '__otra__' && (
            <label className="flex flex-col text-xs">
              Otras (texto libre)
              <input name="centroCostoOtra" className="w-40 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
        </>
      )}
      <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">Agregar</button>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { SelectFincaLote } from '../_componentes/select-finca-lote'
import { PickerLotesBultos } from './picker-lotes-bultos'
import { usaBultos } from '@/dominio/bultos'
import { CasillasDias, CasillasColaboradores } from './campos-sugerencia'

type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string }
type Area = { id: string; nombre: string; maqTareas: boolean }

export function FormSolicitar({
  solicitanteAreaId,
  areas,
  estipuladas,
  lotes,
  accion,
  responsablesPorArea,
}: {
  solicitanteAreaId: string
  areas: Area[]
  estipuladas: Estipulada[]
  lotes: Lote[]
  accion: (formData: FormData) => void | Promise<void>
  responsablesPorArea: Record<string, { id: string; nombre: string }[]>
}) {
  const [areaEjecutoraId, setAreaEjecutoraId] = useState('')
  const [estipulada, setEstipulada] = useState('')
  const esMaquinaria = areas.find((a) => a.id === areaEjecutoraId)?.maqTareas ?? false
  const conBultos = usaBultos(estipulada)
  const responsablesB = responsablesPorArea[areaEjecutoraId] ?? []

  return (
    <form action={accion} className="flex flex-col gap-2 rounded-xl border border-borde bg-arena p-4">
      <h2 className="font-semibold text-arcilla">📨 Solicitar a otra área</h2>
      <input type="hidden" name="solicitanteAreaId" value={solicitanteAreaId} />
      <label className="flex flex-col text-sm">
        Área que la ejecuta
        <select
          name="areaEjecutoraId"
          required
          value={areaEjecutoraId}
          onChange={(e) => setAreaEjecutoraId(e.target.value)}
          className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
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
            <select name="estipulada" value={estipulada} onChange={(e) => setEstipulada(e.target.value)} className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— elegir —</option>
              {estipuladas.map((e) => (
                <option key={e.id} value={e.nombre}>{e.nombre}</option>
              ))}
              <option value="__otra__">Otra…</option>
            </select>
          </label>
          {estipulada === '__otra__' && (
            <label className="flex flex-col text-sm">
              Otra (escribe la actividad)
              <input name="otra" placeholder="¿Qué actividad?" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
          <label className="flex flex-col text-sm">
            {conBultos ? 'Lotes y bultos por lote' : 'Finca y lote'}
            {conBultos ? (
              <PickerLotesBultos lotes={lotes} />
            ) : (
              <SelectFincaLote lotes={lotes} name="loteId" />
            )}
          </label>
          <label className="flex flex-col text-sm">
            Detalle / instrucciones (opcional)
            <textarea name="detalle" rows={2} placeholder="Ej: aplicar urea, 2 bultos/ha" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span>Día sugerido (opcional)</span>
            <CasillasDias />
          </div>
        </>
      ) : (
        <>
          <label className="flex flex-col text-sm">
            Actividad
            <input name="descripcion" placeholder="Ej: pasar renovador en lote X" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
          <label className="flex flex-col text-sm">
            Descripción (opcional)
            <textarea name="detalle" rows={2} placeholder="Detalles / instrucciones" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span>Día sugerido (opcional)</span>
            <CasillasDias />
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span>Colaboradores sugeridos (opcional)</span>
            <CasillasColaboradores key={areaEjecutoraId} responsables={responsablesB} />
          </div>
        </>
      )}
      <button className="self-start rounded-lg bg-arcilla px-4 py-2 text-sm font-semibold text-white">📨 Solicitar</button>
    </form>
  )
}

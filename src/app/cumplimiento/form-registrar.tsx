'use client'

import { useState } from 'react'
import { SelectFincaLote } from '../_componentes/select-finca-lote'
import { etiquetaMedida, normalizarUnidad, type Unidad } from '@/dominio/unidad'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

export function FormRegistrar({
  actividadId,
  esMaquinaria,
  unidad,
  motivos,
  motivoCambioId,
  lotes,
  maquinas,
  estipuladas,
  haProgramada,
  accion,
}: {
  actividadId: string
  esMaquinaria: boolean
  unidad: Unidad
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  haProgramada: number
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [estado, setEstado] = useState('')
  const [motivoId, setMotivoId] = useState('')
  const [reemplazoDesc, setReemplazoDesc] = useState('')
  const requiereMotivo = estado !== '' && estado !== 'CUMPLIDA'
  const esCambio = estado !== '' && estado !== 'CUMPLIDA' && motivoId !== '' && motivoId === motivoCambioId

  // Unidad de la actividad de reemplazo elegida ("Otra"/vacío ⇒ ha).
  const unidadPorNombre = new Map(estipuladas.map((e) => [e.nombre, normalizarUnidad(e.unidad)]))
  const reemplazoOtra = reemplazoDesc === '__otra__'
  const reemplazoUnidad: Unidad = reemplazoOtra || reemplazoDesc === '' ? 'ha' : unidadPorNombre.get(reemplazoDesc) ?? 'ha'

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
        <select
          name="motivoId"
          required={requiereMotivo}
          value={motivoId}
          onChange={(e) => setMotivoId(e.target.value)}
          className="rounded border p-1 text-sm"
        >
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
          {etiquetaMedida(unidad)} (opcional)
          <input
            name="haRealizada"
            type="number"
            step="0.1"
            min="0"
            defaultValue={haProgramada}
            className="w-28 rounded border p-1 text-sm"
          />
        </label>
      )}
      {esCambio && (
        <div className="flex w-full flex-wrap items-end gap-2 rounded border border-amber-200 bg-amber-50 p-2">
          <span className="w-full text-xs font-semibold text-amber-800">Actividad que se hizo en su lugar</span>
          {esMaquinaria ? (
            <>
              <label className="flex flex-1 flex-col text-xs">
                Actividad *
                <select
                  name="reemplazoDescripcion"
                  required
                  value={reemplazoDesc}
                  onChange={(e) => setReemplazoDesc(e.target.value)}
                  className="rounded border p-1 text-sm"
                >
                  <option value="" disabled>— elige —</option>
                  {estipuladas.map((e) => (
                    <option key={e.id} value={e.nombre}>{e.nombre}</option>
                  ))}
                  <option value="__otra__">Otra…</option>
                </select>
              </label>
              {reemplazoOtra && (
                <label className="flex flex-1 flex-col text-xs">
                  Otra (texto libre) *
                  <input name="reemplazoDescripcionOtra" required className="rounded border p-1 text-sm" />
                </label>
              )}
            </>
          ) : (
            <label className="flex flex-1 flex-col text-xs">
              Descripción *
              <input name="reemplazoDescripcion" required className="rounded border p-1 text-sm" />
            </label>
          )}
          <label className="flex flex-col text-xs">
            Finca y lote
            <SelectFincaLote lotes={lotes} name="reemplazoLoteId" />
          </label>
          {esMaquinaria && (
            <>
              <label className="flex flex-col text-xs">
                Máquina
                <select name="reemplazoMaquinaId" className="rounded border p-1 text-sm">
                  <option value="">— sin máquina —</option>
                  {maquinas.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-xs">
                {etiquetaMedida(reemplazoUnidad)} (opcional)
                <input name="reemplazoMedida" type="number" step="0.1" min="0" className="w-28 rounded border p-1 text-sm" />
              </label>
            </>
          )}
        </div>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Registrar</button>
    </form>
  )
}

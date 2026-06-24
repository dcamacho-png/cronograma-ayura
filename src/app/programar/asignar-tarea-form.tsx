'use client'

import { useState } from 'react'
import { turnoPorDia } from '@/dominio/turno'
import { turnoEfectivo } from '@/dominio/programacion'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function AsignarTareaForm({
  tareaId,
  descripcion,
  lotesTarea,
  bultosPorLote,
  responsables,
  esMaquinaria,
  maquinas,
  ocupacion,
  diasPasados = [],
  areaId,
  anio,
  semana,
  accion,
}: {
  tareaId: string
  descripcion: string
  lotesTarea: { id: string; nombre: string }[]
  bultosPorLote?: Record<string, number> | null
  responsables: { id: string; nombre: string }[]
  esMaquinaria: boolean
  maquinas: { id: string; nombre: string }[]
  ocupacion: { dia: number; turno: string; maquinaId: string | null; responsableId: string }[]
  diasPasados?: number[]
  areaId: string
  anio: number
  semana: number
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [turno, setTurno] = useState(esMaquinaria ? turnoPorDia(1) : '')
  const [dias, setDias] = useState<number[]>([])
  const [responsableIds, setResponsableIds] = useState<string[]>(responsables[0] ? [responsables[0].id] : [])
  const [respAbierto, setRespAbierto] = useState(false)
  const toggleResp = (id: string) =>
    setResponsableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const nombresSel = responsables.filter((r) => responsableIds.includes(r.id)).map((r) => r.nombre)

  const toggleDia = (d: number) => {
    if (diasPasados.includes(d)) return
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }

  const conflictosResp = responsableIds.flatMap((rid) =>
    [...dias]
      .sort((a, b) => a - b)
      .filter((d) =>
        ocupacion.some(
          (o) => o.dia === d && o.turno === turnoEfectivo(turno, d) && o.responsableId === rid,
        ),
      )
      .map((d) => ({ rid, dia: d })),
  )

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tareaId" value={tareaId} />
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <input type="hidden" name="esMaquinaria" value={esMaquinaria ? '1' : ''} />
      <span className="min-w-[160px] flex-1 font-medium">{descripcion}</span>
      <div className="relative flex flex-col text-xs">
        Responsables
        <button
          type="button"
          onClick={() => setRespAbierto((v) => !v)}
          className="flex w-48 items-center justify-between rounded border p-1 text-sm"
        >
          <span className="truncate">{nombresSel.length > 0 ? nombresSel.join(', ') : '— elegir —'}</span>
          <span className="ml-1 text-gray-500">▾</span>
        </button>
        <div
          className={`absolute top-full left-0 z-10 mt-1 max-h-52 w-56 flex-col gap-1 overflow-auto rounded border bg-white p-2 shadow-lg ${respAbierto ? 'flex' : 'hidden'}`}
        >
          {responsables.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name="responsableId"
                value={r.id}
                checked={responsableIds.includes(r.id)}
                onChange={() => toggleResp(r.id)}
                className="accent-bosque"
              />
              {r.nombre}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col text-xs">
        Días
        <div className="flex gap-1">
          {DIAS.map((d, i) => {
            const pasado = diasPasados.includes(i + 1)
            return (
              <label
                key={d}
                title={pasado ? 'Día ya pasado de esta semana' : undefined}
                className={`flex flex-col items-center rounded border px-1.5 py-0.5 has-[:checked]:border-bosque has-[:checked]:bg-green-50 ${
                  pasado ? 'cursor-not-allowed bg-gray-100 text-gray-300' : 'cursor-pointer'
                }`}
              >
                <span>{d}</span>
                <input
                  type="checkbox"
                  name="dia"
                  value={i + 1}
                  checked={dias.includes(i + 1)}
                  disabled={pasado}
                  onChange={() => toggleDia(i + 1)}
                  className="accent-bosque"
                />
              </label>
            )
          })}
        </div>
      </div>
      {esMaquinaria && (
        <label className="flex flex-col text-xs">
          Turno
          <input
            name="turno"
            value={turno}
            onChange={(e) => setTurno(e.target.value)}
            className="w-28 rounded border p-1 text-sm"
          />
        </label>
      )}
      {esMaquinaria && dias.length > 0 && (
        <div className="flex w-full flex-col gap-1 text-xs">
          <span className="text-gray-500">Máquina por día (solo disponibles · opcional)</span>
          {[...dias].sort((a, b) => a - b).map((d) => {
            const turnoEf = turnoEfectivo(turno, d)
            const ocupadas = new Set(
              ocupacion
                .filter((o) => o.dia === d && o.turno === turnoEf)
                .map((o) => o.maquinaId),
            )
            const disponibles = maquinas.filter((m) => !ocupadas.has(m.id))
            return (
              <label key={d} className="flex items-center gap-1">
                <span className="w-8">{DIAS[d - 1]}</span>
                <select name={`maquina_${d}`} className="rounded border p-1 text-sm">
                  <option value="">— sin máquina —</option>
                  {disponibles.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
                {disponibles.length === 0 && (
                  <span className="text-amber-600">sin máquinas libres este turno</span>
                )}
              </label>
            )
          })}
        </div>
      )}
      {conflictosResp.length > 0 && (
        <p className="w-full text-xs font-medium text-red-700">
          ⚠️ Conflicto de turno: {conflictosResp.map((c) => `${responsables.find((r) => r.id === c.rid)?.nombre ?? ''} (${DIAS[c.dia - 1]})`).join(', ')}
        </p>
      )}
      <span className="text-xs text-gray-600">
        {lotesTarea.length > 0
          ? `Lote(s): ${lotesTarea
              .map((l) => {
                const bb = bultosPorLote?.[l.id]
                return typeof bb === 'number' ? `${l.nombre} (${bb} bultos)` : l.nombre
              })
              .join(', ')}`
          : 'Sin lote'}
      </span>
      <button
        disabled={responsableIds.length === 0 || conflictosResp.length > 0}
        className="rounded bg-bosque px-3 py-1 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        Asignar →
      </button>
    </form>
  )
}

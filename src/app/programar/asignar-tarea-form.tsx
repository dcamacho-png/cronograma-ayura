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
  const [responsableIds, setResponsableIds] = useState<string[]>(responsables[0] ? [responsables[0].id] : [])
  const [respAbierto, setRespAbierto] = useState(false)
  const [porResp, setPorResp] = useState<Record<string, { dias: number[]; turno: string }>>(
    responsables[0] ? { [responsables[0].id]: { dias: [], turno: esMaquinaria ? turnoPorDia(1) : '' } } : {},
  )

  const toggleResp = (id: string) => {
    setResponsableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setPorResp((prev) => {
      if (prev[id]) {
        const { [id]: _quitado, ...resto } = prev
        return resto
      }
      return { ...prev, [id]: { dias: [], turno: esMaquinaria ? turnoPorDia(1) : '' } }
    })
  }
  const setDiasResp = (id: string, dias: number[]) =>
    setPorResp((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { dias: [], turno: '' }), dias } }))
  const setTurnoResp = (id: string, turno: string) =>
    setPorResp((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { dias: [], turno: '' }), turno } }))
  const toggleDiaResp = (id: string, d: number) => {
    if (diasPasados.includes(d)) return
    const cur = porResp[id]?.dias ?? []
    setDiasResp(id, cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d])
  }

  const nombresSel = responsables.filter((r) => responsableIds.includes(r.id)).map((r) => r.nombre)
  const totalDias = responsableIds.reduce((s, rid) => s + (porResp[rid]?.dias.length ?? 0), 0)

  // Conflicto en vivo por responsable: responsable ya ocupado en día+turno (contra la BD).
  const conflictosResp = responsableIds.flatMap((rid) => {
    const info = porResp[rid]
    if (!info) return [] as { rid: string; dia: number }[]
    return [...info.dias]
      .sort((a, b) => a - b)
      .filter((d) => ocupacion.some((o) => o.dia === d && o.turno === turnoEfectivo(info.turno, d) && o.responsableId === rid))
      .map((d) => ({ rid, dia: d }))
  })

  const seleccionados = responsables.filter((r) => responsableIds.includes(r.id))

  return (
    <form action={accion} className="flex w-full flex-col gap-2">
      <input type="hidden" name="tareaId" value={tareaId} />
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <input type="hidden" name="esMaquinaria" value={esMaquinaria ? '1' : ''} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[160px] flex-1 font-medium">{descripcion}</span>
        <div className="relative flex flex-col text-xs">
          Responsables
          <button
            type="button"
            onClick={() => setRespAbierto((v) => !v)}
            className="flex w-48 items-center justify-between rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
          >
            <span className="truncate">{nombresSel.length > 0 ? nombresSel.join(', ') : '— elegir —'}</span>
            <span className="ml-1 text-tierra">▾</span>
          </button>
          <div
            className={`absolute top-full left-0 z-10 mt-1 max-h-52 w-56 flex-col gap-1 overflow-auto rounded-lg border border-borde bg-white p-2 shadow-lg ${respAbierto ? 'flex' : 'hidden'}`}
          >
            {responsables.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:bg-arena/40">
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
        <span className="text-xs text-tierra">
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
          disabled={totalDias === 0 || conflictosResp.length > 0}
          className="ml-auto rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-arena disabled:text-tierra"
        >
          Asignar →
        </button>
      </div>

      {seleccionados.map((r) => {
        const info = porResp[r.id] ?? { dias: [], turno: '' }
        return (
          <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-borde bg-arena/30 p-2">
            <input type="hidden" name={`respNombre_${r.id}`} value={r.nombre} />
            <span className="text-xs font-semibold text-tinta">{r.nombre}</span>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col text-xs">
                Días
                <div className="flex gap-1">
                  {DIAS.map((d, i) => {
                    const dia = i + 1
                    const pasado = diasPasados.includes(dia)
                    return (
                      <label
                        key={d}
                        title={pasado ? 'Día ya pasado de esta semana' : undefined}
                        className={`flex flex-col items-center rounded-lg border border-borde px-1.5 py-0.5 has-[:checked]:border-bosque has-[:checked]:bg-green-50 ${
                          pasado ? 'cursor-not-allowed bg-arena text-tierra/50' : 'cursor-pointer'
                        }`}
                      >
                        <span>{d}</span>
                        <input
                          type="checkbox"
                          name={`dia_${r.id}`}
                          value={dia}
                          checked={info.dias.includes(dia)}
                          disabled={pasado}
                          onChange={() => toggleDiaResp(r.id, dia)}
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
                    name={`turno_${r.id}`}
                    value={info.turno}
                    onChange={(e) => setTurnoResp(r.id, e.target.value)}
                    className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
                  />
                </label>
              )}
            </div>
            {esMaquinaria && info.dias.length > 0 && (
              <div className="flex w-full flex-col gap-1 text-xs">
                <span className="text-tierra">Máquina por día (solo disponibles · opcional)</span>
                {[...info.dias].sort((a, b) => a - b).map((dia) => {
                  const turnoEf = turnoEfectivo(info.turno, dia)
                  const ocupadas = new Set(
                    ocupacion.filter((o) => o.dia === dia && o.turno === turnoEf).map((o) => o.maquinaId),
                  )
                  const disponibles = maquinas.filter((m) => !ocupadas.has(m.id))
                  return (
                    <label key={dia} className="flex items-center gap-1">
                      <span className="w-8">{DIAS[dia - 1]}</span>
                      <select name={`maquina_${r.id}_${dia}`} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                        <option value="">— sin máquina —</option>
                        {disponibles.map((m) => (
                          <option key={m.id} value={m.id}>{m.nombre}</option>
                        ))}
                      </select>
                      {disponibles.length === 0 && <span className="text-amber-600">sin máquinas libres este turno</span>}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {conflictosResp.length > 0 && (
        <p className="w-full text-xs font-medium text-red-700">
          ⚠️ Conflicto de turno: {conflictosResp.map((c) => `${responsables.find((r) => r.id === c.rid)?.nombre ?? ''} (${DIAS[c.dia - 1]})`).join(', ')}
        </p>
      )}
    </form>
  )
}

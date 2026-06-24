import { InfoLotes } from '../_componentes/info-lotes'
import { actualizarActividadAccion, devolverAAsignacionAccion } from './acciones'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

type ActividadGrilla = {
  id: string
  responsableId: string
  dia: number
  descripcion: string
  turno: string
  tareaId: string | null
  maquina: { nombre: string } | null
  lotes: { id: string; nombre: string; hectareas: number | null }[]
  bultosPorLote?: unknown
}

function fmtFecha(f: Date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)
}

export function GrillaSemana({
  areaNombre,
  anio,
  semana,
  fechas,
  responsables,
  actividades,
  turnoEditable = false,
  esMaquinaria,
}: {
  areaNombre: string
  anio: number
  semana: number
  fechas: Date[]
  responsables: { id: string; nombre: string }[]
  actividades: ActividadGrilla[]
  turnoEditable?: boolean
  esMaquinaria: boolean
}) {
  const rango = fechas.length === 7 ? `${fmtFecha(fechas[0])} – ${fmtFecha(fechas[6])}` : ''
  return (
    <div className="rounded-xl border bg-white text-gray-900">
      <div className="border-b p-3">
        <div className="text-lg font-bold text-bosque">{areaNombre}</div>
        <div className="text-sm text-gray-500">Semana {semana}{rango ? ` · ${rango}` : ''}</div>
      </div>
      {responsables.length === 0 ? (
        <p className="p-4 text-center text-sm italic text-gray-400">Sin actividades programadas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-gray-50 p-2 text-left">Responsable</th>
                {DIAS.map((d, i) => (
                  <th key={d} className="border bg-gray-50 p-2 text-left">
                    {d}
                    <div className="text-xs font-normal text-gray-400">{fechas[i] ? fmtFecha(fechas[i]) : ''}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {responsables.map((r) => (
                <tr key={r.id}>
                  <td className="border p-2 font-medium">{r.nombre}</td>
                  {DIAS.map((_, i) => {
                    const dia = i + 1
                    const celdas = actividades.filter((a) => a.responsableId === r.id && a.dia === dia)
                    return (
                      <td key={dia} className="border p-2 align-top">
                        {celdas.map((a) => (
                          <div key={a.id} className="mb-1 rounded bg-green-50 p-1">
                            <div>{a.descripcion}</div>
                            {esMaquinaria && (turnoEditable ? (
                              <form action={actualizarActividadAccion} className="mt-0.5 flex items-center gap-1">
                                <input type="hidden" name="id" value={a.id} />
                                <input type="hidden" name="descripcion" value={a.descripcion} />
                                <input type="hidden" name="anio" value={anio} />
                                <input type="hidden" name="semana" value={semana} />
                                <input aria-label="Turno" name="turno" defaultValue={a.turno} className="w-20 rounded border p-0.5 text-xs" />
                                <button type="submit" className="rounded bg-bosque px-1.5 text-xs font-semibold text-white">✓</button>
                              </form>
                            ) : (
                              a.turno && <div className="text-xs text-gray-500">{a.turno}</div>
                            ))}
                            {a.maquina && <div className="text-xs text-gray-500">🚜 {a.maquina.nombre}</div>}
                            <InfoLotes lotes={a.lotes} bultosPorLote={a.bultosPorLote as Record<string, number> | null} className="mt-1" />
                            {turnoEditable && a.tareaId && (
                              <form action={devolverAAsignacionAccion} className="mt-0.5">
                                <input type="hidden" name="tareaId" value={a.tareaId} />
                                <input type="hidden" name="anio" value={anio} />
                                <input type="hidden" name="semana" value={semana} />
                                <button type="submit" className="text-xs text-amber-700 hover:underline">↩️ Devolver a asignar</button>
                              </form>
                            )}
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { InfoLotes } from '../_componentes/info-lotes'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

type ActividadGrilla = {
  id: string
  responsableId: string
  dia: number
  descripcion: string
  turno: string
  maquina: { nombre: string } | null
  lotes: { nombre: string; hectareas: number | null }[]
}

function fmtFecha(f: Date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)
}

export function GrillaSemana({
  areaNombre,
  semana,
  fechas,
  responsables,
  actividades,
}: {
  areaNombre: string
  semana: number
  fechas: Date[]
  responsables: { id: string; nombre: string }[]
  actividades: ActividadGrilla[]
}) {
  const rango = fechas.length === 7 ? `${fmtFecha(fechas[0])} – ${fmtFecha(fechas[6])}` : ''
  return (
    <div className="rounded-xl border bg-white text-gray-900">
      <div className="border-b p-3">
        <div className="text-lg font-bold text-[#11603a]">{areaNombre}</div>
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
                            {a.turno && <div className="text-xs text-gray-500">{a.turno}</div>}
                            {a.maquina && <div className="text-xs text-gray-500">🚜 {a.maquina.nombre}</div>}
                            <InfoLotes lotes={a.lotes} className="mt-1" />
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

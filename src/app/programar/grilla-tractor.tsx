const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function fmtFecha(f: Date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)
}

type ActividadTractor = {
  id: string
  dia: number
  descripcion: string
  turno: string
  maquinaId: string | null
  maquina: { nombre: string } | null
  responsable: { nombre: string }
}

// Resumen de solo lectura: una fila por tractor usado esta semana, columnas Lun–Dom,
// con la(s) actividad(es) y el responsable de cada tractor por día. Inverso del cronograma.
export function GrillaTractor({
  fechas,
  actividades,
}: {
  fechas: Date[]
  actividades: ActividadTractor[]
}) {
  // Solo actividades con tractor; agrupar por maquinaId (mostrando el nombre).
  const tractores = new Map<string, { maquinaId: string; nombre: string; actividades: ActividadTractor[] }>()
  for (const a of actividades) {
    if (!a.maquinaId || !a.maquina) continue
    const g = tractores.get(a.maquinaId) ?? { maquinaId: a.maquinaId, nombre: a.maquina.nombre, actividades: [] }
    g.actividades.push(a)
    tractores.set(a.maquinaId, g)
  }
  if (tractores.size === 0) return null
  const filas = [...tractores.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-bosque">🚜 Resumen por tractor</h2>
      <div className="overflow-x-auto rounded-xl border border-borde bg-white text-tinta">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-borde bg-arena p-2 text-left">Tractor</th>
              {DIAS.map((d, i) => (
                <th key={d} className="border border-borde bg-arena p-2 text-left">
                  {d}
                  <div className="text-xs font-normal text-tierra">{fechas[i] ? fmtFecha(fechas[i]) : ''}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => (
              <tr key={t.maquinaId}>
                <td className="border border-borde p-2 font-medium">🚜 {t.nombre}</td>
                {DIAS.map((_, i) => {
                  const dia = i + 1
                  const celdas = t.actividades.filter((a) => a.dia === dia)
                  return (
                    <td key={dia} className="border border-borde p-2 align-top">
                      {celdas.map((a) => (
                        <div key={a.id} className="mb-1 rounded-lg bg-green-50 p-1">
                          <div>{a.descripcion}</div>
                          <div className="text-xs text-tierra">{a.responsable.nombre}</div>
                          {a.turno && <div className="text-xs text-tierra">{a.turno}</div>}
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
    </div>
  )
}

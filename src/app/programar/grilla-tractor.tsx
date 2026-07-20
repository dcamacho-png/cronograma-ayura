import { construirFilasTractor, type ActividadTractor } from '@/dominio/tractor'
import { SelectDedicacion } from './select-dedicacion'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function fmtFecha(f: Date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)
}

// Resumen por tractor: TODAS las máquinas del catálogo (una fila cada una), columnas Lun–Dom,
// con sus actividades por día. En semanas futuras, cada celda deja dedicar el tractor a un área
// ese día (solo informativo). Inverso del cronograma.
export function GrillaTractor({
  fechas,
  actividades,
  maquinas,
  dedicaciones,
  areasParaDedicar,
  programable,
  anio,
  semana,
  accion,
}: {
  fechas: Date[]
  actividades: ActividadTractor[]
  maquinas: { id: string; nombre: string }[]
  dedicaciones: { maquinaId: string; dia: number; areaId: string; areaNombre: string }[]
  areasParaDedicar: { id: string; nombre: string }[]
  programable: boolean
  anio: number
  semana: number
  accion: (form: FormData) => void
}) {
  const filas = construirFilasTractor(maquinas, actividades, dedicaciones)
  if (filas.length === 0) return null

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
                  const ded = t.dedicadasPorDia[dia]
                  const celdas = t.actividades.filter((a) => a.dia === dia)
                  return (
                    <td key={dia} className="border border-borde p-2 align-top">
                      {ded ? (
                        <div className="mb-1 rounded-lg bg-amber-50 p-1 text-xs font-medium text-amber-800">
                          🔒 {ded.areaNombre}
                        </div>
                      ) : (
                        celdas.map((a) => (
                          <div key={a.id} className="mb-1 rounded-lg bg-green-50 p-1">
                            <div>{a.descripcion}</div>
                            <div className="text-xs text-tierra">{a.responsable.nombre}</div>
                            {a.turno && <div className="text-xs text-tierra">{a.turno}</div>}
                          </div>
                        ))
                      )}
                      {programable && (
                        <SelectDedicacion
                          maquinaId={t.maquinaId}
                          anio={anio}
                          semana={semana}
                          dia={dia}
                          areaIdActual={ded?.areaId ?? ''}
                          areas={areasParaDedicar}
                          accion={accion}
                        />
                      )}
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

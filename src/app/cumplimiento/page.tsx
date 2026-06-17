import Link from 'next/link'
import { listarAreas, listarMotivos, listarActividades } from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual } from '@/dominio/semana'
import { porcentajeCumplimiento, porcentajeReprogramadas, colorSemaforo } from '@/dominio/metricas'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'
import { marcarEstadoAccion, reprogramarAccion } from './acciones'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADOS = [
  { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
  { valor: 'CUMPLIDA', etiqueta: '✅ Cumplida' },
  { valor: 'PARCIAL', etiqueta: '🟡 Parcial' },
  { valor: 'NO_CUMPLIDA', etiqueta: '🔴 No cumplida' },
  { valor: 'REPROGRAMADA', etiqueta: '🔄 Reprogramada' },
]

const COLOR_HEX: Record<string, string> = {
  ninguno: 'transparent',
  verde: '#2e9e5b',
  amarillo: '#e8b400',
  naranja: '#e8771a',
  rojo: '#d63b3b',
}

export default async function CumplimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; anio?: string; semana?: string }>
}) {
  const sp = await searchParams
  const areas = await listarAreas()
  if (areas.length === 0) {
    return (
      <main className="p-8">
        <p className="text-gray-600">No hay áreas. Corre <code>npm run db:seed</code>.</p>
      </main>
    )
  }

  const areaId = sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana

  const [motivos, actividades] = await Promise.all([
    listarMotivos(),
    listarActividades(areaId, anio, semana),
  ])

  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const pctRep = porcentajeReprogramadas(dominio)

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/cumplimiento?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Registrar cumplimiento</h1>

      <div className="mb-3 flex flex-wrap gap-2">
        {areas.map((a) => (
          <Link
            key={a.id}
            href={url(a.id, anio, semana)}
            className={`rounded-full px-3 py-1 text-sm ${
              a.id === areaId ? 'bg-[#11603a] text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {a.nombre}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">
          ← Semana {previa.semana}
        </Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">
          Semana {proxima.semana} →
        </Link>
        <span className="ml-auto rounded bg-gray-100 px-3 py-1 text-sm">
          Cumplido: <b>{pct === null ? '—' : `${pct}%`}</b>
        </span>
        <span className="rounded bg-gray-100 px-3 py-1 text-sm">
          Reprogramadas: <b>{pctRep}%</b>
        </span>
      </div>

      {actividades.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay actividades en esta semana. Prográmalas en la pestaña <b>Programar</b>.
        </p>
      ) : (
        <ul className="space-y-3">
          {actividades.map((a) => (
            <li key={a.id} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="font-semibold">{DIAS[a.dia] ?? ''}</span>
                <span>·</span>
                <span>{a.responsable.nombre}</span>
                {a.vecesReprogramada > 0 && (
                  <span
                    className="ml-auto rounded px-2 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: COLOR_HEX[colorSemaforo(a.vecesReprogramada)] }}
                  >
                    reprogramada {a.vecesReprogramada}×
                  </span>
                )}
              </div>
              <div className="mb-2 font-medium">{a.descripcion}</div>

              <form action={marcarEstadoAccion} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={a.id} />
                <label className="flex flex-col text-xs">
                  Estado
                  <select name="estado" defaultValue={a.estado} className="rounded border p-1 text-sm">
                    {ESTADOS.map((e) => (
                      <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-xs">
                  Motivo
                  <select name="motivoId" defaultValue={a.motivoId ?? ''} className="rounded border p-1 text-sm">
                    <option value="">—</option>
                    {motivos.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 flex-col text-xs">
                  Nota
                  <input name="nota" defaultValue={a.nota ?? ''} className="rounded border p-1 text-sm" />
                </label>
                <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">
                  Guardar
                </button>
              </form>

              <form action={reprogramarAccion} className="mt-2">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="anio" value={anio} />
                <input type="hidden" name="semana" value={semana} />
                <button className="text-sm text-blue-700 hover:underline">
                  🔄 Reprogramar a la semana {proxima.semana}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

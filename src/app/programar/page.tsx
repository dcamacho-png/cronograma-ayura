import Link from 'next/link'
import {
  listarAreas,
  listarMaquinas,
  listarResponsablesPorArea,
  listarActividades,
  tareasPorAsignar,
  listarLotes,
} from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana, esSemanaPasada } from '@/dominio/semana'
import { crearActividadAccion, eliminarActividadAccion, duplicarSemanaAccion, crearResponsableAccion, asignarTareaAccion } from './acciones'
import { SelectLote } from '../_componentes/select-lote'
import { InfoLotes } from '../_componentes/info-lotes'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default async function ProgramarPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; anio?: string; semana?: string }>
}) {
  const sp = await searchParams
  const areas = await listarAreas()
  if (areas.length === 0) {
    return (
      <main className="p-8">
        <p className="text-gray-600">No hay áreas. Corre <code>npm run db:seed</code> para sembrar los catálogos.</p>
      </main>
    )
  }

  const areaId = sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id
  const areaActual = areas.find((a) => a.id === areaId)!
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana
  const pasada = esSemanaPasada(anio, semana, hoy)

  const [responsables, maquinas, actividades, porAsignar, lotes] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarMaquinas(),
    listarActividades(areaId, anio, semana),
    tareasPorAsignar(areaId, anio, semana),
    listarLotes(),
  ])

  const fechas = fechasDeSemana(anio, semana)
  const fmtFecha = (f: Date) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/programar?area=${a}&anio=${an}&semana=${se}`
  const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Programar semana</h1>

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

      <div className="mb-5 flex items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">
          ← Semana {previa.semana}
        </Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">
          Semana {proxima.semana} →
        </Link>
        {!pasada && (
          <form action={duplicarSemanaAccion} className="ml-auto">
            <input type="hidden" name="areaId" value={areaId} />
            <input type="hidden" name="anio" value={anio} />
            <input type="hidden" name="semana" value={semana} />
            <button className="rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200">
              ⧉ Duplicar semana anterior
            </button>
          </form>
        )}
      </div>

      {pasada && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          🔒 Semana cerrada — solo lectura. No se puede modificar la programación de una semana pasada.
        </div>
      )}

      {!pasada && (
        <form action={crearResponsableAccion} className="mb-5 flex flex-wrap items-end gap-2">
          <input type="hidden" name="areaId" value={areaId} />
          <label className="flex flex-col text-xs">
            Agregar responsable a {areaActual.nombre}
            <input name="nombre" required className="rounded border p-2 text-sm" placeholder="Nombre del responsable" />
          </label>
          <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">
            + Responsable
          </button>
        </form>
      )}

      {!pasada && porAsignar.length > 0 && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-3 font-semibold text-blue-900">📌 Tareas por asignar — semana {semana}</h2>
          {responsables.length === 0 ? (
            <p className="text-sm text-blue-900">Primero agrega responsables a esta área para poder asignar.</p>
          ) : (
            <ul className="space-y-2">
              {porAsignar.map((t) => (
                <li key={t.id}>
                  <form action={asignarTareaAccion} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="tareaId" value={t.id} />
                    <span className="min-w-[160px] flex-1 font-medium">{t.descripcion}</span>
                    <select name="responsableId" required className="rounded border p-1 text-sm">
                      {responsables.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                    <select name="dia" required className="rounded border p-1 text-sm">
                      {DIAS.map((d, i) => (
                        <option key={d} value={i + 1}>{d}</option>
                      ))}
                    </select>
                    {t.lotes.length > 0 ? (
                      <span className="text-xs text-gray-600">Lote(s): {t.lotes.map((l) => l.nombre).join(', ')}</span>
                    ) : (
                      <SelectLote lotes={lotes} name="loteId" required />
                    )}
                    <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Asignar →</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {responsables.length === 0 ? (
        <p className="mb-6 text-sm text-gray-500">Esta área no tiene responsables. Las actividades se listan abajo.</p>
      ) : (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-gray-50 p-2 text-left">Responsable</th>
                {DIAS.map((d, i) => (
                  <th key={d} className="border bg-gray-50 p-2 text-left">
                    {d}
                    <div className="text-xs font-normal text-gray-400">{fmtFecha(fechas[i])}</div>
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
                            <InfoLotes lotes={a.lotes} className="mt-1" />
                            {!pasada && (
                              <form action={eliminarActividadAccion} className="mt-1 inline">
                                <input type="hidden" name="id" value={a.id} />
                                <button className="text-xs text-red-600 hover:underline">eliminar</button>
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

      {!pasada && (
        <>
          <h2 className="mb-2 text-lg font-semibold">Agregar actividad</h2>
          {responsables.length === 0 ? (
            <p className="text-sm text-gray-500">
              Para agregar actividades, esta área primero necesita responsables.
            </p>
          ) : (
          <form action={crearActividadAccion} className="grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3">
            <input type="hidden" name="areaId" value={areaId} />
            <input type="hidden" name="anio" value={anio} />
            <input type="hidden" name="semana" value={semana} />

            <label className="flex flex-col text-sm">
              Responsable
              <select name="responsableId" required className="rounded border p-2">
                {responsables.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-sm">
              Día
              <select name="dia" required className="rounded border p-2">
                {DIAS.map((d, i) => (
                  <option key={d} value={i + 1}>{d}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-sm">
              Lote
              <SelectLote lotes={lotes} name="loteId" required />
            </label>

            <label className="col-span-2 flex flex-col text-sm md:col-span-2">
              Actividad
              <input name="descripcion" required className="rounded border p-2" placeholder="Ej: Siembra de pasto" />
            </label>

            <label className="flex flex-col text-sm">
              Turno
              <input name="turno" className="rounded border p-2" placeholder="7am-4pm" />
            </label>

            {esMaquinaria && (
              <>
                <label className="flex flex-col text-sm">
                  Máquina
                  <select name="maquinaId" className="rounded border p-2">
                    <option value="">—</option>
                    {maquinas.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}{m.operario ? ` (${m.operario})` : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-sm">
                  Área de la tarea
                  <select name="areaTareaId" className="rounded border p-2">
                    <option value="">—</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-sm">
                  Horas (H.R)
                  <input name="horas" type="number" step="0.1" className="rounded border p-2" />
                </label>
                <label className="flex flex-col text-sm">
                  Hectáreas (ha)
                  <input name="hectareas" type="number" step="0.1" className="rounded border p-2" />
                </label>
                <label className="flex flex-col text-sm">
                  Plan B
                  <input name="planB" className="rounded border p-2" />
                </label>
              </>
            )}

            <div className="col-span-2 md:col-span-3">
              <button className="rounded bg-[#11603a] px-4 py-2 text-sm font-semibold text-white">
                + Agregar
              </button>
            </div>
          </form>
          )}
        </>
      )}
    </main>
  )
}

import Link from 'next/link'
import {
  listarAreas,
  listarFincas,
  listarMaquinas,
  listarResponsablesPorArea,
  listarActividades,
} from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual } from '@/dominio/semana'
import { crearActividadAccion, eliminarActividadAccion, duplicarSemanaAccion } from './acciones'

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
  const anio = sp.anio ? Number(sp.anio) : hoy.anio
  const semana = sp.semana ? Number(sp.semana) : hoy.semana

  const [responsables, fincas, maquinas, actividades] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarFincas(),
    listarMaquinas(),
    listarActividades(areaId, anio, semana),
  ])

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
        <form action={duplicarSemanaAccion} className="ml-auto">
          <input type="hidden" name="areaId" value={areaId} />
          <input type="hidden" name="anio" value={anio} />
          <input type="hidden" name="semana" value={semana} />
          <button className="rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200">
            ⧉ Duplicar semana anterior
          </button>
        </form>
      </div>

      {responsables.length === 0 ? (
        <p className="mb-6 text-sm text-gray-500">Esta área no tiene responsables. Las actividades se listan abajo.</p>
      ) : (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-gray-50 p-2 text-left">Responsable</th>
                {DIAS.map((d) => (
                  <th key={d} className="border bg-gray-50 p-2 text-left">{d}</th>
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
                            <form action={eliminarActividadAccion} className="inline">
                              <input type="hidden" name="id" value={a.id} />
                              <button className="text-xs text-red-600 hover:underline">eliminar</button>
                            </form>
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

      <h2 className="mb-2 text-lg font-semibold">Agregar actividad</h2>
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
          Finca
          <select name="fincaId" required className="rounded border p-2">
            {fincas.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </select>
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
    </main>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  listarAreas,
  listarTareasPendientes,
  listarActividadesEstipuladas,
  listarLotes,
  listarSolicitudesDeArea,
} from '@/datos/repositorio'
import { semanaActual, siguienteSemana } from '@/dominio/semana'
import { usuarioActual } from '@/auth/sesion'
import { InfoLotes } from '../_componentes/info-lotes'
import { SelectLote } from '../_componentes/select-lote'
import { FormNuevaTareaMaquinaria } from './form-nueva-tarea-maquinaria'
import { FormSolicitar } from './form-solicitar'
import { crearTareaAccion, eliminarTareaAccion, programarTareaAccion, crearSolicitudAccion } from './acciones'

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>
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
  const u = await usuarioActual()
  if (!u) redirect('/login')
  const esAdmin = u.rol === 'ADMIN'
  const areaId = esAdmin
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
  const areaActual = areas.find((a) => a.id === areaId)!
  const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')
  const maquinariaArea = areas.find((a) => a.nombre.toLowerCase().includes('maquinaria'))
  const maquinariaAreaId = maquinariaArea?.id ?? ''

  const [tareas, estipuladas, lotes, solicitudes] = await Promise.all([
    listarTareasPendientes(areaId),
    listarActividadesEstipuladas(),
    listarLotes(),
    listarSolicitudesDeArea(areaId),
  ])

  const semanas: { anio: number; semana: number }[] = []
  let w = semanaActual()
  for (let i = 0; i < 9; i++) {
    semanas.push(w)
    w = siguienteSemana(w.anio, w.semana)
  }

  const url = (a: string) => `/tareas?area=${a}`

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">🗂️ Banco de tareas</h1>

      {esAdmin ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {areas.map((a) => (
            <Link
              key={a.id}
              href={url(a.id)}
              className={`rounded-full px-3 py-1 text-sm ${a.id === areaId ? 'bg-[#11603a] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {a.nombre}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-4 text-sm text-gray-500">Área: <b className="text-gray-800">{areaActual.nombre}</b></div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">➕ Agregar al banco</h2>
          {esMaquinaria ? (
            <FormNuevaTareaMaquinaria areaId={areaId} estipuladas={estipuladas} lotes={lotes} accion={crearTareaAccion} />
          ) : (
            <form action={crearTareaAccion} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="areaId" value={areaId} />
              <label className="flex flex-1 flex-col text-sm">
                Nueva tarea
                <input name="descripcion" required placeholder="Ej: Arreglo de saladero" className="rounded border p-2" />
              </label>
              <label className="flex flex-col text-sm">
                Lote (opcional)
                <SelectLote lotes={lotes} name="loteId" />
              </label>
              <button className="rounded bg-[#11603a] px-4 py-2 text-sm font-semibold text-white">+ Agregar al banco</button>
            </form>
          )}
        </div>
        <FormSolicitar
          solicitanteAreaId={areaId}
          areas={areas}
          maquinariaAreaId={maquinariaAreaId}
          estipuladas={estipuladas}
          lotes={lotes}
          accion={crearSolicitudAccion}
        />
      </div>

      <div className="mb-6 rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">Tareas pendientes ({tareas.length})</h2>
        {tareas.length === 0 ? (
          <p className="text-sm text-gray-500">No hay tareas pendientes. Agrega una arriba.</p>
        ) : (
          <ul className="divide-y">
            {tareas.map((t) => {
              const actual = t.anioSel && t.semanaSel ? `${t.anioSel}-${t.semanaSel}` : ''
              const opciones = [...semanas]
              if (t.anioSel && t.semanaSel && !semanas.some((s) => s.anio === t.anioSel && s.semana === t.semanaSel)) {
                opciones.unshift({ anio: t.anioSel, semana: t.semanaSel })
              }
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex-1">
                    <div className="font-medium">
                      {t.descripcion}
                      {t.solicitadaPorArea && (
                        <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                          📨 {t.solicitadaPorArea.nombre}
                        </span>
                      )}
                    </div>
                    <InfoLotes lotes={t.lotes} />
                  </div>
                  <form action={programarTareaAccion} className="flex items-end gap-1">
                    <input type="hidden" name="id" value={t.id} />
                    <label className="flex flex-col text-xs">
                      Programar para
                      <select name="anioSemana" defaultValue={actual} className="rounded border p-1 text-sm">
                        <option value="">— sin programar —</option>
                        {opciones.map((s) => (
                          <option key={`${s.anio}-${s.semana}`} value={`${s.anio}-${s.semana}`}>
                            Semana {s.semana}{s.anio === semanas[0].anio && s.semana === semanas[0].semana ? ' (esta)' : ''} · {s.anio}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Guardar</button>
                  </form>
                  <form action={eliminarTareaAccion}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-sm text-red-600 hover:underline">eliminar</button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mb-4 rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">📨 Mis solicitudes a otras áreas</h2>
        {solicitudes.length === 0 ? (
          <p className="text-sm text-gray-500">No has solicitado tareas a otras áreas.</p>
        ) : (
          <ul className="divide-y text-sm">
            {solicitudes.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span>
                  {s.descripcion} <span className="text-gray-500">· para {s.area.nombre}</span>
                </span>
                <span className={s.estado === 'PROGRAMADA' ? 'text-[#2e9e5b]' : 'text-gray-500'}>
                  {s.estado === 'PROGRAMADA' ? '✅ Programada' : '🕓 En banco'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarLotes, listarTareasPendientes, listarActividadesEstipuladas, listarSolicitudesDeArea } from '@/datos/repositorio'
import { SelectLote } from '../_componentes/select-lote'
import { InfoLotes } from '../_componentes/info-lotes'
import { FormNuevaTareaMaquinaria } from './form-nueva-tarea-maquinaria'
import { FormSolicitar } from './form-solicitar'
import { siguienteSemana, semanaAnterior, semanaActual, esSemanaPasada } from '@/dominio/semana'
import {
  crearTareaAccion,
  eliminarTareaAccion,
  seleccionarTareaAccion,
  quitarSeleccionTareaAccion,
  crearSolicitudAccion,
} from './acciones'

export default async function TareasPage({
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
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana
  const pasada = esSemanaPasada(anio, semana, hoy)

  const [tareas, estipuladas, lotes, solicitudes] = await Promise.all([
    listarTareasPendientes(areaId),
    listarActividadesEstipuladas(),
    listarLotes(),
    listarSolicitudesDeArea(areaId),
  ])

  const seleccionadas = tareas.filter((t) => t.anioSel === anio && t.semanaSel === semana)
  const enBanco = tareas.filter((t) => !(t.anioSel === anio && t.semanaSel === semana))

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/tareas?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">🗂️ Banco de tareas</h1>

      {esAdmin ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {areas.map((a) => (
            <Link
              key={a.id}
              href={url(a.id, anio, semana)}
              className={`rounded-full px-3 py-1 text-sm ${a.id === areaId ? 'bg-[#11603a] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {a.nombre}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-3 text-sm text-gray-500">Área: <b className="text-gray-800">{areaActual.nombre}</b></div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1">← Semana {previa.semana}</Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1">Semana {proxima.semana} →</Link>
        <span className="text-gray-500">(eliges para qué semana seleccionar)</span>
      </div>

      {pasada && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          🔒 Semana cerrada — no puedes seleccionar tareas para una semana pasada. (Sí puedes administrar el banco.)
        </div>
      )}

      <p className="mb-3 text-xs text-gray-500">
        {seleccionadas.length} seleccionadas para esta semana · {enBanco.length} en el banco
      </p>

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

      <div className="mb-4 rounded-xl border p-4">
        <h2 className="mb-3 font-semibold text-[#11603a]">📌 Seleccionadas para la semana {semana}</h2>
        {seleccionadas.length === 0 ? (
          <p className="text-sm text-gray-500">Ninguna seleccionada todavía. Elige del banco de abajo.</p>
        ) : (
          <ul className="divide-y">
            {seleccionadas.map((t) => (
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
                <span className="rounded-full bg-[#1d8a55] px-3 py-1 text-xs font-bold text-white">➡️ Semana {semana}</span>
                {!pasada && (
                  <form action={quitarSeleccionTareaAccion}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="rounded bg-gray-100 px-3 py-1 text-sm">Quitar</button>
                  </form>
                )}
                <form action={eliminarTareaAccion}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-sm text-red-600 hover:underline">eliminar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4 rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">📋 Banco (sin programar / otras semanas)</h2>
        {enBanco.length === 0 ? (
          <p className="text-sm text-gray-500">El banco está vacío.</p>
        ) : (
          <ul className="divide-y">
            {enBanco.map((t) => (
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
                {t.semanaSel !== null && (
                  <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">➡️ S{t.semanaSel}</span>
                )}
                {!pasada && (
                  <form action={seleccionarTareaAccion}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="anio" value={anio} />
                    <input type="hidden" name="semana" value={semana} />
                    <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Seleccionar para semana {semana}</button>
                  </form>
                )}
                <form action={eliminarTareaAccion}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-sm text-red-600 hover:underline">eliminar</button>
                </form>
              </li>
            ))}
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

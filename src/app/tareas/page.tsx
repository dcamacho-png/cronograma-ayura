import Link from 'next/link'
import { listarAreas, listarLotes, listarTareasPendientes, listarActividadesEstipuladas } from '@/datos/repositorio'
import { SelectLote } from '../_componentes/select-lote'
import { InfoLotes } from '../_componentes/info-lotes'
import { FormNuevaTareaMaquinaria } from './form-nueva-tarea-maquinaria'
import { siguienteSemana, semanaAnterior, semanaActual, esSemanaPasada } from '@/dominio/semana'
import {
  crearTareaAccion,
  eliminarTareaAccion,
  seleccionarTareaAccion,
  quitarSeleccionTareaAccion,
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

  const areaId = sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id
  const areaActual = areas.find((a) => a.id === areaId)!
  const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana
  const pasada = esSemanaPasada(anio, semana, hoy)

  const [tareas, estipuladas, lotes] = await Promise.all([
    listarTareasPendientes(areaId),
    listarActividadesEstipuladas(),
    listarLotes(),
  ])

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/tareas?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">🗂️ Banco de tareas</h1>

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

      <div className="mb-4 rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">Tareas pendientes</h2>
        {tareas.length === 0 ? (
          <p className="text-sm text-gray-500">No hay tareas en el banco de esta área. Agrega una abajo.</p>
        ) : (
          <ul className="divide-y">
            {tareas.map((t) => {
              const seleccionada = t.anioSel === anio && t.semanaSel === semana
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex-1">
                    <div className="font-medium">
                      {t.descripcion}
                      {t.turno ? <span className="text-xs font-normal text-gray-500"> · {t.turno}</span> : null}
                    </div>
                    <InfoLotes lotes={t.lotes} />
                  </div>
                  {seleccionada && (
                    <span className="rounded-full bg-[#1d8a55] px-3 py-1 text-xs font-bold text-white">➡️ Semana {semana}</span>
                  )}
                  {!pasada &&
                    (seleccionada ? (
                      <form action={quitarSeleccionTareaAccion}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="rounded bg-gray-100 px-3 py-1 text-sm">Quitar</button>
                      </form>
                    ) : (
                      <form action={seleccionarTareaAccion}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="anio" value={anio} />
                        <input type="hidden" name="semana" value={semana} />
                        <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Seleccionar para semana {semana}</button>
                      </form>
                    ))}
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

      {esMaquinaria ? (
        <FormNuevaTareaMaquinaria
          areaId={areaId}
          estipuladas={estipuladas}
          lotes={lotes}
          accion={crearTareaAccion}
        />
      ) : (
        <form action={crearTareaAccion} className="flex flex-wrap items-end gap-2 rounded-xl border p-4">
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
    </main>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import {
  listarAreas,
  listarResponsablesPorArea,
  listarActividades,
  tareasPorAsignar,
  listarLotes,
  listarMaquinas,
} from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana, esSemanaPasada } from '@/dominio/semana'
import { asignarTareaAccion, devolverAlBancoAccion } from './acciones'
import { AsignarTareaForm } from './asignar-tarea-form'
import { GrillaSemana } from './grilla-semana'
import { BotonDescargarImagen } from './boton-descargar-imagen'

export default async function ProgramarPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; anio?: string; semana?: string; error?: string }>
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

  const u = await usuarioActual()
  if (!u) redirect('/login')
  const esAdmin = u.rol === 'ADMIN'

  const areaId = esAdmin
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
  const areaActual = areas.find((a) => a.id === areaId)!
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana
  const pasada = esSemanaPasada(anio, semana, hoy)

  const [responsables, actividades, porAsignar, lotes, maquinas] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarActividades(areaId, anio, semana),
    tareasPorAsignar(areaId, anio, semana),
    listarLotes(),
    listarMaquinas(),
  ])
  const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')
  // Ocupación en la semana: máquina y responsable usados en cada día+turno.
  const ocupacion = actividades.map((a) => ({
    dia: a.dia,
    turno: a.turno,
    maquinaId: a.maquinaId,
    responsableId: a.responsableId,
  }))

  const fechas = fechasDeSemana(anio, semana)

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/programar?area=${a}&anio=${an}&semana=${se}`
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Programar semana</h1>

      {sp.error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          ⚠️ {sp.error}
        </div>
      )}

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

      <div className="mb-5 flex items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">
          ← Semana {previa.semana}
        </Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">
          Semana {proxima.semana} →
        </Link>
      </div>

      {pasada && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          🔒 Semana cerrada — solo lectura. No se puede modificar la programación de una semana pasada.
        </div>
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
                  <AsignarTareaForm
                    tareaId={t.id}
                    descripcion={t.descripcion}
                    lotesTarea={t.lotes}
                    responsables={responsables}
                    lotes={lotes}
                    esMaquinaria={esMaquinaria}
                    maquinas={maquinas}
                    ocupacion={ocupacion}
                    areaId={areaId}
                    anio={anio}
                    semana={semana}
                    accion={asignarTareaAccion}
                  />
                  <form action={devolverAlBancoAccion} className="mt-1">
                    <input type="hidden" name="tareaId" value={t.id} />
                    <button className="text-xs text-gray-500 hover:underline">↩️ Devolver al banco</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {responsables.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <BotonDescargarImagen
            targetId="grilla-export"
            nombreArchivo={`cronograma-${areaActual.nombre}-S${semana}-${anio}.png`}
          />
        </div>
      )}
      <div id="grilla-export" className="mb-6">
        <GrillaSemana
          areaNombre={areaActual.nombre}
          semana={semana}
          fechas={fechas}
          responsables={responsables}
          actividades={actividades}
        />
      </div>

    </main>
  )
}

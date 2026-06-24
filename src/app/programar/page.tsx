import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import {
  listarAreas,
  listarResponsablesPorArea,
  listarActividades,
  tareasPorAsignar,
  listarMaquinas,
} from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana, esSemanaFutura, diaActual, esDiaPasado } from '@/dominio/semana'
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
  const futura = esSemanaFutura(anio, semana, hoy)
  // Días ya pasados de la semana mostrada (solo aplica a la semana actual; en
  // futuras queda vacío y en pasadas el formulario no se muestra).
  const hoyRef = { ...hoy, dia: diaActual() }
  const diasPasados = [1, 2, 3, 4, 5, 6, 7].filter((d) => esDiaPasado(anio, semana, d, hoyRef))

  const [responsables, actividades, porAsignar, maquinas] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarActividades(areaId, anio, semana),
    tareasPorAsignar(areaId, anio, semana),
    listarMaquinas(),
  ])
  const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')
  const responsablesActivos = responsables.filter((r) => r.activo)
  const actividadesCronograma = actividades.filter((a) => !a.noProgramada)
  // Ocupación en la semana: máquina y responsable usados en cada día+turno.
  const ocupacion = actividadesCronograma.map((a) => ({
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
      <h1 className="mb-4 text-2xl font-bold text-bosque">Programar semana</h1>

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
              className={`rounded-full px-3 py-1 text-sm ${a.id === areaId ? 'bg-bosque text-white' : 'bg-gray-100 text-gray-700'}`}
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

      {!futura && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          🔒 Esta semana ya empezó — solo lectura. La programación se hace antes del lunes de inicio de la semana.
        </div>
      )}

      {futura && porAsignar.length > 0 && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-3 font-semibold text-blue-900">📌 Tareas por asignar — semana {semana}</h2>
          {responsablesActivos.length === 0 ? (
            <p className="text-sm text-blue-900">Primero agrega responsables a esta área para poder asignar.</p>
          ) : (
            <ul className="space-y-2">
              {porAsignar.map((t) => (
                <li key={t.id}>
                  <AsignarTareaForm
                    tareaId={t.id}
                    descripcion={t.descripcion}
                    lotesTarea={t.lotes}
                    bultosPorLote={t.bultosPorLote as Record<string, number> | null}
                    responsables={responsablesActivos}
                    esMaquinaria={esMaquinaria}
                    maquinas={maquinas}
                    ocupacion={ocupacion}
                    diasPasados={diasPasados}
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

      {(responsablesActivos.length > 0 || esAdmin) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {responsablesActivos.length > 0 && (
            <BotonDescargarImagen
              targetId="grilla-export"
              nombreArchivo={`cronograma-${areaActual.nombre}-S${semana}-${anio}.png`}
            />
          )}
          {esAdmin && (
            <a
              href={`/programar/exportar?anio=${anio}&semana=${semana}`}
              target="_blank"
              rel="noopener"
              className="rounded border border-purple-700 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-50"
            >
              🖨️ Exportar PDF (todas las áreas)
            </a>
          )}
        </div>
      )}
      <div id="grilla-export" className="mb-6">
        <GrillaSemana
          areaNombre={areaActual.nombre}
          anio={anio}
          semana={semana}
          fechas={fechas}
          responsables={responsablesActivos}
          actividades={actividadesCronograma}
          turnoEditable={futura}
          esMaquinaria={esMaquinaria}
        />
      </div>
    </main>
  )
}

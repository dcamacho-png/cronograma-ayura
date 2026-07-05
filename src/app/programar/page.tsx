import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { puedeVer, esSoloLectura } from '@/auth/permisos'
import {
  listarAreas,
  listarResponsablesPorArea,
  listarActividades,
  tareasPorAsignar,
  listarMaquinas,
  listarDedicaciones,
} from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana, esSemanaFutura, diaActual, esDiaPasado } from '@/dominio/semana'
import { esMaquinaria as esMaquinariaVar } from '@/dominio/variante'
import { textoSugerencia } from '@/dominio/sugerencia'
import { asignarTareaAccion, devolverAlBancoAccion, dedicarTractorAccion } from './acciones'
import { AsignarTareaForm } from './asignar-tarea-form'
import { GrillaSemana } from './grilla-semana'
import { BotonDescargarImagen } from './boton-descargar-imagen'
import { BotonCompartirWhatsapp } from './boton-compartir-whatsapp'
import { GrillaTractor } from './grilla-tractor'

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
        <p className="text-tierra">No hay áreas. Corre <code>npm run db:seed</code> para sembrar los catálogos.</p>
      </main>
    )
  }

  const u = await usuarioActual()
  if (!u) redirect('/login')
  if (!puedeVer(u, 'programar')) redirect('/')
  const esAdmin = u.rol === 'ADMIN'
  const soloLectura = esSoloLectura(u)
  const verTodas = esAdmin || soloLectura

  const areaId = verTodas
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

  const [responsables, actividades, porAsignar, maquinas, dedicacionesRaw] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarActividades(areaId, anio, semana),
    tareasPorAsignar(areaId, anio, semana),
    listarMaquinas(),
    listarDedicaciones(anio, semana),
  ])
  const esMaquinaria = esMaquinariaVar(areaActual, 'programar')
  const areasParaDedicar = areas.filter((a) => !esMaquinariaVar(a, 'programar'))
  const dedicaciones = dedicacionesRaw.map((d) => ({
    maquinaId: d.maquinaId,
    dia: d.dia,
    areaId: d.areaId,
    areaNombre: d.area.nombre,
  }))
  const responsablesActivos = responsables.filter((r) => r.activo)
  const nombrePorResp = new Map(responsables.map((r) => [r.id, r.nombre]))
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

      {verTodas ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {areas.map((a) => (
            <Link
              key={a.id}
              href={url(a.id, anio, semana)}
              className={`rounded-full px-3 py-1 text-sm ${a.id === areaId ? 'bg-bosque text-white' : 'bg-arena text-tierra'}`}
            >
              {a.nombre}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-3 text-sm text-tierra">Área: <b className="text-tinta">{areaActual.nombre}</b></div>
      )}

      <div className="mb-5 flex items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded-lg border border-borde bg-marfil px-3 py-1 text-sm text-tinta">
          ← Semana {previa.semana}
        </Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded-lg border border-borde bg-marfil px-3 py-1 text-sm text-tinta">
          Semana {proxima.semana} →
        </Link>
      </div>

      {!futura && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          🔒 Esta semana ya empezó — solo lectura. La programación se hace antes del lunes de inicio de la semana.
        </div>
      )}

      {futura && !soloLectura && porAsignar.length > 0 && (
        <div className="mb-6 rounded-xl border border-borde bg-arena p-4">
          <h2 className="mb-3 font-semibold text-bosque">📌 Tareas por asignar — semana {semana}</h2>
          {responsablesActivos.length === 0 ? (
            <p className="text-sm text-tierra">Primero agrega responsables a esta área para poder asignar.</p>
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
                  {(() => {
                    const sug = textoSugerencia(
                      t.solicitadaPorArea?.nombre ?? '',
                      t.diasSugeridos,
                      t.responsablesSugeridosIds,
                      nombrePorResp,
                    )
                    return sug ? <p className="mt-1 text-xs italic text-tierra">💡 {sug}</p> : null
                  })()}
                  <form action={devolverAlBancoAccion} className="mt-1">
                    <input type="hidden" name="tareaId" value={t.id} />
                    <button className="text-xs text-tierra hover:underline">↩️ Devolver al banco</button>
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
            <>
              <BotonCompartirWhatsapp
                targetId="grilla-export"
                nombreArchivo={`cronograma-${areaActual.nombre}-S${semana}-${anio}.png`}
                textoCompartir={`Cronograma — ${areaActual.nombre} — Semana ${semana}`}
              />
              <BotonDescargarImagen
                targetId="grilla-export"
                nombreArchivo={`cronograma-${areaActual.nombre}-S${semana}-${anio}.png`}
              />
            </>
          )}
          {esAdmin && (
            <a
              href={`/programar/exportar?anio=${anio}&semana=${semana}`}
              target="_blank"
              rel="noopener"
              className="rounded-lg border border-arcilla px-3 py-1 text-sm font-semibold text-arcilla hover:bg-arena/40"
            >
              🖨️ Exportar PDF (todas las áreas)
            </a>
          )}
        </div>
      )}
      <div className="mb-6">
        <GrillaSemana
          areaNombre={areaActual.nombre}
          anio={anio}
          semana={semana}
          fechas={fechas}
          responsables={responsablesActivos}
          actividades={actividadesCronograma}
          turnoEditable={futura && !soloLectura}
          esMaquinaria={esMaquinaria}
        />
      </div>
      {esMaquinaria && (
        <GrillaTractor
          fechas={fechas}
          actividades={actividadesCronograma}
          maquinas={maquinas}
          dedicaciones={dedicaciones}
          areasParaDedicar={areasParaDedicar}
          futura={futura && !soloLectura}
          anio={anio}
          semana={semana}
          accion={dedicarTractorAccion}
        />
      )}
      {/* Grilla SOLO para exportar como imagen: recortada (h-0 overflow-hidden) para no
          ocupar espacio ni afectar la pantalla. html2canvas (BotonDescargarImagen) clona
          este #grilla-export y lo renderiza a tamaño completo igualmente. */}
      <div aria-hidden="true" className="h-0 overflow-hidden">
        <div id="grilla-export">
          <GrillaSemana
            areaNombre={areaActual.nombre}
            anio={anio}
            semana={semana}
            fechas={fechas}
            responsables={responsablesActivos}
            actividades={actividadesCronograma}
            esMaquinaria={esMaquinaria}
            paraExportar
          />
        </div>
      </div>
    </main>
  )
}

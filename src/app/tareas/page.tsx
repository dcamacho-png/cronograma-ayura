import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  listarAreas,
  listarTareasPendientes,
  listarActividadesEstipuladas,
  listarLotes,
  listarSolicitudesDeArea,
  listarResponsablesTodos,
} from '@/datos/repositorio'
import { semanaActual, siguienteSemana } from '@/dominio/semana'
import { esMaquinaria as esMaquinariaVar } from '@/dominio/variante'
import { usuarioActual } from '@/auth/sesion'
import { puedeVer } from '@/auth/permisos'
import { InfoLotes } from '../_componentes/info-lotes'
import { FormNuevaTareaMaquinaria } from './form-nueva-tarea-maquinaria'
import { FormNuevaTareaEstandar } from './form-nueva-tarea-estandar'
import { FormSolicitar } from './form-solicitar'
import { crearTareaAccion, eliminarTareaAccion, programarTareaAccion, crearSolicitudAccion, devolverAlSolicitanteAccion, reenviarSolicitudAccion, editarSolicitudAccion, eliminarSolicitudAccion } from './acciones'
import { FormEditarSolicitud } from './form-editar-solicitud'
import { FormEliminar } from './form-eliminar'
import { parseCsv } from '@/dominio/sugerencia'

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
        <p className="text-tierra">No hay áreas. Corre <code>npm run db:seed</code>.</p>
      </main>
    )
  }
  const u = await usuarioActual()
  if (!u) redirect('/login')
  if (!puedeVer(u, 'tareas')) redirect('/')
  const esAdmin = u.rol === 'ADMIN'
  const areaId = esAdmin
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
  const areaActual = areas.find((a) => a.id === areaId)!
  const esMaquinaria = esMaquinariaVar(areaActual, 'tareas')

  const [tareas, estipuladas, lotes, solicitudes, responsablesTodos] = await Promise.all([
    listarTareasPendientes(areaId),
    listarActividadesEstipuladas(),
    listarLotes(),
    listarSolicitudesDeArea(areaId),
    listarResponsablesTodos(),
  ])
  // Ocultar de "Mis solicitudes" las que ya tienen ≥1 actividad CUMPLIDA (viven en Consulta).
  const solicitudesVisibles = solicitudes.filter((s) => s._count.actividades === 0)

  const responsablesPorArea: Record<string, { id: string; nombre: string }[]> = {}
  for (const r of responsablesTodos) {
    if (!r.activo) continue
    ;(responsablesPorArea[r.areaId] ??= []).push({ id: r.id, nombre: r.nombre })
  }

  const semanas: { anio: number; semana: number }[] = []
  let w = siguienteSemana(semanaActual().anio, semanaActual().semana)
  for (let i = 0; i < 8; i++) {
    semanas.push(w)
    w = siguienteSemana(w.anio, w.semana)
  }

  const estipuladasMaq = estipuladas.filter((e) => e.maquinaria)
  const estipuladasEst = estipuladas.filter((e) => !e.maquinaria)

  const url = (a: string) => `/tareas?area=${a}`

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-bosque">🗂️ Banco de tareas</h1>

      {esAdmin ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {areas.map((a) => (
            <Link
              key={a.id}
              href={url(a.id)}
              className={`rounded-full px-3 py-1 text-sm ${a.id === areaId ? 'bg-bosque text-white' : 'bg-arena text-tierra'}`}
            >
              {a.nombre}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-4 text-sm text-tierra">Área: <b className="text-tinta">{areaActual.nombre}</b></div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="tarjeta p-4">
          <h2 className="mb-2 font-semibold text-tinta">➕ Agregar al banco</h2>
          {esMaquinaria ? (
            <FormNuevaTareaMaquinaria areaId={areaId} estipuladas={estipuladasMaq} lotes={lotes} accion={crearTareaAccion} />
          ) : (
            <FormNuevaTareaEstandar areaId={areaId} estipuladas={estipuladasEst} lotes={lotes} accion={crearTareaAccion} />
          )}
        </div>
        <FormSolicitar
          solicitanteAreaId={areaId}
          areas={areas.map((a) => ({ id: a.id, nombre: a.nombre, maqTareas: a.maqTareas }))}
          estipuladas={estipuladasMaq}
          lotes={lotes}
          accion={crearSolicitudAccion}
          responsablesPorArea={responsablesPorArea}
        />
      </div>

      <div className="mb-6 tarjeta p-4">
        <h2 className="mb-3 font-semibold text-tinta">Tareas pendientes ({tareas.length})</h2>
        {tareas.length === 0 ? (
          <p className="text-sm text-tierra">No hay tareas pendientes. Agrega una arriba.</p>
        ) : (
          <ul className="divide-y divide-borde">
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
                        <span className="ml-2 rounded-full bg-arena px-2 py-0.5 text-xs font-semibold text-arcilla">
                          📨 {t.solicitadaPorArea.nombre}
                        </span>
                      )}
                    </div>
                    {t.finca && (
                      <div className="text-xs font-medium text-tierra">🏠 {t.finca.nombre}</div>
                    )}
                    <InfoLotes lotes={t.lotes} bultosPorLote={t.bultosPorLote as Record<string, number> | null} medidaPorLote={t.medidaPorLote as Record<string, number> | null} unidad={t.unidad} />
                    {t.detalle && (
                      <div className="mt-1 whitespace-pre-line text-xs text-tierra">📝 {t.detalle}</div>
                    )}
                  </div>
                  <form action={programarTareaAccion} className="flex items-end gap-1">
                    <input type="hidden" name="id" value={t.id} />
                    <label className="flex flex-col text-xs">
                      Programar para
                      <select name="anioSemana" defaultValue={actual} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                        <option value="">Elegir semana…</option>
                        {opciones.map((s) => (
                          <option key={`${s.anio}-${s.semana}`} value={`${s.anio}-${s.semana}`}>
                            Semana {s.semana} · {s.anio}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">Guardar</button>
                  </form>
                  {t.solicitadaPorArea ? (
                    <form action={devolverAlSolicitanteAccion} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={t.id} />
                      <input name="observacion" placeholder="motivo (opcional)" className="w-44 rounded-lg border border-borde bg-marfil px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-bosque/40" />
                      <button className="text-sm text-amber-700 hover:underline">↩️ Devolver</button>
                    </form>
                  ) : (
                    <form action={eliminarTareaAccion}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="text-sm text-red-600 hover:underline">eliminar</button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mb-4 tarjeta p-4">
        <h2 className="mb-3 font-semibold text-tinta">📨 Mis solicitudes a otras áreas</h2>
        {solicitudesVisibles.length === 0 ? (
          <p className="text-sm text-tierra">No has solicitado tareas a otras áreas.</p>
        ) : (
          <ul className="divide-y divide-borde text-sm">
            {solicitudesVisibles.map((s) => (
              <li key={s.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span>
                    {s.descripcion} <span className="text-tierra">· para {s.area.nombre}</span>
                  </span>
                  <span className={s.estado === 'PROGRAMADA' ? 'text-[#2e9e5b]' : s.estado === 'DEVUELTA' ? 'text-red-600' : 'text-tierra'}>
                    {s.estado === 'PROGRAMADA' ? '✅ Programada' : s.estado === 'DEVUELTA' ? '🔴 No realizada' : '🕓 En banco'}
                  </span>
                </div>
                {(s.finca?.nombre ?? s.lotes[0]?.finca?.nombre) && (
                  <div className="text-xs font-medium text-tierra">🏠 {s.finca?.nombre ?? s.lotes[0]?.finca?.nombre}</div>
                )}
                <InfoLotes lotes={s.lotes} bultosPorLote={s.bultosPorLote as Record<string, number> | null} />
                {s.detalle && (
                  <div className="mt-1 whitespace-pre-line text-xs text-tierra">📝 {s.detalle}</div>
                )}
                {s.estado === 'DEVUELTA' && s.observacionDevolucion && (
                  <div className="mt-1 text-xs italic text-tierra">Obs.: {s.observacionDevolucion}</div>
                )}
                {/* El solicitante puede editar/eliminar mientras la otra área no la haya
                    programado; Reenviar solo aplica a las devueltas. */}
                {s.estado !== 'PROGRAMADA' && (
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    {s.estado === 'DEVUELTA' && (
                      <form action={reenviarSolicitudAccion}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="text-xs font-semibold text-arcilla hover:underline">Reenviar</button>
                      </form>
                    )}
                    <FormEditarSolicitud
                      id={s.id}
                      esMaquinaria={s.area.maqTareas}
                      descripcion={s.descripcion}
                      detalle={s.detalle}
                      diasSeleccion={parseCsv(s.diasSugeridos)}
                      responsablesSeleccion={parseCsv(s.responsablesSugeridosIds)}
                      responsablesB={responsablesPorArea[s.areaId] ?? []}
                      estipuladas={estipuladasMaq}
                      lotes={lotes}
                      lotesActuales={s.lotes}
                      bultosActuales={s.bultosPorLote as Record<string, number> | null}
                      accion={editarSolicitudAccion}
                    />
                    <FormEliminar accion={eliminarSolicitudAccion} id={s.id} etiqueta={s.descripcion} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

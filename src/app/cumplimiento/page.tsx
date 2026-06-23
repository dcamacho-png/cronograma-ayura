import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarMotivos, listarActividades, listarLotes, listarMaquinas, listarResponsablesPorArea, listarActividadesEstipuladas } from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana } from '@/dominio/semana'
import { unidadDe, unidadAbreviada } from '@/dominio/unidad'
import { textoLotesHechos } from '@/dominio/lotes-hechos'
import { porcentajeCumplimiento, colorSemaforo, agruparPorActividad, diasDistintos, responsablesDistintos, conteoEstadoActividades, tieneDiaPendiente } from '@/dominio/metricas'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'
import { lotesPendientes, textoAvanceConFecha, normalizarAvancePorLote, type AvanceEntrada } from '@/dominio/avance-lote'
import { registrarAccion, agregarActividadRealizadaAccion, marcarEstadoAccion, desmarcarAccion, registrarAvanceLoteAccion, devolverAlBancoAccion, marcarCumplidaParcialAccion } from './acciones'
import { FormActividadRealizada } from './form-actividad-realizada'
import { FormAvanceLote } from './form-avance-lote'
import { InfoLotes } from '../_componentes/info-lotes'
import { DiaNoMaquinaria } from './dia-no-maquinaria'
import { DiaMaquinaria } from './dia-maquinaria'

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

  const u = await usuarioActual()
  if (!u) redirect('/login')
  const esAdmin = u.rol === 'ADMIN'

  const areaId = esAdmin
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
  const areaActual = areas.find((a) => a.id === areaId)!
  const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana

  const [motivos, actividades, lotes, maquinas, responsablesTodos, estipuladas] = await Promise.all([
    listarMotivos(),
    listarActividades(areaId, anio, semana),
    listarLotes(),
    listarMaquinas(),
    listarResponsablesPorArea(areaId),
    listarActividadesEstipuladas(),
  ])
  const responsables = responsablesTodos.filter((r) => r.activo)
  const motivoCambioId = motivos.find((m) => m.nombre === 'Cambio de actividad')?.id ?? null
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))

  // Agrupar las filas-día en actividades (misma tarea = una tarjeta).
  // Cada grupo se ordena por día; las tarjetas, por el primer día de la actividad.
  const gruposActividad = [...agruparPorActividad(actividades).values()]
    .map((dias) => [...dias].sort((a, b) => a.dia - b.dia))
    .sort((g1, g2) => g1[0].dia - g2[0].dia)

  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  // Contadores por actividad única (agrupada por tarea), no por filas-día.
  const gruposDominio = [...agruparPorActividad(dominio).values()]
  const totalActividades = gruposDominio.length
  const conteoEstado = conteoEstadoActividades(dominio)
  // Actividades que aún tienen algún día sin registrar (para aviso y bloqueo de semana).
  const pendientes = gruposDominio.filter(tieneDiaPendiente).length

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const fechas = fechasDeSemana(anio, semana)
  const fmtFecha = (f: Date) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)
  const url = (a: string, an: number, se: number) => `/cumplimiento?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Registrar cumplimiento</h1>

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

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">
          ← Semana {previa.semana}
        </Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        {pendientes > 0 ? (
          <span
            className="cursor-not-allowed rounded border px-3 py-1 text-sm text-gray-300"
            title="Registra todas las actividades para pasar a la siguiente semana"
          >
            Semana {proxima.semana} →
          </span>
        ) : (
          <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">
            Semana {proxima.semana} →
          </Link>
        )}
        <a
          href={`/cumplimiento/exportar?area=${areaId}&anio=${anio}&semana=${semana}`}
          className="rounded border border-[#11603a] px-3 py-1 text-sm font-semibold text-[#11603a] hover:bg-green-50"
        >
          📥 Descargar Excel
        </a>
        <span className="ml-auto rounded bg-gray-100 px-3 py-1 text-sm">
          Cumplido: <b>{pct === null ? '—' : `${pct}%`}</b>
        </span>
        <span className="rounded bg-gray-100 px-3 py-1 text-sm">
          ✅ <b>{conteoEstado.CUMPLIDA}</b> · 🟡 <b>{conteoEstado.PARCIAL}</b> · 🔴 <b>{conteoEstado.NO_CUMPLIDA}</b> · 🔄 <b>{conteoEstado.REPROGRAMADA}</b>{' '}
          <span className="text-gray-400">de {totalActividades}</span>
        </span>
      </div>

      {pendientes > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ⚠️ Faltan <b>{pendientes}</b> actividad(es) por registrar esta semana. Regístralas para pasar a la siguiente semana.
        </div>
      )}

      {responsables.length > 0 && (
        <FormActividadRealizada
          areaId={areaId}
          anio={anio}
          semana={semana}
          esMaquinaria={esMaquinaria}
          responsables={responsables}
          lotes={lotes}
          maquinas={maquinas}
          estipuladas={estipuladas}
          accion={agregarActividadRealizadaAccion}
        />
      )}

      {actividades.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay actividades en esta semana. Prográmalas en la pestaña <b>Programar</b>.
        </p>
      ) : (
        <ul className="space-y-4">
          {gruposActividad.map((dias) => {
            const cab = dias[0]
            const pctAct = porcentajeCumplimiento(dias as unknown as ActividadDominio[])
            const nDias = diasDistintos(dias)
            const multiResp = responsablesDistintos(dias) > 1
            // nombres de responsables distintos, en orden de aparición
            const nombresResp = [...new Map(dias.map((a) => [a.responsableId, a.responsable.nombre])).values()]
            // agrupar las filas del grupo por día (cada día una vez)
            const porDia = new Map<number, typeof dias>()
            for (const a of dias) {
              const lista = porDia.get(a.dia) ?? []
              lista.push(a)
              porDia.set(a.dia, lista)
            }
            const diasOrdenados = [...porDia.entries()].sort((x, y) => x[0] - y[0])
            const unidad = unidadDe(unidadPorNombre, cab.descripcion)
            return (
              <li key={cab.tareaId ?? cab.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="font-medium">{cab.descripcion}</span>
                  <span>·</span>
                  <span>{nombresResp.join(', ')}</span>
                  {cab.maquina && <span className="text-gray-600">· 🚜 {cab.maquina.nombre}</span>}
                  {cab.vecesReprogramada > 0 && (
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: COLOR_HEX[colorSemaforo(cab.vecesReprogramada)] }}
                    >
                      reprogramada {cab.vecesReprogramada}×
                    </span>
                  )}
                  <span className="ml-auto rounded bg-gray-100 px-2 py-0.5 text-xs">
                    {nDias > 1 ? `${nDias} días · ` : ''}Cumplido: <b>{pctAct === null ? '—' : `${pctAct}%`}</b>
                  </span>
                </div>
                <InfoLotes lotes={cab.lotes} bultosPorLote={cab.bultosPorLote as Record<string, number> | null} className="mb-2" />

                <ul className="space-y-2">
                  {diasOrdenados.map(([dia, filas]) => (
                    <li key={dia} className="rounded border border-gray-100 bg-gray-50/50 p-2">
                      <div className="mb-1 text-xs font-semibold text-gray-600">
                        {DIAS[dia] ?? ''} {fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}
                      </div>
                      <ul className="space-y-2">
                        {filas.map((a) => (
                          <li key={a.id} className="flex flex-col gap-1">
                            {multiResp && <span className="text-xs text-gray-500">{a.responsable.nombre}</span>}
                            {a.estado === 'PENDIENTE' ? (
                              esMaquinaria ? (
                                <DiaMaquinaria
                                  actividadId={a.id}
                                  unidad={unidad}
                                  motivos={motivos}
                                  motivoCambioId={motivoCambioId}
                                  lotes={lotes}
                                  maquinas={maquinas}
                                  estipuladas={estipuladas}
                                  lotesActividad={a.lotes}
                                  haProgramada={a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)}
                                  accionRegistrar={registrarAccion}
                                />
                              ) : (
                                <DiaNoMaquinaria
                                  actividadId={a.id}
                                  motivos={motivos}
                                  motivoCambioId={motivoCambioId}
                                  lotes={lotes}
                                  maquinas={maquinas}
                                  estipuladas={estipuladas}
                                  lotesActividad={a.lotes}
                                  unidad={unidad}
                                  marcarCumplido={marcarEstadoAccion}
                                  accionRegistrar={registrarAccion}
                                />
                              )
                            ) : (
                              <>
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-semibold">{ESTADOS.find((e) => e.valor === a.estado)?.etiqueta ?? a.estado}</span>
                                {a.haRealizada != null && (
                                  <span className="text-gray-500">· {a.haRealizada} {unidadAbreviada(unidad)}</span>
                                )}
                                {a.motivo && <span className="text-gray-500">· {a.motivo.nombre}</span>}
                                {a.nota && <span className="text-gray-500">· {a.nota}</span>}
                                {a.centroCosto && <span className="text-gray-500">· 🏷️ {a.centroCosto}</span>}
                                {textoLotesHechos(a.lotes, a.lotesHechos as string[] | null) && (
                                  <span className="text-gray-500">· ✅ Realizados: {textoLotesHechos(a.lotes, a.lotesHechos as string[] | null)}</span>
                                )}
                                <form action={desmarcarAccion} className="ml-auto">
                                  <input type="hidden" name="id" value={a.id} />
                                  <button className="text-xs text-gray-500 underline hover:text-gray-700">↩ desmarcar</button>
                                </form>
                              </div>
                              {a.estado === 'PARCIAL' && (() => {
                                const avances = normalizarAvancePorLote(
                                  a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
                                )
                                const etiquetaDia = (dia: number) =>
                                  `${DIAS[dia] ?? ''} ${fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}`.trim()
                                const resumenAvances = textoAvanceConFecha(a.lotes, avances, unidadAbreviada(unidad), etiquetaDia)
                                return (
                                <div className="mt-1 flex w-full flex-col gap-1 text-sm">
                                  {a.lotes.length > 0 && (
                                    <span className="text-gray-600">
                                      Progreso: {a.lotes.length - lotesPendientes(a.lotes, avances).length} de {a.lotes.length} lotes
                                    </span>
                                  )}
                                  {resumenAvances && (
                                    <span className="text-gray-600">Avances: {resumenAvances}</span>
                                  )}
                                  <div className="flex flex-wrap items-center gap-2">
                                    {a.lotes.length > 0 && (
                                      <FormAvanceLote
                                        actividadId={a.id}
                                        diaActividad={a.dia}
                                        esMaquinaria={esMaquinaria}
                                        maquinas={maquinas}
                                        unidad={unidad}
                                        lotes={a.lotes}
                                        accion={registrarAvanceLoteAccion}
                                      />
                                    )}
                                    <form action={marcarCumplidaParcialAccion}>
                                      <input type="hidden" name="id" value={a.id} />
                                      <button className="rounded border border-[#11603a] px-2 py-1 text-xs font-semibold text-[#11603a] hover:bg-green-50">✓ Marcar cumplida</button>
                                    </form>
                                    <form action={devolverAlBancoAccion}>
                                      <input type="hidden" name="id" value={a.id} />
                                      <button className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Devolver al banco</button>
                                    </form>
                                  </div>
                                </div>
                                )
                              })()}
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

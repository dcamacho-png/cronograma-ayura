import { porcentajeCumplimiento, motivosFrecuentes, colorSemaforo, conteoEstadoActividades, agruparPorActividad, estadoActividad } from '@/dominio/metricas'
import {
  colorPorcentaje,
  actividadesConCambio,
  finalizadasPorLabor,
  medidasPorTractor,
  laboresPorTractor,
} from '@/dominio/resumen'
import type { Actividad as ActividadDominio, Estado } from '@/dominio/tipos'
import { unidadDe, unidadAbreviada, type Unidad } from '@/dominio/unidad'
import { normalizarAvancePorLote, type AvanceEntrada } from '@/dominio/avance-lote'

const ESTADOS_ORDEN = [
  { v: ['CUMPLIDA'], etq: '✅ Cumplidas' },
  { v: ['PARCIAL'], etq: '🟡 Parciales' },
  { v: ['NO_CUMPLIDA', 'REPROGRAMADA'], etq: '🔴 No se hizo' },
  { v: ['PENDIENTE'], etq: '⏳ Pendientes' },
]

const COLOR_HEX: Record<string, string> = {
  gris: '#9ca3af',
  verde: '#2e9e5b',
  amarillo: '#e8b400',
  naranja: '#e8771a',
  rojo: '#d63b3b',
  ninguno: 'transparent',
}

type ActividadResumen = {
  id: string
  tareaId: string | null
  estado: string
  descripcion: string
  vecesReprogramada: number
  haRealizada: number | null
  nota: string | null
  lotes: { nombre: string; hectareas: number | null }[]
  maquinaId: string | null
  maquina: { nombre: string } | null
  responsable: { nombre: string }
  motivo: { nombre: string } | null
  noProgramada: boolean
  // Campos JSON de Prisma: llegan como JsonValue, se castean al usarse (patrón del proyecto).
  avancePorLote: unknown
  bultosPorLote: unknown
}

export function ResumenArea({
  areaNombre,
  semana,
  anio,
  esMaquinaria,
  unidadPorNombre,
  actividades,
  responsables,
  motivos,
  recurrentesMes = [],
}: {
  areaNombre: string
  semana: number
  anio: number
  esMaquinaria: boolean
  unidadPorNombre: Record<string, string>
  actividades: ActividadResumen[]
  responsables: { id: string; nombre: string }[]
  motivos: { id: string; nombre: string }[]
  recurrentesMes?: { descripcion: string; areaNombre: string; veces: number }[]
}) {
  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const conteo = conteoEstadoActividades(dominio)
  const totalActividades = agruparPorActividad(dominio).size
  const reprogramadas = [...agruparPorActividad(dominio).values()].filter((filas) => filas.some((f) => f.vecesReprogramada > 0)).length
  const laboresFinalizadas = esMaquinaria ? finalizadasPorLabor(dominio) : []
  const motivosTop = motivosFrecuentes(dominio)
  const cambios = actividadesConCambio(dominio) as unknown as ActividadResumen[]

  const nombrePorId = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombreResp = (id: string) => nombrePorId.get(id) ?? 'Responsable'
  const nombreMaquina = new Map(
    actividades.filter((a) => a.maquinaId && a.maquina).map((a) => [a.maquinaId as string, a.maquina!.nombre]),
  )
  const nombreMotivo = new Map(motivos.map((m) => [m.id, m.nombre]))

  const haActividad = (a: ActividadResumen) => a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)

  // Una sola "actividad" por grupo (tareaId): estado agrupado y medida tomada UNA vez.
  const actividadesUnicas = [...agruparPorActividad(actividades).values()].map((filas) => {
    const base = filas[0]
    const avances = Object.values(normalizarAvancePorLote(base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null)).flat().map((e) => ({ maquinaId: e.maquinaId, cantidad: e.cantidad }))
    const sumAvances = avances.reduce((s, e) => s + e.cantidad, 0)
    return {
      id: base.id,
      estado: estadoActividad(filas.map((f) => ({ estado: f.estado as Estado }))),
      descripcion: base.descripcion,
      unidad: unidadDe(unidadPorNombre, base.descripcion),
      haProgramada: haActividad(base),
      // La medida realizada vive en haRealizada o, en PARCIAL, en la suma de los avances.
      haRealizada: base.haRealizada ?? (sumAvances > 0 ? sumAvances : null),
      lotes: base.lotes,
      maquinaId: base.maquinaId,
      maquinas: new Set(filas.map((f) => f.maquina?.nombre).filter((n): n is string => !!n)),
      responsable: base.responsable,
      noProgramada: base.noProgramada,
      bultosPorLote: base.bultosPorLote as Record<string, number> | null,
      avances,
    }
  })

  const nuevas = actividadesUnicas.filter((a) => a.noProgramada)

  const filasTractorArg = actividadesUnicas.map((a) => ({ estado: a.estado, descripcion: a.descripcion, unidad: a.unidad, haProgramada: a.haProgramada, haRealizada: a.haRealizada, maquinaId: a.maquinaId, avances: a.avances }))
  const porTractor = medidasPorTractor(filasTractorArg)
  const laboresTractor = laboresPorTractor(filasTractorArg)
  // Tarjetas: tractores por nombre, "— sin tractor —" al final.
  const tractoresOrdenados = [...laboresTractor.keys()].sort((x, y) => {
    if (x === '') return 1
    if (y === '') return -1
    return (nombreMaquina.get(x) ?? '').localeCompare(nombreMaquina.get(y) ?? '')
  })
  const totalTractorTexto = (t: string) => {
    const r = porTractor.get(t)
    if (!r) return ''
    return (['ha', 'hora', 'kg', 'cantidad'] as Unidad[]).filter((u) => r[u] > 0).map((u) => `${r[u]} ${unidadAbreviada(u)}`).join(' · ')
  }

  // Lista "realizado por actividad": suma la medida (única) por descripción.
  const medidaPorActividad = new Map<string, { valor: number; unidad: Unidad }>()
  for (const a of actividadesUnicas) {
    if (a.estado === 'PENDIENTE') continue
    const realizada = a.haRealizada ?? (a.unidad === 'ha' && a.estado === 'CUMPLIDA' ? a.haProgramada : 0)
    const prev = medidaPorActividad.get(a.descripcion)
    medidaPorActividad.set(a.descripcion, { valor: (prev?.valor ?? 0) + realizada, unidad: a.unidad })
  }
  const medidaActividadLista = [...medidaPorActividad.entries()].sort((a, b) => b[1].valor - a[1].valor)

  return (
    <div className="text-tinta">
      <div className="mb-4 border-b border-borde pb-2">
        <div className="text-lg font-bold text-bosque">Resumen — {areaNombre}</div>
        <div className="text-sm text-tierra">Semana {semana} · {anio}</div>
      </div>

      {/* Cuadros-resumen */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Cumplimiento</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[colorPorcentaje(pct)] }}>{pct === null ? '—' : `${pct}%`}</div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Cumplidas</div>
          <div className="text-4xl font-extrabold">{conteo.CUMPLIDA}<span className="text-2xl font-semibold text-tierra">/{totalActividades}</span></div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Parciales</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[conteo.PARCIAL > 0 ? 'amarillo' : 'verde'] }}>{conteo.PARCIAL}</div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">No se hizo</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[conteo.NO_CUMPLIDA + conteo.REPROGRAMADA > 0 ? 'naranja' : 'verde'] }}>{conteo.NO_CUMPLIDA + conteo.REPROGRAMADA}</div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Reprogramadas</div>
          <div className="text-4xl font-extrabold">{reprogramadas}</div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Nuevas (no programadas)</div>
          <div className="text-4xl font-extrabold">{nuevas.length}</div>
        </div>
      </div>

      {/* Medidas de maquinaria: una tarjeta por tractor con las labores que hizo y su medida. */}
      {esMaquinaria && laboresTractor.size > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-tinta">🚜 Qué hizo cada tractor</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tractoresOrdenados.map((t) => (
              <div key={t || 'sin'} className="tarjeta p-4">
                <div className="mb-2 font-semibold text-tinta">🚜 {t === '' ? '— sin tractor —' : (nombreMaquina.get(t) ?? 'Tractor')}</div>
                <ul className="flex flex-col gap-1 text-sm">
                  {(laboresTractor.get(t) ?? []).map((l, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-2">
                      <span className="text-tierra">{l.descripcion}</span>
                      <span className="whitespace-nowrap font-semibold text-[#2e9e5b]">{l.total} {unidadAbreviada(l.unidad)}</span>
                    </li>
                  ))}
                </ul>
                {totalTractorTexto(t) && (
                  <div className="mt-2 border-t border-borde pt-2 text-xs text-tierra">Total: <b className="text-tinta">{totalTractorTexto(t)}</b></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {esMaquinaria && medidaActividadLista.some(([, m]) => m.valor > 0) && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-tinta">🚜 Trabajo por actividad</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {medidaActividadLista.filter(([, m]) => m.valor > 0).map(([desc, { valor, unidad }]) => (
              <div key={desc} className="tarjeta p-4">
                <div className="mb-1 text-xs text-tierra">{desc}</div>
                <div className="text-2xl font-extrabold text-[#2e9e5b]">{Math.round(valor * 10) / 10} {unidadAbreviada(unidad)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chips de conteo (visibles) */}
      <h2 className="mb-2 text-lg font-semibold text-tinta">📊 Detalle por estado</h2>
      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <span className="chip-estado chip-cumplida">✅ Cumplidas: <b>{conteo.CUMPLIDA}</b></span>
        <span className="chip-estado chip-parcial">🟡 Parciales: <b>{conteo.PARCIAL}</b></span>
        <span className="chip-estado chip-nocumplida">🔴 No se hizo: <b>{conteo.NO_CUMPLIDA + conteo.REPROGRAMADA}</b></span>
        <span className="chip-estado chip-pendiente">⏳ Pendientes: <b>{conteo.PENDIENTE}</b></span>
      </div>

      {/* Detalle: un colapsable por sección (colapsados por defecto) */}
      <div className="mb-8 space-y-2">
        {ESTADOS_ORDEN.map(({ v, etq }) => {
          const acts = actividadesUnicas.filter((a) => v.includes(a.estado))
          if (acts.length === 0) return null
          const grupos = new Map<string, { descripcion: string; lotes: string[]; maquinas: Set<string>; conteo: number }>()
          for (const a of acts) {
            const lotesNombres = a.lotes.map((l) => l.nombre).sort()
            const clave = `${a.descripcion}|${lotesNombres.join(',')}`
            const g = grupos.get(clave) ?? { descripcion: a.descripcion, lotes: lotesNombres, maquinas: new Set<string>(), conteo: 0 }
            g.conteo += 1
            for (const m of a.maquinas) g.maquinas.add(m)
            grupos.set(clave, g)
          }
          const items = [...grupos.values()]
          return (
            <details key={v.join(',')} className="tarjeta p-3">
              <summary className="cursor-pointer select-none text-sm font-semibold text-tinta">{etq} ({acts.length})</summary>
              <ul className="ml-4 mt-2 list-disc text-sm text-tierra">
                {items.map((g, i) => (
                  <li key={i}>
                    {g.descripcion}
                    {g.conteo > 1 ? ` ·×${g.conteo}` : ''}
                    {g.maquinas.size > 0 ? ` · 🚜 ${[...g.maquinas].join(', ')}` : ''}
                    {g.lotes.length > 0 ? ` · 📍 ${g.lotes.join(', ')}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )
        })}

        {esMaquinaria && (
          <details className="tarjeta p-3">
            <summary className="cursor-pointer select-none text-sm font-semibold text-tinta">🏁 Finalizadas por labor</summary>
            {laboresFinalizadas.length === 0 ? (
              <p className="mt-2 text-sm text-tierra">Sin actividades finalizadas.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {laboresFinalizadas.map((l) => (
                  <li key={l.descripcion} className="flex flex-wrap items-center gap-x-2">
                    <span className="flex-1 font-medium">{l.descripcion}</span>
                    {l.tractor && (<span className="text-tierra">🚜 {nombreMaquina.get(l.tractor.id) ?? 'Tractor'} ({l.tractor.conteo})</span>)}
                    {l.responsable && (<span className="text-tierra">👤 {nombreResp(l.responsable.id)} ({l.responsable.conteo})</span>)}
                  </li>
                ))}
              </ul>
            )}
          </details>
        )}

        <details className="tarjeta p-3">
          <summary className="cursor-pointer select-none text-sm font-semibold text-tinta">⚠️ Motivos más frecuentes</summary>
          {motivosTop.length === 0 ? (
            <p className="mt-2 text-sm text-tierra">Sin motivos registrados.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {motivosTop.map((m) => (
                <li key={m.motivoId} className="flex justify-between">
                  <span>{nombreMotivo.get(m.motivoId) ?? 'Motivo'}</span>
                  <b>{m.conteo}</b>
                </li>
              ))}
            </ul>
          )}
        </details>

        {esMaquinaria && medidaActividadLista.length > 0 && (
          <details className="tarjeta p-3">
            <summary className="cursor-pointer select-none text-sm font-semibold text-tinta">🚜 Realizado por actividad</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {medidaActividadLista.map(([desc, { valor, unidad }]) => (
                <li key={desc} className="flex justify-between rounded-lg border border-borde bg-marfil px-3 py-1">
                  <span>{desc}</span>
                  <b>{Math.round(valor * 10) / 10} {unidadAbreviada(unidad)}</b>
                </li>
              ))}
            </ul>
          </details>
        )}

        {nuevas.length > 0 && (
          <details className="tarjeta p-3">
            <summary className="cursor-pointer select-none text-sm font-semibold text-tinta">🆕 Actividades nuevas (no programadas) ({nuevas.length})</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {nuevas.map((a) => (
                <li key={a.id} className="rounded-lg border border-borde bg-marfil px-3 py-1">
                  {a.descripcion}
                  <span className="text-tierra"> · {a.responsable.nombre}</span>
                  {a.lotes.length > 0 ? (<span className="text-tierra"> · 📍 {a.lotes.map((l) => l.nombre).join(', ')}</span>) : null}
                </li>
              ))}
            </ul>
          </details>
        )}

        <details className="tarjeta p-3">
          <summary className="cursor-pointer select-none text-sm font-semibold text-tinta">🔁 Actividades recurrentes del mes ({recurrentesMes.length})</summary>
          {recurrentesMes.length === 0 ? (
            <p className="mt-2 text-sm text-tierra">Ninguna actividad recurrente este mes.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {recurrentesMes.map((r, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-borde bg-marfil p-3 text-sm">
                  <span className="flex-1">{r.descripcion}</span>
                  <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: COLOR_HEX[colorSemaforo(r.veces)] }}>×{r.veces}</span>
                </li>
              ))}
            </ul>
          )}
        </details>

        <details className="tarjeta p-3">
          <summary className="cursor-pointer select-none text-sm font-semibold text-tinta">🔄 Actividades cambiadas o reprogramadas ({cambios.length})</summary>
          {cambios.length === 0 ? (
            <p className="mt-2 text-sm text-tierra">Ninguna actividad cambió esta semana. 🎉</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {cambios.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-lg border border-borde bg-marfil p-3 text-sm">
                  <span className="flex-1">
                    {a.descripcion}
                    <span className="text-tierra"> · {a.responsable.nombre}</span>
                    {a.motivo && <span className="text-tierra"> · {a.motivo.nombre}</span>}
                    {a.nota && <span className="text-xs text-tierra">· {a.nota}</span>}
                  </span>
                  {a.vecesReprogramada > 0 && (
                    <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: COLOR_HEX[colorSemaforo(a.vecesReprogramada)] }}>
                      {a.vecesReprogramada}×
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </div>
  )
}

import { porcentajeCumplimiento, porcentajeReprogramadas, motivosFrecuentes, colorSemaforo, conteoEstadoActividades, agruparPorActividad, estadoActividad } from '@/dominio/metricas'
import {
  colorPorcentaje,
  actividadesConCambio,
  finalizadasPorLabor,
  medidasPorUnidad,
} from '@/dominio/resumen'
import type { Actividad as ActividadDominio, Estado } from '@/dominio/tipos'
import { unidadDe, unidadAbreviada, type Unidad } from '@/dominio/unidad'

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
}: {
  areaNombre: string
  semana: number
  anio: number
  esMaquinaria: boolean
  unidadPorNombre: Record<string, string>
  actividades: ActividadResumen[]
  responsables: { id: string; nombre: string }[]
  motivos: { id: string; nombre: string }[]
}) {
  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const pctRep = porcentajeReprogramadas(dominio)
  // Conteo por actividad única (agrupada por tareaId)
  const conteo = conteoEstadoActividades(dominio)
  const totalActividades = agruparPorActividad(dominio).size
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
  // Las filas-hermanas comparten lotes y haRealizada, así que NO se suman entre sí.
  const actividadesUnicas = [...agruparPorActividad(actividades).values()].map((filas) => {
    const base = filas[0]
    return {
      id: base.id,
      estado: estadoActividad(filas.map((f) => ({ estado: f.estado as Estado }))),
      descripcion: base.descripcion,
      unidad: unidadDe(unidadPorNombre, base.descripcion),
      haProgramada: haActividad(base),
      haRealizada: base.haRealizada ?? null,
      lotes: base.lotes,
      maquinas: new Set(filas.map((f) => f.maquina?.nombre).filter((n): n is string => !!n)),
      responsable: base.responsable,
      noProgramada: base.noProgramada,
    }
  })

  const nuevas = actividadesUnicas.filter((a) => a.noProgramada)

  const totales = medidasPorUnidad(
    actividadesUnicas.map((a) => ({
      estado: a.estado,
      haProgramada: a.haProgramada,
      haRealizada: a.haRealizada,
      unidad: a.unidad,
    })),
  )
  const totalUnidades = (['ha', 'hora', 'kg', 'cantidad'] as Unidad[])
    .filter((u) => totales[u] > 0)
    .map((u) => `${totales[u]} ${unidadAbreviada(u)}`)
    .join(' · ')

  // Lista "realizado por actividad": suma la medida (única) de cada actividad por descripción.
  const medidaPorActividad = new Map<string, { valor: number; unidad: Unidad }>()
  for (const a of actividadesUnicas) {
    if (a.estado === 'PENDIENTE') continue
    const realizada = a.haRealizada ?? (a.unidad === 'ha' && a.estado === 'CUMPLIDA' ? a.haProgramada : 0)
    const prev = medidaPorActividad.get(a.descripcion)
    medidaPorActividad.set(a.descripcion, {
      valor: (prev?.valor ?? 0) + realizada,
      unidad: a.unidad,
    })
  }
  const medidaActividadLista = [...medidaPorActividad.entries()].sort((a, b) => b[1].valor - a[1].valor)

  return (
    <div className="text-tinta">
      <div className="mb-4 border-b border-borde pb-2">
        <div className="text-lg font-bold text-bosque">Resumen — {areaNombre}</div>
        <div className="text-sm text-tierra">Semana {semana} · {anio}</div>
      </div>

      {/* Tarjetas grandes */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Cumplimiento</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[colorPorcentaje(pct)] }}>
            {pct === null ? '—' : `${pct}%`}
          </div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Cumplidas</div>
          <div className="text-4xl font-extrabold">
            {conteo.CUMPLIDA}<span className="text-2xl font-semibold text-tierra">/{totalActividades}</span>
          </div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Reprogramadas</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[pctRep > 0 ? 'naranja' : 'verde'] }}>{pctRep}%</div>
        </div>
        {esMaquinaria && (
          <div className="tarjeta p-5">
            <div className="mb-1 text-sm text-tierra">Realizado</div>
            <div className="text-2xl font-extrabold text-[#2e9e5b]">{totalUnidades || '—'}</div>
          </div>
        )}
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Nuevas (no programadas)</div>
          <div className="text-4xl font-extrabold">{nuevas.length}</div>
        </div>
      </div>

      {/* Detalle por estado */}
      <h2 className="mb-2 text-lg font-semibold text-tinta">📊 Detalle por estado</h2>
      <div className="mb-8 flex flex-wrap gap-3 text-sm">
        <span className="chip-estado chip-cumplida">✅ Cumplidas: <b>{conteo.CUMPLIDA}</b></span>
        <span className="chip-estado chip-parcial">🟡 Parciales: <b>{conteo.PARCIAL}</b></span>
        <span className="chip-estado chip-nocumplida">🔴 No se hizo: <b>{conteo.NO_CUMPLIDA + conteo.REPROGRAMADA}</b></span>
        <span className="chip-estado chip-pendiente">⏳ Pendientes: <b>{conteo.PENDIENTE}</b></span>
      </div>

      <div className="mb-8 space-y-3">
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
            <div key={v.join(',')}>
              <div className="text-sm font-semibold text-tinta">{etq} ({acts.length})</div>
              <ul className="ml-4 list-disc text-sm text-tierra">
                {items.map((g, i) => (
                  <li key={i}>
                    {g.descripcion}
                    {g.conteo > 1 ? ` ·×${g.conteo}` : ''}
                    {g.maquinas.size > 0 ? ` · 🚜 ${[...g.maquinas].join(', ')}` : ''}
                    {g.lotes.length > 0 ? ` · 📍 ${g.lotes.join(', ')}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Finalizadas por labor (solo maquinaria) */}
        {esMaquinaria && (
          <div className="tarjeta p-4">
            <h2 className="mb-3 text-lg font-semibold text-tinta">🏁 Finalizadas por labor</h2>
            {laboresFinalizadas.length === 0 ? (
              <p className="text-sm text-tierra">Sin actividades finalizadas.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {laboresFinalizadas.map((l) => (
                  <li key={l.descripcion} className="flex flex-wrap items-center gap-x-2">
                    <span className="flex-1 font-medium">{l.descripcion}</span>
                    {l.tractor && (
                      <span className="text-tierra">🚜 {nombreMaquina.get(l.tractor.id) ?? 'Tractor'} ({l.tractor.conteo})</span>
                    )}
                    {l.responsable && (
                      <span className="text-tierra">👤 {nombreResp(l.responsable.id)} ({l.responsable.conteo})</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Motivos */}
        <div className="tarjeta p-4">
          <h2 className="mb-3 text-lg font-semibold text-tinta">⚠️ Motivos más frecuentes</h2>
          {motivosTop.length === 0 ? (
            <p className="text-sm text-tierra">Sin motivos registrados.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {motivosTop.map((m) => (
                <li key={m.motivoId} className="flex justify-between">
                  <span>{nombreMotivo.get(m.motivoId) ?? 'Motivo'}</span>
                  <b>{m.conteo}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {esMaquinaria && medidaActividadLista.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold text-tinta">🚜 Realizado por actividad</h2>
          <ul className="space-y-1 text-sm">
            {medidaActividadLista.map(([desc, { valor, unidad }]) => (
              <li key={desc} className="flex justify-between rounded-lg border border-borde bg-marfil px-3 py-1">
                <span>{desc}</span>
                <b>{Math.round(valor * 10) / 10} {unidadAbreviada(unidad)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nuevas.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold text-tinta">🆕 Actividades nuevas (no programadas) ({nuevas.length})</h2>
          <ul className="space-y-1 text-sm">
            {nuevas.map((a) => (
              <li key={a.id} className="rounded-lg border border-borde bg-marfil px-3 py-1">
                {a.descripcion}
                <span className="text-tierra"> · {a.responsable.nombre}</span>
                {a.lotes.length > 0 ? (
                  <span className="text-tierra"> · 📍 {a.lotes.map((l) => l.nombre).join(', ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cambios / reprogramadas */}
      <h2 className="mb-2 text-lg font-semibold text-tinta">🔄 Actividades cambiadas o reprogramadas</h2>
      {cambios.length === 0 ? (
        <p className="text-sm text-tierra">Ninguna actividad cambió esta semana. 🎉</p>
      ) : (
        <ul className="space-y-2">
          {cambios.map((a) => (
            <li key={a.id} className="flex items-center gap-3 tarjeta p-3 text-sm">
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
    </div>
  )
}

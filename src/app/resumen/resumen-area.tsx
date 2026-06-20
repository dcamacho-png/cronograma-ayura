import { porcentajeCumplimiento, porcentajeReprogramadas, motivosFrecuentes, colorSemaforo } from '@/dominio/metricas'
import {
  colorPorcentaje,
  actividadesConCambio,
  extremosFinalizadas,
  conteoPorEstado,
  hectareasTrabajadasYFaltantes,
} from '@/dominio/resumen'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'

const ESTADOS_ORDEN = [
  { v: 'CUMPLIDA', etq: '✅ Cumplidas' },
  { v: 'PARCIAL', etq: '🟡 Parciales' },
  { v: 'NO_CUMPLIDA', etq: '🔴 No cumplidas' },
  { v: 'REPROGRAMADA', etq: '🔄 Reprogramadas' },
  { v: 'PENDIENTE', etq: '⏳ Pendientes' },
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
  estado: string
  descripcion: string
  vecesReprogramada: number
  haFaltante: number | null
  lotes: { nombre: string; hectareas: number | null }[]
  maquina: { nombre: string } | null
  responsable: { nombre: string }
  motivo: { nombre: string } | null
}

export function ResumenArea({
  areaNombre,
  semana,
  anio,
  esMaquinaria,
  actividades,
  responsables,
  motivos,
}: {
  areaNombre: string
  semana: number
  anio: number
  esMaquinaria: boolean
  actividades: ActividadResumen[]
  responsables: { id: string; nombre: string }[]
  motivos: { id: string; nombre: string }[]
}) {
  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const pctRep = porcentajeReprogramadas(dominio)
  const conteo = conteoPorEstado(dominio)
  const { mas, menos } = extremosFinalizadas(dominio)
  const motivosTop = motivosFrecuentes(dominio)
  const cambios = actividadesConCambio(dominio) as unknown as ActividadResumen[]

  const nombrePorId = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombreResp = (id: string) => nombrePorId.get(id) ?? 'Responsable'
  const nombreMotivo = new Map(motivos.map((m) => [m.id, m.nombre]))

  const haActividad = (a: ActividadResumen) => a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)
  const ha = hectareasTrabajadasYFaltantes(
    actividades.map((a) => ({ estado: a.estado, haProgramada: haActividad(a), haFaltante: a.haFaltante ?? 0 })),
  )

  const haPorActividad = new Map<string, number>()
  for (const a of actividades) {
    if (a.estado === 'PENDIENTE') continue
    const realizada = Math.max(0, haActividad(a) - (a.haFaltante ?? 0))
    haPorActividad.set(a.descripcion, (haPorActividad.get(a.descripcion) ?? 0) + realizada)
  }
  const haActividadLista = [...haPorActividad.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="text-gray-900">
      <div className="mb-4 border-b pb-2">
        <div className="text-lg font-bold text-[#11603a]">Resumen — {areaNombre}</div>
        <div className="text-sm text-gray-500">Semana {semana} · {anio}</div>
      </div>

      {/* Tarjetas grandes */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Cumplimiento</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[colorPorcentaje(pct)] }}>
            {pct === null ? '—' : `${pct}%`}
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Cumplidas</div>
          <div className="text-4xl font-extrabold">
            {conteo.CUMPLIDA}<span className="text-2xl font-semibold text-gray-400">/{actividades.length}</span>
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Reprogramadas</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[pctRep > 0 ? 'naranja' : 'verde'] }}>{pctRep}%</div>
        </div>
        {esMaquinaria && (
          <div className="rounded-2xl border p-5">
            <div className="mb-1 text-sm text-gray-500">Hectáreas</div>
            <div className="text-2xl font-extrabold text-[#2e9e5b]">{ha.trabajadas} ha <span className="text-sm font-medium text-gray-500">trabajadas</span></div>
            <div className="text-2xl font-extrabold text-[#e8771a]">{ha.faltantes} ha <span className="text-sm font-medium text-gray-500">faltantes</span></div>
          </div>
        )}
      </div>

      {/* Detalle por estado */}
      <h2 className="mb-2 text-lg font-semibold">📊 Detalle por estado</h2>
      <div className="mb-8 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-green-50 px-3 py-1">✅ Cumplidas: <b>{conteo.CUMPLIDA}</b></span>
        <span className="rounded-full bg-yellow-50 px-3 py-1">🟡 Parciales: <b>{conteo.PARCIAL}</b></span>
        <span className="rounded-full bg-red-50 px-3 py-1">🔴 No cumplidas: <b>{conteo.NO_CUMPLIDA}</b></span>
        <span className="rounded-full bg-blue-50 px-3 py-1">🔄 Reprogramadas: <b>{conteo.REPROGRAMADA}</b></span>
        <span className="rounded-full bg-gray-100 px-3 py-1">⏳ Pendientes: <b>{conteo.PENDIENTE}</b></span>
      </div>

      <div className="mb-8 space-y-3">
        {ESTADOS_ORDEN.map(({ v, etq }) => {
          const acts = actividades.filter((a) => a.estado === v)
          if (acts.length === 0) return null
          const grupos = new Map<string, { descripcion: string; lotes: string[]; maquinas: Set<string>; conteo: number }>()
          for (const a of acts) {
            const lotesNombres = a.lotes.map((l) => l.nombre).sort()
            const clave = `${a.descripcion}|${lotesNombres.join(',')}`
            const g = grupos.get(clave) ?? { descripcion: a.descripcion, lotes: lotesNombres, maquinas: new Set<string>(), conteo: 0 }
            g.conteo += 1
            if (a.maquina) g.maquinas.add(a.maquina.nombre)
            grupos.set(clave, g)
          }
          const items = [...grupos.values()]
          return (
            <div key={v}>
              <div className="text-sm font-semibold">{etq} ({items.length})</div>
              <ul className="ml-4 list-disc text-sm text-gray-600">
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
        {/* Ranking simple */}
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">⭐ Ranking (finalizadas)</h2>
          {mas ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>🥇</span>
                <span className="flex-1">Quien más finalizó: <b>{nombreResp(mas.responsableId)}</b></span>
                <span className="font-bold">{mas.finalizadas}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🔻</span>
                <span className="flex-1">Quien menos finalizó: <b>{menos ? nombreResp(menos.responsableId) : '—'}</b></span>
                <span className="font-bold">{menos ? menos.finalizadas : ''}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Sin actividades esta semana.</p>
          )}
        </div>

        {/* Motivos */}
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">⚠️ Motivos más frecuentes</h2>
          {motivosTop.length === 0 ? (
            <p className="text-sm text-gray-500">Sin motivos registrados.</p>
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

      {esMaquinaria && haActividadLista.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">🚜 Hectáreas realizadas por actividad</h2>
          <ul className="space-y-1 text-sm">
            {haActividadLista.map(([desc, haRealizada]) => (
              <li key={desc} className="flex justify-between rounded border px-3 py-1">
                <span>{desc}</span>
                <b>{(Math.round(haRealizada * 10) / 10)} ha</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cambios / reprogramadas */}
      <h2 className="mb-2 text-lg font-semibold">🔄 Actividades cambiadas o reprogramadas</h2>
      {cambios.length === 0 ? (
        <p className="text-sm text-gray-500">Ninguna actividad cambió esta semana. 🎉</p>
      ) : (
        <ul className="space-y-2">
          {cambios.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <span className="flex-1">
                {a.descripcion}
                <span className="text-gray-500"> · {a.responsable.nombre}</span>
                {a.motivo && <span className="text-gray-500"> · {a.motivo.nombre}</span>}
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

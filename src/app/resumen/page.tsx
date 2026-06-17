import Link from 'next/link'
import {
  listarAreas,
  listarResponsablesPorArea,
  listarActividades,
} from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual } from '@/dominio/semana'
import { porcentajeCumplimiento, porcentajeReprogramadas, rankingResponsables, colorSemaforo } from '@/dominio/metricas'
import { colorPorcentaje, actividadesConCambio } from '@/dominio/resumen'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const COLOR_HEX: Record<string, string> = {
  gris: '#9ca3af',
  verde: '#2e9e5b',
  amarillo: '#e8b400',
  naranja: '#e8771a',
  rojo: '#d63b3b',
  ninguno: 'transparent',
}

function estrellasTexto(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))
}

export default async function ResumenPage({
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
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana

  const [responsables, actividades] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarActividades(areaId, anio, semana),
  ])

  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const pctRep = porcentajeReprogramadas(dominio)
  const { top, bajos } = rankingResponsables(dominio)
  const cambios = actividadesConCambio(dominio) as unknown as typeof actividades

  const nombrePorId = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombre = (id: string) => nombrePorId.get(id) ?? 'Responsable'
  const cumplidas = dominio.filter((a) => a.estado === 'CUMPLIDA').length

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/resumen?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Resumen semanal</h1>

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

      <div className="mb-6 flex items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">
          ← Semana {previa.semana}
        </Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">
          Semana {proxima.semana} →
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Cumplimiento del área</div>
          <div className="text-5xl font-extrabold" style={{ color: COLOR_HEX[colorPorcentaje(pct)] }}>
            {pct === null ? '—' : `${pct}%`}
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Actividades cumplidas</div>
          <div className="text-5xl font-extrabold">
            {cumplidas}
            <span className="text-2xl font-semibold text-gray-400">/{actividades.length}</span>
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Reprogramadas</div>
          <div className="text-5xl font-extrabold" style={{ color: COLOR_HEX[pctRep > 0 ? 'naranja' : 'verde'] }}>
            {pctRep}%
          </div>
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">⭐ Ranking de responsables</h2>
      {top.length === 0 ? (
        <p className="mb-8 text-sm text-gray-500">Aún no hay actividades evaluadas esta semana.</p>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="mb-2 text-sm font-semibold text-[#2e9e5b]">TOP 3</div>
            <ul className="space-y-2">
              {top.map((f, i) => (
                <li key={f.responsableId} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#11603a] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium">{nombre(f.responsableId)}</span>
                  <span className="text-[#f5b50a]">{estrellasTexto(f.estrellas)}</span>
                  <span className="w-12 text-right font-bold">{f.porcentaje}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border p-4">
            <div className="mb-2 text-sm font-semibold text-[#d63b3b]">3 MÁS BAJOS</div>
            {bajos.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos suficientes.</p>
            ) : (
              <ul className="space-y-2">
                {bajos.map((f) => (
                  <li key={f.responsableId} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d63b3b] text-xs font-bold text-white">
                      ↓
                    </span>
                    <span className="flex-1 font-medium">{nombre(f.responsableId)}</span>
                    <span className="text-[#f5b50a]">{estrellasTexto(f.estrellas)}</span>
                    <span className="w-12 text-right font-bold">{f.porcentaje}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold">🔄 Actividades cambiadas o reprogramadas</h2>
      {cambios.length === 0 ? (
        <p className="text-sm text-gray-500">Ninguna actividad cambió esta semana. 🎉</p>
      ) : (
        <ul className="space-y-2">
          {cambios.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <span className="font-semibold">{DIAS[a.dia] ?? ''}</span>
              <span className="flex-1">
                {a.descripcion}
                <span className="text-gray-500"> · {a.responsable.nombre}</span>
                {a.motivo && <span className="text-gray-500"> · {a.motivo.nombre}</span>}
              </span>
              {a.vecesReprogramada > 0 && (
                <span
                  className="rounded px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: COLOR_HEX[colorSemaforo(a.vecesReprogramada)] }}
                >
                  {a.vecesReprogramada}×
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

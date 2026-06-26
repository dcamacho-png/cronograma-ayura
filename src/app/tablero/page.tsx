import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { puedeVer } from '@/auth/permisos'
import { listarAreas, listarMotivos, listarActividadesDeSemanas } from '@/datos/repositorio'
import { semanasDelMes, mesActual } from '@/dominio/semana'
import {
  porcentajeCumplimiento,
  porcentajeReprogramadas,
  cumplimientoPorArea,
  tendenciaSemanal,
  motivosFrecuentes,
} from '@/dominio/metricas'
import { colorPorcentaje } from '@/dominio/resumen'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const COLOR_HEX: Record<string, string> = {
  gris: '#9ca3af',
  verde: '#2e9e5b',
  amarillo: '#e8b400',
  naranja: '#e8771a',
  rojo: '#d63b3b',
}

export default async function TableroPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>
}) {
  const u = await usuarioActual()
  if (!u) redirect('/login')
  if (!puedeVer(u, 'tablero')) redirect('/')
  const sp = await searchParams
  const hoy = mesActual()
  const anioRaw = Number(sp.anio)
  const mesRaw = Number(sp.mes)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const mes = sp.mes && mesRaw >= 1 && mesRaw <= 12 ? mesRaw : hoy.mes

  const semanas = semanasDelMes(anio, mes)
  const [areas, motivos, actividades] = await Promise.all([
    listarAreas(),
    listarMotivos(),
    listarActividadesDeSemanas(semanas),
  ])

  const dominio = actividades as unknown as ActividadDominio[]
  const pctGeneral = porcentajeCumplimiento(dominio)
  const pctRep = porcentajeReprogramadas(dominio)
  const porArea = cumplimientoPorArea(dominio)
  const tendencia = tendenciaSemanal(dominio)
  const motivosTop = motivosFrecuentes(dominio)

  const pctPorAreaId = new Map(porArea.map((f) => [f.areaId, f.porcentaje]))
  const nombreMotivo = new Map(motivos.map((m) => [m.id, m.nombre]))
  const maxMotivo = motivosTop.reduce((m, x) => Math.max(m, x.conteo), 0)

  const previo = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
  const proximo = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
  const url = (an: number, me: number) => `/tablero?anio=${an}&mes=${me}`

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-bosque">Tablero mensual</h1>

      <div className="mb-6 flex items-center gap-3">
        <Link href={url(previo.anio, previo.mes)} className="rounded-lg border border-borde bg-marfil px-3 py-1 text-sm text-tinta">← {MESES[previo.mes]}</Link>
        <span className="font-semibold">{MESES[mes]} · {anio}</span>
        <Link href={url(proximo.anio, proximo.mes)} className="rounded-lg border border-borde bg-marfil px-3 py-1 text-sm text-tinta">{MESES[proximo.mes]} →</Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Cumplimiento general del mes</div>
          <div className="text-5xl font-extrabold" style={{ color: COLOR_HEX[colorPorcentaje(pctGeneral)] }}>
            {pctGeneral === null ? '—' : `${pctGeneral}%`}
          </div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Reprogramadas del mes</div>
          <div className="text-5xl font-extrabold" style={{ color: COLOR_HEX[pctRep > 0 ? 'naranja' : 'verde'] }}>
            {pctRep}%
          </div>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-tinta">📊 Cumplimiento por área</h2>
      <div className="mb-8 space-y-3">
        {areas.map((a) => {
          const p = pctPorAreaId.get(a.id) ?? null
          return (
            <div key={a.id} className="flex items-center gap-3">
              <div className="w-40 text-sm font-medium">{a.nombre}</div>
              <div className="h-6 flex-1 overflow-hidden rounded-lg bg-arena">
                <div
                  className="flex h-full items-center justify-end pr-2 text-xs font-bold text-white"
                  style={{ width: `${p ?? 0}%`, backgroundColor: COLOR_HEX[colorPorcentaje(p)] }}
                >
                  {p !== null && p >= 12 ? `${p}%` : ''}
                </div>
              </div>
              <div className="w-12 text-right text-sm font-semibold">{p === null ? '—' : `${p}%`}</div>
            </div>
          )
        })}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-tinta">📈 Tendencia semana a semana</h2>
      {tendencia.length === 0 ? (
        <p className="mb-8 text-sm text-tierra">No hay actividades evaluadas este mes.</p>
      ) : (
        <div className="mb-8 flex items-end gap-4 tarjeta p-4" style={{ height: '160px' }}>
          {tendencia.map((t) => (
            <div key={`${t.anio}-${t.semana}`} className="flex flex-1 flex-col items-center justify-end">
              <div className="mb-1 text-xs font-semibold">{t.porcentaje === null ? '—' : `${t.porcentaje}%`}</div>
              <div
                className="w-full rounded-t"
                style={{ height: `${t.porcentaje ?? 0}px`, backgroundColor: COLOR_HEX[colorPorcentaje(t.porcentaje)] }}
              />
              <div className="mt-1 text-xs text-tierra">S{t.semana}</div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-tinta">⚠️ Motivos más frecuentes</h2>
      {motivosTop.length === 0 ? (
        <p className="text-sm text-tierra">No se registraron motivos este mes.</p>
      ) : (
        <div className="space-y-2">
          {motivosTop.map((m) => (
            <div key={m.motivoId} className="flex items-center gap-3">
              <div className="w-40 text-sm">{nombreMotivo.get(m.motivoId) ?? 'Motivo'}</div>
              <div className="h-5 flex-1 overflow-hidden rounded-lg bg-arena">
                <div
                  className="h-full rounded-lg bg-tierra"
                  style={{ width: `${maxMotivo > 0 ? (m.conteo / maxMotivo) * 100 : 0}%` }}
                />
              </div>
              <div className="w-8 text-right text-sm font-semibold">{m.conteo}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

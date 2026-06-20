import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarMotivos, listarActividades, listarLotes, listarMaquinas, listarResponsablesPorArea } from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana } from '@/dominio/semana'
import { porcentajeCumplimiento, colorSemaforo } from '@/dominio/metricas'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'
import { registrarAccion, agregarActividadRealizadaAccion } from './acciones'
import { FormActividadRealizada } from './form-actividad-realizada'
import { InfoLotes } from '../_componentes/info-lotes'
import { FormRegistrar } from './form-registrar'

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

  const [motivos, actividades, lotes, maquinas, responsablesTodos] = await Promise.all([
    listarMotivos(),
    listarActividades(areaId, anio, semana),
    listarLotes(),
    listarMaquinas(),
    listarResponsablesPorArea(areaId),
  ])
  const responsables = responsablesTodos.filter((r) => r.activo)
  const motivoCambioId = motivos.find((m) => m.nombre === 'Cambio de actividad')?.id ?? null

  const pendientes = actividades.filter((a) => a.estado === 'PENDIENTE').length

  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const conteoEstado = {
    CUMPLIDA: actividades.filter((a) => a.estado === 'CUMPLIDA').length,
    PARCIAL: actividades.filter((a) => a.estado === 'PARCIAL').length,
    NO_CUMPLIDA: actividades.filter((a) => a.estado === 'NO_CUMPLIDA').length,
    REPROGRAMADA: actividades.filter((a) => a.estado === 'REPROGRAMADA').length,
  }

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
        <span className="ml-auto rounded bg-gray-100 px-3 py-1 text-sm">
          Cumplido: <b>{pct === null ? '—' : `${pct}%`}</b>
        </span>
        <span className="rounded bg-gray-100 px-3 py-1 text-sm">
          ✅ <b>{conteoEstado.CUMPLIDA}</b> · 🟡 <b>{conteoEstado.PARCIAL}</b> · 🔴 <b>{conteoEstado.NO_CUMPLIDA}</b> · 🔄 <b>{conteoEstado.REPROGRAMADA}</b>{' '}
          <span className="text-gray-400">de {actividades.length}</span>
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
          accion={agregarActividadRealizadaAccion}
        />
      )}

      {actividades.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay actividades en esta semana. Prográmalas en la pestaña <b>Programar</b>.
        </p>
      ) : (
        <ul className="space-y-3">
          {actividades.map((a) => (
            <li key={a.id} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="font-semibold">{DIAS[a.dia] ?? ''} {fechas[a.dia - 1] ? fmtFecha(fechas[a.dia - 1]) : ''}</span>
                <span>·</span>
                <span>{a.responsable.nombre}</span>
                {a.vecesReprogramada > 0 && (
                  <span
                    className="ml-auto rounded px-2 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: COLOR_HEX[colorSemaforo(a.vecesReprogramada)] }}
                  >
                    reprogramada {a.vecesReprogramada}×
                  </span>
                )}
              </div>
              <div className="mb-2 font-medium">{a.descripcion}</div>
              {a.maquina && <div className="mb-2 text-sm text-gray-600">🚜 {a.maquina.nombre}</div>}
              <InfoLotes lotes={a.lotes} className="mb-2" />

              {a.estado === 'PENDIENTE' ? (
                <FormRegistrar
                  actividadId={a.id}
                  esMaquinaria={esMaquinaria}
                  motivos={motivos}
                  motivoCambioId={motivoCambioId}
                  lotes={lotes}
                  maquinas={maquinas}
                  haProgramada={a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)}
                  accion={registrarAccion}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{ESTADOS.find((e) => e.valor === a.estado)?.etiqueta ?? a.estado}</span>
                  {a.motivo && <span className="text-gray-500">· {a.motivo.nombre}</span>}
                  {a.nota && <span className="text-gray-500">· {a.nota}</span>}
                  <span className="text-xs text-gray-400">🔒 registrada</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

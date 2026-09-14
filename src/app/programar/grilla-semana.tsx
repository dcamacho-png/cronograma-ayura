import { Fragment } from 'react'
import { InfoLotes } from '../_componentes/info-lotes'
import { setHorarioDiaAccion, devolverAAsignacionAccion, devolverGrillaAlBancoAccion, devolverActividadAlBancoAccion, eliminarNovedadResponsableAccion, agregarOrdenAseoAccion, quitarOrdenAseoAccion } from './acciones'
import { agruparResponsablesPorFinca, hayFincasAsignadas } from '@/dominio/responsables-finca'
import { diasCubiertos, etiquetaNovedad, type TipoNovedad } from '@/dominio/ausencias'
import { horarioComun } from '@/dominio/turno'
import { agruparOrdenAseoPorDia, type AsignacionOrdenAseo } from '@/dominio/orden-aseo'
import { FormNovedad } from './form-novedad'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const COLOR_NOVEDAD: Record<string, string> = {
  VACACIONES: 'bg-amber-100 text-amber-900',
  PERMISO: 'bg-sky-100 text-sky-900',
  CUMPLEAÑOS: 'bg-rose-100 text-rose-900',
  OTRO: 'bg-stone-100 text-stone-800',
}

type ActividadGrilla = {
  id: string
  responsableId: string
  dia: number
  descripcion: string
  turno: string
  tareaId: string | null
  maquina: { nombre: string } | null
  finca: { nombre: string } | null
  lotes: { id: string; nombre: string; hectareas: number | null }[]
  bultosPorLote?: unknown
  tarea?: { detalle: string | null } | null
}

type NovedadGrilla = {
  id: string
  responsableId: string
  tipo: TipoNovedad
  fechaInicio: Date
  fechaFin: Date
  horario: string | null
  nota: string | null
}

function fmtFecha(f: Date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)
}

export function GrillaSemana({
  areaNombre,
  anio,
  semana,
  fechas,
  responsables,
  actividades,
  novedades = [],
  turnoEditable = false,
  paraExportar = false,
  conOrdenAseo = false,
  ordenAseo = [],
  todosResponsables = [],
}: {
  areaNombre: string
  anio: number
  semana: number
  fechas: Date[]
  responsables: { id: string; nombre: string; finca: { nombre: string } | null }[]
  actividades: ActividadGrilla[]
  novedades?: NovedadGrilla[]
  turnoEditable?: boolean
  paraExportar?: boolean
  conOrdenAseo?: boolean
  ordenAseo?: AsignacionOrdenAseo[]
  todosResponsables?: { id: string; nombre: string; areaNombre: string }[]
}) {
  const rango = fechas.length === 7 ? `${fmtFecha(fechas[0])} – ${fmtFecha(fechas[6])}` : ''
  // En modo export nunca hay controles interactivos (turno como texto, sin "Devolver a asignar").
  const editable = turnoEditable && !paraExportar
  // Fila de cabezado reutilizable: va en <thead> y, al exportar agrupado, se repite al inicio de cada finca.
  const filaCabezado = (clave: string) => (
    <tr key={clave}>
      <th className="border border-borde bg-arena p-2 text-left">Responsable</th>
      {DIAS.map((d, i) => (
        <th key={d} className="border border-borde bg-arena p-2 text-left">
          {d}
          <div className={`font-normal text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>{fechas[i] ? fmtFecha(fechas[i]) : ''}</div>
        </th>
      ))}
    </tr>
  )
  const filaResponsable = (r: { id: string; nombre: string }) => (
    <tr key={r.id}>
      <td className="border border-borde p-2 align-top font-medium">
        <div>{r.nombre}</div>
        {/* La novedad se pinta SOLO en las casillas de los días que cubre (abajo). Acá salía
            además junto al nombre, donde se leía como si el trabajador estuviera ausente toda
            la semana. El ✕ para quitarla vive ahora en el primer día que cubre. */}
        {editable && <FormNovedad responsableId={r.id} anio={anio} semana={semana} />}
      </td>
      {DIAS.map((_, i) => {
        const dia = i + 1
        const celdas = actividades.filter((a) => a.responsableId === r.id && a.dia === dia)
        return (
          <td key={dia} className="border border-borde p-2 align-top">
            {celdas.map((a) => (
              <div key={a.id} className="mb-1 rounded-lg bg-green-50 p-1">
                <div>{a.descripcion}</div>
                {/* El horario ya NO se edita por actividad: es del día del trabajador y vive
                    al pie de esta casilla (una persona no trabaja en dos franjas a la vez). */}
                {a.maquina && <div className={`text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>🚜 {a.maquina.nombre}</div>}
                {a.finca && <div className={`text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>🏠 {a.finca.nombre}</div>}
                {a.tarea?.detalle && <div className={`whitespace-pre-line text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>📝 {a.tarea.detalle}</div>}
                <InfoLotes lotes={a.lotes} bultosPorLote={a.bultosPorLote as Record<string, number> | null} className="mt-1" tamano={paraExportar ? 'text-sm' : 'text-xs'} />
                {editable && a.tareaId && (
                  <>
                    <form action={devolverAAsignacionAccion} className="mt-0.5">
                      <input type="hidden" name="tareaId" value={a.tareaId} />
                      <input type="hidden" name="anio" value={anio} />
                      <input type="hidden" name="semana" value={semana} />
                      <button type="submit" className="text-xs text-amber-700 hover:underline">↩️ Devolver a asignar</button>
                    </form>
                    <form action={devolverGrillaAlBancoAccion} className="mt-0.5">
                      <input type="hidden" name="tareaId" value={a.tareaId} />
                      <input type="hidden" name="anio" value={anio} />
                      <input type="hidden" name="semana" value={semana} />
                      <button type="submit" className="text-xs text-tierra hover:underline">↩️ Devolver al banco</button>
                    </form>
                  </>
                )}
                {editable && !a.tareaId && (
                  <form action={devolverActividadAlBancoAccion} className="mt-0.5">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="anio" value={anio} />
                    <input type="hidden" name="semana" value={semana} />
                    <button type="submit" className="text-xs text-tierra hover:underline">↩️ Devolver al banco</button>
                  </form>
                )}
              </div>
            ))}
            {/* Horario del día de ESTE trabajador: una franja para todo lo que haga ese día,
                en todas las áreas. Va en píldora terracota para que resalte contra el verde
                de las actividades y se lea de un vistazo en la grilla impresa. */}
            {celdas.length > 0 && (() => {
              const horario = horarioComun(celdas.map((c) => c.turno))
              return editable ? (
                <form
                  action={setHorarioDiaAccion}
                  className="mt-1 flex items-center gap-1 rounded-full border border-arcilla/50 bg-arena px-2 py-0.5"
                >
                  <input type="hidden" name="responsableId" value={r.id} />
                  <input type="hidden" name="anio" value={anio} />
                  <input type="hidden" name="semana" value={semana} />
                  <input type="hidden" name="dia" value={dia} />
                  <span className="text-xs" aria-hidden="true">🕐</span>
                  <input
                    aria-label={`Horario ${DIAS[i]}`}
                    name="turno"
                    defaultValue={horario}
                    placeholder="7am-12pm"
                    className="w-20 bg-transparent text-xs font-bold text-arcilla placeholder:font-normal placeholder:text-tierra focus:outline-none"
                  />
                  <button type="submit" aria-label="Guardar horario" className="text-xs font-bold text-arcilla hover:underline">✓</button>
                </form>
              ) : (
                horario && (
                  <div
                    className={`mt-1 inline-flex items-center gap-1 rounded-full border border-arcilla/50 bg-arena px-2 py-0.5 font-bold text-arcilla ${paraExportar ? 'text-sm' : 'text-xs'}`}
                  >
                    🕐 {horario}
                  </div>
                )
              )
            })()}
            {novedades
              .filter((n) => n.responsableId === r.id)
              .map((n) => ({ n, cubiertos: diasCubiertos(n, fechas) }))
              .filter(({ cubiertos }) => cubiertos.includes(dia))
              .map(({ n, cubiertos }) => (
                <div
                  key={n.id}
                  title={`${fmtFecha(n.fechaInicio)}–${fmtFecha(n.fechaFin)}${n.nota ? ` · ${n.nota}` : ''}`}
                  className={`mb-1 flex items-center gap-1 rounded-lg p-1 ${paraExportar ? 'text-sm' : 'text-xs'} ${COLOR_NOVEDAD[n.tipo] ?? COLOR_NOVEDAD.OTRO}`}
                >
                  <span>
                    {etiquetaNovedad(n.tipo).emoji} {etiquetaNovedad(n.tipo).label}
                    {n.tipo === 'PERMISO' && n.horario ? ` · ${n.horario}` : ''}
                    {(n.tipo === 'OTRO' || n.tipo === 'CUMPLEAÑOS') && n.nota ? ` · ${n.nota}` : ''}
                  </span>
                  {/* El ✕ va una sola vez por novedad: en el primer día que cubre en esta
                      semana. Borra la novedad entera, no ese día suelto. */}
                  {editable && cubiertos[0] === dia && (
                    <form action={eliminarNovedadResponsableAccion} className="ml-auto">
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="anio" value={anio} />
                      <input type="hidden" name="semana" value={semana} />
                      <button type="submit" aria-label="Quitar novedad" title="Quitar novedad" className="text-red-600 hover:underline">✕</button>
                    </form>
                  )}
                </div>
              ))}
          </td>
        )
      })}
    </tr>
  )
  const grupos = agruparResponsablesPorFinca(responsables)
  const agrupar = hayFincasAsignadas(grupos)
  const filaFinca = (nombre: string | null) => (
    <tr key={`finca-${nombre ?? '__sin__'}`}>
      <td colSpan={8} className={`border border-borde bg-arena/60 p-2 font-semibold text-bosque ${paraExportar ? 'text-lg' : ''}`}>
        🏠 {nombre ?? 'Sin finca'}
      </td>
    </tr>
  )
  const diasOrdenAseo = agruparOrdenAseoPorDia(ordenAseo)
  const filaOrdenAseo = (
    <tr key="orden-aseo" className="border-t-2 border-borde">
      <td className={`border border-borde bg-arena p-2 align-top font-semibold text-bosque ${paraExportar ? 'text-lg' : ''}`}>
        🧹 Orden y aseo
      </td>
      {diasOrdenAseo.map((d) => (
        <td key={d.dia} className="border border-borde p-2 align-top">
          <div className="flex flex-wrap gap-1">
            {d.encargados.map((e) => (
              <span
                key={e.responsableId}
                className={`inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 ${paraExportar ? 'text-sm' : 'text-xs'}`}
              >
                {e.nombre}
                {editable && (
                  <form action={quitarOrdenAseoAccion} className="inline">
                    <input type="hidden" name="anio" value={anio} />
                    <input type="hidden" name="semana" value={semana} />
                    <input type="hidden" name="dia" value={d.dia} />
                    <input type="hidden" name="responsableId" value={e.responsableId} />
                    <button type="submit" aria-label={`Quitar a ${e.nombre}`} className="text-red-600 hover:underline">✕</button>
                  </form>
                )}
              </span>
            ))}
          </div>
          {editable && (
            <form action={agregarOrdenAseoAccion} className="mt-1 flex items-center gap-1">
              <input type="hidden" name="anio" value={anio} />
              <input type="hidden" name="semana" value={semana} />
              <input type="hidden" name="dia" value={d.dia} />
              <select
                name="responsableId"
                defaultValue=""
                aria-label={`Agregar encargado día ${d.dia}`}
                className="w-full rounded-lg border border-borde bg-marfil p-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-bosque/40"
              >
                <option value="" disabled>+ agregar…</option>
                {todosResponsables.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre} — {r.areaNombre}</option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-bosque px-1.5 text-xs font-semibold text-white">➕</button>
            </form>
          )}
        </td>
      ))}
    </tr>
  )
  return (
    <div className="rounded-xl border border-borde bg-white text-tinta">
      <div className="border-b border-borde p-3">
        <div className={`font-bold text-bosque ${paraExportar ? 'text-xl' : 'text-lg'}`}>{areaNombre}</div>
        <div className={paraExportar ? 'text-base text-black' : 'text-sm text-tierra'}>Semana {semana}{rango ? ` · ${rango}` : ''}</div>
      </div>
      {responsables.length === 0 && !conOrdenAseo ? (
        <p className="p-4 text-center text-sm italic text-tierra">Sin actividades programadas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse ${paraExportar ? 'text-lg text-black' : 'text-sm'}`}>
            <thead>{filaCabezado('head')}</thead>
            <tbody>
              {agrupar
                ? grupos.map((g, gi) => (
                    <Fragment key={`g-${g.finca ?? '__sin__'}`}>
                      {paraExportar && gi > 0 && filaCabezado(`head-${g.finca ?? '__sin__'}`)}
                      {filaFinca(g.finca)}
                      {g.responsables.map((r) => filaResponsable(r))}
                    </Fragment>
                  ))
                : responsables.map((r) => filaResponsable(r))}
              {conOrdenAseo && filaOrdenAseo}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

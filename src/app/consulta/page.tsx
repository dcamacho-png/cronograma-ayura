import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { puedeVer } from '@/auth/permisos'
import { listarAreas, listarActividadesEstipuladas, listarMaquinas, listarResponsablesTodos, consultarCulminadas } from '@/datos/repositorio'
import { fechasDeSemana } from '@/dominio/semana'
import { agruparPorActividad, estadoActividad } from '@/dominio/metricas'
import { COLUMNAS_CUMPLIMIENTO, filasCumplimientoGrupo, type ActividadExport } from '@/dominio/cumplimiento-export'
import type { Estado } from '@/dominio/tipos'
import type { AvanceEntrada } from '@/dominio/avance-lote'
import type { BultosPorLote } from '@/dominio/bultos'
import { FiltrosConsulta } from './filtros-consulta'

const ESTADO_IDX = COLUMNAS_CUMPLIMIENTO.indexOf('Estado')

export default async function ConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; responsable?: string; finca?: string; centro?: string; lote?: string }>
}) {
  const sp = await searchParams
  const areas = await listarAreas()
  if (areas.length === 0) {
    return (<main className="p-8"><p className="text-tierra">No hay áreas.</p></main>)
  }
  const u = await usuarioActual()
  if (!u) redirect('/login')
  if (!puedeVer(u, 'consulta')) redirect('/')
  const esAdmin = u.rol === 'ADMIN'
  const areaId = esAdmin
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
  const areaActual = areas.find((a) => a.id === areaId)!

  const [resultados, estipuladas, maquinas, responsablesTodos] = await Promise.all([
    consultarCulminadas(areaId),
    listarActividadesEstipuladas(),
    listarMaquinas(),
    listarResponsablesTodos(),
  ])

  const nombrePorMaquina = new Map(maquinas.map((m) => [m.id, m.nombre]))
  const nombreMaquina = (id: string | null) => (id ? nombrePorMaquina.get(id) ?? '' : '')
  const nombrePorResponsable = new Map(responsablesTodos.map((r) => [r.id, r.nombre]))
  const nombreResponsable = (id: string | null) => (id ? nombrePorResponsable.get(id) ?? '' : '')
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
  const fmtFecha = (f: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  const fResp = sp.responsable || ''
  const fFinca = sp.finca || ''
  const fCentro = sp.centro || ''
  const fLote = sp.lote || ''

  type Fila = (typeof resultados)[number]
  const aExport = (a: Fila): ActividadExport => ({
    ...a,
    bultosPorLote: a.bultosPorLote as BultosPorLote | null,
    lotesHechos: a.lotesHechos as string[] | null,
    avancePorLote: a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
    detalle: a.tarea?.detalle ?? null,
  })

  const pasaFiltros = (grupo: Fila[]) =>
    (!fResp || grupo.some((a) => a.responsableId === fResp)) &&
    (!fFinca || grupo[0].fincaId === fFinca) &&
    (!fCentro || grupo.some((a) => a.centroCosto === fCentro)) &&
    (!fLote || grupo[0].lotes.some((l) => l.id === fLote))

  const filas: (string | number)[][] = []
  const agregar = (items: Fila[], ejecutadaPor: (grupo: Fila[]) => string) => {
    // Agrupar por (semana, actividad): primero se separa por semana para no mezclar
    // filas-hermanas de un mismo tareaId entre semanas distintas.
    const porSemana = new Map<string, Fila[]>()
    for (const a of items) {
      const k = `${a.anio}-${a.semana}`
      const arr = porSemana.get(k)
      if (arr) arr.push(a)
      else porSemana.set(k, [a])
    }
    for (const semItems of porSemana.values()) {
      for (const grupo of agruparPorActividad(semItems).values()) {
        // Culminadas: la actividad cumplida, o cerrada como Parcial por el área ejecutora.
        const est = estadoActividad(grupo.map((a) => ({ estado: a.estado as Estado })))
        if (est !== 'CUMPLIDA' && !grupo.some((a) => a.cerrada)) continue
        if (!pasaFiltros(grupo)) continue
        const base = grupo[0]
        const fechas = fechasDeSemana(base.anio, base.semana)
        const fechaDeDia = (dia: number) => { const f = fechas[dia - 1]; return f ? fmtFecha(f) : '' }
        const grupoFilas = filasCumplimientoGrupo(
          grupo.map(aExport),
          fechaDeDia(base.dia),
          unidadPorNombre,
          { fechaDeDia, nombreMaquina, nombreResponsable },
          ejecutadaPor(grupo),
        )
        for (const fila of grupoFilas) {
          filas.push([`${base.anio}-S${base.semana}`, ...fila.filter((_, i) => i !== ESTADO_IDX)])
        }
      }
    }
  }
  agregar(resultados.filter((a) => a.areaId === areaId), () => '')
  agregar(resultados.filter((a) => a.areaId !== areaId), (grupo) => grupo[0].area?.nombre ?? '')

  const headers = ['Semana', ...COLUMNAS_CUMPLIMIENTO.filter((_, i) => i !== ESTADO_IDX)]

  // Opciones de filtros derivadas de los datos (solo valores presentes).
  const dedupe = <T extends { id: string; nombre: string }>(xs: T[]) =>
    [...new Map(xs.map((x) => [x.id, { id: x.id, nombre: x.nombre }])).values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  const responsables = dedupe(resultados.map((a) => a.responsable))
  const fincas = dedupe(resultados.map((a) => a.finca).filter((f): f is NonNullable<typeof f> => !!f))
  const lotes = dedupe(resultados.flatMap((a) => a.lotes))
  const centros = [...new Set(resultados.map((a) => a.centroCosto).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b))

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-bosque">🔎 Consulta de culminadas</h1>

      {esAdmin ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {areas.map((a) => (
            <Link key={a.id} href={`/consulta?area=${a.id}`} className={`rounded-full px-3 py-1 text-sm ${a.id === areaId ? 'bg-bosque text-white' : 'bg-arena text-tierra'}`}>
              {a.nombre}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-3 text-sm text-tierra">Área: <b className="text-tinta">{areaActual.nombre}</b></div>
      )}

      <FiltrosConsulta
        areaId={areaId}
        responsables={responsables}
        fincas={fincas}
        lotes={lotes}
        centros={centros}
        sel={{ responsable: fResp, finca: fFinca, centro: fCentro, lote: fLote }}
      />

      {filas.length === 0 ? (
        <p className="mt-4 text-sm text-tierra">No hay actividades culminadas con esos filtros.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-tierra">
                {headers.map((h) => (<th key={h} scope="col" className="p-2 whitespace-nowrap">{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i} className="border-b border-borde/60 align-top">
                  {fila.map((c, j) => (<td key={j} className="p-2">{c === '' ? '—' : c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

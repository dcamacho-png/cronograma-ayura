import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { puedeVer } from '@/auth/permisos'
import { listarAreas, listarResponsablesPorArea, listarFincas, listarLotes, consultarCulminadas } from '@/datos/repositorio'
import { normalizarAvancePorLote, type AvanceEntrada } from '@/dominio/avance-lote'
import { FiltrosConsulta } from './filtros-consulta'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

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

  const filtros = {
    responsableId: sp.responsable || null,
    fincaId: sp.finca || null,
    centroCosto: sp.centro || null,
    loteId: sp.lote || null,
  }
  const [responsables, fincas, lotes, resultados, todasDelArea] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarFincas(),
    listarLotes(),
    consultarCulminadas(areaId, filtros),
    consultarCulminadas(areaId, {}),
  ])
  const centros = [...new Set(todasDelArea.map((a) => a.centroCosto).filter((c): c is string => !!c))].sort()

  const potrerosConMedida = (a: (typeof resultados)[number]) => {
    const av = normalizarAvancePorLote(a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null)
    return a.lotes.map((l) => {
      const total = (av[l.id] ?? []).reduce((s, e) => s + e.cantidad, 0)
      return total > 0 ? `${l.nombre}: ${total}` : l.nombre
    })
  }

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
        sel={{ responsable: filtros.responsableId ?? '', finca: filtros.fincaId ?? '', centro: filtros.centroCosto ?? '', lote: filtros.loteId ?? '' }}
      />

      {resultados.length === 0 ? (
        <p className="mt-4 text-sm text-tierra">No hay actividades culminadas con esos filtros.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-tierra">
                <th className="p-2">Semana</th>
                <th className="p-2">Día</th>
                <th className="p-2">Descripción</th>
                <th className="p-2">Responsable</th>
                <th className="p-2">Área ejec.</th>
                <th className="p-2">Finca</th>
                <th className="p-2">Potreros (medida)</th>
                <th className="p-2">Medida total</th>
                <th className="p-2">Centro de costo</th>
                <th className="p-2">Máquina</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((a) => {
                const ejecutadaPorOtra = a.tarea?.solicitadaPorAreaId === areaId && a.areaId !== areaId
                const potreros = potrerosConMedida(a)
                return (
                  <tr key={a.id} className="border-b border-borde/60 align-top">
                    <td className="p-2 whitespace-nowrap">{a.anio}-S{a.semana}</td>
                    <td className="p-2">{DIAS[a.dia] ?? a.dia}</td>
                    <td className="p-2">{a.descripcion}</td>
                    <td className="p-2">{a.responsable?.nombre ?? '—'}</td>
                    <td className="p-2">{ejecutadaPorOtra ? (a.area?.nombre ?? '—') : '—'}</td>
                    <td className="p-2">{a.finca?.nombre ?? '—'}</td>
                    <td className="p-2">{potreros.length > 0 ? potreros.join(', ') : '—'}</td>
                    <td className="p-2 whitespace-nowrap">{a.haRealizada != null ? `${a.haRealizada} ${a.unidadRealizada ?? ''}`.trim() : '—'}</td>
                    <td className="p-2">{a.centroCosto ?? '—'}</td>
                    <td className="p-2">{a.maquina?.nombre ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

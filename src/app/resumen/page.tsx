import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarResponsablesPorArea, listarMotivos, listarActividades, listarActividadesEstipuladas } from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual } from '@/dominio/semana'
import { ResumenArea } from './resumen-area'

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

  const [responsables, motivos, actividades, estipuladas] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarMotivos(),
    listarActividades(areaId, anio, semana),
    listarActividadesEstipuladas(),
  ])
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/resumen?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Resumen semanal</h1>

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

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">← Semana {previa.semana}</Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">Semana {proxima.semana} →</Link>
        <a
          href={`/resumen/exportar?area=${areaId}&anio=${anio}&semana=${semana}`}
          target="_blank"
          rel="noopener"
          className="rounded border border-purple-700 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-50"
        >
          🖨️ Exportar PDF
        </a>
        {esAdmin && (
          <a
            href={`/resumen/exportar?todas=1&anio=${anio}&semana=${semana}`}
            target="_blank"
            rel="noopener"
            className="rounded border border-purple-700 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-50"
          >
            🖨️ Exportar PDF (todas las áreas)
          </a>
        )}
      </div>

      <ResumenArea
        areaNombre={areaActual.nombre}
        semana={semana}
        anio={anio}
        esMaquinaria={esMaquinaria}
        unidadPorNombre={unidadPorNombre}
        actividades={actividades}
        responsables={responsables}
        motivos={motivos}
      />
    </main>
  )
}

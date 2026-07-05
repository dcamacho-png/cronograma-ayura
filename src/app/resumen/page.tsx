import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { puedeVer, esSoloLectura } from '@/auth/permisos'
import { listarAreas, listarResponsablesPorArea, listarMotivos, listarActividades, listarActividadesDeSemanas, listarActividadesEstipuladas } from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana, semanasDelMes } from '@/dominio/semana'
import { esMaquinaria as esMaquinariaVar } from '@/dominio/variante'
import { ResumenArea } from './resumen-area'
import { actividadesRecurrentes } from '@/dominio/resumen'

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
        <p className="text-tierra">No hay áreas. Corre <code>npm run db:seed</code>.</p>
      </main>
    )
  }

  const u = await usuarioActual()
  if (!u) redirect('/login')
  if (!puedeVer(u, 'resumen')) redirect('/')
  const esAdmin = u.rol === 'ADMIN'
  const verTodas = esAdmin || esSoloLectura(u)

  const areaId = verTodas
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
  const areaActual = areas.find((a) => a.id === areaId)!
  const esMaquinaria = esMaquinariaVar(areaActual, 'resumen')
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana

  // Mes de la semana seleccionada (por el jueves ISO), para la escala mensual de recurrentes.
  const jueves = fechasDeSemana(anio, semana)[3]
  const semanasMes = semanasDelMes(jueves.getUTCFullYear(), jueves.getUTCMonth() + 1)

  const [responsables, motivos, actividades, estipuladas, actividadesMes] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarMotivos(),
    listarActividades(areaId, anio, semana),
    listarActividadesEstipuladas(),
    listarActividadesDeSemanas(semanasMes),
  ])
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
  const recurrentesMes = actividadesRecurrentes(
    actividadesMes
      .filter((a) => a.areaId === areaId)
      .map((a) => ({ descripcion: a.descripcion, areaNombre: areaActual.nombre, vecesReprogramada: a.vecesReprogramada })),
  )

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/resumen?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-bosque">Resumen semanal</h1>

      {verTodas ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {areas.map((a) => (
            <Link
              key={a.id}
              href={url(a.id, anio, semana)}
              className={`rounded-full px-3 py-1 text-sm ${a.id === areaId ? 'bg-bosque text-white' : 'bg-arena text-tierra'}`}
            >
              {a.nombre}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-3 text-sm text-tierra">Área: <b className="text-tinta">{areaActual.nombre}</b></div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded-lg border border-borde bg-marfil px-3 py-1 text-sm text-tinta">← Semana {previa.semana}</Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded-lg border border-borde bg-marfil px-3 py-1 text-sm text-tinta">Semana {proxima.semana} →</Link>
        <a
          href={`/resumen/exportar?area=${areaId}&anio=${anio}&semana=${semana}`}
          target="_blank"
          rel="noopener"
          className="rounded-lg border border-arcilla px-3 py-1 text-sm font-semibold text-arcilla hover:bg-arena/40"
        >
          🖨️ Exportar PDF
        </a>
        {esAdmin && (
          <a
            href={`/resumen/exportar?todas=1&anio=${anio}&semana=${semana}`}
            target="_blank"
            rel="noopener"
            className="rounded-lg border border-arcilla px-3 py-1 text-sm font-semibold text-arcilla hover:bg-arena/40"
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
        recurrentesMes={recurrentesMes}
      />
    </main>
  )
}

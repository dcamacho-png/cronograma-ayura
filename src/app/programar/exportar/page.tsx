import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarResponsablesPorArea, listarActividades } from '@/datos/repositorio'
import { semanaActual, fechasDeSemana } from '@/dominio/semana'
import { GrillaSemana } from '../grilla-semana'
import { AutoImprimir } from './auto-imprimir'

export default async function ExportarPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; semana?: string }>
}) {
  const u = await usuarioActual()
  if (!u || u.rol !== 'ADMIN') redirect('/programar')

  const sp = await searchParams
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana
  const fechas = fechasDeSemana(anio, semana)

  const areas = await listarAreas()
  const datos = await Promise.all(
    areas.map(async (a) => ({
      area: a,
      responsables: await listarResponsablesPorArea(a.id),
      actividades: await listarActividades(a.id, anio, semana),
    })),
  )

  return (
    <main className="mx-auto max-w-6xl p-6">
      <AutoImprimir />
      <h1 className="mb-4 text-2xl font-bold text-[#11603a] print:hidden">
        Exportar cronogramas — Semana {semana}
      </h1>
      <div className="space-y-8">
        {datos.map(({ area, responsables, actividades }, i) => (
          <div key={area.id} style={i < datos.length - 1 ? { breakAfter: 'page' } : undefined}>
            <GrillaSemana
              areaNombre={area.nombre}
              semana={semana}
              fechas={fechas}
              responsables={responsables}
              actividades={actividades}
            />
          </div>
        ))}
      </div>
    </main>
  )
}

import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarResponsablesPorArea, listarMotivos, listarActividades, listarActividadesEstipuladas } from '@/datos/repositorio'
import { semanaActual } from '@/dominio/semana'
import { ResumenArea } from '../resumen-area'
import { AutoImprimir } from '../../_componentes/auto-imprimir'

export default async function ExportarResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; anio?: string; semana?: string; todas?: string }>
}) {
  const u = await usuarioActual()
  if (!u) redirect('/login')

  const sp = await searchParams
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana

  const areas = await listarAreas()
  const estipuladas = await listarActividadesEstipuladas()
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
  const esMaquinaria = (nombre: string) => nombre.toLowerCase().includes('maquinaria')

  // Modo "todas las áreas": solo ADMIN.
  if (sp.todas === '1') {
    if (u.rol !== 'ADMIN') redirect('/resumen')
    const datos = await Promise.all(
      areas.map(async (a) => ({
        area: a,
        responsables: await listarResponsablesPorArea(a.id),
        motivos: await listarMotivos(),
        actividades: await listarActividades(a.id, anio, semana),
      })),
    )
    return (
      <main className="mx-auto max-w-6xl p-6">
        <AutoImprimir />
        <h1 className="mb-4 text-2xl font-bold text-[#11603a] print:hidden">Resumen — todas las áreas · Semana {semana}</h1>
        <div className="space-y-8">
          {datos.map(({ area, responsables, motivos, actividades }, i) => (
            <div key={area.id} style={i < datos.length - 1 ? { breakAfter: 'page' } : undefined}>
              <ResumenArea
                areaNombre={area.nombre}
                semana={semana}
                anio={anio}
                esMaquinaria={esMaquinaria(area.nombre)}
                unidadPorNombre={unidadPorNombre}
                actividades={actividades}
                responsables={responsables}
                motivos={motivos}
              />
            </div>
          ))}
        </div>
      </main>
    )
  }

  // Modo un área: ADMIN cualquier área válida; usuario de área queda forzado a la suya.
  const areaId = u.rol === 'ADMIN'
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0]?.id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0]?.id)
  const area = areas.find((a) => a.id === areaId)
  if (!area) redirect('/resumen')

  const [responsables, motivos, actividades] = await Promise.all([
    listarResponsablesPorArea(area.id),
    listarMotivos(),
    listarActividades(area.id, anio, semana),
  ])

  return (
    <main className="mx-auto max-w-6xl p-6">
      <AutoImprimir />
      <ResumenArea
        areaNombre={area.nombre}
        semana={semana}
        anio={anio}
        esMaquinaria={esMaquinaria(area.nombre)}
        unidadPorNombre={unidadPorNombre}
        actividades={actividades}
        responsables={responsables}
        motivos={motivos}
      />
    </main>
  )
}

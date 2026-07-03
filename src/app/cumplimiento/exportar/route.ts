import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarActividades, listarActividadesSolicitadas, listarActividadesEstipuladas, listarMaquinas } from '@/datos/repositorio'
import { fechasDeSemana } from '@/dominio/semana'
import { COLUMNAS_CUMPLIMIENTO, filasCumplimientoGrupo } from '@/dominio/cumplimiento-export'
import { agruparPorActividad, estadoActividad } from '@/dominio/metricas'
import type { Estado } from '@/dominio/tipos'
import type { AvanceEntrada } from '@/dominio/avance-lote'
import type { BultosPorLote } from '@/dominio/bultos'

// exceljs necesita runtime Node (no edge).
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const u = await usuarioActual()
  if (!u) return NextResponse.redirect(new URL('/login', req.url))

  const sp = req.nextUrl.searchParams
  const areas = await listarAreas()
  const esAdmin = u.rol === 'ADMIN'
  const areaParam = sp.get('area')
  const areaId = esAdmin
    ? (areaParam && areas.some((a) => a.id === areaParam) ? areaParam : areas[0]?.id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0]?.id)
  const area = areas.find((a) => a.id === areaId)
  if (!area) return new NextResponse('Área no encontrada', { status: 404 })

  const anio = Number(sp.get('anio'))
  const semana = Number(sp.get('semana'))
  if (!Number.isInteger(anio) || !Number.isInteger(semana)) {
    return new NextResponse('Parámetros inválidos', { status: 400 })
  }

  const [actividades, solicitadas, estipuladas, maquinas] = await Promise.all([
    listarActividades(area.id, anio, semana),
    listarActividadesSolicitadas(area.id, anio, semana),
    listarActividadesEstipuladas(),
    listarMaquinas(),
  ])
  const nombrePorMaquina = new Map(maquinas.map((m) => [m.id, m.nombre]))
  const nombreMaquina = (id: string | null) => (id ? nombrePorMaquina.get(id) ?? '' : '')
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
  const fechas = fechasDeSemana(anio, semana)
  const fmtFecha = (f: Date) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Cumplimiento')
  const header = ws.addRow([...COLUMNAS_CUMPLIMIENTO])
  header.font = { bold: true }
  const fechaDeDia = (dia: number) => (fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : '')

  // Una actividad es UNA sola aunque tenga varios responsables/días (filas hermanas con
  // el mismo tareaId). Agrupamos por actividad y emitimos una fila representativa; el
  // estado de la actividad es CUMPLIDA/PARCIAL si el grupo lo es.
  const aExport = (a: (typeof actividades)[number] | (typeof solicitadas)[number]) => ({
    ...a,
    bultosPorLote: a.bultosPorLote as BultosPorLote | null,
    lotesHechos: a.lotesHechos as string[] | null,
    avancePorLote: a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
  })
  const agregarGrupos = (
    items: ((typeof actividades)[number] | (typeof solicitadas)[number])[],
    ejecutadaPor: (grupo: typeof items) => string,
  ) => {
    for (const grupo of agruparPorActividad(items).values()) {
      const e = estadoActividad(grupo.map((a) => ({ estado: a.estado as Estado })))
      if (e !== 'CUMPLIDA' && e !== 'PARCIAL') continue // solo lo que se hizo
      for (const fila of filasCumplimientoGrupo(
        grupo.map(aExport),
        fechaDeDia(grupo[0].dia),
        unidadPorNombre,
        { fechaDeDia, nombreMaquina },
        ejecutadaPor(grupo),
      )) {
        ws.addRow(fila)
      }
    }
  }

  // Actividades propias del área.
  agregarGrupos(actividades, () => '')
  // Actividades que esta área solicitó a otra (ejecutadas por la otra área).
  agregarGrupos(solicitadas, (grupo) => (grupo[0] as (typeof solicitadas)[number]).area.nombre)

  const buffer = await wb.xlsx.writeBuffer()
  const safe = area.nombre.replace(/[^\p{L}\p{N}]+/gu, '-')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cumplimiento-${safe}-S${semana}-${anio}.xlsx"`,
    },
  })
}

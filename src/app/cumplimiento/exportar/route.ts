import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarActividades, listarActividadesEstipuladas, listarMaquinas } from '@/datos/repositorio'
import { fechasDeSemana } from '@/dominio/semana'
import { COLUMNAS_CUMPLIMIENTO, filasCumplimiento } from '@/dominio/cumplimiento-export'
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

  const [actividades, estipuladas, maquinas] = await Promise.all([
    listarActividades(area.id, anio, semana),
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

  // Solo actividades cumplidas o parciales.
  const filas = actividades.filter((a) => a.estado === 'CUMPLIDA' || a.estado === 'PARCIAL')
  for (const a of filas) {
    const fecha = fechaDeDia(a.dia)
    for (const fila of filasCumplimiento(
      {
        ...a,
        bultosPorLote: a.bultosPorLote as BultosPorLote | null,
        lotesHechos: a.lotesHechos as string[] | null,
        avancePorLote: a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
      },
      fecha,
      unidadPorNombre,
      { fechaDeDia, nombreMaquina },
    )) {
      ws.addRow(fila)
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const safe = area.nombre.replace(/[^\p{L}\p{N}]+/gu, '-')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cumplimiento-${safe}-S${semana}-${anio}.xlsx"`,
    },
  })
}

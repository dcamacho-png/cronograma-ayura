import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarActividades, listarActividadesEstipuladas } from '@/datos/repositorio'
import { fechasDeSemana } from '@/dominio/semana'
import { COLUMNAS_CUMPLIMIENTO, filaCumplimiento } from '@/dominio/cumplimiento-export'
import { textoAvanceConFecha, type AvancePorLote } from '@/dominio/avance-lote'
import { unidadDe, unidadAbreviada } from '@/dominio/unidad'
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

  const [actividades, estipuladas] = await Promise.all([
    listarActividades(area.id, anio, semana),
    listarActividadesEstipuladas(),
  ])
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
  const fechas = fechasDeSemana(anio, semana)
  const fmtFecha = (f: Date) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Cumplimiento')
  const header = ws.addRow([...COLUMNAS_CUMPLIMIENTO])
  header.font = { bold: true }
  const NOMBRES_DIA = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const etiquetaDia = (dia: number) =>
    `${NOMBRES_DIA[dia] ?? ''} ${fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}`.trim()

  // Solo actividades cumplidas o parciales.
  const filas = actividades.filter((a) => a.estado === 'CUMPLIDA' || a.estado === 'PARCIAL')
  for (const a of filas) {
    const fecha = fechas[a.dia - 1] ? fmtFecha(fechas[a.dia - 1]) : ''
    const unidadAbrev = unidadAbreviada(unidadDe(unidadPorNombre, a.descripcion))
    const avanceTexto = textoAvanceConFecha(a.lotes, a.avancePorLote as AvancePorLote | null, unidadAbrev, etiquetaDia)
    ws.addRow(filaCumplimiento(
      { ...a, bultosPorLote: a.bultosPorLote as BultosPorLote | null, lotesHechos: a.lotesHechos as string[] | null },
      fecha,
      unidadPorNombre,
      avanceTexto,
    ))
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

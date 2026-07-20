import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarActividades, listarActividadesSolicitadas, listarActividadesEstipuladas, listarMaquinas, listarResponsablesTodos } from '@/datos/repositorio'
import { fechasDeSemana } from '@/dominio/semana'
import { COLUMNAS_CUMPLIMIENTO } from '@/dominio/cumplimiento-export'
import { construirFilasCumplimiento } from '@/datos/export-cumplimiento'

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

  const [actividades, solicitadas, estipuladas, maquinas, responsablesTodos] = await Promise.all([
    listarActividades(area.id, anio, semana),
    listarActividadesSolicitadas(area.id, anio, semana),
    listarActividadesEstipuladas(),
    listarMaquinas(),
    listarResponsablesTodos(),
  ])
  const nombrePorMaquina = new Map(maquinas.map((m) => [m.id, m.nombre]))
  const nombreMaquina = (id: string | null) => (id ? nombrePorMaquina.get(id) ?? '' : '')
  const nombrePorResponsable = new Map<string, string>()
  for (const r of responsablesTodos) nombrePorResponsable.set(r.id, r.nombre)
  const nombreResponsable = (id: string | null) => (id ? nombrePorResponsable.get(id) ?? '' : '')
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
  const fechas = fechasDeSemana(anio, semana)
  const fmtFecha = (f: Date) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  const semanaLabel = `${anio}-S${semana}`
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Cumplimiento')
  // Columna "Semana" al frente (mismo formato "AÑO-SNN" que /consulta) como referencia,
  // útil sobre todo cuando varios Excel semanales se acumulan/consolidan (p. ej. en Drive).
  const header = ws.addRow(['Semana', ...COLUMNAS_CUMPLIMIENTO])
  header.font = { bold: true }
  const fechaDeDia = (dia: number) => (fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : '')

  const ctx = { unidadPorNombre, nombreMaquina, nombreResponsable, fechaDeDia }
  // Actividades propias del área.
  for (const fila of construirFilasCumplimiento(actividades, ctx, () => '')) {
    ws.addRow([semanaLabel, ...fila])
  }
  // Actividades que esta área solicitó a otra (ejecutadas por la otra área).
  for (const fila of construirFilasCumplimiento(solicitadas, ctx, (grupo) => grupo[0].area?.nombre ?? '')) {
    ws.addRow([semanaLabel, ...fila])
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

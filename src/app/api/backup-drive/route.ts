import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { listarActividadesTodas, listarActividadesEstipuladas, listarMaquinas, listarResponsablesTodos } from '@/datos/repositorio'
import { construirFilasMaestro, COLUMNAS_MAESTRO, type ActMaestro } from '@/datos/export-cumplimiento'

// exceljs necesita runtime Node (no edge).
export const runtime = 'nodejs'
// La ruta puede tardar; se ejecuta como cron nocturno.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Autorización: Vercel Cron inyecta "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const url = process.env.DRIVE_WEBHOOK_URL
  const token = process.env.DRIVE_WEBHOOK_TOKEN
  if (!url || !token) {
    return new NextResponse('faltan DRIVE_WEBHOOK_URL / DRIVE_WEBHOOK_TOKEN', { status: 500 })
  }

  const [actividades, estipuladas, maquinas, responsables] = await Promise.all([
    listarActividadesTodas(),
    listarActividadesEstipuladas(),
    listarMaquinas(),
    listarResponsablesTodos(),
  ])

  const filas = construirFilasMaestro(
    actividades as unknown as ActMaestro[],
    estipuladas,
    maquinas,
    responsables,
  )

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Cumplimiento')
  const header = ws.addRow([...COLUMNAS_MAESTRO])
  header.font = { bold: true }
  for (const fila of filas) ws.addRow(fila)
  const buffer = await wb.xlsx.writeBuffer()

  // Subir a la Web App de Apps Script (form-urlencoded: token + archivo en base64).
  const body = new URLSearchParams({
    token,
    file: Buffer.from(buffer).toString('base64'),
  })
  const res = await fetch(url, { method: 'POST', body })
  const texto = (await res.text()).trim()
  if (!res.ok || texto !== 'ok') {
    return new NextResponse(`fallo al subir a Drive: ${res.status} ${texto}`, { status: 500 })
  }

  return NextResponse.json({ filas: filas.length, bytes: (buffer as ArrayBuffer).byteLength })
}

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { listarActividadesTodas, listarActividadesEstipuladas, listarMaquinas, listarResponsablesTodos } from '@/datos/repositorio'
import { construirLibrosPorArea, type ActMaestro } from '@/datos/export-cumplimiento'

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

  // Corre desatendido (cron nocturno): logueamos la etapa que falle para poder
  // diagnosticar desde los logs de Vercel sin tener que re-disparar la ruta.
  try {
    const [actividades, estipuladas, maquinas, responsables] = await Promise.all([
      listarActividadesTodas(),
      listarActividadesEstipuladas(),
      listarMaquinas(),
      listarResponsablesTodos(),
    ])

    const libros = construirLibrosPorArea(
      actividades as unknown as ActMaestro[],
      estipuladas,
      maquinas,
      responsables,
    )

    // Un archivo por área: cada libro tiene hoja General + una hoja por mes.
    const fallidas: string[] = []
    for (const libro of libros) {
      const wb = new ExcelJS.Workbook()
      for (const hoja of libro.hojas) {
        const ws = wb.addWorksheet(hoja.nombre)
        const header = ws.addRow(hoja.columnas)
        header.font = { bold: true }
        for (const fila of hoja.filas) ws.addRow(fila)
      }
      const buffer = await wb.xlsx.writeBuffer()
      const safe = libro.area.replace(/[^\p{L}\p{N}]+/gu, '-')
      // Subir a la Web App de Apps Script (form-urlencoded: token + nombre + archivo en base64).
      const body = new URLSearchParams({
        token,
        name: `cumplimiento-${safe}.xlsx`,
        file: Buffer.from(buffer).toString('base64'),
      })
      const res = await fetch(url, { method: 'POST', body })
      const texto = (await res.text()).trim()
      if (!res.ok || texto !== 'ok') {
        // No logueamos el token; solo el área, el estado y la respuesta del webhook.
        console.error(`[backup-drive] fallo al subir "${libro.area}": ${res.status} ${texto}`)
        fallidas.push(libro.area)
      }
    }

    if (fallidas.length > 0) {
      return new NextResponse(`fallaron áreas: ${fallidas.join(', ')}`, { status: 500 })
    }
    return NextResponse.json({ archivos: libros.length, areas: libros.map((l) => l.area) })
  } catch (e) {
    console.error('[backup-drive] error al generar/subir el maestro:', e)
    return new NextResponse('error al generar/subir el maestro', { status: 500 })
  }
}

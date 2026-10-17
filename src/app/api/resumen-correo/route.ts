import { NextRequest, NextResponse } from 'next/server'
import { primerAdmin } from '@/datos/repositorio'
import { generarPdfResumen } from '@/datos/pdf-resumen'
import { valorCookieSesion } from '@/auth/sesion'
import { semanaActual } from '@/dominio/semana'
import { semanaDelResumen, nombrePdfResumen, asuntoResumen, cuerpoResumen, destinatariosResumen } from '@/dominio/resumen-correo'

// Chromium necesita runtime Node (no edge), y armar el PDF tarda unos segundos.
export const runtime = 'nodejs'
export const maxDuration = 120

// Cron semanal (lunes 12 m, hora de Colombia): manda por correo el PDF del resumen de todas
// las áreas de la semana que terminó. El correo lo envía la misma Web App de Apps Script de
// la copia a Drive (acción "correo"), así que sale desde esa cuenta de Google.
//
// A mano (con el mismo Bearer): ?anio=2026&semana=42 para otra semana, y ?formato=pdf para
// recibir el PDF en la respuesta en vez de enviarlo (sirve para revisarlo sin mandar nada).
export async function GET(req: NextRequest) {
  // Autorización: Vercel Cron inyecta "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const anio = Number(sp.get('anio'))
  const sem = Number(sp.get('semana'))
  const semana = Number.isInteger(anio) && Number.isInteger(sem) && anio > 2000 && sem >= 1 && sem <= 53
    ? { anio, semana: sem }
    : semanaDelResumen(semanaActual())
  const soloPdf = sp.get('formato') === 'pdf'

  const url = process.env.DRIVE_WEBHOOK_URL
  const token = process.env.DRIVE_WEBHOOK_TOKEN
  const para = destinatariosResumen(process.env.RESUMEN_CORREO_PARA)
  if (!soloPdf && (!url || !token || para.length === 0)) {
    return new NextResponse('faltan DRIVE_WEBHOOK_URL / DRIVE_WEBHOOK_TOKEN / RESUMEN_CORREO_PARA', { status: 500 })
  }

  // Corre desatendido: se loguea la etapa que falle para diagnosticar desde los logs de Vercel.
  try {
    const admin = await primerAdmin()
    if (!admin) return new NextResponse('no hay usuario ADMIN', { status: 500 })
    // En Vercel el navegador interno entra por el dominio de producción (el de la gente); en
    // desarrollo, por el mismo servidor local que recibe esta petición.
    const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL
    const baseUrl = process.env.VERCEL && prod ? `https://${prod}` : req.nextUrl.origin
    const pdf = await generarPdfResumen({ baseUrl, cookieSesion: valorCookieSesion(admin.id), semana })

    if (soloPdf) {
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${nombrePdfResumen(semana)}"`,
        },
      })
    }

    // Misma Web App que la copia a Drive (form-urlencoded, archivo en base64), con accion=correo.
    const body = new URLSearchParams({
      token: token!,
      accion: 'correo',
      para: para.join(','),
      asunto: asuntoResumen(semana),
      cuerpo: cuerpoResumen(semana),
      name: nombrePdfResumen(semana),
      file: pdf.toString('base64'),
    })
    const res = await fetch(url!, { method: 'POST', body })
    const texto = (await res.text()).trim()
    if (!res.ok || texto !== 'ok') {
      // No logueamos el token; solo el estado y la respuesta del webhook.
      console.error(`[resumen-correo] el webhook no envió el correo: ${res.status} ${texto.slice(0, 300)}`)
      return new NextResponse('el webhook no envió el correo', { status: 502 })
    }
    return NextResponse.json({ ok: true, semana, para, bytes: pdf.length })
  } catch (e) {
    console.error('[resumen-correo] error al generar/enviar el resumen:', e)
    return new NextResponse('error al generar/enviar el resumen', { status: 500 })
  }
}

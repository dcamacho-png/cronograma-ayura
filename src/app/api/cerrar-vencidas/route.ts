import { NextRequest, NextResponse } from 'next/server'
import { cerrarVencidasSinRegistrar } from '@/datos/repositorio'
import { semanaActual } from '@/dominio/semana'

export const runtime = 'nodejs'
export const maxDuration = 60

// Cron semanal: cierra como SIN_REGISTRAR lo que quedó pendiente en semanas vencidas.
// Idempotente: correrlo de nuevo no cambia nada, porque solo mira las PENDIENTE sin cerrar.
export async function GET(req: NextRequest) {
  // Autorización: Vercel Cron inyecta "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 })
  }
  const hoy = semanaActual()
  const { cerradas } = await cerrarVencidasSinRegistrar(hoy)
  return NextResponse.json({ ok: true, semana: hoy, cerradas })
}

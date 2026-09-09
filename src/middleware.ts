import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  // Los crons se autentican solo con CRON_SECRET (Bearer), sin cookie de sesión: deben
  // saltarse la redirección a /login del middleware. Sin esto el cron recibe un 307 a
  // /login y no hace nada — el error que ya pasó una vez con el respaldo a Drive.
  const p = req.nextUrl.pathname
  if (p.startsWith('/api/backup-drive') || p.startsWith('/api/cerrar-vencidas')) {
    return NextResponse.next()
  }
  const tieneSesion = req.cookies.has('sesion')
  const esLogin = req.nextUrl.pathname.startsWith('/login')
  if (!tieneSesion && !esLogin) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (tieneSesion && esLogin) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icon-192.png|icon-512.png).*)'],
}

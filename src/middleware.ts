import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  // El cron de respaldo se autentica solo con CRON_SECRET (Bearer), sin cookie de
  // sesión: debe saltarse la redirección a /login del middleware.
  if (req.nextUrl.pathname.startsWith('/api/backup-drive')) {
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

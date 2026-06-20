import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
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
  matcher: ['/((?!_next|favicon.ico).*)'],
}

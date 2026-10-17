import { cookies } from 'next/headers'
import { createHmac } from 'crypto'
import { prisma } from '@/datos/prisma'

const COOKIE = 'sesion'

function obtenerSecreto(): string {
  const s = process.env.SESION_SECRET
  if (s) return s
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESION_SECRET no está configurado (requerido en producción)')
  }
  return 'cronograma-local-secret'
}

function firmar(id: string): string {
  return createHmac('sha256', obtenerSecreto()).update(id).digest('hex')
}

export const NOMBRE_COOKIE_SESION = COOKIE

// Valor firmado de la cookie de sesión. Lo usa también el correo semanal del resumen: el
// navegador interno que arma el PDF entra como el admin con esta misma cookie, así que no
// hace falta abrir otra puerta a la página del resumen.
export function valorCookieSesion(usuarioId: string): string {
  return `${usuarioId}.${firmar(usuarioId)}`
}

export async function crearSesion(usuarioId: string) {
  const c = await cookies()
  c.set(COOKIE, valorCookieSesion(usuarioId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function cerrarSesion() {
  const c = await cookies()
  c.delete(COOKIE)
}

export async function usuarioActual() {
  const c = await cookies()
  const raw = c.get(COOKIE)?.value
  if (!raw) return null
  const [id, sig] = raw.split('.')
  if (!id || sig !== firmar(id)) return null
  return prisma.usuario.findUnique({ where: { id }, include: { area: true } })
}

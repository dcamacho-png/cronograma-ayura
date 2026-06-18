import { cookies } from 'next/headers'
import { createHmac } from 'crypto'
import { prisma } from '@/datos/prisma'

const SECRET = process.env.SESION_SECRET ?? 'cronograma-local-secret'
const COOKIE = 'sesion'

function firmar(id: string): string {
  return createHmac('sha256', SECRET).update(id).digest('hex')
}

export async function crearSesion(usuarioId: string) {
  const c = await cookies()
  c.set(COOKIE, `${usuarioId}.${firmar(usuarioId)}`, { httpOnly: true, sameSite: 'lax', path: '/' })
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

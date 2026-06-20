'use server'

import { redirect } from 'next/navigation'
import { obtenerUsuarioPorLogin } from '@/datos/repositorio'
import { verifyPassword } from '@/auth/password'
import { crearSesion, cerrarSesion } from '@/auth/sesion'

export async function iniciarSesionAccion(form: FormData) {
  const usuario = String(form.get('usuario') ?? '').trim()
  const password = String(form.get('password') ?? '')
  const u = await obtenerUsuarioPorLogin(usuario)
  if (!u || !verifyPassword(password, u.hash)) {
    redirect('/login?error=1')
  }
  await crearSesion(u.id)
  redirect('/')
}

export async function cerrarSesionAccion() {
  await cerrarSesion()
  redirect('/login')
}

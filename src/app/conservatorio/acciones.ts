'use server'

import { revalidatePath } from 'next/cache'
import {
  crearNotaConservatorio,
  notaConservatorioPorId,
  marcarNotaHablada,
  reabrirNotaConservatorio,
  borrarNotaConservatorio,
} from '@/datos/repositorio'
import { usuarioActual } from '@/auth/sesion'
import { puedeMarcarConservatorio } from '@/auth/permisos'

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}
function textoOpcional(form: FormData, clave: string): string | null {
  const v = texto(form, clave)
  return v === '' ? null : v
}

export async function crearNotaAccion(form: FormData) {
  const u = await usuarioActual()
  // Solo un usuario de área con área asignada crea notas (para su propia área).
  if (!u || u.rol !== 'AREA' || !u.areaId) return
  const t = texto(form, 'texto')
  if (!t) return
  await crearNotaConservatorio({ areaId: u.areaId, texto: t, loteId: textoOpcional(form, 'loteId') })
  revalidatePath('/conservatorio')
}

export async function marcarHabladaAccion(form: FormData) {
  const u = await usuarioActual()
  if (!u || !puedeMarcarConservatorio(u)) return
  const id = texto(form, 'id')
  if (!id) return
  await marcarNotaHablada(id)
  revalidatePath('/conservatorio')
}

export async function reabrirNotaAccion(form: FormData) {
  const u = await usuarioActual()
  if (!u || !puedeMarcarConservatorio(u)) return
  const id = texto(form, 'id')
  if (!id) return
  await reabrirNotaConservatorio(id)
  revalidatePath('/conservatorio')
}

export async function borrarNotaAccion(form: FormData) {
  const u = await usuarioActual()
  if (!u) return
  const id = texto(form, 'id')
  if (!id) return
  const nota = await notaConservatorioPorId(id)
  if (!nota) return
  // ADMIN borra cualquiera; el área solo su propia nota mientras esté pendiente.
  const permitido = u.rol === 'ADMIN' || (u.rol === 'AREA' && nota.areaId === u.areaId && !nota.hablado)
  if (!permitido) return
  await borrarNotaConservatorio(id)
  revalidatePath('/conservatorio')
}

'use server'

import { revalidatePath } from 'next/cache'
import { crearArea, crearFinca, crearMotivo, crearMaquina, crearResponsable } from '@/datos/repositorio'

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}

// Ejecuta la creación ignorando errores (p. ej. nombre duplicado en catálogos únicos).
async function intentar(fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch {
    // se ignora (nombre repetido u otra restricción)
  }
}

export async function crearAreaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (nombre) await intentar(() => crearArea(nombre))
  revalidatePath('/configuracion')
}

export async function crearFincaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (nombre) await intentar(() => crearFinca(nombre))
  revalidatePath('/configuracion')
}

export async function crearMotivoAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (nombre) await intentar(() => crearMotivo(nombre))
  revalidatePath('/configuracion')
}

export async function crearMaquinaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  const operario = texto(form, 'operario')
  if (nombre) await intentar(() => crearMaquina(nombre, operario || null))
  revalidatePath('/configuracion')
}

export async function crearResponsableAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  const areaId = texto(form, 'areaId')
  if (nombre && areaId) await intentar(() => crearResponsable(nombre, areaId))
  revalidatePath('/configuracion')
}

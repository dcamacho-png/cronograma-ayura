'use server'

import { revalidatePath } from 'next/cache'
import { crearArea, crearFinca, crearMotivo, crearMaquina, crearResponsable, eliminarArea, eliminarFinca, eliminarMotivo, eliminarMaquina, eliminarResponsable } from '@/datos/repositorio'

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

export async function eliminarAreaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await intentar(() => eliminarArea(id))
  revalidatePath('/configuracion')
}

export async function eliminarFincaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await intentar(() => eliminarFinca(id))
  revalidatePath('/configuracion')
}

export async function eliminarMotivoAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await intentar(() => eliminarMotivo(id))
  revalidatePath('/configuracion')
}

export async function eliminarMaquinaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await intentar(() => eliminarMaquina(id))
  revalidatePath('/configuracion')
}

export async function eliminarResponsableAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await intentar(() => eliminarResponsable(id))
  revalidatePath('/configuracion')
}

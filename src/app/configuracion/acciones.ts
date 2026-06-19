'use server'

import { revalidatePath } from 'next/cache'
import { crearArea, crearFinca, crearMotivo, crearMaquina, crearResponsable, eliminarArea, eliminarFinca, eliminarMotivo, eliminarMaquina, eliminarResponsable, crearActividadEstipulada, eliminarActividadEstipulada, renombrarActividadEstipulada, crearLote, eliminarLote, crearUsuario, cambiarContrasena, eliminarUsuario } from '@/datos/repositorio'

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}

function textoOpcional(form: FormData, clave: string): string | null {
  const v = texto(form, clave)
  return v === '' ? null : v
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
  if (nombre) await intentar(() => crearMaquina(nombre))
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

export async function crearActividadEstipuladaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (nombre) await intentar(() => crearActividadEstipulada(nombre))
  revalidatePath('/configuracion')
}

export async function eliminarActividadEstipuladaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await intentar(() => eliminarActividadEstipulada(id))
  revalidatePath('/configuracion')
}

export async function renombrarActividadEstipuladaAccion(form: FormData) {
  const id = texto(form, 'id')
  const nombre = texto(form, 'nombre')
  if (id && nombre) await intentar(() => renombrarActividadEstipulada(id, nombre))
  revalidatePath('/configuracion')
}

export async function crearLoteAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  const fincaId = texto(form, 'fincaId')
  const haTxt = texto(form, 'hectareas')
  const hectareas = haTxt && Number.isFinite(Number(haTxt)) ? Number(haTxt) : null
  const tipoPasto = texto(form, 'tipoPasto') || null
  if (nombre && fincaId) await intentar(() => crearLote(nombre, fincaId, hectareas, tipoPasto))
  revalidatePath('/configuracion')
}

export async function eliminarLoteAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await intentar(() => eliminarLote(id))
  revalidatePath('/configuracion')
}

export async function crearUsuarioAccion(form: FormData) {
  const usuario = texto(form, 'usuario')
  const nombre = texto(form, 'nombre')
  const password = texto(form, 'password')
  const rol = texto(form, 'rol')
  const areaId = textoOpcional(form, 'areaId')
  if (usuario && nombre && password && (rol === 'AREA' || rol === 'ADMIN')) {
    await intentar(() => crearUsuario(usuario, nombre, password, rol, rol === 'AREA' ? areaId : null))
  }
  revalidatePath('/configuracion')
}

export async function cambiarContrasenaAccion(form: FormData) {
  const id = texto(form, 'id')
  const password = texto(form, 'password')
  if (id && password) await intentar(() => cambiarContrasena(id, password))
  revalidatePath('/configuracion')
}

export async function eliminarUsuarioAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await intentar(() => eliminarUsuario(id))
  revalidatePath('/configuracion')
}

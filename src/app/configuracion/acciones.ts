'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearArea, crearFinca, crearMotivo, crearMaquina, crearResponsable, eliminarArea, eliminarFinca, eliminarMotivo, eliminarMaquina, eliminarResponsable, setResponsableActivo, crearActividadEstipulada, eliminarActividadEstipulada, renombrarActividadEstipulada, setUnidadActividadEstipulada, crearLote, eliminarLote, crearUsuario, cambiarContrasena, eliminarUsuario, BloqueoError, setPantallasUsuario, setVariantesArea } from '@/datos/repositorio'
import { usuarioActual } from '@/auth/sesion'
import { normalizarUnidad } from '@/dominio/unidad'

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}

function textoOpcional(form: FormData, clave: string): string | null {
  const v = texto(form, clave)
  return v === '' ? null : v
}

// Traduce errores de Prisma a un mensaje claro para el usuario.
function mensajeError(e: unknown): string {
  if (e instanceof BloqueoError) return e.message
  const code = (e as { code?: string })?.code
  if (code === 'P2002') return 'Ya existe un registro con ese nombre.'
  if (code === 'P2003' || code === 'P2014') return 'No se puede eliminar: está en uso.'
  return 'Ocurrió un error. Intenta de nuevo.'
}

// Ejecuta la operación y redirige a /configuracion con un aviso de éxito o error.
async function correr(fn: () => Promise<unknown>, okMsg: string): Promise<never> {
  const u = await usuarioActual()
  if (!u || u.rol !== 'ADMIN') redirect('/')
  let url: string
  try {
    await fn()
    url = `/configuracion?ok=${encodeURIComponent(okMsg)}`
  } catch (e) {
    url = `/configuracion?error=${encodeURIComponent(mensajeError(e))}`
  }
  redirect(url)
}

function faltanDatos(): never {
  redirect(`/configuracion?error=${encodeURIComponent('Faltan datos requeridos.')}`)
}

export async function crearAreaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (!nombre) faltanDatos()
  await correr(() => crearArea(nombre), 'Área agregada.')
}

export async function crearFincaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (!nombre) faltanDatos()
  await correr(() => crearFinca(nombre), 'Finca agregada.')
}

export async function crearMotivoAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (!nombre) faltanDatos()
  await correr(() => crearMotivo(nombre), 'Motivo agregado.')
}

export async function crearMaquinaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (!nombre) faltanDatos()
  await correr(() => crearMaquina(nombre), 'Máquina agregada.')
}

export async function crearResponsableAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  const areaId = texto(form, 'areaId')
  if (!nombre || !areaId) faltanDatos()
  await correr(() => crearResponsable(nombre, areaId), 'Responsable agregado.')
}

export async function eliminarAreaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  await correr(() => eliminarArea(id), 'Área eliminada.')
}

export async function eliminarFincaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  await correr(() => eliminarFinca(id), 'Finca eliminada.')
}

export async function eliminarMotivoAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  await correr(() => eliminarMotivo(id), 'Motivo eliminado.')
}

export async function eliminarMaquinaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  await correr(() => eliminarMaquina(id), 'Máquina eliminada.')
}

export async function eliminarResponsableAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  await correr(() => eliminarResponsable(id), 'Responsable eliminado.')
}

export async function cambiarEstadoResponsableAccion(form: FormData) {
  const id = texto(form, 'id')
  const activo = texto(form, 'activo') === '1'
  if (!id) faltanDatos()
  await correr(
    () => setResponsableActivo(id, activo),
    activo ? 'Responsable reactivado.' : 'Responsable dado de baja.',
  )
}

export async function crearActividadEstipuladaAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  if (!nombre) faltanDatos()
  const unidad = normalizarUnidad(texto(form, 'unidad'))
  await correr(() => crearActividadEstipulada(nombre, unidad), 'Actividad agregada.')
}

export async function eliminarActividadEstipuladaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  await correr(() => eliminarActividadEstipulada(id), 'Actividad eliminada.')
}

export async function renombrarActividadEstipuladaAccion(form: FormData) {
  const id = texto(form, 'id')
  const nombre = texto(form, 'nombre')
  if (!id || !nombre) faltanDatos()
  await correr(() => renombrarActividadEstipulada(id, nombre), 'Actividad actualizada.')
}

export async function setUnidadActividadEstipuladaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  const unidad = normalizarUnidad(texto(form, 'unidad'))
  await correr(async () => {
    await setUnidadActividadEstipulada(id, unidad)
    // La unidad se lee en Cumplimiento y Resumen; refrescarlas para que el cambio
    // se refleje sin tener que recargar manualmente (Router Cache).
    revalidatePath('/cumplimiento')
    revalidatePath('/resumen')
  }, 'Unidad actualizada.')
}

export async function crearLoteAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  const fincaId = texto(form, 'fincaId')
  if (!nombre || !fincaId) faltanDatos()
  const haTxt = texto(form, 'hectareas')
  const hectareas = haTxt && Number.isFinite(Number(haTxt)) ? Number(haTxt) : null
  const tipoPasto = texto(form, 'tipoPasto') || null
  await correr(() => crearLote(nombre, fincaId, hectareas, tipoPasto), 'Lote agregado.')
}

export async function eliminarLoteAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  await correr(() => eliminarLote(id), 'Lote eliminado.')
}

export async function crearUsuarioAccion(form: FormData) {
  const usuario = texto(form, 'usuario')
  const nombre = texto(form, 'nombre')
  const password = texto(form, 'password')
  const rol = texto(form, 'rol')
  const areaId = textoOpcional(form, 'areaId')
  if (!usuario || !nombre || !password || (rol !== 'AREA' && rol !== 'ADMIN')) faltanDatos()
  await correr(
    () => crearUsuario(usuario, nombre, password, rol as 'AREA' | 'ADMIN', rol === 'AREA' ? areaId : null),
    'Usuario creado.',
  )
}

export async function cambiarContrasenaAccion(form: FormData) {
  const id = texto(form, 'id')
  const password = texto(form, 'password')
  if (!id || !password) faltanDatos()
  await correr(() => cambiarContrasena(id, password), 'Contraseña actualizada.')
}

export async function eliminarUsuarioAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  await correr(() => eliminarUsuario(id), 'Usuario eliminado.')
}

export async function actualizarPantallasUsuarioAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  const claves = form.getAll('pantalla').filter((v): v is string => typeof v === 'string')
  const csv = claves.length > 0 ? claves.join(',') : ''
  await correr(() => setPantallasUsuario(id, csv), 'Pantallas del usuario actualizadas.')
}

export async function actualizarVariantesAreaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  const flag = (k: string) => form.get(k) === '1'
  await correr(
    () => setVariantesArea(id, {
      maqTareas: flag('maqTareas'),
      maqProgramar: flag('maqProgramar'),
      maqCumplimiento: flag('maqCumplimiento'),
      maqResumen: flag('maqResumen'),
    }),
    'Variantes del área actualizadas.',
  )
}

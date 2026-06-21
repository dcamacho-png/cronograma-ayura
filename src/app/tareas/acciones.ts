'use server'

import { revalidatePath } from 'next/cache'
import {
  crearTarea,
  eliminarTarea,
  seleccionarTarea,
  quitarSeleccionTarea,
  crearSolicitud,
} from '@/datos/repositorio'
import { esSemanaPasada, semanaActual } from '@/dominio/semana'

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}
function textoOpcional(form: FormData, clave: string): string | null {
  const v = texto(form, clave)
  return v === '' ? null : v
}
function numeroOpcional(form: FormData, clave: string): number | null {
  const v = texto(form, clave)
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function crearTareaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const descripcion =
    textoOpcional(form, 'otra') ?? textoOpcional(form, 'estipulada') ?? texto(form, 'descripcion')
  if (!areaId || !descripcion) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  for (const id of loteIds) {
    const b = numeroOpcional(form, `bultos_${id}`)
    if (b != null) bultos[id] = b
  }
  await crearTarea(areaId, descripcion, loteIds, Object.keys(bultos).length > 0 ? bultos : null)
  revalidatePath('/tareas')
}

export async function eliminarTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await eliminarTarea(id)
  revalidatePath('/tareas')
}

export async function seleccionarTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (id && Number.isInteger(anio) && Number.isInteger(semana)) {
    if (esSemanaPasada(anio, semana, semanaActual())) return
    await seleccionarTarea(id, anio, semana)
  }
  revalidatePath('/tareas')
}

export async function quitarSeleccionTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await quitarSeleccionTarea(id)
  revalidatePath('/tareas')
}

export async function crearSolicitudAccion(form: FormData) {
  const solicitanteAreaId = texto(form, 'solicitanteAreaId')
  const areaEjecutoraId = texto(form, 'areaEjecutoraId')
  const descripcion =
    textoOpcional(form, 'otra') ?? textoOpcional(form, 'estipulada') ?? texto(form, 'descripcion')
  if (!solicitanteAreaId || !areaEjecutoraId || !descripcion || areaEjecutoraId === solicitanteAreaId) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  for (const id of loteIds) {
    const b = numeroOpcional(form, `bultos_${id}`)
    if (b != null) bultos[id] = b
  }
  await crearSolicitud(areaEjecutoraId, descripcion, solicitanteAreaId, loteIds, Object.keys(bultos).length > 0 ? bultos : null)
  revalidatePath('/tareas')
}

export async function programarTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  const v = texto(form, 'anioSemana')
  if (!v) {
    await quitarSeleccionTarea(id)
  } else {
    const [anioStr, semanaStr] = v.split('-')
    const anio = Number(anioStr)
    const semana = Number(semanaStr)
    if (Number.isInteger(anio) && Number.isInteger(semana)) await seleccionarTarea(id, anio, semana)
  }
  revalidatePath('/tareas')
}

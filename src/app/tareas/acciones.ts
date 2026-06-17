'use server'

import { revalidatePath } from 'next/cache'
import {
  crearTarea,
  eliminarTarea,
  seleccionarTarea,
  quitarSeleccionTarea,
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

export async function crearTareaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const descripcion = texto(form, 'descripcion')
  if (!areaId || !descripcion) return
  await crearTarea(areaId, descripcion, textoOpcional(form, 'fincaId'))
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

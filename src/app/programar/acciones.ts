'use server'

import { revalidatePath } from 'next/cache'
import { crearActividadDesdeLotes, eliminarActividad, duplicarSemana, crearResponsable, actualizarActividad, asignarTarea, quitarSeleccionTarea } from '@/datos/repositorio'
import { semanaAnterior, esSemanaPasada, semanaActual } from '@/dominio/semana'

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}
function numeroOpcional(form: FormData, clave: string): number | null {
  const v = texto(form, clave)
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function textoOpcional(form: FormData, clave: string): string | null {
  const v = texto(form, clave)
  return v === '' ? null : v
}

export async function crearActividadAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (esSemanaPasada(anio, semana, semanaActual())) return
  const loteId = texto(form, 'loteId')
  if (!areaId || !loteId) return
  await crearActividadDesdeLotes(
    {
      areaId,
      anio,
      semana,
      dia: Number(texto(form, 'dia')),
      responsableId: texto(form, 'responsableId'),
      descripcion: texto(form, 'descripcion'),
      turno: texto(form, 'turno'),
      maquinaId: textoOpcional(form, 'maquinaId'),
      areaTareaId: textoOpcional(form, 'areaTareaId'),
      horas: numeroOpcional(form, 'horas'),
      hectareas: numeroOpcional(form, 'hectareas'),
      planB: textoOpcional(form, 'planB'),
    },
    [loteId],
  )
  revalidatePath('/programar')
}

export async function eliminarActividadAccion(form: FormData) {
  await eliminarActividad(texto(form, 'id'))
  revalidatePath('/programar')
}

export async function duplicarSemanaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (esSemanaPasada(anio, semana, semanaActual())) return
  const previa = semanaAnterior(anio, semana)
  await duplicarSemana(areaId, previa.anio, previa.semana, anio, semana)
  revalidatePath('/programar')
}

export async function crearResponsableAccion(form: FormData) {
  const nombre = texto(form, 'nombre')
  const areaId = texto(form, 'areaId')
  if (!nombre || !areaId) return
  await crearResponsable(nombre, areaId)
  revalidatePath('/programar')
}

export async function actualizarActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  const descripcion = texto(form, 'descripcion')
  const turno = texto(form, 'turno')
  if (!id || !descripcion) return
  await actualizarActividad(id, descripcion, turno)
  revalidatePath('/programar')
}

export async function asignarTareaAccion(form: FormData) {
  const tareaId = texto(form, 'tareaId')
  const responsableId = texto(form, 'responsableId')
  const dias = form
    .getAll('dia')
    .map((v) => Number(String(v)))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  const loteId = textoOpcional(form, 'loteId')
  const turno = texto(form, 'turno')
  if (!tareaId || !responsableId || dias.length === 0) return
  await asignarTarea(tareaId, responsableId, dias, loteId, turno)
  revalidatePath('/programar')
}

export async function devolverAlBancoAccion(form: FormData) {
  const tareaId = texto(form, 'tareaId')
  if (tareaId) await quitarSeleccionTarea(tareaId)
  revalidatePath('/programar')
}

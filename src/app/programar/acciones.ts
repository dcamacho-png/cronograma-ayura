'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { crearActividadDesdeLotes, eliminarActividad, duplicarSemana, crearResponsable, actualizarActividad, asignarTarea, quitarSeleccionTarea } from '@/datos/repositorio'
import { semanaAnterior, esSemanaPasada, semanaActual, diaActual, esDiaPasado } from '@/dominio/semana'

const DIAS_CORTOS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

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
  const dia = Number(texto(form, 'dia'))
  if (esDiaPasado(anio, semana, dia, { ...semanaActual(), dia: diaActual() })) return
  const loteId = texto(form, 'loteId')
  if (!areaId || !loteId) return
  await crearActividadDesdeLotes(
    {
      areaId,
      anio,
      semana,
      dia,
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
  const anioForm = Number(texto(form, 'anio'))
  const semanaForm = Number(texto(form, 'semana'))
  const hoy = { ...semanaActual(), dia: diaActual() }
  const dias = form
    .getAll('dia')
    .map((v) => Number(String(v)))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
    .filter((d) => !esDiaPasado(anioForm, semanaForm, d, hoy))
  const loteId = textoOpcional(form, 'loteId')
  const turno = texto(form, 'turno')
  const maquinaPorDia: Record<number, string | null> = {}
  for (const dia of dias) {
    const m = textoOpcional(form, `maquina_${dia}`)
    maquinaPorDia[dia] = m || null
  }
  if (!tareaId || !responsableId || dias.length === 0) return
  const res = await asignarTarea(tareaId, responsableId, dias, loteId, turno, maquinaPorDia)
  if (res.ok === false && res.motivo === 'conflicto') {
    const partes = res.conflictos.map((c) =>
      c.tipo === 'responsable'
        ? `${DIAS_CORTOS[c.dia]}: el responsable ya tiene una tarea en ese turno`
        : `${DIAS_CORTOS[c.dia]}: la máquina ya está ocupada en ese turno`,
    )
    const msg = `No se asignó. ${partes.join(' · ')}`
    const areaId = texto(form, 'areaId')
    const anio = texto(form, 'anio')
    const semana = texto(form, 'semana')
    redirect(`/programar?area=${areaId}&anio=${anio}&semana=${semana}&error=${encodeURIComponent(msg)}`)
  }
  revalidatePath('/programar')
}

export async function devolverAlBancoAccion(form: FormData) {
  const tareaId = texto(form, 'tareaId')
  if (tareaId) await quitarSeleccionTarea(tareaId)
  revalidatePath('/programar')
}

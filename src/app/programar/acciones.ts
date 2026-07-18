'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { crearActividadDesdeLotes, eliminarActividad, duplicarSemana, crearResponsable, actualizarActividad, asignarTarea, quitarSeleccionTarea, devolverAAsignacion, devolverGrillaAlBanco, devolverActividadReprogramadaAlBanco, dedicarTractor, crearNovedadResponsable, eliminarNovedadResponsable, areaDeActividad, areaDeTarea, areaDeResponsable, areaDeNovedadResponsable, areaDedicacionTractor } from '@/datos/repositorio'
import { semanaAnterior, esSemanaPasada, semanaActual, diaActual, esDiaPasado, esSemanaFutura } from '@/dominio/semana'
import type { Asignacion } from '@/dominio/programacion'
import { usuarioActual } from '@/auth/sesion'
import { puedeMutarArea } from '@/auth/permisos'

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

// ¿El usuario actual puede mutar datos del área dada? (sesión válida + rol + propiedad).
// Reemplaza al antiguo candado que solo bloqueaba al Visor: ahora también evita
// que un área toque datos de otra (IDOR). ADMIN pasa siempre; VISOR nunca.
async function autorizado(areaId: string | null): Promise<boolean> {
  const u = await usuarioActual()
  return !!u && puedeMutarArea(u, areaId)
}
async function autorizadoActividad(id: string): Promise<boolean> {
  const a = await areaDeActividad(id)
  return !!a && autorizado(a.areaId)
}
async function autorizadoTarea(id: string): Promise<boolean> {
  const t = await areaDeTarea(id)
  return !!t && autorizado(t.areaId)
}
async function autorizadoResponsable(id: string): Promise<boolean> {
  const r = await areaDeResponsable(id)
  return !!r && autorizado(r.areaId)
}
async function autorizadoNovedadResponsable(id: string): Promise<boolean> {
  const n = await areaDeNovedadResponsable(id)
  return !!n && autorizado(n.areaId)
}

export async function crearActividadAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  if (!(await autorizado(areaId))) return
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
  const id = texto(form, 'id')
  if (!id || !(await autorizadoActividad(id))) return
  await eliminarActividad(id)
  revalidatePath('/programar')
}

export async function duplicarSemanaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  if (!(await autorizado(areaId))) return
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
  if (!nombre || !areaId || !(await autorizado(areaId))) return
  await crearResponsable(nombre, areaId)
  revalidatePath('/programar')
}

export async function actualizarActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id || !(await autorizadoActividad(id))) return
  const descripcion = texto(form, 'descripcion')
  const turno = texto(form, 'turno')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!id || !descripcion) return
  if (!Number.isInteger(anio) || !Number.isInteger(semana) || !esSemanaFutura(anio, semana, semanaActual())) return
  await actualizarActividad(id, descripcion, turno)
  revalidatePath('/programar')
}

export async function asignarTareaAccion(form: FormData) {
  const tareaId = texto(form, 'tareaId')
  if (!tareaId || !(await autorizadoTarea(tareaId))) return
  const responsableIds = form.getAll('responsableId').map((v) => String(v)).filter(Boolean)
  const anioForm = Number(texto(form, 'anio'))
  const semanaForm = Number(texto(form, 'semana'))
  const hoy = { ...semanaActual(), dia: diaActual() }
  const loteId = textoOpcional(form, 'loteId')
  const esMaquinaria = texto(form, 'esMaquinaria') === '1'

  const nombres: Record<string, string> = {}
  const asignaciones: Asignacion[] = []
  for (const rid of responsableIds) {
    nombres[rid] = texto(form, `respNombre_${rid}`)
    const dias = form
      .getAll(`dia_${rid}`)
      .map((v) => Number(String(v)))
      .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
      .filter((d) => !esDiaPasado(anioForm, semanaForm, d, hoy))
    if (dias.length === 0) continue
    const turno = texto(form, `turno_${rid}`)
    const maquinaPorDia: Record<number, string | null> = {}
    for (const dia of dias) {
      maquinaPorDia[dia] = textoOpcional(form, `maquina_${rid}_${dia}`) || null
    }
    asignaciones.push({ responsableId: rid, dias, turno, maquinaPorDia })
  }

  if (!tareaId || asignaciones.length === 0) return
  const res = await asignarTarea(tareaId, asignaciones, loteId, esMaquinaria)
  if (res.ok === false && res.motivo === 'conflicto') {
    const partes = res.conflictos.map((c) => {
      const nombre = (c.responsableId && nombres[c.responsableId]) || 'Responsable'
      const detalle =
        c.tipo === 'responsable'
          ? 'ya tiene una tarea en ese turno'
          : 'la máquina ya está ocupada en ese turno'
      return `${nombre} — ${DIAS_CORTOS[c.dia]}: ${detalle}`
    })
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
  if (!tareaId || !(await autorizadoTarea(tareaId))) return
  await quitarSeleccionTarea(tareaId)
  revalidatePath('/programar')
}

export async function devolverAAsignacionAccion(form: FormData) {
  const tareaId = texto(form, 'tareaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!tareaId || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  if (!(await autorizadoTarea(tareaId))) return
  if (!esSemanaFutura(anio, semana, semanaActual())) return
  await devolverAAsignacion(tareaId, anio, semana)
  revalidatePath('/programar')
}

export async function devolverGrillaAlBancoAccion(form: FormData) {
  const tareaId = texto(form, 'tareaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!tareaId || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  if (!(await autorizadoTarea(tareaId))) return
  if (!esSemanaFutura(anio, semana, semanaActual())) return
  await devolverGrillaAlBanco(tareaId, anio, semana)
  revalidatePath('/programar')
}

// Devuelve al banco una actividad que llegó por reprogramación (sin tarea de
// origen). No borra: la convierte en tarea PENDIENTE del banco para reasignarla.
export async function devolverActividadAlBancoAccion(form: FormData) {
  const id = texto(form, 'id')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!id || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  if (!(await autorizadoActividad(id))) return
  if (!esSemanaFutura(anio, semana, semanaActual())) return
  await devolverActividadReprogramadaAlBanco(id)
  revalidatePath('/programar')
}

export async function dedicarTractorAccion(form: FormData) {
  const maquinaId = texto(form, 'maquinaId')
  const areaId = textoOpcional(form, 'areaId') // '' → null = quitar dedicación
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  const dia = Number(texto(form, 'dia'))
  if (!maquinaId || !Number.isInteger(anio) || !Number.isInteger(semana) || !Number.isInteger(dia)) return
  if (!esSemanaFutura(anio, semana, semanaActual())) return
  // Al dedicar: el área objetivo debe ser la del usuario. Al quitar: debe ser el
  // dueño de la dedicación existente (no se puede quitar la de otra área).
  const areaObjetivo = areaId ?? (await areaDedicacionTractor(maquinaId, anio, semana, dia))?.areaId ?? null
  if (!(await autorizado(areaObjetivo))) return
  await dedicarTractor(maquinaId, areaId, anio, semana, dia)
  revalidatePath('/programar')
}

// "YYYY-MM-DD" (input date) → Date a medianoche UTC; null si no es válida.
function fechaUTC(form: FormData, clave: string): Date | null {
  const v = texto(form, clave)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(v + 'T00:00:00.000Z')
  return Number.isNaN(d.getTime()) ? null : d
}

export async function crearNovedadResponsableAccion(form: FormData) {
  const responsableId = texto(form, 'responsableId')
  const tipo = texto(form, 'tipo')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!responsableId || (tipo !== 'VACACIONES' && tipo !== 'PERMISO')) return
  if (!(await autorizadoResponsable(responsableId))) return
  if (!Number.isInteger(anio) || !Number.isInteger(semana) || !esSemanaFutura(anio, semana, semanaActual())) return
  const fechaInicio = fechaUTC(form, 'fechaInicio')
  if (!fechaInicio) return
  let fechaFin = fechaUTC(form, 'fechaFin') ?? fechaInicio
  if (fechaFin.getTime() < fechaInicio.getTime()) fechaFin = fechaInicio
  await crearNovedadResponsable({
    responsableId,
    tipo,
    fechaInicio,
    fechaFin,
    horario: textoOpcional(form, 'horario'),
    nota: textoOpcional(form, 'nota'),
  })
  revalidatePath('/programar')
}

export async function eliminarNovedadResponsableAccion(form: FormData) {
  const id = texto(form, 'id')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!id) return
  if (!Number.isInteger(anio) || !Number.isInteger(semana) || !esSemanaFutura(anio, semana, semanaActual())) return
  if (!(await autorizadoNovedadResponsable(id))) return
  await eliminarNovedadResponsable(id)
  revalidatePath('/programar')
}

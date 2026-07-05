'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { crearActividadDesdeLotes, eliminarActividad, duplicarSemana, crearResponsable, actualizarActividad, asignarTarea, quitarSeleccionTarea, devolverAAsignacion, devolverGrillaAlBanco, dedicarTractor } from '@/datos/repositorio'
import { semanaAnterior, esSemanaPasada, semanaActual, diaActual, esDiaPasado, esSemanaFutura } from '@/dominio/semana'
import type { Asignacion } from '@/dominio/programacion'
import { usuarioActual } from '@/auth/sesion'
import { esSoloLectura } from '@/auth/permisos'

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

// El Visor (solo consulta) nunca puede mutar. Doble candado con la UI.
async function bloqueadoVisor(): Promise<boolean> {
  const u = await usuarioActual()
  return !!u && esSoloLectura(u)
}

export async function crearActividadAccion(form: FormData) {
  if (await bloqueadoVisor()) return
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
  if (await bloqueadoVisor()) return
  await eliminarActividad(texto(form, 'id'))
  revalidatePath('/programar')
}

export async function duplicarSemanaAccion(form: FormData) {
  if (await bloqueadoVisor()) return
  const areaId = texto(form, 'areaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (esSemanaPasada(anio, semana, semanaActual())) return
  const previa = semanaAnterior(anio, semana)
  await duplicarSemana(areaId, previa.anio, previa.semana, anio, semana)
  revalidatePath('/programar')
}

export async function crearResponsableAccion(form: FormData) {
  if (await bloqueadoVisor()) return
  const nombre = texto(form, 'nombre')
  const areaId = texto(form, 'areaId')
  if (!nombre || !areaId) return
  await crearResponsable(nombre, areaId)
  revalidatePath('/programar')
}

export async function actualizarActividadAccion(form: FormData) {
  if (await bloqueadoVisor()) return
  const id = texto(form, 'id')
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
  if (await bloqueadoVisor()) return
  const tareaId = texto(form, 'tareaId')
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
  if (await bloqueadoVisor()) return
  const tareaId = texto(form, 'tareaId')
  if (tareaId) await quitarSeleccionTarea(tareaId)
  revalidatePath('/programar')
}

export async function devolverAAsignacionAccion(form: FormData) {
  if (await bloqueadoVisor()) return
  const tareaId = texto(form, 'tareaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!tareaId || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  if (!esSemanaFutura(anio, semana, semanaActual())) return
  await devolverAAsignacion(tareaId, anio, semana)
  revalidatePath('/programar')
}

export async function devolverGrillaAlBancoAccion(form: FormData) {
  if (await bloqueadoVisor()) return
  const tareaId = texto(form, 'tareaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!tareaId || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  if (!esSemanaFutura(anio, semana, semanaActual())) return
  await devolverGrillaAlBanco(tareaId, anio, semana)
  revalidatePath('/programar')
}

export async function dedicarTractorAccion(form: FormData) {
  if (await bloqueadoVisor()) return
  const maquinaId = texto(form, 'maquinaId')
  const areaId = textoOpcional(form, 'areaId') // '' → null = quitar dedicación
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  const dia = Number(texto(form, 'dia'))
  if (!maquinaId || !Number.isInteger(anio) || !Number.isInteger(semana) || !Number.isInteger(dia)) return
  if (!esSemanaFutura(anio, semana, semanaActual())) return
  await dedicarTractor(maquinaId, areaId, anio, semana, dia)
  revalidatePath('/programar')
}

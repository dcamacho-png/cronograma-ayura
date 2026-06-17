'use server'

import { revalidatePath } from 'next/cache'
import { marcarEstado, reprogramarActividad } from '@/datos/repositorio'
import { siguienteSemana } from '@/dominio/semana'

const ESTADOS_VALIDOS = ['PENDIENTE', 'CUMPLIDA', 'PARCIAL', 'NO_CUMPLIDA', 'REPROGRAMADA']

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}
function textoOpcional(form: FormData, clave: string): string | null {
  const v = texto(form, clave)
  return v === '' ? null : v
}

export async function marcarEstadoAccion(form: FormData) {
  const id = texto(form, 'id')
  const estado = texto(form, 'estado')
  if (!id || !ESTADOS_VALIDOS.includes(estado)) return
  await marcarEstado(id, estado, textoOpcional(form, 'motivoId'), textoOpcional(form, 'nota'))
  revalidatePath('/cumplimiento')
}

export async function reprogramarAccion(form: FormData) {
  const id = texto(form, 'id')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!id || !anio || !semana || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  const prox = siguienteSemana(anio, semana)
  await reprogramarActividad(id, prox.anio, prox.semana)
  revalidatePath('/cumplimiento')
}

'use server'

import { revalidatePath } from 'next/cache'
import { marcarEstado, reprogramarActividad, registrarCumplimiento, crearActividadRealizada, reabrirActividad } from '@/datos/repositorio'
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
function numeroOpcional(form: FormData, clave: string): number | null {
  const v = texto(form, clave)
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function marcarEstadoAccion(form: FormData) {
  const id = texto(form, 'id')
  const estado = texto(form, 'estado')
  if (!id || !ESTADOS_VALIDOS.includes(estado)) return
  await marcarEstado(id, estado, textoOpcional(form, 'motivoId'), textoOpcional(form, 'nota'))
  revalidatePath('/cumplimiento')
}

export async function desmarcarAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  await reabrirActividad(id)
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

export async function agregarActividadRealizadaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  const dia = Number(texto(form, 'dia'))
  const responsableId = texto(form, 'responsableId')
  // Para maquinaria la descripción viene del catálogo; "__otra__" usa el texto libre.
  const descSelect = texto(form, 'descripcion')
  const descripcion = descSelect === '__otra__' ? texto(form, 'descripcionOtra') : descSelect
  if (!areaId || !Number.isInteger(anio) || !Number.isInteger(semana) || !(dia >= 1 && dia <= 7) || !responsableId || !descripcion) return
  const centroSelect = texto(form, 'centroCosto')
  const centroCosto = centroSelect === '__otra__' ? textoOpcional(form, 'centroCostoOtra') : (centroSelect || null)
  await crearActividadRealizada({
    areaId,
    anio,
    semana,
    dia,
    responsableId,
    descripcion,
    loteId: textoOpcional(form, 'loteId'),
    maquinaId: textoOpcional(form, 'maquinaId'),
    medida: numeroOpcional(form, 'medida'),
    centroCosto,
  })
  revalidatePath('/cumplimiento')
}

export async function registrarAccion(form: FormData) {
  const id = texto(form, 'id')
  const estado = texto(form, 'estado')
  if (!id || !ESTADOS_VALIDOS.includes(estado) || estado === 'PENDIENTE') return
  const motivoId = textoOpcional(form, 'motivoId')
  if (estado !== 'CUMPLIDA' && !motivoId) return
  const nota = textoOpcional(form, 'nota')
  const haRealizada = numeroOpcional(form, 'haRealizada')
  const centroSelect = texto(form, 'centroCosto')
  const centroCosto = centroSelect === '__otra__' ? textoOpcional(form, 'centroCostoOtra') : (centroSelect || null)
  const lotesHechos = form.getAll('loteHecho').map((v) => String(v))
  // La descripción del reemplazo (maquinaria) puede venir del catálogo o ser "__otra__" (texto libre).
  const reemplazoSelect = texto(form, 'reemplazoDescripcion')
  const reemplazoDescripcion = reemplazoSelect === '__otra__' ? textoOpcional(form, 'reemplazoDescripcionOtra') : (reemplazoSelect || null)
  const reemplazo = reemplazoDescripcion
    ? {
        descripcion: reemplazoDescripcion,
        loteId: textoOpcional(form, 'reemplazoLoteId'),
        maquinaId: textoOpcional(form, 'reemplazoMaquinaId'),
        medida: numeroOpcional(form, 'reemplazoMedida'),
      }
    : null
  await registrarCumplimiento(id, estado, motivoId, nota, haRealizada, reemplazo, centroCosto, lotesHechos)
  revalidatePath('/cumplimiento')
}

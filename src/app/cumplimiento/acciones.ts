'use server'

import { revalidatePath } from 'next/cache'
import { reprogramarActividad, crearActividadRealizada, devolverAlBanco, semanaDeActividad, registrarAvanceLoteGrupo, registrarAvanceObservacionGrupo, marcarCumplidaGrupo, registrarNovedadGrupo, reabrirGrupo, setLotesGrupo, setUnidadRealizadaGrupo, anexarLotesGrupo, registrarMedidaGeneralGrupo } from '@/datos/repositorio'
import { siguienteSemana, plazoCumplimientoVencido, semanaActual } from '@/dominio/semana'
import { usuarioActual } from '@/auth/sesion'

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

// ¿El usuario actual NO puede modificar el cumplimiento de esta semana?
// (plazo vencido y no es ADMIN). El ADMIN nunca queda bloqueado.
async function bloqueadoPorPlazo(anio: number, semana: number): Promise<boolean> {
  const u = await usuarioActual()
  if (u?.rol === 'ADMIN') return false
  return plazoCumplimientoVencido(anio, semana, semanaActual())
}

// Igual, resolviendo la semana a partir del id de actividad. Si la actividad no existe,
// se bloquea (la acción no tendría nada válido que hacer).
async function bloqueadoPorPlazoActividad(id: string): Promise<boolean> {
  const a = await semanaDeActividad(id)
  if (!a) return true
  return bloqueadoPorPlazo(a.anio, a.semana)
}

export async function reprogramarAccion(form: FormData) {
  const id = texto(form, 'id')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!id || !anio || !semana || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  if (await bloqueadoPorPlazo(anio, semana)) return
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
  if (await bloqueadoPorPlazo(anio, semana)) return
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

export async function devolverAlBancoAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await devolverAlBanco(id)
  revalidatePath('/cumplimiento')
}

// ---- Acciones a nivel de ACTIVIDAD (estándar). El `id` es una fila representativa. ----

export async function registrarAvanceLoteActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  if (!id || !(dia >= 1 && dia <= 7)) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const loteIds = form.getAll('loteAvance').map((v) => String(v))
  const avances = loteIds
    .map((loteId) => ({ loteId, cantidad: numeroOpcional(form, `cantidad_${loteId}`) ?? 0 }))
    .filter((a) => a.cantidad > 0)
  if (avances.length === 0) return
  await registrarAvanceLoteGrupo(id, dia, null, avances)
  revalidatePath('/cumplimiento')
}

export async function registrarAvanceMaquinariaAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  if (!id || !(dia >= 1 && dia <= 7)) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const maquinaId = textoOpcional(form, 'maquinaId')
  const centroCosto = textoOpcional(form, 'centroCosto')
  const loteIds = form.getAll('loteAvance').map((v) => String(v))
  const avances = loteIds
    .map((loteId) => ({ loteId, cantidad: numeroOpcional(form, `cantidad_${loteId}`) ?? 0 }))
    .filter((a) => a.cantidad > 0)
  if (avances.length === 0) return
  await registrarAvanceLoteGrupo(id, dia, maquinaId, avances, centroCosto)
  revalidatePath('/cumplimiento')
}

export async function registrarAvanceObservacionAccion(form: FormData) {
  const id = texto(form, 'id')
  const nota = texto(form, 'nota')
  if (!id || nota === '') return
  if (await bloqueadoPorPlazoActividad(id)) return
  await registrarAvanceObservacionGrupo(id, nota)
  revalidatePath('/cumplimiento')
}

export async function marcarCumplidaActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await marcarCumplidaGrupo(id)
  revalidatePath('/cumplimiento')
}

export async function setLotesActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const loteIds = form.getAll('loteId').map((v) => String(v))
  if (loteIds.length === 0) return
  await setLotesGrupo(id, loteIds)
  revalidatePath('/cumplimiento')
}

// Resuelve la unidad elegida: si es "otro", usa el texto libre; si no, el valor del select.
function unidadElegida(form: FormData): string {
  const u = texto(form, 'unidad')
  if (u === 'otro') return texto(form, 'unidadOtra') || 'otro'
  return u || 'cantidad'
}

export async function registrarAvanceEstandarAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  const loteId = texto(form, 'loteId')
  const cantidad = numeroOpcional(form, 'cantidad') ?? 0
  if (!id || !loteId || !(dia >= 1 && dia <= 7) || cantidad <= 0) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await anexarLotesGrupo(id, [loteId])
  await setUnidadRealizadaGrupo(id, unidadElegida(form))
  await registrarAvanceLoteGrupo(id, dia, null, [{ loteId, cantidad }])
  revalidatePath('/cumplimiento')
}

export async function registrarMedidaGeneralAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const cantidad = numeroOpcional(form, 'cantidad') ?? 0
  const nota = textoOpcional(form, 'nota')
  await registrarMedidaGeneralGrupo(id, unidadElegida(form), cantidad, nota)
  revalidatePath('/cumplimiento')
}

export async function registrarNovedadActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  const estado = texto(form, 'estado')
  if (!id || !ESTADOS_VALIDOS.includes(estado) || estado === 'PENDIENTE' || estado === 'CUMPLIDA') return
  const motivoId = textoOpcional(form, 'motivoId')
  if (!motivoId) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const nota = textoOpcional(form, 'nota')
  const lotesHechos = form.getAll('loteHecho').map((v) => String(v))
  // Cambio de actividad (estándar): descripción + lote, sin máquina/medida.
  const reemplazoDesc = texto(form, 'reemplazoDescripcion')
  const reemplazo = reemplazoDesc
    ? { descripcion: reemplazoDesc, loteId: textoOpcional(form, 'reemplazoLoteId') }
    : null
  await registrarNovedadGrupo(id, estado, motivoId, nota, reemplazo, lotesHechos)
  revalidatePath('/cumplimiento')
}

export async function desmarcarActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await reabrirGrupo(id)
  revalidatePath('/cumplimiento')
}

'use server'

import { revalidatePath } from 'next/cache'
import {
  crearTarea,
  eliminarTarea,
  seleccionarTarea,
  quitarSeleccionTarea,
  crearSolicitud,
  devolverAlSolicitante,
  reenviarSolicitud,
  editarSolicitud,
  editarTarea,
  eliminarSolicitud,
  areaDeTarea,
} from '@/datos/repositorio'
import { esSemanaPasada, esSemanaFutura, semanaActual } from '@/dominio/semana'
import { usuarioActual } from '@/auth/sesion'
import { puedeMutarArea } from '@/auth/permisos'

// ¿El usuario actual puede mutar datos del área dada? (sesión válida + rol + propiedad).
async function autorizado(areaId: string | null): Promise<boolean> {
  const u = await usuarioActual()
  return !!u && puedeMutarArea(u, areaId)
}
// Autoriza sobre una tarea existente según la "cara" del flujo de solicitudes:
// 'ejecutora' = quien la tiene en su tablero (areaId); 'solicitante' = quien la pidió.
async function autorizadoTarea(id: string, cara: 'ejecutora' | 'solicitante'): Promise<boolean> {
  const t = await areaDeTarea(id)
  if (!t) return false
  return autorizado(cara === 'ejecutora' ? t.areaId : t.solicitadaPorAreaId)
}
// El área SOLICITANTE puede editar/eliminar su solicitud mientras NO esté PROGRAMADA
// (una vez la otra área la programa, ya hay trabajo asignado y no se toca).
async function solicitudEditable(id: string): Promise<boolean> {
  const u = await usuarioActual()
  if (!u) return false
  const t = await areaDeTarea(id)
  if (!t || t.estado === 'PROGRAMADA') return false
  return puedeMutarArea(u, t.solicitadaPorAreaId)
}
// El área DUEÑA puede editar/eliminar su tarea del banco mientras no esté PROGRAMADA.
async function tareaPropiaEditable(id: string): Promise<boolean> {
  const u = await usuarioActual()
  if (!u) return false
  const t = await areaDeTarea(id)
  if (!t || t.estado === 'PROGRAMADA') return false
  return puedeMutarArea(u, t.areaId)
}

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

// Resuelve la unidad elegida en el formulario estándar: "otro"→texto libre; vacío→null.
function unidadElegida(form: FormData): string | null {
  const u = texto(form, 'unidad')
  if (!u) return null
  if (u === 'otro') return texto(form, 'unidadOtra') || 'otro'
  return u
}

export async function crearTareaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  if (!(await autorizado(areaId))) return
  const est = textoOpcional(form, 'estipulada')
  const descripcion = est === '__otra__'
    ? textoOpcional(form, 'otra')
    : (est ?? textoOpcional(form, 'descripcion'))
  if (!areaId || !descripcion) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  const medida: Record<string, number> = {}
  for (const id of loteIds) {
    const b = numeroOpcional(form, `bultos_${id}`)
    if (b != null) bultos[id] = b
    const m = numeroOpcional(form, `medida_${id}`)
    if (m != null) medida[id] = m
  }
  const detalle = textoOpcional(form, 'detalle')
  const unidad = unidadElegida(form)
  const fincaNombre = textoOpcional(form, 'fincaNombre')
  await crearTarea(
    areaId,
    descripcion,
    loteIds,
    Object.keys(bultos).length > 0 ? bultos : null,
    detalle,
    Object.keys(medida).length > 0 ? medida : null,
    unidad,
    fincaNombre,
  )
  revalidatePath('/tareas')
}

export async function eliminarTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  // Tarea propia del banco: la dueña puede eliminarla mientras no esté programada.
  if (!id || !(await tareaPropiaEditable(id))) return
  await eliminarTarea(id)
  revalidatePath('/tareas')
}

export async function editarTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id || !(await tareaPropiaEditable(id))) return
  const est = textoOpcional(form, 'estipulada')
  const descripcion = est === '__otra__'
    ? textoOpcional(form, 'otra')
    : (est ?? textoOpcional(form, 'descripcion'))
  if (!descripcion) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  for (const lid of loteIds) {
    const b = numeroOpcional(form, `bultos_${lid}`)
    if (b != null) bultos[lid] = b
  }
  const detalle = textoOpcional(form, 'detalle')
  const fincaNombre = textoOpcional(form, 'fincaNombre')
  await editarTarea(id, { descripcion, detalle, loteIds, bultosPorLote: Object.keys(bultos).length > 0 ? bultos : null, fincaNombre })
  revalidatePath('/tareas')
}

export async function seleccionarTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (id && Number.isInteger(anio) && Number.isInteger(semana)) {
    if (!(await autorizadoTarea(id, 'ejecutora'))) return
    if (esSemanaPasada(anio, semana, semanaActual())) return
    await seleccionarTarea(id, anio, semana)
  }
  revalidatePath('/tareas')
}

export async function quitarSeleccionTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id || !(await autorizadoTarea(id, 'ejecutora'))) return
  await quitarSeleccionTarea(id)
  revalidatePath('/tareas')
}

export async function crearSolicitudAccion(form: FormData) {
  const solicitanteAreaId = texto(form, 'solicitanteAreaId')
  const areaEjecutoraId = texto(form, 'areaEjecutoraId')
  // La solicitud la crea el área solicitante: debe ser la del usuario (o ADMIN).
  if (!(await autorizado(solicitanteAreaId))) return
  const est = textoOpcional(form, 'estipulada')
  const descripcion = est === '__otra__'
    ? textoOpcional(form, 'otra')
    : (est ?? textoOpcional(form, 'descripcion'))
  if (!solicitanteAreaId || !areaEjecutoraId || !descripcion || areaEjecutoraId === solicitanteAreaId) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  for (const id of loteIds) {
    const b = numeroOpcional(form, `bultos_${id}`)
    if (b != null) bultos[id] = b
  }
  const detalle = textoOpcional(form, 'detalle')
  const diasSugeridos = form.getAll('diaSugerido').map((v) => String(v).trim()).filter(Boolean).join(',') || null
  const responsablesSugeridosIds = form.getAll('responsableSugerido').map((v) => String(v).trim()).filter(Boolean).join(',') || null
  const fincaNombre = textoOpcional(form, 'fincaNombre')
  await crearSolicitud(areaEjecutoraId, descripcion, solicitanteAreaId, loteIds, Object.keys(bultos).length > 0 ? bultos : null, detalle, diasSugeridos, responsablesSugeridosIds, fincaNombre)
  revalidatePath('/tareas')
}

export async function devolverAlSolicitanteAccion(form: FormData) {
  const id = texto(form, 'id')
  // Devolver al solicitante lo hace el área ejecutora (la que tiene la tarea).
  if (!id || !(await autorizadoTarea(id, 'ejecutora'))) return
  await devolverAlSolicitante(id, textoOpcional(form, 'observacion'))
  revalidatePath('/tareas')
}

export async function reenviarSolicitudAccion(form: FormData) {
  const id = texto(form, 'id')
  // Reenviar una solicitud devuelta lo hace el área solicitante.
  if (!id || !(await autorizadoTarea(id, 'solicitante'))) return
  await reenviarSolicitud(id)
  revalidatePath('/tareas')
}

export async function editarSolicitudAccion(form: FormData) {
  const id = texto(form, 'id')
  // La edita el área solicitante, y solo mientras la solicitud no esté PROGRAMADA.
  if (!id || !(await solicitudEditable(id))) return
  const est = textoOpcional(form, 'estipulada')
  const descripcion = est === '__otra__'
    ? textoOpcional(form, 'otra')
    : (est ?? textoOpcional(form, 'descripcion'))
  if (!descripcion) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  for (const lid of loteIds) {
    const b = numeroOpcional(form, `bultos_${lid}`)
    if (b != null) bultos[lid] = b
  }
  const detalle = textoOpcional(form, 'detalle')
  const diasSugeridos = form.getAll('diaSugerido').map((v) => String(v).trim()).filter(Boolean).join(',') || null
  const responsablesSugeridosIds = form.getAll('responsableSugerido').map((v) => String(v).trim()).filter(Boolean).join(',') || null
  await editarSolicitud(id, { descripcion, detalle, loteIds, bultosPorLote: Object.keys(bultos).length > 0 ? bultos : null, diasSugeridos, responsablesSugeridosIds })
  revalidatePath('/tareas')
}

// El área solicitante elimina su solicitud mientras no esté PROGRAMADA (borra también
// cualquier actividad ligada para no dejar residuos).
export async function eliminarSolicitudAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id || !(await solicitudEditable(id))) return
  await eliminarSolicitud(id)
  revalidatePath('/tareas')
}

export async function programarTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id || !(await autorizadoTarea(id, 'ejecutora'))) return
  const v = texto(form, 'anioSemana')
  if (!v) {
    await quitarSeleccionTarea(id)
  } else {
    const [anioStr, semanaStr] = v.split('-')
    const anio = Number(anioStr)
    const semana = Number(semanaStr)
    if (Number.isInteger(anio) && Number.isInteger(semana)) {
      if (!esSemanaFutura(anio, semana, semanaActual())) return
      await seleccionarTarea(id, anio, semana)
    }
  }
  revalidatePath('/tareas')
}

import { prisma } from './prisma'
import { hashPassword } from '@/auth/password'
import { duplicarActividades, datosReprogramacion, detectarConflictosAsignacion } from '@/dominio/programacion'
import { turnoPorDia } from '@/dominio/turno'
import type { BorradorActividad, Conflicto } from '@/dominio/programacion'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'

export function listarAreas() {
  return prisma.area.findMany({ orderBy: { nombre: 'asc' } })
}

export function listarFincas() {
  return prisma.finca.findMany({ orderBy: { nombre: 'asc' } })
}

export function listarMotivos() {
  return prisma.motivo.findMany({ orderBy: { nombre: 'asc' } })
}

export function listarMaquinas() {
  return prisma.maquina.findMany({ orderBy: { nombre: 'asc' } })
}

export function listarResponsablesPorArea(areaId: string) {
  return prisma.responsable.findMany({ where: { areaId }, orderBy: { nombre: 'asc' } })
}

export function listarActividades(areaId: string, anio: number, semana: number) {
  return prisma.actividad.findMany({
    where: { areaId, anio, semana },
    include: {
      responsable: true,
      finca: true,
      motivo: true,
      maquina: true,
      areaTarea: true,
      lotes: true,
      _count: { select: { derivadas: true } },
    },
    orderBy: [{ dia: 'asc' }],
  })
}

export function crearActividad(datos: BorradorActividad) {
  return prisma.actividad.create({ data: datos })
}

export function eliminarActividad(id: string) {
  return prisma.actividad.delete({ where: { id } })
}

// Duplica las actividades de una semana origen hacia la semana destino del mismo área.
export async function duplicarSemana(
  areaId: string,
  anioOrigen: number,
  semanaOrigen: number,
  anioDestino: number,
  semanaDestino: number,
): Promise<number> {
  const origen = await prisma.actividad.findMany({ where: { areaId, anio: anioOrigen, semana: semanaOrigen } })
  const borradores = duplicarActividades(origen as unknown as ActividadDominio[], anioDestino, semanaDestino)
  if (borradores.length === 0) return 0
  await prisma.$transaction(borradores.map((b) => prisma.actividad.create({ data: b })))
  return borradores.length
}

// Marca el estado de una actividad (y su motivo/nota).
export function marcarEstado(
  id: string,
  estado: string,
  motivoId: string | null,
  nota: string | null,
) {
  return prisma.actividad.update({
    where: { id },
    data: { estado, motivoId, nota },
  })
}

// Crea un responsable nuevo en un área.
export function crearResponsable(nombre: string, areaId: string) {
  return prisma.responsable.create({ data: { nombre, areaId } })
}

// Crea la copia reprogramada de una actividad en la semana destino.
export async function reprogramarActividad(
  id: string,
  anioDestino: number,
  semanaDestino: number,
) {
  const origen = await prisma.actividad.findUnique({ where: { id } })
  if (!origen) return null
  // Evitar reprogramar dos veces la misma actividad.
  const yaReprogramada = await prisma.actividad.findFirst({ where: { origenId: id } })
  if (yaReprogramada) return yaReprogramada
  const datos = datosReprogramacion(origen as unknown as ActividadDominio, anioDestino, semanaDestino)
  return prisma.actividad.create({ data: datos })
}

export function crearArea(nombre: string) {
  return prisma.area.create({ data: { nombre } })
}

export function crearFinca(nombre: string) {
  return prisma.finca.create({ data: { nombre } })
}

export function crearMotivo(nombre: string) {
  return prisma.motivo.create({ data: { nombre } })
}

export function crearMaquina(nombre: string) {
  return prisma.maquina.create({ data: { nombre } })
}

export function listarResponsablesTodos() {
  return prisma.responsable.findMany({
    include: { area: true, _count: { select: { actividades: true } } },
    orderBy: { nombre: 'asc' },
  })
}

export function setResponsableActivo(id: string, activo: boolean) {
  return prisma.responsable.update({ where: { id }, data: { activo } })
}

// Actividades de un conjunto de semanas (todas las áreas), para el tablero mensual.
export function listarActividadesDeSemanas(semanas: { anio: number; semana: number }[]) {
  if (semanas.length === 0) {
    return prisma.actividad.findMany({ where: { id: '' } }) // lista vacía
  }
  return prisma.actividad.findMany({
    where: { OR: semanas.map((s) => ({ anio: s.anio, semana: s.semana })) },
    include: { area: true, motivo: true },
    orderBy: [{ anio: 'asc' }, { semana: 'asc' }],
  })
}

// Actualiza los campos editables de una actividad (descripción y turno).
export function actualizarActividad(id: string, descripcion: string, turno: string) {
  return prisma.actividad.update({
    where: { id },
    data: { descripcion, turno },
  })
}

// Error de bloqueo por integridad: lleva un mensaje claro para mostrar al usuario.
export class BloqueoError extends Error {}

export async function eliminarArea(id: string) {
  const [usuarios, responsables, actividades, actividadesTarea, tareas, tareasSolic] = await Promise.all([
    prisma.usuario.count({ where: { areaId: id } }),
    prisma.responsable.count({ where: { areaId: id } }),
    prisma.actividad.count({ where: { areaId: id } }),
    prisma.actividad.count({ where: { areaTareaId: id } }),
    prisma.tarea.count({ where: { areaId: id } }),
    prisma.tarea.count({ where: { solicitadaPorAreaId: id } }),
  ])
  const partes: string[] = []
  if (usuarios) partes.push(`${usuarios} usuario(s)`)
  if (responsables) partes.push(`${responsables} responsable(s)`)
  if (actividades + actividadesTarea) partes.push(`${actividades + actividadesTarea} actividad(es)`)
  if (tareas + tareasSolic) partes.push(`${tareas + tareasSolic} tarea(s)`)
  if (partes.length) {
    throw new BloqueoError(
      `No se puede eliminar el área: tiene ${partes.join(', ')}. Elimina o reasigna eso primero.`,
    )
  }
  return prisma.area.delete({ where: { id } })
}
export function eliminarFinca(id: string) {
  return prisma.finca.delete({ where: { id } })
}
export function eliminarMotivo(id: string) {
  return prisma.motivo.delete({ where: { id } })
}
export function eliminarMaquina(id: string) {
  return prisma.maquina.delete({ where: { id } })
}
export async function eliminarResponsable(id: string) {
  const actividades = await prisma.actividad.count({ where: { responsableId: id } })
  if (actividades) {
    throw new BloqueoError(
      `No se puede eliminar el responsable: tiene ${actividades} actividad(es) en el cronograma. Primero quita o reasigna esas actividades.`,
    )
  }
  return prisma.responsable.delete({ where: { id } })
}

// ---- Banco de tareas ----

export function listarTareasPendientes(areaId: string) {
  return prisma.tarea.findMany({
    where: { areaId, estado: 'PENDIENTE', anioSel: null },
    include: { finca: true, lotes: { include: { finca: true } }, solicitadaPorArea: true },
    orderBy: { descripcion: 'asc' },
  })
}

export async function crearTarea(areaId: string, descripcion: string, loteIds: string[]) {
  let fincaId: string | null = null
  if (loteIds.length > 0) {
    const primer = await prisma.lote.findUnique({ where: { id: loteIds[0] } })
    fincaId = primer?.fincaId ?? null
  }
  return prisma.tarea.create({
    data: { areaId, descripcion, fincaId, lotes: { connect: loteIds.map((id) => ({ id })) } },
  })
}

export function eliminarTarea(id: string) {
  return prisma.tarea.delete({ where: { id } })
}

export function seleccionarTarea(id: string, anio: number, semana: number) {
  return prisma.tarea.update({ where: { id }, data: { anioSel: anio, semanaSel: semana } })
}

export function quitarSeleccionTarea(id: string) {
  return prisma.tarea.update({ where: { id }, data: { anioSel: null, semanaSel: null } })
}

export function tareasPorAsignar(areaId: string, anio: number, semana: number) {
  return prisma.tarea.findMany({
    where: { areaId, estado: 'PENDIENTE', anioSel: anio, semanaSel: semana },
    include: { finca: true, lotes: { include: { finca: true } }, solicitadaPorArea: true },
    orderBy: { descripcion: 'asc' },
  })
}

// Asigna una tarea: crea la actividad (vinculada) y marca la tarea como PROGRAMADA.
// Asigna una tarea a uno o varios días de su semana: crea una actividad por día
// (mismo responsable, lote y turno) y marca la tarea como PROGRAMADA.
export async function asignarTarea(
  tareaId: string,
  responsableId: string,
  dias: number[],
  loteIdFallback: string | null,
  turno: string,
  maquinaPorDia: Record<number, string | null> = {},
): Promise<
  | { ok: false; motivo: 'tarea' }
  | { ok: false; motivo: 'conflicto'; conflictos: Conflicto[] }
  | { ok: true; creadas: number }
> {
  const tarea = await prisma.tarea.findUnique({ where: { id: tareaId }, include: { lotes: true } })
  if (!tarea || tarea.anioSel === null || tarea.semanaSel === null) return { ok: false, motivo: 'tarea' }
  const diasUnicos = [...new Set(dias)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  if (diasUnicos.length === 0) return { ok: false, motivo: 'tarea' }
  const anio = tarea.anioSel
  const semana = tarea.semanaSel
  const loteIds =
    tarea.lotes.length > 0 ? tarea.lotes.map((l) => l.id) : loteIdFallback ? [loteIdFallback] : []
  let fincaId: string | null = null
  if (loteIds.length > 0) {
    const primer = await prisma.lote.findUnique({ where: { id: loteIds[0] } })
    if (!primer) return { ok: false, motivo: 'tarea' }
    fincaId = primer.fincaId
  }
  return prisma.$transaction(async (tx) => {
    // Guardia contra choques (a prueba de carreras: dentro de la transacción).
    const existentes = await tx.actividad.findMany({
      where: { anio, semana, dia: { in: diasUnicos } },
      select: { dia: true, turno: true, maquinaId: true, responsableId: true },
    })
    const conflictos = detectarConflictosAsignacion(
      existentes,
      diasUnicos,
      responsableId,
      maquinaPorDia,
      turno,
    )
    if (conflictos.length > 0) {
      return { ok: false as const, motivo: 'conflicto' as const, conflictos }
    }
    let creadas = 0
    for (const dia of diasUnicos) {
      await tx.actividad.create({
        data: {
          anio,
          semana,
          dia,
          descripcion: tarea.descripcion,
          turno: turno.trim() || turnoPorDia(dia),
          vecesReprogramada: tarea.vecesReprogramada,
          areaId: tarea.areaId,
          fincaId,
          responsableId,
          maquinaId: maquinaPorDia[dia] ?? null,
          tareaId: tarea.id,
          lotes: { connect: loteIds.map((id) => ({ id })) },
        },
      })
      creadas += 1
    }
    await tx.tarea.update({ where: { id: tarea.id }, data: { estado: 'PROGRAMADA' } })
    return { ok: true as const, creadas }
  })
}

// ---- Actividades estipuladas (catálogo de maquinaria) ----

export function listarActividadesEstipuladas() {
  return prisma.actividadEstipulada.findMany({ orderBy: { nombre: 'asc' } })
}

export function crearActividadEstipulada(nombre: string) {
  return prisma.actividadEstipulada.create({ data: { nombre } })
}

export function eliminarActividadEstipulada(id: string) {
  return prisma.actividadEstipulada.delete({ where: { id } })
}

export function renombrarActividadEstipulada(id: string, nombre: string) {
  return prisma.actividadEstipulada.update({ where: { id }, data: { nombre } })
}

export function obtenerUsuarioPorLogin(usuario: string) {
  return prisma.usuario.findUnique({ where: { usuario } })
}

export function listarUsuarios() {
  return prisma.usuario.findMany({ include: { area: true }, orderBy: { usuario: 'asc' } })
}

export function crearUsuario(
  usuario: string,
  nombre: string,
  password: string,
  rol: string,
  areaId: string | null,
) {
  return prisma.usuario.create({
    data: { usuario, nombre, hash: hashPassword(password), rol, areaId: rol === 'AREA' ? areaId : null },
  })
}

export function cambiarContrasena(id: string, password: string) {
  return prisma.usuario.update({ where: { id }, data: { hash: hashPassword(password) } })
}

export function eliminarUsuario(id: string) {
  return prisma.usuario.delete({ where: { id } })
}

// ---- Lotes / potreros ----

export function listarLotes() {
  return prisma.lote.findMany({
    include: { finca: true },
    orderBy: [{ finca: { nombre: 'asc' } }, { nombre: 'asc' }],
  })
}

export function crearLote(nombre: string, fincaId: string, hectareas: number | null, tipoPasto: string | null) {
  return prisma.lote.create({ data: { nombre, fincaId, hectareas, tipoPasto } })
}

export function eliminarLote(id: string) {
  return prisma.lote.delete({ where: { id } })
}

// Registra el cumplimiento de una actividad PENDIENTE (la bloquea). Si no es CUMPLIDA,
// devuelve la tarea de origen al banco (sin semana) para reprogramarla, conservando el contador.
export async function registrarCumplimiento(
  id: string,
  estado: string,
  motivoId: string | null,
  nota: string | null,
  haFaltante: number | null,
) {
  const act = await prisma.actividad.findUnique({ where: { id }, include: { lotes: true } })
  if (!act || act.estado !== 'PENDIENTE') return null // ya registrada / bloqueada
  await prisma.actividad.update({ where: { id }, data: { estado, motivoId, nota, haFaltante } })
  // Novedad (todo lo que no es 100% cumplido): la tarea vuelve al banco sin semana,
  // conservando el contador de reprogramaciones. El registro de esta semana queda en el historial.
  // Solo aplica a tareas de UN día (única actividad en su semana). Si la tarea se programó en
  // varios días, cada día es independiente y no se devuelve al banco automáticamente.
  if (estado !== 'CUMPLIDA' && act.tareaId) {
    const enLaSemana = await prisma.actividad.count({
      where: { tareaId: act.tareaId, anio: act.anio, semana: act.semana },
    })
    if (enLaSemana === 1) {
      await prisma.tarea.update({
        where: { id: act.tareaId },
        data: {
          estado: 'PENDIENTE',
          anioSel: null,
          semanaSel: null,
          vecesReprogramada: act.vecesReprogramada + 1,
        },
      })
    }
  }
  return true
}

// Crea una solicitud: una tarea que ejecuta `areaEjecutoraId`, pedida por `solicitadaPorAreaId`.
export function crearSolicitud(
  areaEjecutoraId: string,
  descripcion: string,
  solicitadaPorAreaId: string,
  loteIds: string[],
) {
  return prisma.tarea.create({
    data: {
      areaId: areaEjecutoraId,
      descripcion,
      solicitadaPorAreaId,
      lotes: { connect: loteIds.map((id) => ({ id })) },
    },
  })
}

// Tareas que un área solicitó a otras (para seguimiento), con el área ejecutora incluida.
export function listarSolicitudesDeArea(areaId: string) {
  return prisma.tarea.findMany({
    where: { solicitadaPorAreaId: areaId },
    include: { area: true },
    orderBy: { descripcion: 'asc' },
  })
}

// Crea una actividad enlazada a uno o varios lotes; la finca se deduce del primer lote.
export async function crearActividadDesdeLotes(
  base: {
    anio: number
    semana: number
    dia: number
    areaId: string
    responsableId: string
    descripcion: string
    turno: string
    maquinaId: string | null
    areaTareaId: string | null
    horas: number | null
    hectareas: number | null
    planB: string | null
  },
  loteIds: string[],
) {
  if (loteIds.length === 0) return null
  const primer = await prisma.lote.findUnique({ where: { id: loteIds[0] } })
  if (!primer) return null
  return prisma.actividad.create({
    data: {
      ...base,
      fincaId: primer.fincaId,
      lotes: { connect: loteIds.map((id) => ({ id })) },
    },
  })
}

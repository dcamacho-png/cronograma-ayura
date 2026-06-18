import { prisma } from './prisma'
import { duplicarActividades, datosReprogramacion } from '@/dominio/programacion'
import { turnoPorDia } from '@/dominio/turno'
import { siguienteSemana } from '@/dominio/semana'
import type { BorradorActividad } from '@/dominio/programacion'
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

export function crearMaquina(nombre: string, operario: string | null) {
  return prisma.maquina.create({ data: { nombre, operario } })
}

export function listarResponsablesTodos() {
  return prisma.responsable.findMany({ include: { area: true }, orderBy: { nombre: 'asc' } })
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

export function eliminarArea(id: string) {
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
export function eliminarResponsable(id: string) {
  return prisma.responsable.delete({ where: { id } })
}

// ---- Banco de tareas ----

export function listarTareasPendientes(areaId: string) {
  return prisma.tarea.findMany({
    where: { areaId, estado: 'PENDIENTE' },
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
export async function asignarTarea(
  tareaId: string,
  responsableId: string,
  dia: number,
  loteIdFallback: string | null,
  turno: string,
) {
  const tarea = await prisma.tarea.findUnique({ where: { id: tareaId }, include: { lotes: true } })
  if (!tarea || tarea.anioSel === null || tarea.semanaSel === null) return null
  const anio = tarea.anioSel
  const semana = tarea.semanaSel
  const loteIds =
    tarea.lotes.length > 0 ? tarea.lotes.map((l) => l.id) : loteIdFallback ? [loteIdFallback] : []
  let fincaId: string | null = null
  if (loteIds.length > 0) {
    const primer = await prisma.lote.findUnique({ where: { id: loteIds[0] } })
    if (!primer) return null
    fincaId = primer.fincaId
  }
  return prisma.$transaction(async (tx) => {
    const actividad = await tx.actividad.create({
      data: {
        anio,
        semana,
        dia,
        descripcion: tarea.descripcion,
        turno: turno.trim() || turnoPorDia(dia),
        areaId: tarea.areaId,
        fincaId,
        responsableId,
        tareaId: tarea.id,
        lotes: { connect: loteIds.map((id) => ({ id })) },
      },
    })
    await tx.tarea.update({ where: { id: tarea.id }, data: { estado: 'PROGRAMADA' } })
    return actividad
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

// Registra el cumplimiento de una actividad PENDIENTE (la bloquea). Si es PARCIAL o
// REPROGRAMADA, además crea la copia de continuación en la semana siguiente con la
// observación de lo faltante.
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
  if (estado === 'PARCIAL' || estado === 'REPROGRAMADA') {
    const yaExiste = await prisma.actividad.findFirst({ where: { origenId: id } })
    if (!yaExiste) {
      const prox = siguienteSemana(act.anio, act.semana)
      await prisma.actividad.create({
        data: {
          anio: prox.anio,
          semana: prox.semana,
          dia: act.dia,
          descripcion: act.descripcion,
          turno: act.turno,
          estado: 'REPROGRAMADA',
          nota: nota ? `Faltante: ${nota}${haFaltante ? ` (${haFaltante} ha)` : ''}` : null,
          vecesReprogramada: act.vecesReprogramada + 1,
          origenId: act.id,
          areaId: act.areaId,
          fincaId: act.fincaId,
          responsableId: act.responsableId,
          lotes: { connect: act.lotes.map((l) => ({ id: l.id })) },
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

import { prisma } from './prisma'
import { Prisma } from '@prisma/client'
import { hashPassword } from '@/auth/password'
import { duplicarActividades, datosReprogramacion, detectarConflictosAsignacion, conflictosMaquinaEntreResponsables } from '@/dominio/programacion'
import { turnoPorDia } from '@/dominio/turno'
import type { BorradorActividad, Conflicto, Asignacion } from '@/dominio/programacion'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'
import {
  normalizarAvancePorLote,
  agregarAvances,
  totalAvanceLotes,
  editarAvanceEntrada,
  eliminarAvanceEntrada,
  type AvanceEntrada,
} from '@/dominio/avance-lote'
import { normalizarNovedades, agregarNovedad, eliminarNovedad, editarNovedad } from '@/dominio/novedades'

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
      tarea: { select: { detalle: true } },
      lotes: true,
      _count: { select: { derivadas: true } },
    },
    orderBy: [{ dia: 'asc' }],
  })
}

// Actividades que ESTE área solicitó a OTRA área (ejecutadas por la otra área).
// Sirven para mostrar en el Excel del área solicitante el cumplimiento de lo que pidió.
export function listarActividadesSolicitadas(areaId: string, anio: number, semana: number) {
  return prisma.actividad.findMany({
    where: {
      anio,
      semana,
      areaId: { not: areaId },
      tarea: { solicitadaPorAreaId: areaId },
    },
    include: {
      responsable: true,
      finca: true,
      motivo: true,
      maquina: true,
      areaTarea: true,
      area: true,
      tarea: { select: { detalle: true } },
      lotes: true,
      _count: { select: { derivadas: true } },
    },
    orderBy: [{ dia: 'asc' }],
  })
}

// Actividades CUMPLIDA del área para la pantalla de Consulta (solo lectura): propias
// (areaId) o solicitadas por el área a otras (tarea.solicitadaPorAreaId). Filtros opcionales.
export function consultarCulminadas(
  areaId: string,
  filtros: { responsableId?: string | null; fincaId?: string | null; centroCosto?: string | null; loteId?: string | null } = {},
) {
  return prisma.actividad.findMany({
    where: {
      estado: 'CUMPLIDA',
      OR: [{ areaId }, { tarea: { solicitadaPorAreaId: areaId } }],
      ...(filtros.responsableId ? { responsableId: filtros.responsableId } : {}),
      ...(filtros.fincaId ? { fincaId: filtros.fincaId } : {}),
      ...(filtros.centroCosto ? { centroCosto: filtros.centroCosto } : {}),
      ...(filtros.loteId ? { lotes: { some: { id: filtros.loteId } } } : {}),
    },
    include: {
      responsable: true,
      finca: true,
      maquina: true,
      lotes: true,
      area: true,
      tarea: { select: { solicitadaPorAreaId: true } },
    },
    orderBy: [{ anio: 'desc' }, { semana: 'desc' }, { dia: 'asc' }],
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

// Devuelve un día a PENDIENTE y limpia lo capturado al registrar (medida, centro de
// costo, motivo, nota, potreros). Para el "↩ desmarcar" sin dejar datos huérfanos.
export function reabrirActividad(id: string) {
  return prisma.actividad.update({
    where: { id },
    data: {
      estado: 'PENDIENTE',
      haRealizada: null,
      centroCosto: null,
      motivoId: null,
      nota: null,
      lotesHechos: Prisma.DbNull,
      avancePorLote: Prisma.DbNull,
    },
  })
}

// Año/semana ISO a la que pertenece una actividad; null si no existe.
export function semanaDeActividad(id: string) {
  return prisma.actividad.findUnique({ where: { id }, select: { anio: true, semana: true } })
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
    include: { area: true, motivo: true, lotes: { select: { id: true } } },
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

export async function crearTarea(
  areaId: string,
  descripcion: string,
  loteIds: string[],
  bultosPorLote: Record<string, number> | null = null,
  detalle: string | null = null,
  medidaPorLote: Record<string, number> | null = null,
  unidad: string | null = null,
) {
  let fincaId: string | null = null
  if (loteIds.length > 0) {
    const primer = await prisma.lote.findUnique({ where: { id: loteIds[0] } })
    fincaId = primer?.fincaId ?? null
  }
  return prisma.tarea.create({
    data: {
      areaId,
      descripcion,
      fincaId,
      detalle,
      lotes: { connect: loteIds.map((id) => ({ id })) },
      ...(bultosPorLote ? { bultosPorLote } : {}),
      ...(medidaPorLote ? { medidaPorLote } : {}),
      ...(unidad ? { unidad } : {}),
    },
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
// Asigna una tarea a la grilla: por cada responsable, crea una actividad por cada
// uno de SUS días, con su propio turno y máquina por día. Marca la tarea PROGRAMADA.
export async function asignarTarea(
  tareaId: string,
  asignaciones: Asignacion[],
  loteIdFallback: string | null,
  esMaquinaria = true,
): Promise<
  | { ok: false; motivo: 'tarea' }
  | { ok: false; motivo: 'conflicto'; conflictos: Conflicto[] }
  | { ok: true; creadas: number }
> {
  const tarea = await prisma.tarea.findUnique({ where: { id: tareaId }, include: { lotes: true } })
  if (!tarea || tarea.anioSel === null || tarea.semanaSel === null) return { ok: false, motivo: 'tarea' }
  // Normaliza días de cada asignación (enteros 1-7, únicos) y descarta responsables sin días.
  const asigs = asignaciones
    .map((a) => ({ ...a, dias: [...new Set(a.dias)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7) }))
    .filter((a) => a.responsableId && a.dias.length > 0)
  const diasTodos = [...new Set(asigs.flatMap((a) => a.dias))]
  if (asigs.length === 0 || diasTodos.length === 0) return { ok: false, motivo: 'tarea' }
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
    // Guardia contra choques (a prueba de carreras: la consulta va dentro de la transacción).
    const existentes = await tx.actividad.findMany({
      where: { anio, semana, dia: { in: diasTodos } },
      select: { dia: true, turno: true, maquinaId: true, responsableId: true },
    })
    const conflictosRaw = [
      ...asigs.flatMap((a) => detectarConflictosAsignacion(existentes, a.dias, a.responsableId, a.maquinaPorDia, a.turno)),
      ...conflictosMaquinaEntreResponsables(asigs),
    ]
    const vistos = new Set<string>()
    const conflictos = conflictosRaw.filter((c) => {
      const k = `${c.dia}-${c.tipo}-${c.responsableId ?? ''}`
      if (vistos.has(k)) return false
      vistos.add(k)
      return true
    })
    if (conflictos.length > 0) {
      return { ok: false as const, motivo: 'conflicto' as const, conflictos }
    }
    let creadas = 0
    for (const a of asigs) {
      for (const dia of a.dias) {
        await tx.actividad.create({
          data: {
            anio,
            semana,
            dia,
            descripcion: tarea.descripcion,
            turno: esMaquinaria ? (a.turno.trim() || turnoPorDia(dia)) : '',
            vecesReprogramada: tarea.vecesReprogramada,
            areaId: tarea.areaId,
            fincaId,
            responsableId: a.responsableId,
            maquinaId: a.maquinaPorDia[dia] ?? null,
            tareaId: tarea.id,
            lotes: { connect: loteIds.map((id) => ({ id })) },
            ...(tarea.bultosPorLote != null ? { bultosPorLote: tarea.bultosPorLote as Prisma.InputJsonValue } : {}),
            ...(tarea.unidad ? { unidadRealizada: tarea.unidad } : {}),
          },
        })
        creadas += 1
      }
    }
    await tx.tarea.update({ where: { id: tarea.id }, data: { estado: 'PROGRAMADA' } })
    return { ok: true as const, creadas }
  })
}

// ---- Actividades estipuladas (catálogo de maquinaria) ----

export function listarActividadesEstipuladas() {
  return prisma.actividadEstipulada.findMany({ orderBy: { nombre: 'asc' } })
}

export function crearActividadEstipulada(nombre: string, unidad: string = 'ha', maquinaria: boolean = true) {
  return prisma.actividadEstipulada.create({ data: { nombre, unidad, maquinaria } })
}

export function eliminarActividadEstipulada(id: string) {
  return prisma.actividadEstipulada.delete({ where: { id } })
}

export function renombrarActividadEstipulada(id: string, nombre: string) {
  return prisma.actividadEstipulada.update({ where: { id }, data: { nombre } })
}

export function setUnidadActividadEstipulada(id: string, unidad: string) {
  return prisma.actividadEstipulada.update({ where: { id }, data: { unidad } })
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

export async function registrarCumplimiento(
  id: string,
  estado: string,
  motivoId: string | null,
  nota: string | null,
  haRealizada: number | null,
  reemplazo?: { descripcion: string; loteId: string | null; maquinaId: string | null; medida: number | null } | null,
  centroCosto: string | null = null,
  lotesHechos: string[] = [],
) {
  const act = await prisma.actividad.findUnique({ where: { id }, include: { lotes: true } })
  if (!act || act.estado !== 'PENDIENTE') return null // ya registrada / bloqueada
  const notaFinal = reemplazo ? `Cambiada por: ${reemplazo.descripcion}` : nota
  await prisma.actividad.update({
    where: { id },
    data: {
      estado,
      motivoId,
      nota: notaFinal,
      haRealizada: reemplazo ? null : haRealizada,
      centroCosto,
      ...(lotesHechos.length ? { lotesHechos: lotesHechos as Prisma.InputJsonValue } : {}),
    },
  })

  // Novedad que vuelve al banco automáticamente: solo No cumplida / Reprogramada
  // (el Parcial se maneja con los botones de la UI). Solo tareas de un día.
  if ((estado === 'NO_CUMPLIDA' || estado === 'REPROGRAMADA') && act.tareaId) {
    const enLaSemana = await prisma.actividad.count({
      where: { tareaId: act.tareaId, anio: act.anio, semana: act.semana },
    })
    if (enLaSemana === 1) {
      await prisma.tarea.update({
        where: { id: act.tareaId },
        data: { estado: 'PENDIENTE', anioSel: null, semanaSel: null, vecesReprogramada: act.vecesReprogramada + 1 },
      })
    }
  }

  // Cambio de actividad: crear la que SÍ se hizo, como cumplida, mismo día/responsable.
  if (reemplazo && reemplazo.descripcion) {
    let fincaId: string | null = null
    if (reemplazo.loteId) {
      const lote = await prisma.lote.findUnique({ where: { id: reemplazo.loteId } })
      fincaId = lote?.fincaId ?? null
    }
    await prisma.actividad.create({
      data: {
        anio: act.anio,
        semana: act.semana,
        dia: act.dia,
        descripcion: reemplazo.descripcion,
        turno: act.turno,
        estado: 'CUMPLIDA',
        areaId: act.areaId,
        fincaId,
        responsableId: act.responsableId,
        maquinaId: reemplazo.maquinaId,
        haRealizada: reemplazo.medida,
        nota: `En reemplazo de: ${act.descripcion}`,
        lotes: reemplazo.loteId ? { connect: [{ id: reemplazo.loteId }] } : undefined,
      },
    })
  }

  return true
}

// Agrega un avance (incremental, por día) al historial de cada lote indicado.
// `avancePorLote` es Record<loteId, AvanceEntrada[]>. La actividad queda SIEMPRE
// PARCIAL; CUMPLIDA se marca a mano con marcarCumplidaDesdeParcial.
export async function registrarAvanceLote(
  actividadId: string,
  dia: number,
  maquinaId: string | null,
  avances: { loteId: string; cantidad: number }[],
) {
  const act = await prisma.actividad.findUnique({ where: { id: actividadId } })
  if (!act) return null
  // Se permite arrancar desde PENDIENTE (el primer avance lo pasa a PARCIAL) o seguir
  // sumando en PARCIAL. No se registran avances sobre cerradas/no cumplidas/reprogramadas.
  if (act.estado !== 'PENDIENTE' && act.estado !== 'PARCIAL') return null
  const actual = agregarAvances(
    normalizarAvancePorLote(act.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
    dia,
    maquinaId,
    avances.map((a) => ({ loteId: a.loteId, cantidad: a.cantidad })),
  )
  // Registrar avance nunca cierra la actividad: queda siempre PARCIAL.
  // CUMPLIDA se marca a mano cuando el trabajo realmente se completó.
  return prisma.actividad.update({
    where: { id: actividadId },
    data: {
      avancePorLote: actual as Prisma.InputJsonValue,
      estado: 'PARCIAL',
    },
  })
}

// Cierra manualmente un parcial: estado CUMPLIDA y medida realizada = suma de
// avances de los lotes vigentes. Conserva el historial. null si no está PARCIAL.
export async function marcarCumplidaDesdeParcial(actividadId: string) {
  const act = await prisma.actividad.findUnique({
    where: { id: actividadId },
    include: { lotes: { select: { id: true } } },
  })
  if (!act || act.estado !== 'PARCIAL') return null
  const avance = normalizarAvancePorLote(
    act.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
  )
  return prisma.actividad.update({
    where: { id: actividadId },
    data: { estado: 'CUMPLIDA', haRealizada: totalAvanceLotes(act.lotes, avance) },
  })
}

// Devuelve al banco la tarea de origen de una actividad (conserva la actividad
// registrada): tarea PENDIENTE, sin semana, +1 reprogramada. Misma lógica que la
// devolución que antes era automática para las novedades de un día.
export async function devolverAlBanco(actividadId: string) {
  const act = await prisma.actividad.findUnique({ where: { id: actividadId } })
  if (!act || !act.tareaId) return null
  return prisma.tarea.update({
    where: { id: act.tareaId },
    data: { estado: 'PENDIENTE', anioSel: null, semanaSel: null, vecesReprogramada: act.vecesReprogramada + 1 },
  })
}

// ---- Cumplimiento a nivel de ACTIVIDAD (grupo tareaId), versión estándar ----

// Filas hermanas: todas las de la misma (tareaId, anio, semana). A partir de un id
// representativo. Sin tareaId, el grupo es solo esa fila. Incluye lotes (compartidos).
async function filasHermanas(id: string) {
  const base = await prisma.actividad.findUnique({ where: { id }, include: { lotes: true } })
  if (!base) return null
  if (!base.tareaId) return { base, filas: [base] }
  const filas = await prisma.actividad.findMany({
    where: { tareaId: base.tareaId, anio: base.anio, semana: base.semana },
    include: { lotes: true },
  })
  return { base, filas }
}

// Agrega un avance por lote a TODA la actividad: mismo avancePorLote consolidado en
// cada fila del grupo; todas quedan PARCIAL. Solo afecta filas PENDIENTE/PARCIAL.
export async function registrarAvanceLoteGrupo(
  id: string,
  dia: number,
  maquinaId: string | null,
  avances: { loteId: string; cantidad: number }[],
  centroCosto?: string | null,
  responsableId?: string | null,
  observacion?: string | null,
  bultosPorLote?: Record<string, number> | null,
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const actual = agregarAvances(
    normalizarAvancePorLote(g.base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
    dia,
    maquinaId,
    avances,
    centroCosto,
    responsableId,
    observacion,
  )
  const bultosMerge = bultosPorLote
    ? { ...((g.base.bultosPorLote ?? {}) as Record<string, number>), ...bultosPorLote }
    : null
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) =>
        prisma.actividad.update({
          where: { id: f.id },
          data: {
            avancePorLote: actual as Prisma.InputJsonValue,
            estado: 'PARCIAL',
            ...(bultosMerge ? { bultosPorLote: bultosMerge as Prisma.InputJsonValue } : {}),
          },
        }),
      ),
  )
  return true
}

// Edita una entrada de avance (loteId, index) del grupo y reescribe el JSON en todas las
// filas abiertas. No cambia estado ni haRealizada. null si el grupo no existe.
export async function editarAvanceEntradaGrupo(
  id: string,
  loteId: string,
  index: number,
  cambios: { cantidad?: number; dia?: number; observacion?: string | null },
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const actual = editarAvanceEntrada(
    normalizarAvancePorLote(g.base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
    loteId,
    index,
    cambios,
  )
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({ where: { id: f.id }, data: { avancePorLote: actual as Prisma.InputJsonValue } })),
  )
  return true
}

// Elimina una entrada de avance (loteId, index) del grupo y reescribe el JSON en todas las
// filas abiertas. No cambia estado. null si el grupo no existe.
export async function eliminarAvanceEntradaGrupo(id: string, loteId: string, index: number) {
  const g = await filasHermanas(id)
  if (!g) return null
  const actual = eliminarAvanceEntrada(
    normalizarAvancePorLote(g.base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
    loteId,
    index,
  )
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({ where: { id: f.id }, data: { avancePorLote: actual as Prisma.InputJsonValue } })),
  )
  return true
}

// Agrega una novedad (razón) al log del grupo. No cambia el estado.
export async function agregarNovedadGrupo(
  id: string,
  entrada: { dia: number; motivoId: string | null; observacion: string | null },
  reemplazo?: Reemplazo | null,
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const lista = agregarNovedad(normalizarNovedades(g.base.novedades), entrada)
  await prisma.$transaction(async (tx) => {
    for (const f of g.filas) {
      if (f.estado !== 'PENDIENTE' && f.estado !== 'PARCIAL') continue
      await tx.actividad.update({
        where: { id: f.id },
        data: { novedades: lista as unknown as Prisma.InputJsonValue },
      })
    }
    if (reemplazo?.descripcion) {
      await crearActividadReemplazo(tx, g.base, reemplazo)
    }
  })
  return true
}

// Elimina una novedad del log por índice.
export async function eliminarNovedadGrupo(id: string, index: number) {
  const g = await filasHermanas(id)
  if (!g) return null
  const lista = eliminarNovedad(normalizarNovedades(g.base.novedades), index)
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({
        where: { id: f.id },
        data: { novedades: lista as unknown as Prisma.InputJsonValue },
      })),
  )
  return true
}

// Cierra una actividad como PARCIAL (bloqueada) sin tocar avances/novedades.
export async function cerrarParcialGrupo(id: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({ where: { id: f.id }, data: { estado: 'PARCIAL', cerrada: true } })),
  )
  return true
}

// Quita el bloqueo de cierre conservando estado/avances/novedades (para corregir un cierre).
export async function reabrirCierreGrupo(id: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas.map((f) => prisma.actividad.update({ where: { id: f.id }, data: { cerrada: false } })),
  )
  return true
}

// Edita una novedad del log por índice (día/motivo/observación) en las filas abiertas.
export async function editarNovedadGrupo(
  id: string,
  index: number,
  cambios: { dia?: number; motivoId?: string | null; observacion?: string | null },
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const lista = editarNovedad(normalizarNovedades(g.base.novedades), index, cambios)
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) => prisma.actividad.update({ where: { id: f.id }, data: { novedades: lista as unknown as Prisma.InputJsonValue } })),
  )
  return true
}

// Avance "genérico" (actividad SIN lotes): guarda la observación en nota de todas las
// filas y las deja PARCIAL. Editable (sobrescribe la nota previa).
export async function registrarAvanceObservacionGrupo(id: string, nota: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) =>
        prisma.actividad.update({ where: { id: f.id }, data: { nota, estado: 'PARCIAL' } }),
      ),
  )
  return true
}

// Cierra la actividad: todas las filas no cumplidas pasan a CUMPLIDA. Si hay lotes,
// haRealizada = suma de avances de los lotes vigentes (igual en todas las filas).
export async function marcarCumplidaGrupo(id: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  const total = totalAvanceLotes(
    g.base.lotes,
    normalizarAvancePorLote(g.base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
  )
  const tieneLotes = g.base.lotes.length > 0
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) =>
        prisma.actividad.update({
          where: { id: f.id },
          data: { estado: 'CUMPLIDA', cerrada: true, ...(tieneLotes ? { haRealizada: total } : {}) },
        }),
      ),
  )
  return true
}

// Fija los potreros (lotes) de TODA la actividad (grupo tareaId): reemplaza el conjunto
// en cada fila-hermana y ajusta la finca a la del primer potrero. Debe quedar ≥1 potrero.
export async function setLotesGrupo(id: string, loteIds: string[]) {
  const g = await filasHermanas(id)
  if (!g || loteIds.length === 0) return null
  const primer = await prisma.lote.findUnique({ where: { id: loteIds[0] } })
  if (!primer) return null
  await prisma.$transaction(
    g.filas.map((f) =>
      prisma.actividad.update({
        where: { id: f.id },
        data: { fincaId: primer.fincaId, lotes: { set: loteIds.map((lid) => ({ id: lid })) } },
      }),
    ),
  )
  return true
}

// Fija la unidad de medida (texto libre) en todas las filas del grupo.
export async function setUnidadRealizadaGrupo(id: string, unidad: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas.map((f) =>
      prisma.actividad.update({ where: { id: f.id }, data: { unidadRealizada: unidad } }),
    ),
  )
  return true
}

// Conecta (sin quitar) esos lotes a todas las filas del grupo. Para "anexar" al registrar
// un avance de un potrero que aún no estaba asignado.
export async function anexarLotesGrupo(id: string, loteIds: string[]) {
  const g = await filasHermanas(id)
  if (!g || loteIds.length === 0) return null
  await prisma.$transaction(
    g.filas.map((f) =>
      prisma.actividad.update({
        where: { id: f.id },
        data: { lotes: { connect: loteIds.map((lid) => ({ id: lid })) } },
      }),
    ),
  )
  return true
}

// Actividad general (sin lotes): fija unidad + medida (haRealizada) + nota, y deja las
// filas abiertas en PARCIAL (igual que la observación actual).
export async function registrarMedidaGeneralGrupo(id: string, unidad: string, cantidad: number, nota: string | null) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) =>
        prisma.actividad.update({
          where: { id: f.id },
          data: { unidadRealizada: unidad, haRealizada: cantidad, nota, estado: 'PARCIAL' },
        }),
      ),
  )
  return true
}

type Reemplazo = { descripcion: string; unidad?: string | null; maquinaId?: string | null; loteIds?: string[]; medida?: Record<string, number>; bultos?: Record<string, number>; dia?: number | null }

// Crea UNA actividad de reemplazo ("En reemplazo de: <base.descripcion>", CUMPLIDA) dentro de
// una transacción. Reutilizado por registrarNovedadGrupo (al cerrar por cambio) y por
// agregarNovedadGrupo (al registrar una novedad de cambio, sin cerrar la original).
async function crearActividadReemplazo(
  tx: Prisma.TransactionClient,
  base: { anio: number; semana: number; dia: number; turno: string; areaId: string; responsableId: string; descripcion: string },
  reemplazo: Reemplazo,
) {
  let fincaId: string | null = null
  if (reemplazo.loteIds?.[0]) {
    const lote = await tx.lote.findUnique({ where: { id: reemplazo.loteIds[0] } })
    fincaId = lote?.fincaId ?? null
  }
  await tx.actividad.create({
    data: {
      anio: base.anio,
      semana: base.semana,
      dia: reemplazo.dia ?? base.dia,
      descripcion: reemplazo.descripcion,
      turno: base.turno,
      estado: 'CUMPLIDA',
      areaId: base.areaId,
      fincaId,
      responsableId: base.responsableId,
      maquinaId: reemplazo.maquinaId ?? null,
      nota: `En reemplazo de: ${base.descripcion}`,
      lotes: reemplazo.loteIds?.length ? { connect: reemplazo.loteIds.map((lid) => ({ id: lid })) } : undefined,
      ...(reemplazo.medida && Object.keys(reemplazo.medida).length ? { haRealizada: Object.values(reemplazo.medida).reduce((s, n) => s + n, 0) } : {}),
      ...(reemplazo.unidad ? { unidadRealizada: reemplazo.unidad } : {}),
      ...(reemplazo.bultos && Object.keys(reemplazo.bultos).length ? { bultosPorLote: reemplazo.bultos as Prisma.InputJsonValue } : {}),
    },
  })
}

// Novedad de la actividad completa: aplica estado (NO_CUMPLIDA/PARCIAL/REPROGRAMADA) +
// motivo/nota a todas las filas. Para No cumplida/Reprogramada devuelve la tarea al banco
// (toda la actividad es una sola novedad). Cambio de actividad: crea UNA actividad de
// reemplazo (cumplida) con el día/responsable de la fila base.
export async function registrarNovedadGrupo(
  id: string,
  estado: string,
  motivoId: string | null,
  nota: string | null,
  reemplazo?: { descripcion: string; unidad?: string | null; loteIds?: string[]; medida?: Record<string, number>; bultos?: Record<string, number>; dia?: number | null } | null,
  lotesHechos: string[] = [],
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const notaFinal = reemplazo ? `Cambiada por: ${reemplazo.descripcion}` : nota
  await prisma.$transaction(async (tx) => {
    for (const f of g.filas) {
      if (f.estado === 'CUMPLIDA') continue
      await tx.actividad.update({
        where: { id: f.id },
        data: {
          estado,
          motivoId,
          nota: notaFinal,
          cerrada: true,
          ...(lotesHechos.length
            ? {
                lotesHechos: lotesHechos as Prisma.InputJsonValue,
                lotes: { connect: lotesHechos.map((lid) => ({ id: lid })) },
              }
            : {}),
        },
      })
    }
    if (estado === 'REPROGRAMADA' && g.base.tareaId) {
      await tx.tarea.update({
        where: { id: g.base.tareaId },
        data: {
          estado: 'PENDIENTE',
          anioSel: null,
          semanaSel: null,
          vecesReprogramada: g.base.vecesReprogramada + 1,
        },
      })
    }
    if (reemplazo?.descripcion) {
      await crearActividadReemplazo(tx, g.base, reemplazo)
    }
  })
  return true
}

// Desmarca toda la actividad: todas las filas vuelven a PENDIENTE y se limpia lo
// capturado (medida, centro de costo, motivo, nota, potreros, avances).
export async function reabrirGrupo(id: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas.map((f) =>
      prisma.actividad.update({
        where: { id: f.id },
        data: {
          estado: 'PENDIENTE',
          haRealizada: null,
          centroCosto: null,
          motivoId: null,
          nota: null,
          lotesHechos: Prisma.DbNull,
          avancePorLote: Prisma.DbNull,
          cerrada: false,
        },
      }),
    ),
  )
  return true
}

// Crea una solicitud: una tarea que ejecuta `areaEjecutoraId`, pedida por `solicitadaPorAreaId`.
export function crearSolicitud(
  areaEjecutoraId: string,
  descripcion: string,
  solicitadaPorAreaId: string,
  loteIds: string[],
  bultosPorLote: Record<string, number> | null = null,
  detalle: string | null = null,
  diasSugeridos: string | null = null,
  responsablesSugeridosIds: string | null = null,
) {
  return prisma.tarea.create({
    data: {
      areaId: areaEjecutoraId,
      descripcion,
      solicitadaPorAreaId,
      detalle,
      diasSugeridos,
      responsablesSugeridosIds,
      lotes: { connect: loteIds.map((id) => ({ id })) },
      ...(bultosPorLote ? { bultosPorLote } : {}),
    },
  })
}

// Deshace la asignación de una tarea en una semana: borra sus actividades de esa
// semana y la deja PENDIENTE en la misma semana (reaparece en "Tareas por asignar").
export async function devolverAAsignacion(tareaId: string, anio: number, semana: number) {
  await prisma.actividad.deleteMany({ where: { tareaId, anio, semana } })
  return prisma.tarea.update({ where: { id: tareaId }, data: { estado: 'PENDIENTE' } })
}

// Desde la grilla, en un solo paso: borra las actividades asignadas y devuelve la
// tarea al banco (PENDIENTE, sin semana). Combina devolverAAsignacion + quitarSeleccion.
// No cuenta como reprogramación: es planeación previa al inicio de la semana.
export async function devolverGrillaAlBanco(tareaId: string, anio: number, semana: number) {
  await prisma.actividad.deleteMany({ where: { tareaId, anio, semana } })
  return prisma.tarea.update({
    where: { id: tareaId },
    data: { estado: 'PENDIENTE', anioSel: null, semanaSel: null },
  })
}

// Maquinaria devuelve una tarea solicitada al área que la pidió (no la elimina).
export function devolverAlSolicitante(id: string, observacion: string | null) {
  return prisma.tarea.update({
    where: { id },
    data: { estado: 'DEVUELTA', anioSel: null, semanaSel: null, observacionDevolucion: observacion },
  })
}

// El área solicitante vuelve a enviar al banco de la ejecutora una tarea devuelta.
export function reenviarSolicitud(id: string) {
  return prisma.tarea.update({
    where: { id },
    data: { estado: 'PENDIENTE', anioSel: null, semanaSel: null, observacionDevolucion: null },
  })
}

export function editarSolicitud(
  id: string,
  datos: {
    descripcion: string
    detalle: string | null
    loteIds: string[]
    bultosPorLote: Record<string, number> | null
    diasSugeridos: string | null
    responsablesSugeridosIds: string | null
  },
) {
  return prisma.tarea.update({
    where: { id },
    data: {
      descripcion: datos.descripcion,
      detalle: datos.detalle,
      diasSugeridos: datos.diasSugeridos,
      responsablesSugeridosIds: datos.responsablesSugeridosIds,
      bultosPorLote: datos.bultosPorLote ?? undefined,
      ...(datos.loteIds.length > 0 ? { lotes: { set: datos.loteIds.map((lid) => ({ id: lid })) } } : {}),
    },
  })
}

// Tareas que un área solicitó a otras (para seguimiento), con el área ejecutora incluida.
export function listarSolicitudesDeArea(areaId: string) {
  return prisma.tarea.findMany({
    where: { solicitadaPorAreaId: areaId },
    include: {
      area: true,
      lotes: true,
      _count: { select: { actividades: { where: { estado: 'CUMPLIDA' } } } },
    },
    orderBy: { descripcion: 'asc' },
  })
}

// Crea una actividad no programada registrada como CUMPLIDA en Cumplimiento.
export async function crearActividadRealizada(datos: {
  areaId: string
  anio: number
  semana: number
  dia: number
  responsableId: string
  descripcion: string
  loteId: string | null
  maquinaId: string | null
  medida: number | null
  centroCosto: string | null
}) {
  let fincaId: string | null = null
  if (datos.loteId) {
    const lote = await prisma.lote.findUnique({ where: { id: datos.loteId } })
    fincaId = lote?.fincaId ?? null
  }
  return prisma.actividad.create({
    data: {
      anio: datos.anio,
      semana: datos.semana,
      dia: datos.dia,
      descripcion: datos.descripcion,
      estado: 'CUMPLIDA',
      noProgramada: true,
      areaId: datos.areaId,
      fincaId,
      responsableId: datos.responsableId,
      maquinaId: datos.maquinaId,
      haRealizada: datos.medida,
      centroCosto: datos.centroCosto,
      lotes: datos.loteId ? { connect: [{ id: datos.loteId }] } : undefined,
    },
  })
}

export function setPantallasUsuario(id: string, pantallas: string | null) {
  return prisma.usuario.update({ where: { id }, data: { pantallas } })
}

export function setVariantesArea(
  id: string,
  flags: { maqTareas: boolean; maqProgramar: boolean; maqCumplimiento: boolean; maqResumen: boolean },
) {
  return prisma.area.update({ where: { id }, data: flags })
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

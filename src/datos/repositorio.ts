import { prisma } from './prisma'
import { duplicarActividades, datosReprogramacion } from '@/dominio/programacion'
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
    include: { responsable: true, finca: true, motivo: true, maquina: true, areaTarea: true },
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

import { filasCumplimientoGrupo, type ActividadExport } from '@/dominio/cumplimiento-export'
import { agruparPorActividad, estadoActividad } from '@/dominio/metricas'
import type { Estado } from '@/dominio/tipos'
import type { AvanceEntrada } from '@/dominio/avance-lote'
import type { BultosPorLote } from '@/dominio/bultos'

// Forma mínima de una actividad cargada con relaciones que necesitan el agrupado
// (id/tareaId), el filtro de estado (estado/dia) y el mapeo a ActividadExport.
// Los campos JSON llegan crudos de Prisma (unknown) y se castean al mapear.
export type ActExportRaw = {
  id: string
  tareaId: string | null
  dia: number
  descripcion: string
  estado: string
  haRealizada: number | null
  centroCosto: string | null
  nota: string | null
  unidadRealizada?: string | null
  responsable: { nombre: string }
  maquina: { nombre: string } | null
  finca: { nombre: string } | null
  lotes: { id: string; nombre: string }[]
  bultosPorLote: unknown
  lotesHechos: unknown
  avancePorLote: unknown
  tarea?: { detalle: string | null } | null
  area?: { nombre: string } | null
}

export type CtxFilas = {
  unidadPorNombre: Record<string, string>
  nombreMaquina: (id: string | null) => string
  nombreResponsable: (id: string | null) => string
  fechaDeDia: (dia: number) => string
}

function aExport(a: ActExportRaw): ActividadExport {
  return {
    ...a,
    bultosPorLote: a.bultosPorLote as BultosPorLote | null,
    lotesHechos: a.lotesHechos as string[] | null,
    avancePorLote: a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
    detalle: a.tarea?.detalle ?? null,
  }
}

// Filas de cumplimiento (sin las columnas Semana/Área) de un conjunto de actividades
// de UN (área, año, semana). Agrupa por actividad, deja solo CUMPLIDA/PARCIAL y delega
// el armado a la función de dominio pura. `ejecutadaPor` etiqueta cada grupo.
export function construirFilasCumplimiento(
  items: ActExportRaw[],
  ctx: CtxFilas,
  ejecutadaPor: (grupo: ActExportRaw[]) => string,
): (string | number)[][] {
  const filas: (string | number)[][] = []
  for (const grupo of agruparPorActividad(items).values()) {
    const e = estadoActividad(grupo.map((a) => ({ estado: a.estado as Estado })))
    if (e !== 'CUMPLIDA' && e !== 'PARCIAL') continue
    for (const fila of filasCumplimientoGrupo(
      grupo.map(aExport),
      ctx.fechaDeDia(grupo[0].dia),
      ctx.unidadPorNombre,
      { fechaDeDia: ctx.fechaDeDia, nombreMaquina: ctx.nombreMaquina, nombreResponsable: ctx.nombreResponsable },
      ejecutadaPor(grupo),
    )) {
      filas.push(fila)
    }
  }
  return filas
}

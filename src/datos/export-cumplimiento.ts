import { filasCumplimientoGrupo, COLUMNAS_CUMPLIMIENTO, type ActividadExport } from '@/dominio/cumplimiento-export'
import { agruparPorActividad, estadoActividad } from '@/dominio/metricas'
import type { Estado } from '@/dominio/tipos'
import type { AvanceEntrada } from '@/dominio/avance-lote'
import type { BultosPorLote } from '@/dominio/bultos'
import { fechasDeSemana } from '@/dominio/semana'

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

export const COLUMNAS_MAESTRO = ['Semana', 'Área', ...COLUMNAS_CUMPLIMIENTO] as const

export type ActMaestro = ActExportRaw & {
  areaId: string
  anio: number
  semana: number
  area: { nombre: string }
}

// Arma TODAS las filas del maestro: agrupa por (área, año, semana), antepone
// [Semana, Área] y ordena Área → Semana → día (el día viene del orden interno de
// construirFilasCumplimiento). Solo propias por área ⇒ cada actividad una sola vez.
export function construirFilasMaestro(
  actividades: ActMaestro[],
  catalogo: { nombre: string; unidad: string }[],
  maquinas: { id: string; nombre: string }[],
  responsables: { id: string; nombre: string }[],
): (string | number)[][] {
  const unidadPorNombre = Object.fromEntries(catalogo.map((e) => [e.nombre, e.unidad]))
  const mapMaquina = new Map(maquinas.map((m) => [m.id, m.nombre]))
  const mapResponsable = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombreMaquina = (id: string | null) => (id ? mapMaquina.get(id) ?? '' : '')
  const nombreResponsable = (id: string | null) => (id ? mapResponsable.get(id) ?? '' : '')
  const fmtFecha = (f: Date) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  // Agrupar por (área, año, semana).
  const grupos = new Map<string, { areaNombre: string; anio: number; semana: number; items: ActMaestro[] }>()
  for (const a of actividades) {
    const k = `${a.areaId}|${a.anio}|${a.semana}`
    const g = grupos.get(k) ?? { areaNombre: a.area.nombre, anio: a.anio, semana: a.semana, items: [] }
    g.items.push(a)
    grupos.set(k, g)
  }
  const ordenados = [...grupos.values()].sort(
    (x, y) => x.areaNombre.localeCompare(y.areaNombre) || x.anio - y.anio || x.semana - y.semana,
  )

  const filas: (string | number)[][] = []
  for (const g of ordenados) {
    const fechas = fechasDeSemana(g.anio, g.semana)
    const fechaDeDia = (dia: number) => (fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : '')
    const ctx: CtxFilas = { unidadPorNombre, nombreMaquina, nombreResponsable, fechaDeDia }
    const semanaLabel = `${g.anio}-S${g.semana}`
    for (const fila of construirFilasCumplimiento(g.items, ctx, () => '')) {
      filas.push([semanaLabel, g.areaNombre, ...fila])
    }
  }
  return filas
}

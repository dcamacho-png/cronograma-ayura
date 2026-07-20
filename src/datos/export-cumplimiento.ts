import { filasCumplimientoGrupo, COLUMNAS_CUMPLIMIENTO, type ActividadExport } from '@/dominio/cumplimiento-export'
import { agruparPorActividad, estadoActividad } from '@/dominio/metricas'
import type { Estado } from '@/dominio/tipos'
import type { AvanceEntrada } from '@/dominio/avance-lote'
import type { BultosPorLote } from '@/dominio/bultos'
import { fechasDeSemana, mesDeSemana } from '@/dominio/semana'

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

export type ActMaestro = ActExportRaw & {
  areaId: string
  anio: number
  semana: number
  area: { nombre: string }
}

export type HojaExport = { nombre: string; columnas: string[]; filas: (string | number)[][] }
export type LibroArea = { area: string; hojas: HojaExport[] } // hojas[0] = General, luego meses asc

const COLS_GENERAL: string[] = ['Mes', 'Semana', ...COLUMNAS_CUMPLIMIENTO]
const COLS_MES: string[] = ['Semana', ...COLUMNAS_CUMPLIMIENTO]

// Un libro (archivo) por área con datos: hoja "General" (todas las filas del área con
// columnas Mes+Semana, orden Mes→Semana) + una hoja por mes (nombre "AÑO-MM", columnas
// Semana+…, orden Semana), en orden cronológico ascendente. Solo propias, solo CUMPLIDA/PARCIAL.
export function construirLibrosPorArea(
  actividades: ActMaestro[],
  catalogo: { nombre: string; unidad: string }[],
  maquinas: { id: string; nombre: string }[],
  responsables: { id: string; nombre: string }[],
): LibroArea[] {
  const unidadPorNombre = Object.fromEntries(catalogo.map((e) => [e.nombre, e.unidad]))
  const mapMaquina = new Map(maquinas.map((m) => [m.id, m.nombre]))
  const mapResponsable = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombreMaquina = (id: string | null) => (id ? mapMaquina.get(id) ?? '' : '')
  const nombreResponsable = (id: string | null) => (id ? mapResponsable.get(id) ?? '' : '')
  const fmtFecha = (f: Date) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  // Agrupar por área.
  const porArea = new Map<string, { areaNombre: string; items: ActMaestro[] }>()
  for (const a of actividades) {
    const g = porArea.get(a.areaId) ?? { areaNombre: a.area.nombre, items: [] }
    g.items.push(a)
    porArea.set(a.areaId, g)
  }

  const libros: LibroArea[] = []
  const areas = [...porArea.values()].sort((x, y) => x.areaNombre.localeCompare(y.areaNombre))
  for (const area of areas) {
    // Agrupar las actividades del área por (año, semana) y armar sus filas.
    const porSemana = new Map<string, { anio: number; semana: number; items: ActMaestro[] }>()
    for (const a of area.items) {
      const k = `${a.anio}|${a.semana}`
      const g = porSemana.get(k) ?? { anio: a.anio, semana: a.semana, items: [] }
      g.items.push(a)
      porSemana.set(k, g)
    }
    type FilaMes = { anioMes: number; mesLabel: string; semana: number; semanaLabel: string; fila: (string | number)[] }
    const todas: FilaMes[] = []
    for (const s of porSemana.values()) {
      const fechas = fechasDeSemana(s.anio, s.semana)
      const fechaDeDia = (dia: number) => (fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : '')
      const ctx: CtxFilas = { unidadPorNombre, nombreMaquina, nombreResponsable, fechaDeDia }
      const { anio: ma, mes } = mesDeSemana(s.anio, s.semana)
      const mesLabel = `${ma}-${String(mes).padStart(2, '0')}`
      const semanaLabel = `${s.anio}-S${s.semana}`
      for (const fila of construirFilasCumplimiento(s.items, ctx, () => '')) {
        todas.push({ anioMes: ma * 100 + mes, mesLabel, semana: s.semana, semanaLabel, fila })
      }
    }
    if (todas.length === 0) continue // área sin datos → sin archivo

    const general: HojaExport = {
      nombre: 'General',
      columnas: COLS_GENERAL,
      filas: [...todas]
        .sort((a, b) => a.anioMes - b.anioMes || a.semana - b.semana)
        .map((r) => [r.mesLabel, r.semanaLabel, ...r.fila]),
    }
    // "AÑO-MM" ordena lexicográficamente = cronológico.
    const meses = [...new Set(todas.map((r) => r.mesLabel))].sort()
    const hojasMes: HojaExport[] = meses.map((mesLabel) => ({
      nombre: mesLabel,
      columnas: COLS_MES,
      filas: todas
        .filter((r) => r.mesLabel === mesLabel)
        .sort((a, b) => a.semana - b.semana)
        .map((r) => [r.semanaLabel, ...r.fila]),
    }))

    libros.push({ area: area.areaNombre, hojas: [general, ...hojasMes] })
  }
  return libros
}

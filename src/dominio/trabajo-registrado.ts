// ¿El área ejecutora ya registró trabajo en una actividad?
//
// Es el criterio con el que una solicitud entre áreas deja de estar "en curso" para el
// área que la pidió: se va de "Mis solicitudes" (/tareas) y pasa a verse en /consulta.
// Antes solo contaba el cierre explícito (Cumplida / Cerrar como parcial), así que una
// actividad ya trabajada —con sus avances registrados— seguía apareciendo como pendiente
// en la lista del solicitante para siempre.
//
// "No se hizo" y "Reprogramada" NO cuentan: son exactamente lo que el solicitante
// necesita seguir viendo. Si se cerraron (`cerrada`), cuentan por el cierre.
import { normalizarAvancePorLote } from './avance-lote'
import { normalizarAvanceGeneral } from './avance-general'

export type FilaTrabajo = {
  estado: string
  cerrada: boolean
  avancePorLote?: unknown
  avanceGeneral?: unknown
}

export function trabajoRegistrado(a: FilaTrabajo): boolean {
  if (a.cerrada || a.estado === 'CUMPLIDA') return true
  if (a.estado !== 'PARCIAL') return false
  const porLote = normalizarAvancePorLote(
    a.avancePorLote as Parameters<typeof normalizarAvancePorLote>[0],
  )
  return Object.values(porLote).some((es) => es.length > 0)
    || normalizarAvanceGeneral(a.avanceGeneral).length > 0
}

// Una actividad son varias filas-hermanas (una por responsable × día): basta que
// cualquiera tenga trabajo registrado.
export function grupoTrabajado(filas: FilaTrabajo[]): boolean {
  return filas.some(trabajoRegistrado)
}

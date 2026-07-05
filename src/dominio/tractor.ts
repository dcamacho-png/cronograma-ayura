export type ActividadTractor = {
  id: string
  dia: number
  descripcion: string
  turno: string
  maquinaId: string | null
  maquina: { nombre: string } | null
  responsable: { nombre: string }
}

export type FilaTractor = {
  maquinaId: string
  nombre: string
  actividades: ActividadTractor[]
  dedicadasPorDia: Record<number, { areaId: string; areaNombre: string }>
}

// Una fila por máquina (orden por nombre), con sus actividades de la semana y sus
// dedicaciones por día (tractor dedicado 100% a un área ese día). Solo informativo.
export function construirFilasTractor(
  maquinas: { id: string; nombre: string }[],
  actividades: ActividadTractor[],
  dedicaciones: { maquinaId: string; dia: number; areaId: string; areaNombre: string }[],
): FilaTractor[] {
  return [...maquinas]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((m) => {
      const dedicadasPorDia: Record<number, { areaId: string; areaNombre: string }> = {}
      for (const d of dedicaciones) {
        if (d.maquinaId === m.id) dedicadasPorDia[d.dia] = { areaId: d.areaId, areaNombre: d.areaNombre }
      }
      return {
        maquinaId: m.id,
        nombre: m.nombre,
        actividades: actividades.filter((a) => a.maquinaId === m.id),
        dedicadasPorDia,
      }
    })
}

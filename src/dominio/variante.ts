export type AreaVariante = {
  maqTareas: boolean
  maqProgramar: boolean
  maqCumplimiento: boolean
  maqResumen: boolean
}

export type PantallaVariante = 'tareas' | 'programar' | 'cumplimiento' | 'resumen'

export function esMaquinaria(area: AreaVariante, pantalla: PantallaVariante): boolean {
  switch (pantalla) {
    case 'tareas':
      return area.maqTareas
    case 'programar':
      return area.maqProgramar
    case 'cumplimiento':
      return area.maqCumplimiento
    case 'resumen':
      return area.maqResumen
  }
}

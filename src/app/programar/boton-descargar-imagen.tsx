'use client'

import { generarImagenGrilla, descargarCanvas } from './generar-imagen-grilla'

export function BotonDescargarImagen({
  targets,
}: {
  targets: { id: string; nombre: string }[]
}) {
  async function descargar() {
    try {
      // Secuencial: cada captura ajusta el ancho del elemento y lo restaura; hacerlas en
      // paralelo se pisaría. Con varias fincas se descargan varias imágenes.
      for (const t of targets) {
        const canvas = await generarImagenGrilla(t.id)
        if (canvas) descargarCanvas(canvas, t.nombre)
      }
    } catch {
      alert('No se pudo generar la imagen.')
    }
  }

  return (
    <button
      type="button"
      onClick={descargar}
      className="rounded-lg border border-arcilla px-3 py-1 text-sm font-semibold text-arcilla hover:bg-arena/40"
    >
      📷 Descargar imagen{targets.length > 1 ? `es (${targets.length})` : ''}
    </button>
  )
}

'use client'

import { generarImagenGrilla, descargarCanvas } from './generar-imagen-grilla'

export function BotonDescargarImagen({
  targetId,
  nombreArchivo,
}: {
  targetId: string
  nombreArchivo: string
}) {
  async function descargar() {
    try {
      const canvas = await generarImagenGrilla(targetId)
      if (!canvas) return
      descargarCanvas(canvas, nombreArchivo)
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
      📷 Descargar imagen
    </button>
  )
}

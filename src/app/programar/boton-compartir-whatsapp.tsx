'use client'

import { generarImagenGrilla, descargarCanvas } from './generar-imagen-grilla'

function canvasABlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export function BotonCompartirWhatsapp({
  targets,
  textoCompartir,
}: {
  targets: { id: string; nombre: string }[]
  textoCompartir: string
}) {
  async function compartir() {
    // Genera un canvas por finca (secuencial: cada captura ajusta el ancho del elemento).
    const canvases: { canvas: HTMLCanvasElement; nombre: string }[] = []
    try {
      for (const t of targets) {
        const canvas = await generarImagenGrilla(t.id)
        if (canvas) canvases.push({ canvas, nombre: t.nombre })
      }
    } catch {
      alert('No se pudieron generar las imágenes.')
      return
    }
    if (canvases.length === 0) return

    // Arma un archivo PNG por cada foto.
    const archivos: File[] = []
    for (const c of canvases) {
      const blob = await canvasABlob(c.canvas)
      if (blob) archivos.push(new File([blob], c.nombre.replace(/\s+/g, '-'), { type: 'image/png' }))
    }

    // En celular: menú nativo con TODAS las fotos en un solo envío (se elige WhatsApp).
    if (archivos.length > 0 && typeof navigator.canShare === 'function' && navigator.canShare({ files: archivos })) {
      try {
        await navigator.share({ files: archivos, text: textoCompartir })
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return // el usuario canceló
        canvases.forEach((c) => descargarCanvas(c.canvas, c.nombre))
      }
      return
    }

    // Respaldo (computador o sin soporte): descarga cada foto para adjuntar a mano.
    canvases.forEach((c) => descargarCanvas(c.canvas, c.nombre))
    alert(
      'Tu dispositivo no permite adjuntar las imágenes directamente a WhatsApp. Las descargamos: ' +
        'ábrelas en WhatsApp y adjúntalas manualmente.',
    )
  }

  return (
    <button
      type="button"
      onClick={compartir}
      className="rounded-lg bg-[#25D366] px-3 py-1 text-sm font-semibold text-white hover:opacity-90"
    >
      🟢 Compartir por WhatsApp{targets.length > 1 ? ` (${targets.length} fotos)` : ''}
    </button>
  )
}

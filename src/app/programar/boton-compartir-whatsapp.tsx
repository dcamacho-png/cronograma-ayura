'use client'

import { generarImagenGrilla, descargarCanvas } from './generar-imagen-grilla'

export function BotonCompartirWhatsapp({
  targetId,
  nombreArchivo,
  textoCompartir,
}: {
  targetId: string
  nombreArchivo: string
  textoCompartir: string
}) {
  async function compartir() {
    let canvas: HTMLCanvasElement | null
    try {
      canvas = await generarImagenGrilla(targetId)
    } catch {
      alert('No se pudo generar la imagen.')
      return
    }
    if (!canvas) return

    const blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, 'image/png'))
    if (!blob) {
      descargarCanvas(canvas, nombreArchivo)
      return
    }

    const archivo = new File([blob], nombreArchivo.replace(/\s+/g, '-'), { type: 'image/png' })

    // En celular (Web Share API con archivos) abrimos el menú nativo para elegir WhatsApp.
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], text: textoCompartir })
      } catch (e) {
        // El usuario canceló el menú de compartir: no es un error.
        if ((e as Error)?.name === 'AbortError') return
        // Otro fallo al compartir: caemos al respaldo (descargar).
        descargarCanvas(canvas, nombreArchivo)
      }
      return
    }

    // Respaldo (computador o navegador sin soporte): descargamos la imagen para adjuntar a mano.
    descargarCanvas(canvas, nombreArchivo)
    alert(
      'Tu dispositivo no permite adjuntar la imagen directamente a WhatsApp. La descargamos: ' +
        'ábrela en WhatsApp y adjúntala manualmente.',
    )
  }

  return (
    <button
      type="button"
      onClick={compartir}
      className="rounded-lg bg-[#25D366] px-3 py-1 text-sm font-semibold text-white hover:opacity-90"
    >
      🟢 Compartir por WhatsApp
    </button>
  )
}

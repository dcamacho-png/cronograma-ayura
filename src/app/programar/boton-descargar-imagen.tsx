'use client'

export function BotonDescargarImagen({
  targetId,
  nombreArchivo,
}: {
  targetId: string
  nombreArchivo: string
}) {
  async function descargar() {
    const el = document.getElementById(targetId)
    if (!el) return
    // La imagen se comparte sobre todo por WhatsApp/celular, donde lo que importa es que
    // el texto sea grande y nítido (no que la imagen sea horizontal). Por eso fijamos un
    // ancho cómodo y dejamos que el alto crezca con cada responsable: la imagen sale más
    // vertical pero el texto se lee grande, y con scale alto queda nítido al ampliar.
    const ANCHO = 1280
    const anchoPrevio = el.style.width
    const maxWidthPrevio = el.style.maxWidth
    el.style.maxWidth = 'none'
    el.style.width = `${ANCHO}px`
    try {
      const { default: html2canvas } = await import('html2canvas-pro')
      const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff', windowWidth: ANCHO })
      const enlace = document.createElement('a')
      enlace.href = canvas.toDataURL('image/png')
      enlace.download = nombreArchivo.replace(/\s+/g, '-')
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
    } catch {
      alert('No se pudo generar la imagen.')
    } finally {
      el.style.width = anchoPrevio
      el.style.maxWidth = maxWidthPrevio
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

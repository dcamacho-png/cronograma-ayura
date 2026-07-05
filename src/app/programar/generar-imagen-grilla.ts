// Generación del PNG de la grilla del cronograma, compartida por los botones
// "Descargar imagen" y "Compartir por WhatsApp".
//
// La imagen se comparte sobre todo por WhatsApp/celular, donde lo que importa es que el
// texto sea grande y nítido (no que la imagen sea horizontal). Por eso fijamos un ancho
// cómodo y dejamos que el alto crezca con cada responsable: la imagen sale más vertical
// pero el texto se lee grande, y con scale alto queda nítido al ampliar.
const ANCHO = 1280

export async function generarImagenGrilla(targetId: string): Promise<HTMLCanvasElement | null> {
  const el = document.getElementById(targetId)
  if (!el) return null
  const anchoPrevio = el.style.width
  const maxWidthPrevio = el.style.maxWidth
  el.style.maxWidth = 'none'
  el.style.width = `${ANCHO}px`
  try {
    const { default: html2canvas } = await import('html2canvas-pro')
    return await html2canvas(el, { scale: 3, backgroundColor: '#ffffff', windowWidth: ANCHO })
  } finally {
    el.style.width = anchoPrevio
    el.style.maxWidth = maxWidthPrevio
  }
}

export function descargarCanvas(canvas: HTMLCanvasElement, nombreArchivo: string) {
  const enlace = document.createElement('a')
  enlace.href = canvas.toDataURL('image/png')
  enlace.download = nombreArchivo.replace(/\s+/g, '-')
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
}

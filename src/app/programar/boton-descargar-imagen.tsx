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
    // La imagen sale con la orientación del elemento capturado. En pantalla la grilla
    // está acotada al ancho del contenedor (~1100px) y crece en alto con cada
    // responsable, así que con varios responsables saldría vertical. Antes de capturar
    // ensanchamos la grilla hasta que quede horizontal (ancho ≥ alto + 5% de margen):
    // al ensanchar, las columnas-día caben mejor, el texto envuelve menos y baja el alto.
    const anchoPrevio = el.style.width
    const maxWidthPrevio = el.style.maxWidth
    el.style.maxWidth = 'none'
    let ancho = 1600
    el.style.width = `${ancho}px`
    for (let i = 0; i < 5; i++) {
      const alto = el.scrollHeight
      if (ancho >= alto * 1.05) break
      ancho = Math.min(Math.ceil(alto * 1.15), 4000)
      el.style.width = `${ancho}px`
    }
    try {
      const { default: html2canvas } = await import('html2canvas-pro')
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', windowWidth: ancho })
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

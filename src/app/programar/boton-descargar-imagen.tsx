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
    try {
      const { default: html2canvas } = await import('html2canvas-pro')
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
      const enlace = document.createElement('a')
      enlace.href = canvas.toDataURL('image/png')
      enlace.download = nombreArchivo.replace(/\s+/g, '-')
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
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

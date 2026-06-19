'use client'

// Botón ✕ que pide confirmación antes de enviar el formulario de eliminación.
export function FormEliminar({
  accion,
  id,
  etiqueta,
}: {
  accion: (formData: FormData) => void | Promise<void>
  id: string
  etiqueta: string
}) {
  return (
    <form
      action={accion}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar "${etiqueta}"? Esta acción no se puede deshacer.`)) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-gray-400 hover:text-red-600" title="Eliminar" aria-label="Eliminar">✕</button>
    </form>
  )
}

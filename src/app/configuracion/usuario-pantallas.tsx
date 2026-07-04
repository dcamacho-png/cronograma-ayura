'use client'

const PANTALLAS: { clave: string; etiqueta: string }[] = [
  { clave: 'tareas', etiqueta: 'Tareas' },
  { clave: 'programar', etiqueta: 'Programar' },
  { clave: 'cumplimiento', etiqueta: 'Cumplimiento' },
  { clave: 'resumen', etiqueta: 'Resumen' },
  { clave: 'tablero', etiqueta: 'Tablero' },
  { clave: 'consulta', etiqueta: 'Consulta' },
]

// pantallas: CSV guardado (null = set por defecto de área: las 4 menos Tablero)
function setActual(pantallas: string | null): Set<string> {
  if (pantallas == null) return new Set(['tareas', 'programar', 'cumplimiento', 'resumen'])
  return new Set(pantallas.split(',').map((c) => c.trim()).filter(Boolean))
}

export function UsuarioPantallas({
  id,
  esAdmin,
  pantallas,
  accion,
}: {
  id: string
  esAdmin: boolean
  pantallas: string | null
  accion: (formData: FormData) => void | Promise<void>
}) {
  if (esAdmin) return <span className="text-xs text-tierra">ve todo (admin)</span>
  const activas = setActual(pantallas)
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {PANTALLAS.map((p) => (
        <label key={p.clave} className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="pantalla" value={p.clave} defaultChecked={activas.has(p.clave)} className="accent-bosque" />
          {p.etiqueta}
        </label>
      ))}
      <button className="rounded-lg bg-bosque px-2 py-1 text-xs font-semibold text-white">Guardar</button>
    </form>
  )
}

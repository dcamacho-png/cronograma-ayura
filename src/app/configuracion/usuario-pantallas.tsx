'use client'

import { DEFAULT_AREA } from '@/auth/permisos'

const PANTALLAS: { clave: string; etiqueta: string }[] = [
  { clave: 'tareas', etiqueta: 'Tareas' },
  { clave: 'programar', etiqueta: 'Programar' },
  { clave: 'cumplimiento', etiqueta: 'Cumplimiento' },
  { clave: 'resumen', etiqueta: 'Resumen' },
  { clave: 'tablero', etiqueta: 'Tablero' },
  { clave: 'consulta', etiqueta: 'Consulta' },
  { clave: 'conservatorio', etiqueta: 'Conservatorio' },
]

// pantallas: CSV guardado (null = set por defecto de área, ver DEFAULT_AREA)
function setActual(pantallas: string | null): Set<string> {
  if (pantallas == null) return new Set<string>(DEFAULT_AREA)
  return new Set(pantallas.split(',').map((c) => c.trim()).filter(Boolean))
}

export function UsuarioPantallas({
  id,
  sinToggles,
  pantallas,
  accion,
}: {
  id: string
  sinToggles: boolean
  pantallas: string | null
  accion: (formData: FormData) => void | Promise<void>
}) {
  if (sinToggles) return <span className="text-xs text-tierra">pantallas fijas</span>
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

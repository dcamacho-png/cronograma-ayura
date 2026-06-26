'use client'

import { useState } from 'react'

const CAMPOS: { name: string; etiqueta: string }[] = [
  { name: 'maqTareas', etiqueta: 'Tareas' },
  { name: 'maqProgramar', etiqueta: 'Programar' },
  { name: 'maqCumplimiento', etiqueta: 'Cumplimiento' },
  { name: 'maqResumen', etiqueta: 'Resumen' },
]

export function AreaVariantes({
  id,
  nombre,
  valores,
  accion,
}: {
  id: string
  nombre: string
  valores: { maqTareas: boolean; maqProgramar: boolean; maqCumplimiento: boolean; maqResumen: boolean }
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [estado, setEstado] = useState(valores)
  const set = (name: string, v: boolean) => setEstado((p) => ({ ...p, [name]: v }))
  const valoresArr = [estado.maqTareas, estado.maqProgramar, estado.maqCumplimiento, estado.maqResumen]
  const incoherente = valoresArr.some(Boolean) && !valoresArr.every(Boolean)

  return (
    <form action={accion} className="flex flex-col gap-2 rounded-lg border border-borde bg-marfil p-3 text-sm">
      <input type="hidden" name="id" value={id} />
      <div className="font-semibold text-tinta">{nombre}</div>
      <div className="flex flex-wrap gap-3">
        {CAMPOS.map((c) => {
          const on = estado[c.name as keyof typeof estado]
          return (
            <label key={c.name} className="flex items-center gap-1 text-xs">
              <input type="hidden" name={c.name} value={on ? '1' : '0'} />
              <input type="checkbox" checked={on} onChange={(e) => set(c.name, e.target.checked)} className="accent-bosque" />
              {c.etiqueta}: <b>{on ? 'Maquinaria' : 'Estándar'}</b>
            </label>
          )
        })}
      </div>
      {incoherente && (
        <p className="text-xs text-arcilla">
          ⚠️ Las 4 pantallas no coinciden. Es válido, pero puede dar combinaciones raras (p. ej. asignar máquina sin poder registrar su medida). Conviene igualarlas.
        </p>
      )}
      <button className="self-start rounded-lg bg-bosque px-3 py-1 text-xs font-semibold text-white">Guardar variantes</button>
    </form>
  )
}

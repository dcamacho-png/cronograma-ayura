'use client'

import { useState } from 'react'
import { crearNovedadResponsableAccion } from './acciones'

export function FormNovedad({
  responsableId,
  anio,
  semana,
}: {
  responsableId: string
  anio: number
  semana: number
}) {
  const [abierto, setAbierto] = useState(false)
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-1 text-xs text-bosque hover:underline"
      >
        ＋ Novedad
      </button>
    )
  }
  return (
    <form action={crearNovedadResponsableAccion} className="mt-1 space-y-1 rounded-lg border border-borde bg-marfil p-2 text-xs">
      <input type="hidden" name="responsableId" value={responsableId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <select name="tipo" defaultValue="VACACIONES" aria-label="Tipo" className="w-full rounded border border-borde bg-white p-1">
        <option value="VACACIONES">Vacaciones</option>
        <option value="PERMISO">Permiso</option>
        <option value="CUMPLEAÑOS">Cumpleaños</option>
        <option value="OTRO">Otro</option>
      </select>
      <label className="block">Desde
        <input type="date" name="fechaInicio" required className="w-full rounded border border-borde bg-white p-1" />
      </label>
      <label className="block">Hasta
        <input type="date" name="fechaFin" className="w-full rounded border border-borde bg-white p-1" />
      </label>
      <input name="horario" placeholder="Horario (solo permisos)" className="w-full rounded border border-borde bg-white p-1" />
      <input name="nota" placeholder="Nota / texto libre (p. ej. para 'Otro')" className="w-full rounded border border-borde bg-white p-1" />
      <div className="flex gap-1">
        <button type="submit" className="rounded bg-bosque px-2 py-0.5 font-semibold text-white">Guardar</button>
        <button type="button" onClick={() => setAbierto(false)} className="rounded border border-borde px-2 py-0.5">Cancelar</button>
      </div>
    </form>
  )
}

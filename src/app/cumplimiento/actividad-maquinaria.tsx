'use client'

import { useState } from 'react'
import type { Unidad } from '@/dominio/unidad'
import type { Estado } from '@/dominio/tipos'
import { FormAvanceLote } from './form-avance-lote'
import { FormRegistrar } from './form-registrar'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Control de cumplimiento de UNA actividad de maquinaria (grupo tareaId), PENDIENTE o
// PARCIAL: avances por lote (máquina + cantidad + centro de costo + día) que se acumulan,
// y cierre manual (Cumplida). Novedad y devolver al banco como en el estándar.
export function ActividadMaquinaria({
  actividadId,
  estado,
  unidad,
  dia,
  lotesActividad,
  lotesCatalogo,
  maquinas,
  estipuladas,
  motivos,
  motivoCambioId,
  haProgramada,
  registrarAvance,
  marcarCumplida,
  registrarNovedad,
  devolverAlBanco,
}: {
  actividadId: string
  estado: Estado
  unidad: Unidad
  dia: number
  lotesActividad: { id: string; nombre: string }[]
  lotesCatalogo: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  motivos: Motivo[]
  motivoCambioId: string | null
  haProgramada: number
  registrarAvance: (f: FormData) => void | Promise<void>
  marcarCumplida: (f: FormData) => void | Promise<void>
  registrarNovedad: (f: FormData) => void | Promise<void>
  devolverAlBanco: (f: FormData) => void | Promise<void>
}) {
  const [novedad, setNovedad] = useState(false)
  const esParcial = estado === 'PARCIAL'

  if (novedad) {
    return (
      <div>
        <FormRegistrar
          actividadId={actividadId}
          esMaquinaria={true}
          unidad={unidad}
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          lotes={lotesCatalogo}
          maquinas={maquinas}
          estipuladas={estipuladas}
          haProgramada={haProgramada}
          lotesActividad={lotesActividad}
          accion={registrarNovedad}
        />
        <button type="button" onClick={() => setNovedad(false)} className="mt-1 text-xs text-tierra underline">
          cancelar novedad
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3 text-sm">
      {lotesActividad.length > 0 && (
        <FormAvanceLote
          actividadId={actividadId}
          diaActividad={dia}
          esMaquinaria={true}
          maquinas={maquinas}
          unidad={unidad}
          lotes={lotesActividad}
          accion={registrarAvance}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <form action={marcarCumplida}>
          <input type="hidden" name="id" value={actividadId} />
          <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">
            ✓ {esParcial ? 'Marcar cumplida' : 'Cumplida'}
          </button>
        </form>
        {esParcial && (
          <form action={devolverAlBanco}>
            <input type="hidden" name="id" value={actividadId} />
            <button className="rounded-lg border border-borde px-2 py-1 text-xs text-tierra hover:bg-arena/40">Devolver al banco</button>
          </form>
        )}
        {!esParcial && (
          <button type="button" onClick={() => setNovedad(true)} className="text-xs text-tierra underline">registrar novedad</button>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { Unidad } from '@/dominio/unidad'
import { FormRegistrar } from './form-registrar'
import { FormAvanceLote } from './form-avance-lote'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Registro de un día SIN medida (no maquinaria): un clic en "cumplido" marca el
// día como CUMPLIDA; "novedad" revela el formulario completo (no cumplida, motivo).
export function DiaNoMaquinaria({
  actividadId,
  motivos,
  motivoCambioId,
  lotes,
  maquinas,
  estipuladas,
  lotesActividad,
  unidad,
  dia,
  marcarCumplido,
  accionRegistrar,
  accionAvance,
}: {
  actividadId: string
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  lotesActividad: { id: string; nombre: string }[]
  unidad: Unidad
  dia: number
  marcarCumplido: (formData: FormData) => void | Promise<void>
  accionRegistrar: (formData: FormData) => void | Promise<void>
  accionAvance: (formData: FormData) => void | Promise<void>
}) {
  const [novedad, setNovedad] = useState(false)

  if (novedad) {
    return (
      <div>
        <FormRegistrar
          actividadId={actividadId}
          esMaquinaria={false}
          unidad={unidad}
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          lotes={lotes}
          maquinas={maquinas}
          estipuladas={estipuladas}
          haProgramada={0}
          lotesActividad={lotesActividad}
          accion={accionRegistrar}
        />
        <button
          type="button"
          onClick={() => setNovedad(false)}
          className="mt-1 text-xs text-tierra underline"
        >
          cancelar novedad
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <form action={marcarCumplido}>
        <input type="hidden" name="id" value={actividadId} />
        <input type="hidden" name="estado" value="CUMPLIDA" />
        <button className="flex items-center gap-1 rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">
          ✓ Cumplido
        </button>
      </form>
      <button
        type="button"
        onClick={() => setNovedad(true)}
        className="text-xs text-tierra underline"
      >
        registrar novedad
      </button>
      {lotesActividad.length > 0 && (
        <FormAvanceLote
          actividadId={actividadId}
          diaActividad={dia}
          esMaquinaria={false}
          maquinas={maquinas}
          unidad={unidad}
          lotes={lotesActividad}
          accion={accionAvance}
        />
      )}
    </div>
  )
}

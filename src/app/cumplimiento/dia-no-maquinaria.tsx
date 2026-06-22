'use client'

import { useState } from 'react'
import type { Unidad } from '@/dominio/unidad'
import { FormRegistrar } from './form-registrar'

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
  marcarCumplido,
  accionRegistrar,
}: {
  actividadId: string
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  lotesActividad: { id: string; nombre: string }[]
  unidad: Unidad
  marcarCumplido: (formData: FormData) => void | Promise<void>
  accionRegistrar: (formData: FormData) => void | Promise<void>
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
          className="mt-1 text-xs text-gray-500 underline"
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
        <button className="flex items-center gap-1 rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">
          ✓ Cumplido
        </button>
      </form>
      <button
        type="button"
        onClick={() => setNovedad(true)}
        className="text-xs text-gray-500 underline"
      >
        registrar novedad
      </button>
    </div>
  )
}

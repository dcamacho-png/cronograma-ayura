'use client'

import { useState } from 'react'
import { etiquetaMedida, type Unidad } from '@/dominio/unidad'
import { CENTROS_COSTO } from '@/dominio/centro-costo'
import { FormRegistrar } from './form-registrar'
import { FormAvanceLote } from './form-avance-lote'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Registro de un día de MAQUINARIA por avance: se ingresa la medida lograda ese día
// (ha/hora/kg) y al Guardar el día queda CUMPLIDA con esa medida. "registrar novedad"
// revela el formulario completo (no cumplida / parcial / reprogramada con motivo).
export function DiaMaquinaria({
  actividadId,
  unidad,
  motivos,
  motivoCambioId,
  lotes,
  maquinas,
  estipuladas,
  lotesActividad,
  haProgramada,
  dia,
  accionRegistrar,
  accionAvance,
  marcarCumplido,
}: {
  actividadId: string
  unidad: Unidad
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  lotesActividad: { id: string; nombre: string }[]
  haProgramada: number
  dia: number
  accionRegistrar: (formData: FormData) => void | Promise<void>
  accionAvance: (formData: FormData) => void | Promise<void>
  marcarCumplido: (formData: FormData) => void | Promise<void>
}) {
  const [novedad, setNovedad] = useState(false)
  const [centro, setCentro] = useState('')

  if (novedad) {
    return (
      <div>
        <FormRegistrar
          actividadId={actividadId}
          esMaquinaria={true}
          unidad={unidad}
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          lotes={lotes}
          maquinas={maquinas}
          estipuladas={estipuladas}
          haProgramada={haProgramada}
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
    <div className="flex flex-col gap-2">
      <form action={accionRegistrar} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={actividadId} />
        <input type="hidden" name="estado" value="CUMPLIDA" />
        <label className="flex flex-col text-xs">
          {etiquetaMedida(unidad)}
          <input
            name="haRealizada"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={haProgramada}
            className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
          />
        </label>
        <label className="flex flex-col text-xs">
          Centro de costo
          <select
            name="centroCosto"
            value={centro}
            onChange={(e) => setCentro(e.target.value)}
            className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
          >
            <option value="">— sin centro —</option>
            {CENTROS_COSTO.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="__otra__">Otras…</option>
          </select>
        </label>
        {centro === '__otra__' && (
          <label className="flex flex-col text-xs">
            Otras (texto libre)
            <input name="centroCostoOtra" className="w-40 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
        )}
        <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">✓ Registrar cumplimiento</button>
        <button type="button" onClick={() => setNovedad(true)} className="text-xs text-tierra underline">
          registrar novedad
        </button>
      </form>
      <form action={marcarCumplido}>
        <input type="hidden" name="id" value={actividadId} />
        <input type="hidden" name="estado" value="CUMPLIDA" />
        <button className="rounded-lg border border-bosque px-3 py-1 text-sm font-semibold text-bosque hover:bg-arena/40">
          ✓ Cumplida
        </button>
      </form>
      {lotesActividad.length > 0 && (
        <FormAvanceLote
          actividadId={actividadId}
          diaActividad={dia}
          esMaquinaria={true}
          maquinas={maquinas}
          unidad={unidad}
          lotes={lotesActividad}
          accion={accionAvance}
        />
      )}
    </div>
  )
}

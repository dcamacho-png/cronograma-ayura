'use client'

import { useState } from 'react'
import type { Unidad } from '@/dominio/unidad'
import type { Estado } from '@/dominio/tipos'
import { FormAvance } from './form-avance'
import { FormRegistrar } from './form-registrar'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro" (texto libre)

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
  responsables,
  responsableActividadId,
  fincaActividad,
  unidadRealizada,
  registrarAvance,
  setUnidadRealizada,
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
  responsables: { id: string; nombre: string }[]
  responsableActividadId: string
  fincaActividad: string
  unidadRealizada: string | null
  registrarAvance: (f: FormData) => void | Promise<void>
  setUnidadRealizada: (f: FormData) => void | Promise<void>
  marcarCumplida: (f: FormData) => void | Promise<void>
  registrarNovedad: (f: FormData) => void | Promise<void>
  devolverAlBanco: (f: FormData) => void | Promise<void>
}) {
  const [novedad, setNovedad] = useState(false)
  const esParcial = estado === 'PARCIAL'
  const conocida = UNIDADES.find((u) => u.toLowerCase() === (unidadRealizada ?? '').toLowerCase())
  const [unidadSel, setUnidadSel] = useState(conocida ?? (unidadRealizada ? 'Otro' : 'Ha'))

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

  // Selector de unidad (mismo patrón que ActividadEstandar).
  const selectorUnidad = (
    <label className="flex flex-col text-xs">
      Unidad
      <select
        name="unidad"
        value={unidadSel === 'Otro' ? 'otro' : unidadSel.toLowerCase()}
        onChange={(e) => setUnidadSel(e.target.value === 'otro' ? 'Otro' : e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
        className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
      >
        {UNIDADES.map((u) => (
          <option key={u} value={u.toLowerCase()}>{u}</option>
        ))}
        <option value="otro">Otro…</option>
      </select>
    </label>
  )
  const inputUnidadOtra = unidadSel === 'Otro' && (
    <label className="flex flex-col text-xs">
      Unidad (texto)
      <input name="unidadOtra" defaultValue={conocida ? '' : unidadRealizada ?? ''} placeholder="ej. bultos" className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
    </label>
  )

  return (
    <div className="flex w-full flex-col gap-3 text-sm">
      <form action={setUnidadRealizada} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={actividadId} />
        {selectorUnidad}
        {inputUnidadOtra}
        <button className="rounded-lg border border-bosque px-3 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">Guardar unidad</button>
      </form>
      <FormAvance
        actividadId={actividadId}
        diaActividad={dia}
        esMaquinaria={true}
        responsables={responsables}
        responsableDefault={responsableActividadId}
        maquinas={maquinas}
        lotesCatalogo={lotesCatalogo}
        fincaDefault={fincaActividad}
        accion={registrarAvance}
      />
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

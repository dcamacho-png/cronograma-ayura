'use client'

import { useState } from 'react'
import { BloqueReemplazo } from './bloque-reemplazo'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; hectareas?: number | null; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Acción única de cierre de UNA actividad (grupo tareaId): Cumplida (confirma si quedan
// potreros sin avance) / Cerrar como parcial / No se hizo (+¿reprogramar? y, con motivo
// "cambio", el reemplazo multipotrero que crea la actividad "En reemplazo de…").
// Todas las acciones fijan `cerrada` en el repo; solo Reprogramada vuelve al banco.
export function FormCerrar({
  actividadId,
  diaActividad,
  hayPotrerosPendientes,
  esMaquinaria,
  motivos,
  motivoCambioId,
  estipuladas,
  lotes,
  maquinas,
  cumplida,
  cerrarParcial,
  noSeHizo,
}: {
  actividadId: string
  diaActividad: number
  hayPotrerosPendientes: boolean
  esMaquinaria: boolean
  motivos: Motivo[]
  motivoCambioId: string | null
  estipuladas: Estipulada[]
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  cumplida: (f: FormData) => void | Promise<void>
  cerrarParcial: (f: FormData) => void | Promise<void>
  noSeHizo: (f: FormData) => void | Promise<void>
}) {
  const [modo, setModo] = useState<'' | 'noSeHizo'>('')
  const [reprogramar, setReprogramar] = useState(false)
  const [motivoSel, setMotivoSel] = useState('')

  const esCambio = motivoSel !== '' && motivoSel === motivoCambioId

  if (modo === '') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <form
          action={cumplida}
          onSubmit={(e) => {
            if (hayPotrerosPendientes && !confirm('Quedan potreros sin avance. ¿Marcar como Cumplida de todos modos?')) e.preventDefault()
          }}
        >
          <input type="hidden" name="id" value={actividadId} />
          <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">✓ Cumplida</button>
        </form>
        <form action={cerrarParcial}>
          <input type="hidden" name="id" value={actividadId} />
          <button className="rounded-lg border border-bosque px-2 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">Cerrar como parcial</button>
        </form>
        <button
          type="button"
          onClick={() => setModo('noSeHizo')}
          className="rounded-lg border border-borde px-2 py-1 text-xs text-tierra hover:bg-arena/40"
        >
          No se hizo…
        </button>
      </div>
    )
  }

  return (
    <form action={noSeHizo} className="flex flex-wrap items-end gap-2 rounded-lg border border-borde bg-arena/40 p-2">
      <input type="hidden" name="id" value={actividadId} />
      <input type="hidden" name="estado" value={reprogramar ? 'REPROGRAMADA' : 'NO_CUMPLIDA'} />
      <label className="flex w-full items-center gap-2 text-xs text-tinta">
        <input type="checkbox" checked={reprogramar} onChange={(e) => setReprogramar(e.target.checked)} className="accent-bosque" />
        ¿Reprogramar la próxima semana?
      </label>
      <label className="flex flex-col text-xs">
        Motivo *
        <select
          name="motivoId"
          required
          value={motivoSel}
          onChange={(e) => setMotivoSel(e.target.value)}
          className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
        >
          <option value="">—</option>
          {motivos.map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
        </select>
      </label>
      <label className="flex flex-1 flex-col text-xs">
        Observación
        <input name="nota" placeholder="(opcional)" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
      </label>
      {esCambio && (
        <BloqueReemplazo
          esMaquinaria={esMaquinaria}
          estipuladas={estipuladas}
          lotes={lotes}
          maquinas={maquinas}
          diaActividad={diaActividad}
        />
      )}
      <div className="flex w-full items-center gap-3">
        <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">Cerrar (no se hizo)</button>
        <button type="button" onClick={() => setModo('')} className="text-xs text-tierra underline">cancelar</button>
      </div>
    </form>
  )
}

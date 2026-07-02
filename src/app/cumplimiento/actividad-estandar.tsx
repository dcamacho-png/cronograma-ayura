'use client'

import { useState } from 'react'
import type { Unidad } from '@/dominio/unidad'
import type { Estado } from '@/dominio/tipos'
import { FormAvanceLote } from './form-avance-lote'
import { FormRegistrar } from './form-registrar'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Control único de cumplimiento de UNA actividad estándar (no maquinaria), en estado
// PENDIENTE o PARCIAL. Con lotes: avances por lote. Sin lotes: observación. El cierre
// (Cumplida) es manual; la novedad (No cumplida/Reprogramada/cambio) usa FormRegistrar.
export function ActividadEstandar({
  actividadId,
  estado,
  unidad,
  dia,
  tieneLotes,
  lotesActividad,
  lotesCatalogo,
  estipuladas,
  motivos,
  motivoCambioId,
  nota,
  registrarAvanceLote,
  registrarObservacion,
  marcarCumplida,
  registrarNovedad,
  devolverAlBanco,
  editarPotreros,
}: {
  actividadId: string
  estado: Estado
  unidad: Unidad
  dia: number
  tieneLotes: boolean
  lotesActividad: { id: string; nombre: string }[]
  lotesCatalogo: Lote[]
  estipuladas: Estipulada[]
  motivos: Motivo[]
  motivoCambioId: string | null
  nota: string | null
  registrarAvanceLote: (f: FormData) => void | Promise<void>
  registrarObservacion: (f: FormData) => void | Promise<void>
  marcarCumplida: (f: FormData) => void | Promise<void>
  registrarNovedad: (f: FormData) => void | Promise<void>
  devolverAlBanco: (f: FormData) => void | Promise<void>
  editarPotreros: (f: FormData) => void | Promise<void>
}) {
  const [novedad, setNovedad] = useState(false)
  const [editandoPotreros, setEditandoPotreros] = useState(false)
  const esParcial = estado === 'PARCIAL'
  // La actividad solo se renderiza si está abierta (PENDIENTE/PARCIAL); "Cumplida" siempre
  // disponible para poder cerrarla directo, sin exigir un avance previo.
  const mostrarCumplida = true

  if (novedad) {
    return (
      <div>
        <FormRegistrar
          actividadId={actividadId}
          esMaquinaria={false}
          unidad={unidad}
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          lotes={lotesCatalogo}
          maquinas={[]}
          estipuladas={estipuladas}
          haProgramada={0}
          lotesActividad={lotesActividad}
          accion={registrarNovedad}
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
    <div className="flex flex-wrap items-end gap-3 text-sm">
      {tieneLotes ? (
        <FormAvanceLote
          actividadId={actividadId}
          diaActividad={dia}
          esMaquinaria={false}
          maquinas={[]}
          unidad={unidad}
          lotes={lotesActividad}
          accion={registrarAvanceLote}
        />
      ) : (
        <form action={registrarObservacion} className="flex flex-1 items-end gap-2">
          <input type="hidden" name="id" value={actividadId} />
          <label className="flex flex-1 flex-col text-xs">
            Avance / observación
            <input
              name="nota"
              defaultValue={nota ?? ''}
              placeholder="¿qué se avanzó?"
              className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
            />
          </label>
          <button className="rounded-lg border border-bosque px-2 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">
            Guardar avance
          </button>
        </form>
      )}

      {tieneLotes && (
        editandoPotreros ? (
          <form action={editarPotreros} className="flex w-full flex-col gap-2 rounded-lg border border-borde bg-arena p-2 text-xs">
            <input type="hidden" name="id" value={actividadId} />
            <span className="font-semibold text-tinta">Potreros de la actividad</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {lotesCatalogo.map((l) => (
                <label key={l.id} className="flex items-center gap-1">
                  <input type="checkbox" name="loteId" value={l.id} defaultChecked={lotesActividad.some((x) => x.id === l.id)} />
                  {l.nombre} <span className="text-tierra">({l.finca.nombre})</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg bg-bosque px-2 py-1 font-semibold text-white">Guardar potreros</button>
              <button type="button" onClick={() => setEditandoPotreros(false)} className="text-tierra underline">cancelar</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setEditandoPotreros(true)} className="text-xs text-tierra underline">
            Editar potreros
          </button>
        )
      )}

      {mostrarCumplida && (
        <form action={marcarCumplida}>
          <input type="hidden" name="id" value={actividadId} />
          <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">
            ✓ {esParcial ? 'Marcar cumplida' : 'Cumplida'}
          </button>
        </form>
      )}

      {esParcial && (
        <form action={devolverAlBanco}>
          <input type="hidden" name="id" value={actividadId} />
          <button className="rounded-lg border border-borde px-2 py-1 text-xs text-tierra hover:bg-arena/40">
            Devolver al banco
          </button>
        </form>
      )}

      {!esParcial && (
        <button type="button" onClick={() => setNovedad(true)} className="text-xs text-tierra underline">
          registrar novedad
        </button>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { Estado } from '@/dominio/tipos'
import { FormRegistrar } from './form-registrar'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

const UNIDADES = ['Cantidad', 'Ha', 'Jornales'] // + "Otro" (texto libre)
const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Control de cumplimiento de UNA actividad estándar (no maquinaria), PENDIENTE o PARCIAL.
// Unidad elegible (una por actividad); con potreros: Finca→Lote→cantidad (anexa lote nuevo);
// sin potreros: unidad + cantidad + observación. Cierre manual (Cumplida); novedad aparte.
export function ActividadEstandar({
  actividadId,
  estado,
  dia,
  tieneLotes,
  lotesActividad,
  lotesCatalogo,
  unidadRealizada,
  estipuladas,
  motivos,
  motivoCambioId,
  nota,
  registrarAvanceEstandar,
  registrarMedidaGeneral,
  marcarCumplida,
  registrarNovedad,
  devolverAlBanco,
  editarPotreros,
}: {
  actividadId: string
  estado: Estado
  dia: number
  tieneLotes: boolean
  lotesActividad: { id: string; nombre: string }[]
  lotesCatalogo: Lote[]
  unidadRealizada: string | null
  estipuladas: Estipulada[]
  motivos: Motivo[]
  motivoCambioId: string | null
  nota: string | null
  registrarAvanceEstandar: (f: FormData) => void | Promise<void>
  registrarMedidaGeneral: (f: FormData) => void | Promise<void>
  marcarCumplida: (f: FormData) => void | Promise<void>
  registrarNovedad: (f: FormData) => void | Promise<void>
  devolverAlBanco: (f: FormData) => void | Promise<void>
  editarPotreros: (f: FormData) => void | Promise<void>
}) {
  const esParcial = estado === 'PARCIAL'
  const conocida = UNIDADES.find((u) => u.toLowerCase() === (unidadRealizada ?? '').toLowerCase())
  const [novedad, setNovedad] = useState(false)
  const [unidadSel, setUnidadSel] = useState(conocida ?? (unidadRealizada ? 'Otro' : 'Cantidad'))
  const fincas = [...new Set(lotesCatalogo.map((l) => l.finca.nombre))].sort()
  const [finca, setFinca] = useState('')

  if (novedad) {
    return (
      <div>
        <FormRegistrar
          actividadId={actividadId}
          esMaquinaria={false}
          unidad="ha"
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          lotes={lotesCatalogo}
          maquinas={[]}
          estipuladas={estipuladas}
          haProgramada={0}
          lotesActividad={lotesActividad}
          accion={registrarNovedad}
        />
        <button type="button" onClick={() => setNovedad(false)} className="mt-1 text-xs text-tierra underline">
          cancelar novedad
        </button>
      </div>
    )
  }

  // Selector de unidad reutilizable (se envía con cada registro).
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
      {tieneLotes ? (
        <>
          {lotesActividad.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {lotesActividad.map((l) => (
                <span key={l.id} className="flex items-center gap-1 rounded-lg border border-borde bg-arena px-2 py-0.5">
                  {l.nombre}
                  <form action={editarPotreros} className="inline">
                    <input type="hidden" name="id" value={actividadId} />
                    {lotesActividad.filter((x) => x.id !== l.id).map((x) => (
                      <input key={x.id} type="hidden" name="loteId" value={x.id} />
                    ))}
                    <button className="text-tierra hover:text-rose-700" title="quitar potrero">×</button>
                  </form>
                </span>
              ))}
            </div>
          )}
          <form action={registrarAvanceEstandar} className="flex flex-wrap items-end gap-2 rounded-lg border border-borde bg-arena/40 p-2">
            <input type="hidden" name="id" value={actividadId} />
            {selectorUnidad}
            {inputUnidadOtra}
            <label className="flex flex-col text-xs">
              Finca
              <select value={finca} onChange={(e) => setFinca(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                <option value="">— finca —</option>
                {fincas.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs">
              Lote
              <select name="loteId" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                <option value="">— lote —</option>
                {lotesCatalogo.filter((l) => l.finca.nombre === finca).map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs">
              Cantidad
              <input name="cantidad" type="number" step="any" min="0" className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
            <label className="flex flex-col text-xs">
              Día
              <select name="dia" defaultValue={dia} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>{DIAS[d]}</option>
                ))}
              </select>
            </label>
            <button className="rounded-lg border border-bosque px-3 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">Guardar avance</button>
          </form>
        </>
      ) : (
        <form action={registrarMedidaGeneral} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={actividadId} />
          {selectorUnidad}
          {inputUnidadOtra}
          <label className="flex flex-col text-xs">
            Cantidad
            <input name="cantidad" type="number" step="any" min="0" className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
          <label className="flex flex-1 flex-col text-xs">
            Observación
            <input name="nota" defaultValue={nota ?? ''} placeholder="¿qué se avanzó?" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
          <button className="rounded-lg border border-bosque px-3 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">Guardar</button>
        </form>
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

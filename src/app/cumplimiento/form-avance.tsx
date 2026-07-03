'use client'

import { useState } from 'react'
import { CENTROS_COSTO } from '@/dominio/centro-costo'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
type Lote = { id: string; nombre: string; finca: { nombre: string } }

// Un avance = un potrero por envío: día, responsable, finca→lote, cantidad (+ tractor y
// centro de costo en maquinaria). La unidad NO va aquí (es por actividad).
export function FormAvance({
  actividadId,
  diaActividad,
  esMaquinaria,
  responsables,
  responsableDefault,
  maquinas,
  lotesCatalogo,
  fincaDefault,
  accion,
}: {
  actividadId: string
  diaActividad: number
  esMaquinaria: boolean
  responsables: { id: string; nombre: string }[]
  responsableDefault: string
  maquinas: { id: string; nombre: string }[]
  lotesCatalogo: Lote[]
  fincaDefault: string
  accion: (f: FormData) => void | Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [finca, setFinca] = useState(fincaDefault)
  const [centro, setCentro] = useState('')
  const fincas = [...new Set(lotesCatalogo.map((l) => l.finca.nombre))].sort()

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="rounded-lg border border-bosque px-2 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">
        Registrar avance
      </button>
    )
  }
  return (
    <form action={accion} className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-borde bg-arena/40 p-2 text-xs">
      <input type="hidden" name="id" value={actividadId} />
      <label className="flex flex-col">Día
        <select name="dia" defaultValue={diaActividad} className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{DIAS[d]}</option>))}
        </select>
      </label>
      <label className="flex flex-col">Responsable
        <select name="responsableId" defaultValue={responsableDefault} className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
          {responsables.map((r) => (<option key={r.id} value={r.id}>{r.nombre}</option>))}
        </select>
      </label>
      {esMaquinaria && (
        <>
          <label className="flex flex-col">Tractor
            <select name="maquinaId" className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— sin máquina —</option>
              {maquinas.map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
            </select>
          </label>
          <label className="flex flex-col">Centro de costo
            <select name="centroCosto" value={centro} onChange={(e) => setCentro(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— sin centro —</option>
              {CENTROS_COSTO.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </label>
        </>
      )}
      <label className="flex flex-col">Finca
        <select value={finca} onChange={(e) => setFinca(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
          <option value="">— finca —</option>
          {fincas.map((f) => (<option key={f} value={f}>{f}</option>))}
        </select>
      </label>
      <label className="flex flex-col">Lote
        <select name="loteId" className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
          <option value="">— lote —</option>
          {lotesCatalogo.filter((l) => l.finca.nombre === finca).map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
        </select>
      </label>
      <label className="flex flex-col">Cantidad
        <input name="cantidad" type="number" step="any" min="0" className="w-24 rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
      </label>
      <button className="rounded-lg bg-bosque px-3 py-1 font-semibold text-white">Guardar avance</button>
      <button type="button" onClick={() => setAbierto(false)} className="text-tierra underline">cancelar</button>
    </form>
  )
}

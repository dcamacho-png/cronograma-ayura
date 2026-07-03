'use client'

import { useState } from 'react'
import { CENTROS_COSTO } from '@/dominio/centro-costo'
import { usaBultos } from '@/dominio/bultos'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro" (texto libre)
type Lote = { id: string; nombre: string; finca: { nombre: string } }

// Un avance puede registrar varios potreros a la vez: día, responsable, unidad (por actividad),
// observación, tabla por potrero (casilla + ha = medida + bultos en fertilización), anexar
// potreros no asignados, y —en maquinaria— tractor + centro de costo. La medida es siempre ha.
export function FormAvance({
  actividadId,
  diaActividad,
  esMaquinaria,
  responsables,
  responsableDefault,
  maquinas,
  lotesActividad,
  lotesCatalogo,
  fincaDefault,
  bultosAsignados,
  descripcion,
  unidadActual,
  accion,
}: {
  actividadId: string
  diaActividad: number
  esMaquinaria: boolean
  responsables: { id: string; nombre: string }[]
  responsableDefault: string
  maquinas: { id: string; nombre: string }[]
  lotesActividad: { id: string; nombre: string; hectareas?: number | null }[]
  lotesCatalogo: Lote[]
  fincaDefault: string
  bultosAsignados?: Record<string, number> | null
  descripcion?: string
  unidadActual?: string | null
  accion: (f: FormData) => void | Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [centro, setCentro] = useState('')
  const [anexados, setAnexados] = useState<{ id: string; nombre: string; hectareas?: number | null }[]>([])
  const [fincaAnexar, setFincaAnexar] = useState(fincaDefault)
  const [loteAnexar, setLoteAnexar] = useState('')
  const conocida = UNIDADES.find((u) => u.toLowerCase() === (unidadActual ?? '').toLowerCase())
  const [unidadSel, setUnidadSel] = useState(conocida ?? (unidadActual ? 'Otro' : (esMaquinaria ? 'Ha' : 'Cantidad')))
  const conBultos = descripcion ? usaBultos(descripcion) : false
  const filasPotreros = [...lotesActividad, ...anexados]
  const fincasAnexar = [...new Set(lotesCatalogo.map((l) => l.finca.nombre))].sort()

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
              <option value="__otra__">Otras…</option>
            </select>
          </label>
          {centro === '__otra__' && (
            <label className="flex flex-col">Otras (texto)
              <input name="centroCostoOtra" className="w-40 rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
        </>
      )}
      <label className="flex flex-col">Unidad
        <select
          name="unidad"
          value={unidadSel === 'Otro' ? 'otro' : unidadSel.toLowerCase()}
          onChange={(e) => setUnidadSel(e.target.value === 'otro' ? 'Otro' : e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
          className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40"
        >
          {UNIDADES.map((u) => (<option key={u} value={u.toLowerCase()}>{u}</option>))}
          <option value="otro">Otro…</option>
        </select>
      </label>
      {unidadSel === 'Otro' && (
        <label className="flex flex-col">Unidad (texto)
          <input name="unidadOtra" defaultValue={conocida ? '' : unidadActual ?? ''} placeholder="ej. bultos" className="w-28 rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      <div className="flex w-full flex-col gap-2 rounded-lg border border-borde bg-arena p-2">
        <span className="font-semibold text-tinta">Potreros realizados</span>
        <div className="flex flex-col gap-1">
          {filasPotreros.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1">
                <input type="checkbox" name="loteHecho" value={l.id} defaultChecked className="accent-bosque" />
                {l.nombre}
              </label>
              <label className="flex items-center gap-1">ha
                <input name={`ha_${l.id}`} type="number" step="any" min="0" defaultValue={l.hectareas ?? ''} className="w-20 rounded-lg border border-borde bg-marfil p-0.5" />
              </label>
              {conBultos && (
                <label className="flex items-center gap-1">bultos
                  <input name={`bultos_${l.id}`} type="number" step="any" min="0" defaultValue={bultosAsignados?.[l.id] ?? ''} className="w-20 rounded-lg border border-borde bg-marfil p-0.5" />
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-borde pt-2">
          <span className="w-full text-tierra">Anexar potrero(s):</span>
          <select value={fincaAnexar} onChange={(e) => { setFincaAnexar(e.target.value); setLoteAnexar('') }} className="rounded-lg border border-borde bg-marfil p-1">
            <option value="">— finca —</option>
            {fincasAnexar.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
          <select value={loteAnexar} onChange={(e) => setLoteAnexar(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1">
            <option value="">— lote —</option>
            {lotesCatalogo.filter((l) => l.finca.nombre === fincaAnexar && !filasPotreros.some((x) => x.id === l.id)).map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
          </select>
          <button
            type="button"
            onClick={() => {
              const l = lotesCatalogo.find((x) => x.id === loteAnexar)
              if (l) { setAnexados((prev) => [...prev, { id: l.id, nombre: l.nombre }]); setLoteAnexar('') }
            }}
            className="rounded-lg border border-bosque px-2 py-1 font-semibold text-bosque hover:bg-arena/40"
          >
            + agregar
          </button>
        </div>
      </div>
      <label className="flex flex-1 flex-col">Observaciones
        <input name="observacion" placeholder="¿qué se avanzó?" className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
      </label>
      <button className="rounded-lg bg-bosque px-3 py-1 font-semibold text-white">Guardar avance</button>
      <button type="button" onClick={() => setAbierto(false)} className="text-tierra underline">cancelar</button>
    </form>
  )
}

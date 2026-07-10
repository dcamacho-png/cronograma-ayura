'use client'

import { useState } from 'react'
import { PickerReemplazoPotreros } from './picker-reemplazo-potreros'
import { usaBultos } from '@/dominio/bultos'
import { CENTROS_COSTO } from '@/dominio/centro-costo'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro" (texto libre)

type Lote = { id: string; nombre: string; hectareas?: number | null; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

export function FormActividadRealizada({
  areaId,
  anio,
  semana,
  esMaquinaria,
  responsables,
  lotes,
  maquinas,
  estipuladas,
  accion,
}: {
  areaId: string
  anio: number
  semana: number
  esMaquinaria: boolean
  responsables: { id: string; nombre: string }[]
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  // Descripción: en maquinaria se elige del catálogo (o "Otra" texto); en estándar es texto libre.
  const [desc, setDesc] = useState('')
  const [descOtra, setDescOtra] = useState('')
  const [centroCosto, setCentroCosto] = useState('')
  const [unidadSel, setUnidadSel] = useState(esMaquinaria ? 'Ha' : 'Cantidad')
  const [unidadOtraTxt, setUnidadOtraTxt] = useState('')

  // Al elegir una actividad del catálogo, fijar su unidad por defecto (editable).
  const matchUnidad = (u: string | undefined) => UNIDADES.find((x) => x.toLowerCase() === (u ?? '').toLowerCase())
  const elegirDesc = (v: string) => {
    setDesc(v)
    const u = matchUnidad(estipuladas.find((x) => x.nombre === v)?.unidad)
    if (u) setUnidadSel(u)
  }
  const esOtra = desc === '__otra__'
  // Descripción efectiva (para saber si usa bultos): en maquinaria el catálogo o el texto "Otra";
  // en estándar el texto libre (guardado en `desc`).
  const descripcionActual = esMaquinaria ? (esOtra ? descOtra : desc) : desc
  const conBultos = usaBultos(descripcionActual)
  const unidadLabel = unidadSel === 'Otro' ? (unidadOtraTxt.trim() || 'medida') : unidadSel

  return (
    <form action={accion} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-borde bg-arena p-3">
      <span className="w-full text-sm font-semibold text-bosque">➕ Agregar actividad realizada (no programada)</span>
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <label className="flex flex-col text-xs">
        Responsable
        <select name="responsableId" required className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs">
        Día
        <select name="dia" required defaultValue="" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
          <option value="" disabled>—</option>
          {DIAS.map((d, i) => (
            <option key={d} value={i + 1}>{d}</option>
          ))}
        </select>
      </label>
      {esMaquinaria ? (
        <>
          <label className="flex flex-1 flex-col text-xs">
            Actividad
            <select
              name="descripcion"
              required
              value={desc}
              onChange={(e) => elegirDesc(e.target.value)}
              className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
            >
              <option value="" disabled>— elige —</option>
              {estipuladas.map((e) => (
                <option key={e.id} value={e.nombre}>{e.nombre}</option>
              ))}
              <option value="__otra__">Otra…</option>
            </select>
          </label>
          {esOtra && (
            <label className="flex flex-1 flex-col text-xs">
              Otra (texto libre)
              <input name="descripcionOtra" required value={descOtra} onChange={(e) => setDescOtra(e.target.value)} placeholder="¿Qué se hizo?" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
        </>
      ) : (
        <label className="flex flex-1 flex-col text-xs">
          Descripción
          <input name="descripcion" required value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="¿Qué se hizo?" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      <label className="flex flex-col text-xs">
        Unidad
        <select
          name="unidad"
          value={unidadSel === 'Otro' ? 'otro' : unidadSel.toLowerCase()}
          onChange={(e) => setUnidadSel(e.target.value === 'otro' ? 'Otro' : e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
          className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
        >
          {UNIDADES.map((u) => (<option key={u} value={u.toLowerCase()}>{u}</option>))}
          <option value="otro">Otro…</option>
        </select>
      </label>
      {unidadSel === 'Otro' && (
        <label className="flex flex-col text-xs">
          Unidad (texto)
          <input name="unidadOtra" value={unidadOtraTxt} onChange={(e) => setUnidadOtraTxt(e.target.value)} placeholder="ej. bultos" className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      {esMaquinaria && (
        <>
          <label className="flex flex-col text-xs">
            Máquina
            <select name="maquinaId" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— sin máquina —</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            Centro de costo
            <select
              name="centroCosto"
              value={centroCosto}
              onChange={(e) => setCentroCosto(e.target.value)}
              className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
            >
              <option value="">— sin centro —</option>
              {CENTROS_COSTO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__otra__">Otras…</option>
            </select>
          </label>
          {centroCosto === '__otra__' && (
            <label className="flex flex-col text-xs">
              Otras (texto libre)
              <input name="centroCostoOtra" className="w-40 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
        </>
      )}
      <label className="flex w-full flex-col text-xs">
        Potreros (medida por lote{conBultos ? ' + bultos' : ''} + observación)
        <PickerReemplazoPotreros lotes={lotes} conBultos={conBultos} unidadLabel={unidadLabel} prefijo="np" conObservacion />
      </label>
      <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">Agregar</button>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { PickerReemplazoPotreros } from './picker-reemplazo-potreros'
import { etiquetaMedida, normalizarUnidad, type Unidad } from '@/dominio/unidad'
import { usaBultos } from '@/dominio/bultos'

type Lote = { id: string; nombre: string; hectareas?: number | null; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro"
const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Bloque "actividad que se hizo en su lugar" (cambio). Estado propio; emite los name-s del
// contrato de reemplazo que leen registrarNovedadActividadAccion y agregarNovedadAccion.
// mostrarDia=false: el día lo aporta el formulario contenedor (p. ej. el día de la novedad).
export function BloqueReemplazo({
  esMaquinaria,
  estipuladas,
  lotes,
  maquinas,
  diaActividad,
  mostrarDia = true,
}: {
  esMaquinaria: boolean
  estipuladas: Estipulada[]
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  diaActividad: number
  mostrarDia?: boolean
}) {
  const [reemplazoDesc, setReemplazoDesc] = useState('')
  const [reemplazoUnidadSel, setReemplazoUnidadSel] = useState('Jornales')
  const [reemplazoDia, setReemplazoDia] = useState(String(diaActividad))

  const unidadPorNombre = new Map(estipuladas.map((e) => [e.nombre, normalizarUnidad(e.unidad)]))
  const reemplazoOtra = reemplazoDesc === '__otra__'
  const reemplazoUnidad: Unidad = reemplazoOtra || reemplazoDesc === '' ? 'ha' : unidadPorNombre.get(reemplazoDesc) ?? 'ha'

  return (
    <div className="flex w-full flex-wrap items-end gap-2 rounded border border-amber-200 bg-amber-50 p-2">
      <span className="w-full text-xs font-semibold text-amber-800">Actividad que se hizo en su lugar</span>
      {esMaquinaria ? (
        <>
          <label className="flex flex-1 flex-col text-xs">
            Actividad *
            <select
              name="reemplazoDescripcion"
              required
              value={reemplazoDesc}
              onChange={(e) => setReemplazoDesc(e.target.value)}
              className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
            >
              <option value="" disabled>— elige —</option>
              {estipuladas.map((e) => (
                <option key={e.id} value={e.nombre}>{e.nombre}</option>
              ))}
              <option value="__otra__">Otra…</option>
            </select>
          </label>
          {reemplazoOtra && (
            <label className="flex flex-1 flex-col text-xs">
              Otra (texto libre) *
              <input name="reemplazoDescripcionOtra" required className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
          <label className="flex flex-col text-xs">
            Máquina
            <select name="reemplazoMaquinaId" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— sin máquina —</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
          <span className="flex flex-col text-xs text-tierra">
            Medida: {etiquetaMedida(reemplazoUnidad)}
            <input type="hidden" name="reemplazoUnidad" value={reemplazoUnidad} />
          </span>
        </>
      ) : (
        <>
          <label className="flex flex-1 flex-col text-xs">
            Descripción *
            <input name="reemplazoDescripcion" required value={reemplazoDesc} onChange={(e) => setReemplazoDesc(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
          <label className="flex flex-col text-xs">
            Unidad
            <select
              name="reemplazoUnidad"
              value={reemplazoUnidadSel === 'Otro' ? 'otro' : reemplazoUnidadSel.toLowerCase()}
              onChange={(e) => setReemplazoUnidadSel(e.target.value === 'otro' ? 'Otro' : e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
              className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
            >
              {UNIDADES.map((u) => (<option key={u} value={u.toLowerCase()}>{u}</option>))}
              <option value="otro">Otro…</option>
            </select>
          </label>
          {reemplazoUnidadSel === 'Otro' && (
            <label className="flex flex-col text-xs">
              Unidad (texto)
              <input name="reemplazoUnidadOtra" placeholder="ej. jornales" className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
        </>
      )}
      {mostrarDia && (
        <label className="flex flex-col text-xs">
          Día *
          <select name="reemplazoDia" value={reemplazoDia} onChange={(e) => setReemplazoDia(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{DIAS[d]}</option>))}
          </select>
        </label>
      )}
      <label className="flex w-full flex-col text-xs">
        Potreros (marca y pon medida{usaBultos(reemplazoDesc) ? ' + bultos' : ''})
        <PickerReemplazoPotreros
          lotes={lotes}
          conBultos={usaBultos(reemplazoDesc)}
          unidadLabel={esMaquinaria ? etiquetaMedida(reemplazoUnidad) : reemplazoUnidadSel === 'Otro' ? 'medida' : reemplazoUnidadSel}
        />
      </label>
    </div>
  )
}

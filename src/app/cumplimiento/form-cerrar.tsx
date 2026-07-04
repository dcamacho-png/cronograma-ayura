'use client'

import { useState } from 'react'
import { PickerReemplazoPotreros } from './picker-reemplazo-potreros'
import { etiquetaMedida, normalizarUnidad, type Unidad } from '@/dominio/unidad'
import { usaBultos } from '@/dominio/bultos'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; hectareas?: number | null; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro"
const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

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
  const [reemplazoDesc, setReemplazoDesc] = useState('')
  const [reemplazoUnidadSel, setReemplazoUnidadSel] = useState('Jornales')
  const [reemplazoDia, setReemplazoDia] = useState(String(diaActividad))

  const esCambio = motivoSel !== '' && motivoSel === motivoCambioId
  // Unidad de la actividad de reemplazo elegida ("Otra"/vacío ⇒ ha).
  const unidadPorNombre = new Map(estipuladas.map((e) => [e.nombre, normalizarUnidad(e.unidad)]))
  const reemplazoOtra = reemplazoDesc === '__otra__'
  const reemplazoUnidad: Unidad = reemplazoOtra || reemplazoDesc === '' ? 'ha' : unidadPorNombre.get(reemplazoDesc) ?? 'ha'

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
          <label className="flex flex-col text-xs">
            Día *
            <select name="reemplazoDia" value={reemplazoDia} onChange={(e) => setReemplazoDia(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{DIAS[d]}</option>))}
            </select>
          </label>
          <label className="flex w-full flex-col text-xs">
            Potreros (marca y pon medida{usaBultos(reemplazoDesc) ? ' + bultos' : ''})
            <PickerReemplazoPotreros
              lotes={lotes}
              conBultos={usaBultos(reemplazoDesc)}
              unidadLabel={esMaquinaria ? etiquetaMedida(reemplazoUnidad) : reemplazoUnidadSel === 'Otro' ? 'medida' : reemplazoUnidadSel}
            />
          </label>
        </div>
      )}
      <div className="flex w-full items-center gap-3">
        <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">Cerrar (no se hizo)</button>
        <button type="button" onClick={() => setModo('')} className="text-xs text-tierra underline">cancelar</button>
      </div>
    </form>
  )
}

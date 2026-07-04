'use client'

import { useState } from 'react'
import { PickerReemplazoPotreros } from './picker-reemplazo-potreros'
import { etiquetaMedida, normalizarUnidad, type Unidad } from '@/dominio/unidad'
import { usaBultos } from '@/dominio/bultos'
import { CENTROS_COSTO } from '@/dominio/centro-costo'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; hectareas?: number | null; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

export function FormRegistrar({
  actividadId,
  esMaquinaria,
  unidad,
  motivos,
  motivoCambioId,
  lotes,
  maquinas,
  estipuladas,
  haProgramada,
  lotesActividad,
  unidadActual,
  diaActividad,
  estadoInicial = '',
  motivoInicial = '',
  notaInicial = '',
  accion,
}: {
  actividadId: string
  esMaquinaria: boolean
  unidad: Unidad
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  haProgramada: number
  lotesActividad: { id: string; nombre: string; hectareas?: number | null }[]
  unidadActual?: string | null
  diaActividad: number
  estadoInicial?: string
  motivoInicial?: string
  notaInicial?: string
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [estado, setEstado] = useState(estadoInicial)
  const [motivoId, setMotivoId] = useState(motivoInicial)
  const [reemplazoDesc, setReemplazoDesc] = useState('')
  const [reemplazoUnidadSel, setReemplazoUnidadSel] = useState('Jornales')
  const [reemplazoDia, setReemplazoDia] = useState(String(diaActividad))
  const [centroCosto, setCentroCosto] = useState('')
  const [anexados, setAnexados] = useState<{ id: string; nombre: string; hectareas?: number | null }[]>([])
  const [fincaAnexar, setFincaAnexar] = useState('')
  const [loteAnexar, setLoteAnexar] = useState('')
  const requiereMotivo = estado !== ''
  const requierePotreros = (estado === 'PARCIAL' || estado === 'REPROGRAMADA') && lotesActividad.length > 1
  const esCambio = estado !== '' && motivoId !== '' && motivoId === motivoCambioId
  const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro"
  const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const conocidaU = UNIDADES.find((u) => u.toLowerCase() === (unidadActual ?? '').toLowerCase())
  const [unidadSel, setUnidadSel] = useState(conocidaU ?? (unidadActual ? 'Otro' : (esMaquinaria ? 'Ha' : 'Cantidad')))
  const filasPotreros = [...lotesActividad, ...anexados]
  const fincasAnexar = [...new Set(lotes.map((l) => l.finca.nombre))].sort()

  // Unidad de la actividad de reemplazo elegida ("Otra"/vacío ⇒ ha).
  const unidadPorNombre = new Map(estipuladas.map((e) => [e.nombre, normalizarUnidad(e.unidad)]))
  const reemplazoOtra = reemplazoDesc === '__otra__'
  const reemplazoUnidad: Unidad = reemplazoOtra || reemplazoDesc === '' ? 'ha' : unidadPorNombre.get(reemplazoDesc) ?? 'ha'

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={actividadId} />
      <label className="flex flex-col text-xs">
        Estado
        <select
          name="estado"
          required
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
        >
          <option value="">— marcar —</option>
          <option value="NO_CUMPLIDA">🔴 No cumplida</option>
          <option value="PARCIAL">🟡 Parcial</option>
          <option value="REPROGRAMADA">🔄 Reprogramada</option>
        </select>
      </label>
      <label className="flex flex-col text-xs">
        Motivo{requiereMotivo ? ' *' : ''}
        <select
          name="motivoId"
          required={requiereMotivo}
          value={motivoId}
          onChange={(e) => setMotivoId(e.target.value)}
          className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
        >
          <option value="">—</option>
          {motivos.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col text-xs">
        Observación / lo que faltó
        <input name="nota" defaultValue={notaInicial} placeholder="(para parcial o reprogramada)" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
      </label>
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
          <input name="unidadOtra" defaultValue={conocidaU ? '' : unidadActual ?? ''} placeholder="ej. bultos" className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      {esMaquinaria && (
        <label className="flex flex-col text-xs">
          {etiquetaMedida(unidad)} (opcional)
          <input
            name="haRealizada"
            type="number"
            step="any"
            min="0"
            defaultValue={haProgramada}
            className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
          />
        </label>
      )}
      {esMaquinaria && (
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
      )}
      {esMaquinaria && centroCosto === '__otra__' && (
        <label className="flex flex-col text-xs">
          Otras (texto libre)
          <input name="centroCostoOtra" className="w-40 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      {requierePotreros && (
        <div className="flex w-full flex-col gap-2 rounded-lg border border-borde bg-arena p-2 text-xs">
          <span className="font-semibold text-tinta">Potreros realizados</span>
          <div className="flex flex-wrap gap-2">
            {filasPotreros.map((l) => (
              <label key={l.id} className="flex items-center gap-1">
                <input type="checkbox" name="loteHecho" value={l.id} defaultChecked={anexados.some((a) => a.id === l.id)} className="accent-bosque" />
                {l.nombre}
              </label>
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
              {lotes.filter((l) => l.finca.nombre === fincaAnexar && !filasPotreros.some((x) => x.id === l.id)).map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
            </select>
            <button
              type="button"
              onClick={() => {
                const l = lotes.find((x) => x.id === loteAnexar)
                if (l) { setAnexados((prev) => [...prev, { id: l.id, nombre: l.nombre }]); setLoteAnexar('') }
              }}
              className="rounded-lg border border-bosque px-2 py-1 font-semibold text-bosque hover:bg-arena/40"
            >
              + agregar
            </button>
          </div>
        </div>
      )}
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
      <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">Registrar</button>
    </form>
  )
}

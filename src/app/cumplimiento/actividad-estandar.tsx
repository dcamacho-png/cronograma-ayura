'use client'

import type { Estado } from '@/dominio/tipos'
import { FormCerrar } from './form-cerrar'
import { FormAvance } from './form-avance'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; hectareas?: number | null; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Control de cumplimiento de UNA actividad estándar (no maquinaria), PENDIENTE o PARCIAL.
// El avance se registra día a día con `FormAvance`: con potreros, una medida por potrero;
// sin potreros, una medida del día (bitácora general). Cierre manual (Cumplida); novedad aparte.
export function ActividadEstandar({
  actividadId,
  estado,
  dia,
  tieneLotes,
  lotesActividad,
  lotesCatalogo,
  unidadRealizada,
  unidadCatalogo,
  lotesPendientesIds,
  estipuladas,
  motivos,
  motivoCambioId,
  responsables,
  responsableActividadId,
  fincaActividad,
  bultosAsignados,
  descripcion,
  registrarAvance,
  registrarAvanceGeneral,
  marcarCumplida,
  cerrarParcial,
  noSeHizo,
  hayPotrerosPendientes,
  devolverAlBanco,
  editarPotreros,
}: {
  actividadId: string
  estado: Estado
  dia: number
  tieneLotes: boolean
  lotesActividad: { id: string; nombre: string; hectareas?: number | null }[]
  lotesCatalogo: Lote[]
  unidadRealizada: string | null
  unidadCatalogo?: string
  lotesPendientesIds?: string[]
  estipuladas: Estipulada[]
  motivos: Motivo[]
  motivoCambioId: string | null
  responsables: { id: string; nombre: string }[]
  responsableActividadId: string
  fincaActividad: string
  bultosAsignados?: Record<string, number> | null
  descripcion?: string
  registrarAvance: (f: FormData) => void | Promise<void>
  registrarAvanceGeneral: (f: FormData) => void | Promise<void>
  marcarCumplida: (f: FormData) => void | Promise<void>
  cerrarParcial: (f: FormData) => void | Promise<void>
  noSeHizo: (f: FormData) => void | Promise<void>
  hayPotrerosPendientes: boolean
  devolverAlBanco: (f: FormData) => void | Promise<void>
  editarPotreros: (f: FormData) => void | Promise<void>
}) {
  const esParcial = estado === 'PARCIAL'

  return (
    <div className="flex w-full flex-col gap-3 text-sm">
      {tieneLotes && lotesActividad.length > 0 && (
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
      <FormAvance
        actividadId={actividadId}
        diaActividad={dia}
        esMaquinaria={false}
        responsables={responsables}
        responsableDefault={responsableActividadId}
        maquinas={[]}
        lotesActividad={lotesActividad}
        lotesCatalogo={lotesCatalogo}
        fincaDefault={fincaActividad}
        bultosAsignados={bultosAsignados}
        descripcion={descripcion}
        unidadActual={unidadRealizada}
        unidadCatalogo={unidadCatalogo}
        lotesPendientesIds={lotesPendientesIds}
        accion={registrarAvance}
        accionGeneral={registrarAvanceGeneral}
      />

      <div className="flex flex-col gap-2">
        <FormCerrar
          actividadId={actividadId}
          diaActividad={dia}
          hayPotrerosPendientes={hayPotrerosPendientes}
          esMaquinaria={false}
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          estipuladas={estipuladas}
          lotes={lotesCatalogo}
          maquinas={[]}
          cumplida={marcarCumplida}
          cerrarParcial={cerrarParcial}
          noSeHizo={noSeHizo}
        />
        <div className="flex flex-wrap items-center gap-3">
          {esParcial && (
            <form action={devolverAlBanco}>
              <input type="hidden" name="id" value={actividadId} />
              <button className="rounded-lg border border-borde px-2 py-1 text-xs text-tierra hover:bg-arena/40">Devolver al banco</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

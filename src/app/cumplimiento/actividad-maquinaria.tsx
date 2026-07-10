'use client'

import type { Unidad } from '@/dominio/unidad'
import type { Estado } from '@/dominio/tipos'
import { FormAvance } from './form-avance'
import { FormCerrar } from './form-cerrar'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; hectareas?: number | null; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Control de cumplimiento de UNA actividad de maquinaria (grupo tareaId), PENDIENTE o
// PARCIAL: avances por lote (máquina + cantidad + centro de costo + día) que se acumulan,
// y cierre manual (Cumplida). Novedad y devolver al banco como en el estándar.
export function ActividadMaquinaria({
  actividadId,
  estado,
  unidad,
  dia,
  lotesActividad,
  lotesCatalogo,
  maquinas,
  estipuladas,
  motivos,
  motivoCambioId,
  haProgramada,
  responsables,
  responsableActividadId,
  fincaActividad,
  unidadRealizada,
  unidadCatalogo,
  bultosAsignados,
  descripcion,
  registrarAvance,
  marcarCumplida,
  cerrarParcial,
  noSeHizo,
  hayPotrerosPendientes,
  devolverAlBanco,
  nota,
}: {
  actividadId: string
  estado: Estado
  unidad: Unidad
  dia: number
  lotesActividad: { id: string; nombre: string; hectareas?: number | null }[]
  lotesCatalogo: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  motivos: Motivo[]
  motivoCambioId: string | null
  haProgramada: number
  responsables: { id: string; nombre: string }[]
  responsableActividadId: string
  fincaActividad: string
  unidadRealizada: string | null
  unidadCatalogo?: string
  bultosAsignados?: Record<string, number> | null
  descripcion?: string
  registrarAvance: (f: FormData) => void | Promise<void>
  marcarCumplida: (f: FormData) => void | Promise<void>
  cerrarParcial: (f: FormData) => void | Promise<void>
  noSeHizo: (f: FormData) => void | Promise<void>
  hayPotrerosPendientes: boolean
  devolverAlBanco: (f: FormData) => void | Promise<void>
  nota: string | null
}) {
  const esParcial = estado === 'PARCIAL'

  return (
    <div className="flex w-full flex-col gap-3 text-sm">
      <FormAvance
        actividadId={actividadId}
        diaActividad={dia}
        esMaquinaria={true}
        responsables={responsables}
        responsableDefault={responsableActividadId}
        maquinas={maquinas}
        lotesActividad={lotesActividad}
        lotesCatalogo={lotesCatalogo}
        fincaDefault={fincaActividad}
        bultosAsignados={bultosAsignados}
        descripcion={descripcion}
        unidadActual={unidadRealizada}
        unidadCatalogo={unidadCatalogo}
        accion={registrarAvance}
      />
      <div className="flex flex-col gap-2">
        <FormCerrar
          actividadId={actividadId}
          diaActividad={dia}
          hayPotrerosPendientes={hayPotrerosPendientes}
          esMaquinaria={true}
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          estipuladas={estipuladas}
          lotes={lotesCatalogo}
          maquinas={maquinas}
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

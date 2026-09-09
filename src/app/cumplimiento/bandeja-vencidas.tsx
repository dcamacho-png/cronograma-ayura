'use client'

import { useState } from 'react'
import { InfoLotes } from '../_componentes/info-lotes'

export type Vencida = {
  id: string                 // fila base de la actividad (basta una: la acción va a la tarea)
  descripcion: string
  anio: number
  semana: number
  responsables: string
  lotes: { id: string; nombre: string; hectareas: number | null }[]
}

// Lo que se venció sin registrar y todavía espera algo.
//
// Registrarlas no se puede: el plazo de esas semanas ya venció. Lo que sí se puede es
// devolver su tarea al banco para programarla de nuevo, con su día, responsable y
// potreros; la actividad vencida queda intacta, como constancia de que no se hizo en su
// momento. Plegada por omisión para no tapar la semana en curso.
export function BandejaVencidas({
  vencidas,
  devolver,
}: {
  vencidas: Vencida[]
  devolver: (f: FormData) => void | Promise<void>
}) {
  const [abierta, setAbierta] = useState(false)
  if (vencidas.length === 0) return null

  return (
    <div className="mb-5 rounded-lg border border-borde bg-arena/60 px-4 py-3">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-tinta"
      >
        <span>{abierta ? '▾' : '▸'}</span>
        ⚠️ {vencidas.length} actividad(es) vencidas sin registrar
        <span className="font-normal text-tierra">· de semanas anteriores</span>
      </button>
      {abierta && (
        <>
          <p className="mt-2 text-xs text-tierra">
            El plazo de esas semanas ya venció, así que no se pueden registrar. Si todavía hay
            que hacerlas, devolvé la tarea al banco y programala de nuevo en Programar; la
            actividad vencida queda como constancia de que no se hizo en su momento.
          </p>
          <ul className="mt-2 divide-y divide-borde">
            {vencidas.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <div className="flex-1">
                  <div className="font-medium">
                    {v.descripcion}
                    <span className="ml-2 text-xs text-tierra">
                      semana {v.semana} de {v.anio} · {v.responsables}
                    </span>
                  </div>
                  <InfoLotes lotes={v.lotes} />
                </div>
                <form action={devolver}>
                  <input type="hidden" name="id" value={v.id} />
                  <button className="rounded-lg border border-bosque px-3 py-1 text-xs font-semibold text-bosque hover:bg-marfil">
                    ↩️ Devolver al banco
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

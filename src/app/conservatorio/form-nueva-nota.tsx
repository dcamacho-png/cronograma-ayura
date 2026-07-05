'use client'

import { SelectFincaLote } from '@/app/_componentes/select-finca-lote'

type Lote = { id: string; nombre: string; finca: { nombre: string } }

// Alta minimalista de un tema: una línea (texto + "+") y un desplegable opcional
// "➕ contexto" con el selector finca→lote (envía loteId).
export function FormNuevaNota({
  lotes,
  accion,
}: {
  lotes: Lote[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  return (
    <form action={accion} className="mb-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          name="texto"
          required
          placeholder="Escribe un tema para hablar…"
          className="flex-1 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
        />
        <button className="rounded-lg bg-bosque px-4 py-2 text-sm font-semibold text-white">+</button>
      </div>
      <details className="text-sm text-tierra">
        <summary className="cursor-pointer select-none">➕ contexto (finca/potrero)</summary>
        <div className="mt-2 max-w-xs">
          <SelectFincaLote lotes={lotes} name="loteId" />
        </div>
      </details>
    </form>
  )
}

'use client'

import { useEffect } from 'react'

export function AutoImprimir() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="mb-4 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded bg-[#11603a] px-4 py-2 text-sm font-semibold text-white"
      >
        🖨️ Imprimir / Guardar PDF
      </button>
    </div>
  )
}

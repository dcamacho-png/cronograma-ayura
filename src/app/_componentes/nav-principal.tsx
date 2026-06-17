'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ENLACES = [
  { href: '/programar', texto: 'Programar' },
  { href: '/cumplimiento', texto: 'Cumplimiento' },
  { href: '/resumen', texto: 'Resumen' },
  { href: '/tablero', texto: 'Tablero' },
  { href: '/configuracion', texto: 'Configuración' },
]

export function NavPrincipal() {
  const ruta = usePathname()
  return (
    <header className="bg-[#11603a] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
        <span className="font-bold">🌱 Cronograma Ayurá</span>
        <nav className="flex flex-wrap gap-3 text-sm">
          {ENLACES.map((e) => {
            const activo = ruta === e.href
            return (
              <Link
                key={e.href}
                href={e.href}
                className={
                  activo
                    ? 'font-semibold underline underline-offset-4'
                    : 'opacity-90 hover:underline'
                }
              >
                {e.texto}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

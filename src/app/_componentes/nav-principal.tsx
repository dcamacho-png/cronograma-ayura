'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cerrarSesionAccion } from '@/app/login/acciones'

const ENLACES = [
  { href: '/tareas', texto: 'Tareas' },
  { href: '/programar', texto: 'Programar' },
  { href: '/cumplimiento', texto: 'Cumplimiento' },
  { href: '/resumen', texto: 'Resumen' },
  { href: '/tablero', texto: 'Tablero' },
  { href: '/configuracion', texto: 'Configuración' },
]

export function NavPrincipal({ usuario }: { usuario: { nombre: string; rol: string } | null }) {
  const ruta = usePathname()
  const enlaces =
    usuario?.rol === 'ADMIN'
      ? ENLACES
      : ENLACES.filter((e) => e.href !== '/tablero' && e.href !== '/configuracion')
  return (
    <header className="bg-[#11603a] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
        <span className="font-bold">🌱 Cronograma Ayurá</span>
        {usuario && (
          <nav className="flex flex-wrap gap-3 text-sm">
            {enlaces.map((e) => {
              const activo = ruta === e.href
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  className={activo ? 'font-semibold underline underline-offset-4' : 'opacity-90 hover:underline'}
                >
                  {e.texto}
                </Link>
              )
            })}
          </nav>
        )}
        {usuario && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="opacity-90">{usuario.nombre}</span>
            <form action={cerrarSesionAccion}>
              <button className="rounded bg-white/15 px-2 py-1 hover:bg-white/25">Cerrar sesión</button>
            </form>
          </div>
        )}
      </div>
    </header>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cerrarSesionAccion } from '@/app/login/acciones'
import { seccionesVisibles } from './secciones'

export function NavPrincipal({ usuario }: { usuario: { nombre: string; rol: string; pantallas: string | null } | null }) {
  const ruta = usePathname()
  const [abierto, setAbierto] = useState(false)

  const enlaces = usuario
    ? [{ href: '/', texto: 'Inicio', icono: '🏠' }, ...seccionesVisibles({ rol: usuario.rol, pantallas: usuario.pantallas })]
    : []

  const claseEnlace = (href: string) =>
    ruta === href ? 'font-semibold underline underline-offset-4' : 'opacity-90 hover:underline'

  return (
    <header className="bg-gradient-to-r from-bosque-hondo to-bosque text-white print:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 gap-y-2 px-6 py-3">
        <Link href="/" className="font-bold">🌱 Cronograma Ayurá</Link>

        {usuario && (
          <>
            {/* Escritorio: enlaces en fila */}
            <nav className="ml-2 hidden flex-wrap gap-3 text-sm md:flex">
              {enlaces.map((e) => (
                <Link key={e.href} href={e.href} className={`inline-flex items-center gap-1 ${claseEnlace(e.href)}`}>
                  <span>{e.icono}</span>{e.texto}
                </Link>
              ))}
            </nav>

            {/* Escritorio: usuario a la derecha */}
            <div className="ml-auto hidden items-center gap-3 text-sm md:flex">
              <span className="opacity-90">{usuario.nombre}</span>
              <form action={cerrarSesionAccion}>
                <button className="rounded bg-white/15 px-2 py-1 hover:bg-white/25">Cerrar sesión</button>
              </form>
            </div>

            {/* Celular: botón ☰ */}
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              aria-label="Menú"
              className="ml-auto rounded bg-white/15 px-3 py-1 text-lg leading-none hover:bg-white/25 md:hidden"
            >
              {abierto ? '✕' : '☰'}
            </button>
          </>
        )}
      </div>

      {/* Celular: panel desplegable */}
      {usuario && abierto && (
        <div className="border-t border-white/20 px-4 pb-3 md:hidden">
          <nav className="flex flex-col">
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                onClick={() => setAbierto(false)}
                className={`flex items-center gap-2 rounded px-3 py-2.5 text-[15px] hover:bg-white/10 ${ruta === e.href ? 'bg-white/15 font-semibold' : ''}`}
              >
                <span>{e.icono}</span>{e.texto}
              </Link>
            ))}
          </nav>
          <div className="mt-2 flex items-center gap-3 border-t border-white/20 px-3 pt-3 text-sm">
            <span className="flex-1 opacity-90">👤 {usuario.nombre}</span>
            <form action={cerrarSesionAccion}>
              <button className="rounded bg-white/15 px-2 py-1 hover:bg-white/25">Cerrar sesión</button>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}

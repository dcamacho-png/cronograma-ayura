import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { semanaActual } from '@/dominio/semana'
import { seccionesVisibles } from './_componentes/secciones'

export default async function Home() {
  const u = await usuarioActual()
  if (!u) redirect('/login')
  const secciones = seccionesVisibles(u.rol)
  const hoy = semanaActual()

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl font-extrabold text-bosque">Hola, {u.nombre} 👋</h1>
      <p className="mb-6 text-sm text-tierra">Semana {hoy.semana} · {hoy.anio}</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="tarjeta flex flex-col items-start gap-2 p-5 transition hover:-translate-y-0.5 hover:border-bosque hover:shadow-md"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-arena text-3xl">{s.icono}</span>
            <span className="text-lg font-bold text-bosque">{s.texto}</span>
            <span className="text-sm text-tierra">{s.descripcion}</span>
          </Link>
        ))}
      </div>
    </main>
  )
}

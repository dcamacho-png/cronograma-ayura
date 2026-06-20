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
      <h1 className="mb-1 text-2xl font-extrabold text-[#11603a]">Hola, {u.nombre} 👋</h1>
      <p className="mb-6 text-sm text-gray-500">Semana {hoy.semana} · {hoy.anio}</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex flex-col items-start gap-1 rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:border-[#11603a] hover:shadow-lg"
          >
            <span className="text-4xl">{s.icono}</span>
            <span className="text-lg font-bold text-[#11603a]">{s.texto}</span>
            <span className="text-sm text-gray-500">{s.descripcion}</span>
          </Link>
        ))}
      </div>
    </main>
  )
}

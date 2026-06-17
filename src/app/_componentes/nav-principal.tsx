import Link from 'next/link'

export function NavPrincipal() {
  return (
    <header className="bg-[#11603a] text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <span className="font-bold">🌱 Cronograma Ayurá</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/programar" className="hover:underline">Programar</Link>
          <Link href="/cumplimiento" className="hover:underline">Cumplimiento</Link>
          <Link href="/resumen" className="hover:underline">Resumen</Link>
        </nav>
      </div>
    </header>
  )
}

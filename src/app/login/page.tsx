import { iniciarSesionAccion } from './acciones'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  return (
    <main className="tarjeta mx-auto mt-16 max-w-sm p-8">
      <h1 className="mb-4 text-2xl font-bold text-bosque">🌱 Cronograma Ayurá</h1>
      <h2 className="mb-4 text-lg font-semibold text-tinta">Iniciar sesión</h2>
      {sp.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Usuario o contraseña incorrectos.</p>
      )}
      <form action={iniciarSesionAccion} className="flex flex-col gap-3">
        <label className="flex flex-col text-sm">
          Usuario
          <input name="usuario" required autoFocus className="rounded-lg border border-borde bg-marfil p-2 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
        <label className="flex flex-col text-sm">
          Contraseña
          <input name="password" type="password" required className="rounded-lg border border-borde bg-marfil p-2 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
        <button className="rounded-lg bg-bosque px-4 py-2 font-semibold text-white">Entrar</button>
      </form>
    </main>
  )
}

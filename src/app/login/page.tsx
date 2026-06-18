import { iniciarSesionAccion } from './acciones'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  return (
    <main className="mx-auto mt-16 max-w-sm rounded-2xl border p-8">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">🌱 Cronograma Ayurá</h1>
      <h2 className="mb-4 text-lg font-semibold">Iniciar sesión</h2>
      {sp.error && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">Usuario o contraseña incorrectos.</p>
      )}
      <form action={iniciarSesionAccion} className="flex flex-col gap-3">
        <label className="flex flex-col text-sm">
          Usuario
          <input name="usuario" required autoFocus className="rounded border p-2" />
        </label>
        <label className="flex flex-col text-sm">
          Contraseña
          <input name="password" type="password" required className="rounded border p-2" />
        </label>
        <button className="rounded bg-[#11603a] px-4 py-2 font-semibold text-white">Entrar</button>
      </form>
      <p className="mt-4 text-xs text-gray-400">
        Usuarios: admin, ganaderia, maquinaria, maiz, riego, nelore · contraseña por defecto: clave123
      </p>
    </main>
  )
}

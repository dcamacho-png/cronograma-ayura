import {
  listarAreas,
  listarFincas,
  listarMotivos,
  listarMaquinas,
  listarResponsablesTodos,
} from '@/datos/repositorio'
import {
  crearAreaAccion,
  crearFincaAccion,
  crearMotivoAccion,
  crearMaquinaAccion,
  crearResponsableAccion,
} from './acciones'

export default async function ConfiguracionPage() {
  const [areas, fincas, motivos, maquinas, responsables] = await Promise.all([
    listarAreas(),
    listarFincas(),
    listarMotivos(),
    listarMaquinas(),
    listarResponsablesTodos(),
  ])

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Configuración</h1>
      <p className="mb-6 text-sm text-gray-500">
        Agrega los catálogos del cronograma. (Por ahora solo se pueden agregar, no eliminar.)
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Áreas */}
        <section className="rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">Áreas</h2>
          <ul className="mb-3 flex flex-wrap gap-2">
            {areas.map((a) => (
              <li key={a.id} className="rounded bg-gray-100 px-2 py-1 text-sm">{a.nombre}</li>
            ))}
          </ul>
          <form action={crearAreaAccion} className="flex gap-2">
            <input name="nombre" required placeholder="Nueva área" className="flex-1 rounded border p-2 text-sm" />
            <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Fincas */}
        <section className="rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">Fincas</h2>
          <ul className="mb-3 flex flex-wrap gap-2">
            {fincas.map((f) => (
              <li key={f.id} className="rounded bg-gray-100 px-2 py-1 text-sm">{f.nombre}</li>
            ))}
          </ul>
          <form action={crearFincaAccion} className="flex gap-2">
            <input name="nombre" required placeholder="Nueva finca" className="flex-1 rounded border p-2 text-sm" />
            <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Motivos */}
        <section className="rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">Motivos</h2>
          <ul className="mb-3 flex flex-wrap gap-2">
            {motivos.map((m) => (
              <li key={m.id} className="rounded bg-gray-100 px-2 py-1 text-sm">{m.nombre}</li>
            ))}
          </ul>
          <form action={crearMotivoAccion} className="flex gap-2">
            <input name="nombre" required placeholder="Nuevo motivo" className="flex-1 rounded border p-2 text-sm" />
            <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Máquinas */}
        <section className="rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">Máquinas</h2>
          <ul className="mb-3 space-y-1 text-sm">
            {maquinas.map((m) => (
              <li key={m.id} className="rounded bg-gray-100 px-2 py-1">
                {m.nombre}{m.operario ? ` · ${m.operario}` : ''}
              </li>
            ))}
          </ul>
          <form action={crearMaquinaAccion} className="flex flex-wrap gap-2">
            <input name="nombre" required placeholder="Máquina (placa/nombre)" className="flex-1 rounded border p-2 text-sm" />
            <input name="operario" placeholder="Operario (opcional)" className="flex-1 rounded border p-2 text-sm" />
            <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Responsables */}
        <section className="rounded-xl border p-4 md:col-span-2">
          <h2 className="mb-2 font-semibold">Responsables</h2>
          <ul className="mb-3 flex flex-wrap gap-2">
            {responsables.map((r) => (
              <li key={r.id} className="rounded bg-gray-100 px-2 py-1 text-sm">
                {r.nombre} <span className="text-gray-500">· {r.area.nombre}</span>
              </li>
            ))}
          </ul>
          <form action={crearResponsableAccion} className="flex flex-wrap gap-2">
            <input name="nombre" required placeholder="Nombre del responsable" className="flex-1 rounded border p-2 text-sm" />
            <select name="areaId" required className="rounded border p-2 text-sm">
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>
      </div>
    </main>
  )
}

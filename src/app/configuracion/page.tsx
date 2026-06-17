import {
  listarAreas,
  listarFincas,
  listarMotivos,
  listarMaquinas,
  listarResponsablesTodos,
  listarActividadesEstipuladas,
} from '@/datos/repositorio'
import {
  crearAreaAccion,
  crearFincaAccion,
  crearMotivoAccion,
  crearMaquinaAccion,
  crearResponsableAccion,
  eliminarAreaAccion,
  eliminarFincaAccion,
  eliminarMotivoAccion,
  eliminarMaquinaAccion,
  eliminarResponsableAccion,
  crearActividadEstipuladaAccion,
  eliminarActividadEstipuladaAccion,
  renombrarActividadEstipuladaAccion,
} from './acciones'

export default async function ConfiguracionPage() {
  const [areas, fincas, motivos, maquinas, responsables, estipuladas] = await Promise.all([
    listarAreas(),
    listarFincas(),
    listarMotivos(),
    listarMaquinas(),
    listarResponsablesTodos(),
    listarActividadesEstipuladas(),
  ])

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Configuración</h1>
      <p className="mb-6 text-sm text-gray-500">
        Agrega o elimina los catálogos. (Los que están en uso no se pueden eliminar.)
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Áreas */}
        <section className="rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">Áreas</h2>
          <ul className="mb-3 flex flex-wrap gap-2">
            {areas.map((a) => (
              <li key={a.id} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm">
                <span>{a.nombre}</span>
                <form action={eliminarAreaAccion}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-gray-400 hover:text-red-600" title="Eliminar" aria-label="Eliminar">✕</button>
                </form>
              </li>
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
              <li key={f.id} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm">
                <span>{f.nombre}</span>
                <form action={eliminarFincaAccion}>
                  <input type="hidden" name="id" value={f.id} />
                  <button className="text-gray-400 hover:text-red-600" title="Eliminar" aria-label="Eliminar">✕</button>
                </form>
              </li>
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
              <li key={m.id} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm">
                <span>{m.nombre}</span>
                <form action={eliminarMotivoAccion}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-gray-400 hover:text-red-600" title="Eliminar" aria-label="Eliminar">✕</button>
                </form>
              </li>
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
              <li key={m.id} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1">
                <span>{m.nombre}{m.operario ? ` · ${m.operario}` : ''}</span>
                <form action={eliminarMaquinaAccion}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-gray-400 hover:text-red-600" title="Eliminar" aria-label="Eliminar">✕</button>
                </form>
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
              <li key={r.id} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm">
                <span>{r.nombre} <span className="text-gray-500">· {r.area.nombre}</span></span>
                <form action={eliminarResponsableAccion}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-gray-400 hover:text-red-600" title="Eliminar" aria-label="Eliminar">✕</button>
                </form>
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

        {/* Actividades de maquinaria (estipuladas) */}
        <section className="rounded-xl border p-4 md:col-span-2">
          <h2 className="mb-2 font-semibold">Actividades de maquinaria (estipuladas)</h2>
          <p className="mb-3 text-xs text-gray-500">Estas aparecen en el desplegable de Tareas cuando el área es Maquinaria.</p>
          <ul className="mb-3 space-y-1">
            {estipuladas.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <form action={renombrarActividadEstipuladaAccion} className="flex flex-1 items-center gap-1">
                  <input type="hidden" name="id" value={e.id} />
                  <input name="nombre" defaultValue={e.nombre} className="flex-1 rounded border p-1 text-sm" />
                  <button className="text-xs font-semibold text-[#11603a] hover:underline">guardar</button>
                </form>
                <form action={eliminarActividadEstipuladaAccion}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="text-gray-400 hover:text-red-600" title="Eliminar" aria-label="Eliminar">✕</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={crearActividadEstipuladaAccion} className="flex gap-2">
            <input name="nombre" required placeholder="Nueva actividad de maquinaria" className="flex-1 rounded border p-2 text-sm" />
            <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>
      </div>
    </main>
  )
}

import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import {
  listarAreas,
  listarFincas,
  listarMotivos,
  listarMaquinas,
  listarResponsablesTodos,
  listarActividadesEstipuladas,
  listarLotes,
  listarUsuarios,
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
  crearLoteAccion,
  eliminarLoteAccion,
  crearUsuarioAccion,
  cambiarContrasenaAccion,
  eliminarUsuarioAccion,
} from './acciones'

export default async function ConfiguracionPage() {
  const u = await usuarioActual()
  if (!u || u.rol !== 'ADMIN') redirect('/programar')
  const [areas, fincas, motivos, maquinas, responsables, estipuladas, lotes, usuarios] = await Promise.all([
    listarAreas(),
    listarFincas(),
    listarMotivos(),
    listarMaquinas(),
    listarResponsablesTodos(),
    listarActividadesEstipuladas(),
    listarLotes(),
    listarUsuarios(),
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
                <span>{m.nombre}</span>
                <form action={eliminarMaquinaAccion}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-gray-400 hover:text-red-600" title="Eliminar" aria-label="Eliminar">✕</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={crearMaquinaAccion} className="flex flex-wrap gap-2">
            <input name="nombre" required placeholder="Máquina (placa/nombre)" className="flex-1 rounded border p-2 text-sm" />
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

        {/* Lotes / Potreros */}
        <section className="rounded-xl border p-4 md:col-span-2">
          <h2 className="mb-2 font-semibold">Lotes / Potreros</h2>
          <p className="mb-3 text-xs text-gray-500">{lotes.length} lotes. Al crear actividades eliges el lote y la finca queda automática.</p>
          <ul className="mb-3 max-h-72 space-y-1 overflow-y-auto">
            {lotes.map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {l.nombre}
                  <span className="text-gray-500"> · {l.finca.nombre}{l.hectareas ? ` · ${l.hectareas} ha` : ''}{l.tipoPasto ? ` · ${l.tipoPasto}` : ''}</span>
                </span>
                <form action={eliminarLoteAccion}>
                  <input type="hidden" name="id" value={l.id} />
                  <button className="text-gray-400 hover:text-red-600" title="Eliminar" aria-label="Eliminar">✕</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={crearLoteAccion} className="flex flex-wrap items-end gap-2">
            <input name="nombre" required placeholder="Nombre del lote" className="flex-1 rounded border p-2 text-sm" />
            <select name="fincaId" required className="rounded border p-2 text-sm">
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
            <input name="hectareas" type="number" step="0.01" placeholder="ha" className="w-20 rounded border p-2 text-sm" />
            <input name="tipoPasto" placeholder="Tipo de pasto" className="rounded border p-2 text-sm" />
            <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Usuarios */}
        <section className="rounded-xl border p-4 md:col-span-2">
          <h2 className="mb-2 font-semibold">Usuarios</h2>
          <ul className="mb-3 space-y-2 text-sm">
            {usuarios.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                  <b>{u.usuario}</b> · {u.nombre} · {u.rol}{u.area ? ` · ${u.area.nombre}` : ''}
                </span>
                <form action={cambiarContrasenaAccion} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={u.id} />
                  <input name="password" required placeholder="nueva contraseña" className="rounded border p-1 text-xs" />
                  <button className="text-xs font-semibold text-[#11603a] hover:underline">cambiar</button>
                </form>
                <form action={eliminarUsuarioAccion}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="text-gray-400 hover:text-red-600" title="Eliminar" aria-label="Eliminar">✕</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={crearUsuarioAccion} className="flex flex-wrap items-end gap-2">
            <input name="usuario" required placeholder="usuario (login)" className="rounded border p-2 text-sm" />
            <input name="nombre" required placeholder="nombre" className="rounded border p-2 text-sm" />
            <input name="password" required placeholder="contraseña" className="rounded border p-2 text-sm" />
            <select name="rol" required className="rounded border p-2 text-sm">
              <option value="AREA">Área</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select name="areaId" className="rounded border p-2 text-sm">
              <option value="">(área, si es de área)</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            <button className="rounded bg-[#11603a] px-3 py-2 text-sm font-semibold text-white">+ Usuario</button>
          </form>
        </section>
      </div>
    </main>
  )
}

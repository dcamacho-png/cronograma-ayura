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
  cambiarEstadoResponsableAccion,
  crearActividadEstipuladaAccion,
  eliminarActividadEstipuladaAccion,
  renombrarActividadEstipuladaAccion,
  crearLoteAccion,
  eliminarLoteAccion,
  crearUsuarioAccion,
  cambiarContrasenaAccion,
  eliminarUsuarioAccion,
} from './acciones'
import { FormEliminar } from './form-eliminar'
import { LotesLista } from './lotes-lista'

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 border-b pb-1 text-lg font-bold text-bosque">{titulo}</h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>
    </section>
  )
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>
}) {
  const u = await usuarioActual()
  if (!u || u.rol !== 'ADMIN') redirect('/programar')
  const sp = await searchParams
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
      <h1 className="mb-4 text-2xl font-bold text-bosque">Configuración</h1>

      {sp.ok && (
        <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          ✔ {sp.ok}
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          ⚠️ {sp.error}
        </div>
      )}

      <p className="mb-6 text-sm text-gray-500">
        Agrega o elimina los catálogos. (Los que están en uso no se pueden eliminar.)
      </p>

      {/* ---------- Estructura ---------- */}
      <Grupo titulo="Estructura">
        {/* Áreas */}
        <section className="rounded-xl border p-4">
          <h3 className="mb-2 font-semibold">Áreas ({areas.length})</h3>
          <ul className="mb-3 flex flex-wrap gap-2">
            {areas.map((a) => (
              <li key={a.id} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm">
                <span>{a.nombre}</span>
                <FormEliminar accion={eliminarAreaAccion} id={a.id} etiqueta={a.nombre} />
              </li>
            ))}
          </ul>
          <form action={crearAreaAccion} className="flex gap-2">
            <input name="nombre" required placeholder="Nueva área" className="flex-1 rounded border p-2 text-sm" />
            <button className="rounded bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Fincas */}
        <section className="rounded-xl border p-4">
          <h3 className="mb-2 font-semibold">Fincas ({fincas.length})</h3>
          <ul className="mb-3 flex flex-wrap gap-2">
            {fincas.map((f) => (
              <li key={f.id} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm">
                <span>{f.nombre}</span>
                <FormEliminar accion={eliminarFincaAccion} id={f.id} etiqueta={f.nombre} />
              </li>
            ))}
          </ul>
          <form action={crearFincaAccion} className="flex gap-2">
            <input name="nombre" required placeholder="Nueva finca" className="flex-1 rounded border p-2 text-sm" />
            <button className="rounded bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Lotes / Potreros */}
        <section className="rounded-xl border p-4 md:col-span-2">
          <h3 className="mb-2 font-semibold">Lotes / Potreros ({lotes.length})</h3>
          <p className="mb-3 text-xs text-gray-500">Al crear actividades eliges el lote y la finca queda automática.</p>
          <LotesLista lotes={lotes} eliminar={eliminarLoteAccion} />
          <form action={crearLoteAccion} className="flex flex-wrap items-end gap-2">
            <input name="nombre" required placeholder="Nombre del lote" className="flex-1 rounded border p-2 text-sm" />
            <select name="fincaId" required className="rounded border p-2 text-sm">
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
            <input name="hectareas" type="number" step="0.01" placeholder="ha" className="w-20 rounded border p-2 text-sm" />
            <input name="tipoPasto" placeholder="Tipo de pasto" className="rounded border p-2 text-sm" />
            <button className="rounded bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>
      </Grupo>

      {/* ---------- Maquinaria ---------- */}
      <Grupo titulo="Maquinaria">
        {/* Máquinas */}
        <section className="rounded-xl border p-4">
          <h3 className="mb-2 font-semibold">Máquinas ({maquinas.length})</h3>
          <ul className="mb-3 space-y-1 text-sm">
            {maquinas.map((m) => (
              <li key={m.id} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1">
                <span className="flex-1">{m.nombre}</span>
                <FormEliminar accion={eliminarMaquinaAccion} id={m.id} etiqueta={m.nombre} />
              </li>
            ))}
          </ul>
          <form action={crearMaquinaAccion} className="flex flex-wrap gap-2">
            <input name="nombre" required placeholder="Máquina (placa/nombre)" className="flex-1 rounded border p-2 text-sm" />
            <button className="rounded bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Actividades de maquinaria (estipuladas) */}
        <section className="rounded-xl border p-4">
          <h3 className="mb-2 font-semibold">Actividades de maquinaria ({estipuladas.length})</h3>
          <p className="mb-3 text-xs text-gray-500">Aparecen en el desplegable de Tareas cuando el área es Maquinaria.</p>
          <ul className="mb-3 space-y-1">
            {estipuladas.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <form action={renombrarActividadEstipuladaAccion} className="flex flex-1 items-center gap-1">
                  <input type="hidden" name="id" value={e.id} />
                  <input name="nombre" defaultValue={e.nombre} className="flex-1 rounded border p-1 text-sm" />
                  <button className="text-xs font-semibold text-bosque hover:underline">guardar</button>
                </form>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{e.unidad}</span>
                <FormEliminar accion={eliminarActividadEstipuladaAccion} id={e.id} etiqueta={e.nombre} />
              </li>
            ))}
          </ul>
          <form action={crearActividadEstipuladaAccion} className="flex flex-wrap gap-2">
            <input name="nombre" required placeholder="Nueva actividad de maquinaria" className="flex-1 rounded border p-2 text-sm" />
            <select name="unidad" defaultValue="ha" className="rounded border p-2 text-sm">
              <option value="ha">Ha</option>
              <option value="hora">Hora</option>
              <option value="kg">Kg</option>
            </select>
            <button className="rounded bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>
      </Grupo>

      {/* ---------- Personas ---------- */}
      <Grupo titulo="Personas">
        {/* Responsables */}
        <section className="rounded-xl border p-4 md:col-span-2">
          <h3 className="mb-2 font-semibold">Responsables ({responsables.length})</h3>
          <ul className="mb-3 flex flex-wrap gap-2">
            {responsables.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded bg-gray-100 px-2 py-1 text-sm">
                <span className={r.activo ? '' : 'text-gray-400'}>
                  {r.nombre} <span className="text-gray-500">· {r.area.nombre}</span>
                  {!r.activo && <span className="text-gray-400"> · (inactivo)</span>}
                </span>
                <form action={cambiarEstadoResponsableAccion}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="activo" value={r.activo ? '0' : '1'} />
                  <button className="text-xs font-semibold text-bosque hover:underline">
                    {r.activo ? 'Dar de baja' : 'Reactivar'}
                  </button>
                </form>
                {r._count.actividades === 0 && (
                  <FormEliminar accion={eliminarResponsableAccion} id={r.id} etiqueta={r.nombre} />
                )}
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
            <button className="rounded bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Usuarios */}
        <section className="rounded-xl border p-4 md:col-span-2">
          <h3 className="mb-2 font-semibold">Usuarios ({usuarios.length})</h3>
          <ul className="mb-3 space-y-2 text-sm">
            {usuarios.map((us) => (
              <li key={us.id} className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                  <b>{us.usuario}</b> · {us.nombre} · {us.rol}{us.area ? ` · ${us.area.nombre}` : ''}
                </span>
                <form action={cambiarContrasenaAccion} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={us.id} />
                  <input name="password" required placeholder="nueva contraseña" className="rounded border p-1 text-xs" />
                  <button className="text-xs font-semibold text-bosque hover:underline">cambiar</button>
                </form>
                <FormEliminar accion={eliminarUsuarioAccion} id={us.id} etiqueta={us.usuario} />
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
            <button className="rounded bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Usuario</button>
          </form>
        </section>
      </Grupo>

      {/* ---------- Otros ---------- */}
      <Grupo titulo="Otros">
        {/* Motivos */}
        <section className="rounded-xl border p-4">
          <h3 className="mb-2 font-semibold">Motivos ({motivos.length})</h3>
          <ul className="mb-3 flex flex-wrap gap-2">
            {motivos.map((m) => (
              <li key={m.id} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm">
                <span>{m.nombre}</span>
                <FormEliminar accion={eliminarMotivoAccion} id={m.id} etiqueta={m.nombre} />
              </li>
            ))}
          </ul>
          <form action={crearMotivoAccion} className="flex gap-2">
            <input name="nombre" required placeholder="Nuevo motivo" className="flex-1 rounded border p-2 text-sm" />
            <button className="rounded bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>
      </Grupo>
    </main>
  )
}

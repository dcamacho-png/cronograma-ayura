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
  setUnidadActividadEstipuladaAccion,
  crearLoteAccion,
  eliminarLoteAccion,
  crearUsuarioAccion,
  cambiarContrasenaAccion,
  eliminarUsuarioAccion,
  actualizarPantallasUsuarioAccion,
  actualizarVariantesAreaAccion,
} from './acciones'
import { FormEliminar } from './form-eliminar'
import { LotesLista } from './lotes-lista'
import { UsuarioPantallas } from './usuario-pantallas'
import { AreaVariantes } from './area-variantes'

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 border-b border-borde pb-1 text-lg font-bold text-bosque">{titulo}</h2>
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

      <p className="mb-6 text-sm text-tierra">
        Agrega o elimina los catálogos. (Los que están en uso no se pueden eliminar.)
      </p>

      {/* ---------- Estructura ---------- */}
      <Grupo titulo="Estructura">
        {/* Áreas */}
        <section className="tarjeta p-4">
          <h3 className="mb-2 font-semibold text-tinta">Áreas ({areas.length})</h3>
          <ul className="mb-3 flex flex-wrap gap-2">
            {areas.map((a) => (
              <li key={a.id} className="flex items-center gap-1 rounded bg-arena px-2 py-1 text-sm">
                <span>{a.nombre}</span>
                <FormEliminar accion={eliminarAreaAccion} id={a.id} etiqueta={a.nombre} />
              </li>
            ))}
          </ul>
          <form action={crearAreaAccion} className="flex gap-2">
            <input name="nombre" required placeholder="Nueva área" className="flex-1 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <button className="rounded-lg bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
          <div className="mt-3 flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-tinta">Variante por pantalla</h4>
            {areas.map((a) => (
              <AreaVariantes
                key={a.id}
                id={a.id}
                nombre={a.nombre}
                valores={{ maqTareas: a.maqTareas, maqProgramar: a.maqProgramar, maqCumplimiento: a.maqCumplimiento, maqResumen: a.maqResumen }}
                accion={actualizarVariantesAreaAccion}
              />
            ))}
          </div>
        </section>

        {/* Fincas */}
        <section className="tarjeta p-4">
          <h3 className="mb-2 font-semibold text-tinta">Fincas ({fincas.length})</h3>
          <ul className="mb-3 flex flex-wrap gap-2">
            {fincas.map((f) => (
              <li key={f.id} className="flex items-center gap-1 rounded bg-arena px-2 py-1 text-sm">
                <span>{f.nombre}</span>
                <FormEliminar accion={eliminarFincaAccion} id={f.id} etiqueta={f.nombre} />
              </li>
            ))}
          </ul>
          <form action={crearFincaAccion} className="flex gap-2">
            <input name="nombre" required placeholder="Nueva finca" className="flex-1 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <button className="rounded-lg bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Lotes / Potreros */}
        <section className="tarjeta p-4 md:col-span-2">
          <h3 className="mb-2 font-semibold text-tinta">Lotes / Potreros ({lotes.length})</h3>
          <p className="mb-3 text-xs text-tierra">Al crear actividades eliges el lote y la finca queda automática.</p>
          <LotesLista lotes={lotes} eliminar={eliminarLoteAccion} />
          <form action={crearLoteAccion} className="flex flex-wrap items-end gap-2">
            <input name="nombre" required placeholder="Nombre del lote" className="flex-1 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <select name="fincaId" required className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
            <input name="hectareas" type="number" step="0.01" placeholder="ha" className="w-20 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <input name="tipoPasto" placeholder="Tipo de pasto" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <button className="rounded-lg bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>
      </Grupo>

      {/* ---------- Maquinaria ---------- */}
      <Grupo titulo="Maquinaria">
        {/* Máquinas */}
        <section className="tarjeta p-4">
          <h3 className="mb-2 font-semibold text-tinta">Máquinas ({maquinas.length})</h3>
          <ul className="mb-3 space-y-1 text-sm">
            {maquinas.map((m) => (
              <li key={m.id} className="flex items-center gap-1 rounded bg-arena px-2 py-1">
                <span className="flex-1">{m.nombre}</span>
                <FormEliminar accion={eliminarMaquinaAccion} id={m.id} etiqueta={m.nombre} />
              </li>
            ))}
          </ul>
          <form action={crearMaquinaAccion} className="flex flex-wrap gap-2">
            <input name="nombre" required placeholder="Máquina (placa/nombre)" className="flex-1 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <button className="rounded-lg bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Actividades de maquinaria (estipuladas) */}
        <section className="tarjeta p-4">
          <h3 className="mb-2 font-semibold text-tinta">Actividades (catálogo) ({estipuladas.length})</h3>
          <p className="mb-3 text-xs text-tierra">Estándar y maquinaria; cada área ve su categoría en el desplegable de Tareas.</p>
          <ul className="mb-3 space-y-1">
            {estipuladas.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <form action={renombrarActividadEstipuladaAccion} className="flex flex-1 items-center gap-1">
                  <input type="hidden" name="id" value={e.id} />
                  <input name="nombre" defaultValue={e.nombre} className="flex-1 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
                  <button className="text-xs font-semibold text-bosque hover:underline">guardar</button>
                </form>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.maquinaria ? 'bg-arena text-arcilla' : 'bg-bosque/15 text-bosque'}`}>
                  {e.maquinaria ? 'Maquinaria' : 'Estándar'}
                </span>
                <form action={setUnidadActividadEstipuladaAccion} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={e.id} />
                  <select name="unidad" defaultValue={e.unidad} className="rounded-lg border border-borde bg-marfil p-1 text-xs focus:outline-none focus:ring-2 focus:ring-bosque/40">
                    <option value="ha">Ha</option>
                    <option value="hora">Hora</option>
                    <option value="kg">Kg</option>
                    <option value="cantidad">Cantidad</option>
                  </select>
                  <button className="text-xs font-semibold text-bosque hover:underline">guardar</button>
                </form>
                <FormEliminar accion={eliminarActividadEstipuladaAccion} id={e.id} etiqueta={e.nombre} />
              </li>
            ))}
          </ul>
          <form action={crearActividadEstipuladaAccion} className="flex flex-wrap gap-2">
            <input name="nombre" required placeholder="Nueva actividad de maquinaria" className="flex-1 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <select name="unidad" defaultValue="ha" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="ha">Ha</option>
              <option value="hora">Hora</option>
              <option value="kg">Kg</option>
              <option value="cantidad">Cantidad</option>
            </select>
            <select name="categoria" defaultValue="maquinaria" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="maquinaria">Maquinaria</option>
              <option value="estandar">Estándar</option>
            </select>
            <button className="rounded-lg bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>
      </Grupo>

      {/* ---------- Personas ---------- */}
      <Grupo titulo="Personas">
        {/* Responsables */}
        <section className="tarjeta p-4 md:col-span-2">
          <h3 className="mb-2 font-semibold text-tinta">Responsables ({responsables.length})</h3>
          <ul className="mb-3 flex flex-wrap gap-2">
            {responsables.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded bg-arena px-2 py-1 text-sm">
                <span className={r.activo ? '' : 'text-tierra/60'}>
                  {r.nombre} <span className="text-tierra">· {r.area.nombre}</span>
                  {!r.activo && <span className="text-tierra/60"> · (inactivo)</span>}
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
            <input name="nombre" required placeholder="Nombre del responsable" className="flex-1 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <select name="areaId" required className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            <button className="rounded-lg bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>

        {/* Usuarios */}
        <section className="tarjeta p-4 md:col-span-2">
          <h3 className="mb-2 font-semibold text-tinta">Usuarios ({usuarios.length})</h3>
          <ul className="mb-3 space-y-2 text-sm">
            {usuarios.map((us) => (
              <li key={us.id} className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                  <b>{us.usuario}</b> · {us.nombre} · {us.rol}{us.area ? ` · ${us.area.nombre}` : ''}
                </span>
                <UsuarioPantallas
                  id={us.id}
                  sinToggles={us.rol === 'ADMIN' || us.rol === 'VISOR'}
                  pantallas={us.pantallas}
                  accion={actualizarPantallasUsuarioAccion}
                />
                <form action={cambiarContrasenaAccion} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={us.id} />
                  <input name="password" required placeholder="nueva contraseña" className="rounded-lg border border-borde bg-marfil p-1 text-xs focus:outline-none focus:ring-2 focus:ring-bosque/40" />
                  <button className="text-xs font-semibold text-bosque hover:underline">cambiar</button>
                </form>
                <FormEliminar accion={eliminarUsuarioAccion} id={us.id} etiqueta={us.usuario} />
              </li>
            ))}
          </ul>
          <form action={crearUsuarioAccion} className="flex flex-wrap items-end gap-2">
            <input name="usuario" required placeholder="usuario (login)" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <input name="nombre" required placeholder="nombre" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <input name="password" required placeholder="contraseña" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <select name="rol" required className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="AREA">Área</option>
              <option value="ADMIN">Admin</option>
              <option value="VISOR">Visor (solo consulta)</option>
            </select>
            <select name="areaId" className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">(área, si es de área)</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            <button className="rounded-lg bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Usuario</button>
          </form>
        </section>
      </Grupo>

      {/* ---------- Otros ---------- */}
      <Grupo titulo="Otros">
        {/* Motivos */}
        <section className="tarjeta p-4">
          <h3 className="mb-2 font-semibold text-tinta">Motivos ({motivos.length})</h3>
          <ul className="mb-3 flex flex-wrap gap-2">
            {motivos.map((m) => (
              <li key={m.id} className="flex items-center gap-1 rounded bg-arena px-2 py-1 text-sm">
                <span>{m.nombre}</span>
                <FormEliminar accion={eliminarMotivoAccion} id={m.id} etiqueta={m.nombre} />
              </li>
            ))}
          </ul>
          <form action={crearMotivoAccion} className="flex gap-2">
            <input name="nombre" required placeholder="Nuevo motivo" className="flex-1 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            <button className="rounded-lg bg-bosque px-3 py-2 text-sm font-semibold text-white">+ Agregar</button>
          </form>
        </section>
      </Grupo>
    </main>
  )
}

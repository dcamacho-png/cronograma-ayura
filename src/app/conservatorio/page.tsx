import { redirect } from 'next/navigation'
import { listarNotasConservatorio, listarLotes } from '@/datos/repositorio'
import { usuarioActual } from '@/auth/sesion'
import { puedeVer, puedeMarcarConservatorio } from '@/auth/permisos'
import { separarNotas, agruparPorArea } from '@/dominio/conservatorio'
import { FormNuevaNota } from './form-nueva-nota'
import { crearNotaAccion, marcarHabladaAccion, reabrirNotaAccion, borrarNotaAccion } from './acciones'

const fmtFecha = (f: Date) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

export default async function ConservatorioPage() {
  const u = await usuarioActual()
  if (!u) redirect('/login')
  if (!puedeVer(u, 'conservatorio')) redirect('/')

  const verTodas = u.rol === 'ADMIN' || u.rol === 'VISOR'
  const puedeMarcar = puedeMarcarConservatorio(u)
  const puedeCrear = u.rol === 'AREA' && !!u.areaId

  const notas = await listarNotasConservatorio(verTodas ? null : (u.areaId ?? '__none__'))
  const lotes = puedeCrear ? await listarLotes() : []
  const { pendientes, hablados } = separarNotas(notas)

  // Etiqueta de contexto (potrero) si la nota tiene lote.
  const etiquetaLote = (n: (typeof notas)[number]) =>
    n.lote ? `${n.lote.finca.nombre} · ${n.lote.nombre}` : null

  // Una fila de tema (texto · fecha · etiqueta · acciones según permisos).
  const filaNota = (n: (typeof notas)[number], enHistorial: boolean) => (
    <li key={n.id} className="flex items-start gap-2 border-b border-borde/60 py-2 last:border-0">
      <div className="flex-1">
        <p className="text-sm text-tinta">{n.texto}</p>
        <p className="text-xs text-tierra">
          {fmtFecha(n.creadaEn)}
          {etiquetaLote(n) && <span className="ml-2 rounded bg-arena px-1.5 py-0.5">{etiquetaLote(n)}</span>}
        </p>
      </div>
      {!enHistorial && puedeMarcar && (
        <form action={marcarHabladaAccion}>
          <input type="hidden" name="id" value={n.id} />
          <button className="text-sm font-semibold text-bosque hover:underline" title="Marcar como hablado">✓</button>
        </form>
      )}
      {!enHistorial && u.rol === 'AREA' && n.areaId === u.areaId && (
        <form action={borrarNotaAccion}>
          <input type="hidden" name="id" value={n.id} />
          <button className="text-sm text-tierra hover:text-arcilla" title="Borrar">×</button>
        </form>
      )}
      {enHistorial && puedeMarcar && (
        <form action={reabrirNotaAccion}>
          <input type="hidden" name="id" value={n.id} />
          <button className="text-xs text-tierra hover:underline">↩ reabrir</button>
        </form>
      )}
    </li>
  )

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-bosque">🗣️ Conservatorio</h1>

      {puedeCrear && <FormNuevaNota lotes={lotes} accion={crearNotaAccion} />}
      {u.rol === 'AREA' && !u.areaId && (
        <p className="mb-4 rounded-lg bg-arena p-3 text-sm text-tierra">Tu usuario no tiene área asignada.</p>
      )}

      {pendientes.length === 0 ? (
        <p className="text-sm text-tierra">No hay temas pendientes.</p>
      ) : verTodas ? (
        agruparPorArea(pendientes).map(([area, ns]) => (
          <section key={area} className="mb-5">
            <h2 className="mb-1 text-sm font-semibold text-bosque">{area}</h2>
            <ul>{ns.map((n) => filaNota(n, false))}</ul>
          </section>
        ))
      ) : (
        <ul className="mb-5">{pendientes.map((n) => filaNota(n, false))}</ul>
      )}

      {hablados.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer select-none text-sm font-semibold text-tierra">Ya hablados</summary>
          <div className="mt-2">
            {verTodas
              ? agruparPorArea(hablados).map(([area, ns]) => (
                  <section key={area} className="mb-4">
                    <h3 className="mb-1 text-xs font-semibold text-tierra">{area}</h3>
                    <ul>{ns.map((n) => filaNota(n, true))}</ul>
                  </section>
                ))
              : <ul>{hablados.map((n) => filaNota(n, true))}</ul>}
          </div>
        </details>
      )}
    </main>
  )
}

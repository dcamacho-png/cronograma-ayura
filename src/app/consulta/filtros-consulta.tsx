type Opt = { id: string; nombre: string }

// Filtros de la Consulta como <form method="get">: al enviar navega a /consulta con los
// query params. `area` va en hidden para conservar el área seleccionada.
export function FiltrosConsulta({
  areaId,
  responsables,
  fincas,
  lotes,
  centros,
  sel,
}: {
  areaId: string
  responsables: Opt[]
  fincas: Opt[]
  lotes: Opt[]
  centros: string[]
  sel: { responsable: string; finca: string; centro: string; lote: string }
}) {
  return (
    <form method="get" action="/consulta" className="flex flex-wrap items-end gap-2 rounded-lg border border-borde bg-arena/30 p-3 text-xs">
      <input type="hidden" name="area" value={areaId} />
      <label className="flex flex-col">
        Responsable
        <select name="responsable" defaultValue={sel.responsable} className="rounded-lg border border-borde bg-marfil p-1 text-sm">
          <option value="">— todos —</option>
          {responsables.map((r) => (<option key={r.id} value={r.id}>{r.nombre}</option>))}
        </select>
      </label>
      <label className="flex flex-col">
        Finca
        <select name="finca" defaultValue={sel.finca} className="rounded-lg border border-borde bg-marfil p-1 text-sm">
          <option value="">— todas —</option>
          {fincas.map((f) => (<option key={f.id} value={f.id}>{f.nombre}</option>))}
        </select>
      </label>
      <label className="flex flex-col">
        Centro de costo
        <select name="centro" defaultValue={sel.centro} className="rounded-lg border border-borde bg-marfil p-1 text-sm">
          <option value="">— todos —</option>
          {centros.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </label>
      <label className="flex flex-col">
        Potrero
        <select name="lote" defaultValue={sel.lote} className="rounded-lg border border-borde bg-marfil p-1 text-sm">
          <option value="">— todos —</option>
          {lotes.map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
        </select>
      </label>
      <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">Buscar</button>
      <a href={`/consulta?area=${areaId}`} className="self-center text-tierra underline">Limpiar</a>
    </form>
  )
}

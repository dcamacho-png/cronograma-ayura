type LoteConFinca = { id: string; nombre: string; finca: { nombre: string } }

export function SelectLote({
  lotes,
  name = 'loteId',
  required = false,
  defaultValue = '',
}: {
  lotes: LoteConFinca[]
  name?: string
  required?: boolean
  defaultValue?: string
}) {
  const grupos = new Map<string, LoteConFinca[]>()
  for (const l of lotes) {
    const arr = grupos.get(l.finca.nombre) ?? []
    arr.push(l)
    grupos.set(l.finca.nombre, arr)
  }
  return (
    <select name={name} required={required} defaultValue={defaultValue} className="rounded border p-2 text-sm">
      <option value="">— elegir lote —</option>
      {[...grupos.entries()].map(([finca, ls]) => (
        <optgroup key={finca} label={finca}>
          {ls.map((l) => (
            <option key={l.id} value={l.id}>{l.nombre}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

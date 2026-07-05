'use client'

// Desplegable por celda (tractor × día) para dedicar el tractor a un área ese día.
// Select NO controlada (defaultValue, sin estado React) que auto-envía al cambiar.
export function SelectDedicacion({
  maquinaId,
  anio,
  semana,
  dia,
  areaIdActual,
  areas,
  accion,
}: {
  maquinaId: string
  anio: number
  semana: number
  dia: number
  areaIdActual: string
  areas: { id: string; nombre: string }[]
  accion: (form: FormData) => void
}) {
  return (
    <form action={accion} className="mt-1">
      <input type="hidden" name="maquinaId" value={maquinaId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <input type="hidden" name="dia" value={dia} />
      <select
        // key = área dedicada actual: fuerza a React a re-montar la select tras dedicar/quitar
        // para que la opción marcada refleje el valor guardado (defaultValue solo aplica al montar).
        key={areaIdActual}
        name="areaId"
        defaultValue={areaIdActual}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full rounded border border-borde bg-white px-1 py-0.5 text-xs text-tinta"
      >
        <option value="">— ninguna —</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
      </select>
    </form>
  )
}

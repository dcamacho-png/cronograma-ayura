'use client'

// "↩ desmarcar" devuelve la actividad a PENDIENTE **borrando** lo capturado: avances,
// medida, potreros realizados y nota. Como al lado está "Reabrir" —que hace lo mismo
// conservándolo todo— se pide confirmación diciendo cuántos avances se pierden.
export function BotonDesmarcar({
  actividadId,
  avances,
  accion,
}: {
  actividadId: string
  avances: number
  accion: (f: FormData) => void | Promise<void>
}) {
  const aviso = avances > 0
    ? `Se van a BORRAR ${avances} avance(s) registrados, junto con la medida y la nota de la actividad.\n\nSi solo querés corregir algo, cancelá y usá "Reabrir": deja editar sin perder nada.\n\n¿Borrar de todos modos?`
    : 'Se va a borrar lo registrado en esta actividad (medida, potreros realizados y nota).\n\n¿Continuar?'

  return (
    <form action={accion} onSubmit={(e) => { if (!confirm(aviso)) e.preventDefault() }}>
      <input type="hidden" name="id" value={actividadId} />
      <button className="text-xs text-tierra underline hover:text-tinta">↩ desmarcar</button>
    </form>
  )
}

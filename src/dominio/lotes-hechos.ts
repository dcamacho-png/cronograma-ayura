// Nombres de los lotes (en el orden de `lotes`) cuyo id está en `ids`. '' si no hay.
export function textoLotesHechos(
  lotes: { id: string; nombre: string }[],
  ids: string[] | null | undefined,
): string {
  if (!ids || ids.length === 0) return ''
  return lotes.filter((l) => ids.includes(l.id)).map((l) => l.nombre).join(', ')
}

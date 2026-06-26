export const DIAS_SEMANA = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function parseCsv(csv: string | null): string[] {
  if (!csv) return []
  return csv.split(',').map((s) => s.trim()).filter(Boolean)
}

export function etiquetaDias(csv: string | null): string {
  return parseCsv(csv)
    .map((d) => DIAS_SEMANA[Number(d)] ?? '')
    .filter(Boolean)
    .join(', ')
}

export function etiquetaResponsables(csv: string | null, nombrePorId: Map<string, string>): string {
  return parseCsv(csv)
    .map((id) => nombrePorId.get(id))
    .filter((n): n is string => !!n)
    .join(', ')
}

export function textoSugerencia(
  areaNombre: string,
  diasCsv: string | null,
  responsablesCsv: string | null,
  nombrePorId: Map<string, string>,
): string | null {
  const d = etiquetaDias(diasCsv)
  const r = etiquetaResponsables(responsablesCsv, nombrePorId)
  const partes: string[] = []
  if (d) partes.push(`días ${d}`)
  if (r) partes.push(`personas ${r}`)
  if (partes.length === 0) return null
  return `Sugerido por ${areaNombre}: ${partes.join(' · ')}`
}

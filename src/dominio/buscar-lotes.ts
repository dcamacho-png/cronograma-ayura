// Búsqueda del selector de lotes: sin distinguir mayúsculas ni tildes ("clinica" encuentra
// "Clínica Caño Colorado"), dejando fuera los ya marcados (esos se ven abajo, en la lista de
// seleccionados) y mostrando pocos a la vez para que la lista no vuelva a ser larga.
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function buscarLotes<T extends { id: string; nombre: string }>(
  lotes: T[],
  texto: string,
  marcados: Set<string>,
  max: number,
): { visibles: T[]; total: number } {
  const q = normalizar(texto)
  const coinciden = lotes.filter((l) => !marcados.has(l.id) && (q === '' || normalizar(l.nombre).includes(q)))
  return { visibles: coinciden.slice(0, max), total: coinciden.length }
}

import { semanaAnterior, type Semana } from './semana'

// Correo semanal del resumen (todas las áreas en PDF). Corre el lunes al mediodía: para
// entonces la semana anterior ya cerró (cerrar-vencidas corre esa madrugada), así que lo
// que se manda es la semana que terminó el domingo, no la que empieza.
export function semanaDelResumen(hoy: Semana): Semana {
  return semanaAnterior(hoy.anio, hoy.semana)
}

export function nombrePdfResumen(s: Semana): string {
  return `resumen-semana-${s.semana}-${s.anio}.pdf`
}

export function asuntoResumen(s: Semana): string {
  return `Resumen semana ${s.semana} · ${s.anio} — Cronograma Ayurá`
}

export function cuerpoResumen(s: Semana): string {
  return [
    `Adjunto va el resumen de cumplimiento de todas las áreas, semana ${s.semana} de ${s.anio}.`,
    '',
    'Para compartirlo al grupo: abre el PDF en el celular, toca Compartir y elige WhatsApp.',
    '',
    'Correo automático de Cronograma Ayurá (lunes al mediodía).',
  ].join('\n')
}

// Los destinatarios salen de una variable de entorno ("a@x.co, b@x.co"), no del código:
// cambiar a quién le llega no debe pedir un despliegue nuevo de la lógica.
export function destinatariosResumen(valor: string | undefined): string[] {
  return (valor ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c))
}

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cronograma Ayurá',
    short_name: 'Cronograma',
    description: 'Cronograma semanal y seguimiento de cumplimiento — Ayurá S.A.S',
    start_url: '/',
    display: 'standalone',
    background_color: '#0e5233',
    theme_color: '#11603a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

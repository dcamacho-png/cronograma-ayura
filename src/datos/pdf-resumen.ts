import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import type { Semana } from '@/dominio/semana'
import { NOMBRE_COOKIE_SESION } from '@/auth/sesion'

// Arma el PDF del resumen de todas las áreas abriendo la MISMA página que el botón manual
// "Exportar PDF (todas las áreas)" (/resumen/exportar?todas=1) en un Chromium sin pantalla y
// guardándola como PDF. Así el adjunto se ve igual que el que se imprime a mano.
//
// En Vercel usa el Chromium de @sparticuz/chromium; en el computador de desarrollo, el
// navegador local que diga CHROME_PATH.
export async function generarPdfResumen({
  baseUrl,
  cookieSesion,
  semana,
}: {
  baseUrl: string
  cookieSesion: string
  semana: Semana
}): Promise<Buffer> {
  const local = process.env.CHROME_PATH
  const browser = await puppeteer.launch(
    local
      ? { executablePath: local, headless: true }
      : {
          args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
          executablePath: await chromium.executablePath(),
          headless: 'shell',
        },
  )
  try {
    const page = await browser.newPage()
    const url = new URL(baseUrl)
    await browser.setCookie({
      name: NOMBRE_COOKIE_SESION,
      value: cookieSesion,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
    })
    // La página de exportar abre sola el diálogo de imprimir (AutoImprimir); sin pantalla
    // ese diálogo no tiene sentido y podría trabar la página.
    await page.evaluateOnNewDocument(() => {
      window.print = () => {}
    })
    const destino = new URL('/resumen/exportar', baseUrl)
    destino.searchParams.set('todas', '1')
    destino.searchParams.set('anio', String(semana.anio))
    destino.searchParams.set('semana', String(semana.semana))
    const res = await page.goto(destino.toString(), { waitUntil: 'networkidle0', timeout: 45_000 })
    // Si la sesión no sirvió, la app redirige a /login: mejor fallar que mandar un PDF del login.
    if (!res?.ok() || new URL(page.url()).pathname !== '/resumen/exportar') {
      throw new Error(`no se pudo abrir el resumen (estado ${res?.status()}, url ${new URL(page.url()).pathname})`)
    }
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

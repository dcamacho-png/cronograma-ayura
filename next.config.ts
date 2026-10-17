import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El Chromium comprimido de @sparticuz/chromium (carpeta bin) no lo detecta el rastreo de
  // archivos: sin esto, el correo semanal del resumen no encuentra el navegador en Vercel.
  outputFileTracingIncludes: {
    '/api/resumen-correo': ['node_modules/@sparticuz/chromium/bin/**/*'],
  },
};

export default nextConfig;

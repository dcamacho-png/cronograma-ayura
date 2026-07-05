# Compartir cronograma por WhatsApp — pantalla /programar

**Fecha:** 2026-07-05
**Estado:** Aprobado

## Objetivo

En `/programar` ya existe el botón "📷 Descargar imagen", que convierte la grilla
semanal a PNG (pensado sobre todo para compartir por WhatsApp desde el celular). Hoy el
flujo obliga a descargar la imagen y luego adjuntarla a mano en WhatsApp.

Agregar un botón **"Compartir por WhatsApp"** que evite esos pasos: genera la misma
imagen y la manda directo al menú de compartir del dispositivo, donde el usuario elige
WhatsApp y el contacto/grupo.

## Alcance

- **Sí:** botón nuevo en `/programar` que comparte la imagen de la grilla vía Web Share API.
- **No:** cambios en servidor, base de datos, ni en otras pantallas. Todo ocurre en el navegador.
- **No:** integración con la API de WhatsApp Business ni envío automático.

## Comportamiento

1. Al tocar el botón se genera el PNG de la grilla — la **misma imagen** que produce hoy
   "Descargar imagen" (misma lógica, sin duplicar código).
2. **Celular (y navegadores con Web Share API de archivos):** se abre el menú nativo de
   compartir con la imagen adjunta; el usuario elige WhatsApp → contacto/grupo → enviar.
   Se incluye un texto de leyenda: `Cronograma — {área} — Semana {N}`.
3. **Computador / navegador sin soporte de compartir archivos:** respaldo = **descargar la
   imagen** (mismo comportamiento que "Descargar imagen"), con un aviso corto de que en el
   computador debe adjuntarla manualmente en WhatsApp.

## Diseño técnico

- **Extraer helper compartido:** mover la generación del PNG que hoy vive en
  `src/app/programar/boton-descargar-imagen.tsx` (html2canvas-pro sobre `#grilla-export`,
  ancho fijo 1280, scale 3, fondo blanco) a un módulo reutilizable, p. ej.
  `src/app/programar/generar-imagen-grilla.ts`, que reciba `targetId` y devuelva el
  `HTMLCanvasElement` (o un `Blob`). Refactorizar `BotonDescargarImagen` para usarlo.
- **Nuevo componente cliente** `src/app/programar/boton-compartir-whatsapp.tsx`:
  - Genera el canvas con el helper, lo pasa a `Blob` y arma un `File` PNG.
  - Si `navigator.canShare?.({ files: [file] })` → `navigator.share({ files: [file], text })`.
  - Si no → descarga la imagen (respaldo) + `alert` breve.
  - Manejo de errores: si el usuario cancela el share nativo, no mostrar error.
- **Ubicación:** en `src/app/programar/page.tsx`, junto a `BotonDescargarImagen`, bajo la
  misma condición (`responsablesActivos.length > 0`). Recibe `targetId="grilla-export"`,
  `nombreArchivo` y el texto de leyenda (área + semana).
- **Estilo:** botón verde estilo WhatsApp, coherente con los botones existentes.

## Pruebas

- Verificación manual en la app: el botón aparece cuando hay responsables activos; genera
  la imagen; en un navegador sin soporte de compartir archivos cae al respaldo (descarga).
- No se agregan pruebas automatizadas nuevas (el flujo depende de APIs del navegador y del
  menú nativo del sistema, no verificables en headless de forma fiable).

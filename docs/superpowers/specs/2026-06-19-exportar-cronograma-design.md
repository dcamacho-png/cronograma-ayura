# Exportar cronograma: imagen PNG por área y PDF de todas las áreas (admin)

Estado: APROBADO (2026-06-19)

## Problema / petición

1. El cronograma de la semana **por área** debe poder **descargarse como imagen** (PNG) para compartir por WhatsApp con el coordinador/grupo.
2. El **administrador** debe poder **exportar a PDF** los cronogramas de **todas las áreas** de la semana seleccionada (una área por página).

## Contexto técnico

- Next.js 16 (App Router, Server Components + Server Actions), React 19, Tailwind v4, Prisma 6/SQLite.
- Tailwind v4 usa colores `oklch`. La librería clásica `html2canvas` NO entiende `oklch` y falla; se usa el fork `html2canvas-pro`, que sí.
- La grilla actual de Programar (`src/app/programar/page.tsx`) es de solo lectura: tabla responsables × días con descripción, turno, 🚜 máquina y lotes. `listarActividades(areaId, anio, semana)` ya incluye `responsable`, `maquina`, `lotes`.

## Enfoque elegido (A)

- **PNG por área:** captura del cuadro de la semana con `html2canvas-pro` → descarga de archivo PNG en el navegador.
- **PDF (admin, todas las áreas):** una ruta de exportación que renderiza el cronograma de cada área en su propia página y dispara `window.print()`; el usuario elige "Guardar como PDF". Texto nítido, multipágina, sin generación de PDF en JS.

Descartados: jsPDF (PDF rasterizado, más pesado); solo-impresión (no produce PNG).

## Alcance

- La **imagen PNG** está disponible para cualquier usuario en su(s) área(s) (coordinadores de área y admin).
- El **PDF de todas las áreas** es **solo ADMIN**.
- No cambia la lógica de programación, cumplimiento ni resumen. Es solo presentación/exportación de datos existentes.

## Componentes

### 1. `GrillaSemana` (componente presentacional reutilizable)

Archivo: `src/app/programar/grilla-semana.tsx` (Server Component, sin estado).

Extrae el cuadro que hoy está embebido en `page.tsx`. Renderiza:
- Encabezado: `Área: <nombre> · Semana <n> · <rango de fechas>`.
- Tabla responsables × días (Lun–Dom) con, por celda: descripción, turno, `🚜 máquina` (si hay), lotes (vía `InfoLotes`).
- Si el área no tiene responsables o actividades, muestra un texto "Sin actividades programadas".

Props:
```ts
{
  areaNombre: string
  anio: number
  semana: number
  fechas: Date[]            // fechasDeSemana(anio, semana)
  responsables: { id: string; nombre: string }[]
  actividades: ActividadConRelaciones[]   // mismo tipo que devuelve listarActividades
}
```
Usa estilos de Tailwind (la captura con `html2canvas-pro` los soporta). `GrillaSemana` se usa en:
- `programar/page.tsx` (reemplaza la tabla inline actual; el resto de la página —navegación, "por asignar", banners— no cambia).
- la ruta de exportación PDF (una por área).

### 2. Imagen PNG por área

Componente cliente: `src/app/programar/boton-descargar-imagen.tsx` (`'use client'`).
- Recibe `targetId: string` (id del contenedor a capturar) y `nombreArchivo: string`.
- Botón "📷 Descargar imagen". Al hacer clic: `import('html2canvas-pro')` dinámico, captura `document.getElementById(targetId)` con `{ scale: 2, backgroundColor: '#ffffff' }`, convierte a `dataURL('image/png')` y dispara descarga con un `<a download>` temporal.
- Maneja error: si la captura falla, `alert('No se pudo generar la imagen.')`.

En `programar/page.tsx`:
- La `GrillaSemana` se envuelve en un `<div id="grilla-export">`.
- Junto al título de la grilla se coloca `<BotonDescargarImagen targetId="grilla-export" nombreArchivo={\`cronograma-${areaActual.nombre}-S${semana}-${anio}.png\`} />`.
- El botón aparece solo si hay responsables (si no, no hay nada que exportar).

### 3. PDF de todas las áreas (admin)

Ruta: `src/app/programar/exportar/page.tsx` (Server Component, **solo ADMIN** — si no, `redirect('/programar')`).
- Lee `searchParams`: `anio`, `semana` (si faltan, usa `semanaActual()`).
- Trae todas las áreas; por cada una `listarResponsablesPorArea` + `listarActividades(area, anio, semana)`.
- Renderiza un `GrillaSemana` por área, cada uno en un contenedor con `className` que fuerza salto de página al imprimir (`style={{ breakAfter: 'page' }}`, salvo el último).
- Incluye un componente cliente pequeño `src/app/programar/exportar/auto-imprimir.tsx` que llama `window.print()` al montar (con un botón "🖨️ Imprimir / Guardar PDF" visible que se oculta al imprimir vía `print:hidden`, por si el diálogo no abre solo).
- Estilos de impresión: usar utilidades `print:` de Tailwind para ocultar la navegación/botones y dejar solo las grillas.

En `programar/page.tsx` (solo si `esAdmin`):
- Enlace/botón "🖨️ Exportar PDF (todas las áreas)" que abre `/programar/exportar?anio=${anio}&semana=${semana}` (en pestaña nueva, `target="_blank"`).

### 4. Navegación / layout

La barra de navegación (`nav-principal`) y el layout no deben salir en la exportación PDF. La ruta `/programar/exportar` comparte el layout raíz (que incluye la nav). Para que la nav no aparezca en el PDF, la página de exportación marca el `<main>` propio y se confía en `print:hidden` sobre la nav. **Decisión:** añadir `print:hidden` al contenedor de `nav-principal` (no afecta la vista normal en pantalla).

## Dependencia nueva

- `html2canvas-pro` (instalar con `npm install html2canvas-pro`). Import dinámico (`await import(...)`) para no cargarla salvo al exportar imagen.

## Qué NO cambia

- Datos, programación, cumplimiento, resumen: sin cambios.
- La grilla se ve igual en pantalla (solo se extrae a componente).
- Otras áreas/pantallas no se tocan.

## Pruebas

- Sin lógica de dominio nueva → sin tests unitarios nuevos. Verificación: `npx tsc --noEmit` y `npm run lint` limpios.
- Verificación manual:
  - Como área (ej. maquinaria) con actividades: en Programar, "📷 Descargar imagen" baja un PNG con el cuadro de la semana y su encabezado.
  - Como admin: "🖨️ Exportar PDF (todas las áreas)" abre la vista de exportación con cada área en su página y permite Guardar como PDF; la navegación no aparece en el PDF.
  - Área sin actividades aparece con el cuadro y "Sin actividades programadas".

## Notas técnicas

- `html2canvas-pro` corre solo en cliente (usa `document`), por eso el import dinámico dentro del handler del botón.
- La ruta de exportación NO necesita reiniciar el server (sin cambio de esquema Prisma).
- Nombre de archivo PNG: `cronograma-<area>-S<semana>-<año>.png` (espacios del área se dejan; el navegador los acepta).

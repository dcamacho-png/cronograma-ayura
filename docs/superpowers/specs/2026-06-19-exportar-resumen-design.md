# Exportar Resumen del área a PDF

Estado: APROBADO (2026-06-19)

## Problema / petición

Poder exportar a PDF el **Resumen** del área (KPIs de cumplimiento, detalle por estado, ranking, motivos, hectáreas de maquinaria, cambios/reprogramadas). El admin además debe poder exportar el resumen de **todas las áreas** de la semana, una por página.

## Enfoque elegido

Vista de impresión + "Guardar como PDF" del navegador (texto nítido, multipágina, sin dependencias nuevas). Mismo patrón que el PDF del cronograma (`/programar/exportar`).

## Contexto técnico

- Next.js 16 (App Router, Server Components), React 19, Tailwind v4, Prisma 6/SQLite.
- `src/app/resumen/page.tsx` ya calcula, para UN área/semana: `porcentajeCumplimiento`, `porcentajeReprogramadas`, `conteoPorEstado`, `extremosFinalizadas`, `motivosFrecuentes`, `hectareasTrabajadasYFaltantes`, hectáreas por actividad, `actividadesConCambio`, y arma mapas nombre-por-id de responsables/motivos. Datos de `listarActividades(areaId, anio, semana)`, `listarResponsablesPorArea`, `listarMotivos`.
- La barra de navegación (`nav-principal`) ya tiene `print:hidden`.
- Ya existe `src/app/programar/exportar/auto-imprimir.tsx` (cliente: `window.print()` al montar + botón).

## Alcance

- El **PDF del área actual** está disponible para cualquier usuario (área y admin), de su propia área.
- El **PDF de todas las áreas** es **solo ADMIN**.
- Un usuario de área que pida exportar otra área es redirigido a la suya.
- No cambia datos, métricas, ni otras pantallas. Es solo presentación/exportación.

## Componentes

### 1. `ResumenArea` (componente presentacional reutilizable)

Archivo: `src/app/resumen/resumen-area.tsx` (Server Component, sin estado).

Extrae el "cuerpo del informe" que hoy está embebido en `page.tsx`: desde las tarjetas de KPIs (línea ~125) hasta la lista de cambios/reprogramadas (línea ~272). Hace internamente el cálculo (bloque actual líneas ~69-93) y el render.

Props:
```ts
{
  areaNombre: string
  semana: number
  anio: number
  esMaquinaria: boolean
  actividades: ActividadConRelaciones[]   // lo que devuelve listarActividades
  responsables: { id: string; nombre: string }[]
  motivos: { id: string; nombre: string }[]
}
```
Incluye al inicio un encabezado simple para el PDF: `Resumen — <área> · Semana <n> · <año>`.

Se usa en:
- `resumen/page.tsx` (reemplaza el cuerpo inline; la página conserva título, chips de área, navegación de semana y los botones de exportar).
- la ruta de exportación (uno por área).

Las constantes/cálculos auxiliares que hoy viven en `page.tsx` y que necesita el cuerpo (`ESTADOS_ORDEN`, `COLOR_HEX`, agrupación del detalle por estado) se mueven dentro de `ResumenArea`.

### 2. Botones en `resumen/page.tsx`

Junto a la navegación de semana:
- **"🖨️ Exportar PDF"** (todos): enlace a `/resumen/exportar?area=${areaId}&anio=${anio}&semana=${semana}` (`target="_blank"`).
- **"🖨️ Exportar PDF (todas las áreas)"** (solo `esAdmin`): enlace a `/resumen/exportar?todas=1&anio=${anio}&semana=${semana}` (`target="_blank"`).

### 3. Ruta de exportación `src/app/resumen/exportar/page.tsx` (Server Component)

- Lee `searchParams`: `area?`, `anio?`, `semana?`, `todas?`.
- `anio`/`semana`: validan con `Number.isInteger`, si faltan usan `semanaActual()`.
- Requiere sesión (`usuarioActual()`; si no, `redirect('/login')`).
- **Modo todas las áreas** (`todas === '1'`): solo ADMIN (si no, redirige a `/resumen`). Trae todas las áreas; por cada una calcula `esMaquinaria` y trae `listarResponsablesPorArea` + `listarMotivos` + `listarActividades(area, anio, semana)`; renderiza un `ResumenArea` por área, cada uno en un contenedor con `style={{ breakAfter: 'page' }}` salvo el último.
- **Modo un área** (`area` dado): determina el área permitida — ADMIN puede cualquier área válida; un usuario de área queda forzado a `u.areaId` (si pidió otra, se usa la suya). Renderiza un solo `ResumenArea`.
- Incluye `AutoImprimir` (dispara `window.print()` al montar; botón visible con `print:hidden`).

### 4. `AutoImprimir` compartido

Mover `src/app/programar/exportar/auto-imprimir.tsx` a `src/app/_componentes/auto-imprimir.tsx` (mismo contenido) y actualizar el import en `programar/exportar/page.tsx`. La ruta de exportación de resumen importa el mismo componente. (Evita duplicar.)

## Qué NO cambia

- Métricas (`dominio/metricas.ts`, `dominio/resumen.ts`): sin cambios.
- La pantalla de Resumen se ve igual (solo se extrae el cuerpo a `ResumenArea`).
- `nav-principal` ya tiene `print:hidden`; sin cambios.
- Tareas, programar, cumplimiento, configuración: sin cambios.

## Pruebas

- Sin lógica de dominio nueva → sin tests unitarios nuevos. Verificación: `npx tsc --noEmit` y `npm run lint` limpios; suite existente (61) sigue verde.
- Verificación manual:
  - Como área (ej. maquinaria): en Resumen, "🖨️ Exportar PDF" abre la vista del resumen de su área/semana y permite Guardar como PDF; la nav no aparece en el PDF.
  - Como admin: "🖨️ Exportar PDF (todas las áreas)" abre la vista con cada área en su propia página.
  - Un usuario de área que entre a `/resumen/exportar?area=<otra>` ve el resumen de SU área (no la otra); y a `/resumen/exportar?todas=1` es redirigido a `/resumen`.

## Notas técnicas

- Sin cambios de esquema Prisma → no hace falta reiniciar el dev server.
- La vista de exportación comparte el layout raíz (que incluye la nav con `print:hidden`), así que el PDF queda solo con el/los informes.

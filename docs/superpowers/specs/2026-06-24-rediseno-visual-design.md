# Rediseño visual — Cronograma Ayurá

**Fecha:** 2026-06-24
**Tipo:** Rediseño visual (solo apariencia). **No cambia ninguna función, comportamiento, server action, dato ni texto.**
**Dirección elegida:** B · "Cálido del campo" (paleta terrosa, verde profundo, tarjetas redondeadas y suaves).

## Objetivo

Renovar la imagen de la app para que sea **moderna, sencilla y con identidad propia** del agro/ganadería, de forma **cohesiva en todas las pantallas**, conservando los layouts y la navegación actuales. El cambio es exclusivamente de estilos (colores, tipografía, espaciado, forma de tarjetas/botones/chips/inputs).

### Fuera de alcance (explícito)
- No se cambian layouts ni estructura de navegación (header + secciones se mantienen).
- No se toca lógica, server actions, validaciones, rutas, ni el contenido textual.
- No se agregan dependencias nuevas salvo, opcionalmente, una fuente vía `next/font` (ver Tipografía).
- No se introduce modo oscuro (la app es light-only; ver tarea de limpieza del boilerplate).

## Restricciones clave

1. **Vistas de exportación/impresión** — `src/app/programar/exportar/page.tsx`, `src/app/resumen/exportar/page.tsx`, `src/app/_componentes/auto-imprimir.tsx` y `src/app/programar/boton-descargar-imagen.tsx` (descarga vía `html2canvas-pro`) producen PDF/imagen. Estas superficies **deben mantener fondo blanco y alto contraste**; el fondo crema NO debe aparecer en lo impreso/exportado. Regla: el color de fondo cálido vive en `body`/contenedores de pantalla normales, pero las vistas de export y `@media print` fuerzan `background:#fff`.
2. **`cumplimiento/exportar/route.ts`** genera un Excel (sin UI) — no se toca.
3. **Sin regresiones funcionales.** Verificación visual pantalla por pantalla y de los export, confirmando que la app sigue comportándose igual.
4. **Responsive intacto:** el menú móvil (☰) y los breakpoints actuales se conservan.

## Sistema de diseño (tokens)

Se centraliza la paleta en **tokens de Tailwind v4** vía `@theme` en `src/app/globals.css`, para reemplazar el verde hardcodeado `#11603a` (presente en ~22 archivos) por utilidades semánticas. Esto hace el estilo consistente y editable desde un solo lugar.

### Color

| Token (utilidad Tailwind)      | Hex        | Uso |
|--------------------------------|------------|-----|
| `bosque` (primario)            | `#11603a`  | Marca, botones primarios, títulos, estado activo |
| `bosque-hondo`                 | `#0e5233`  | Extremo oscuro del degradado del header, hover |
| `crema` (fondo de página)      | `#f6f2e9`  | `body` / fondo general de pantallas normales |
| `marfil` (superficie)          | `#fffdf8`  | Fondo de tarjetas, paneles, inputs |
| `arena` (neutro tenue)         | `#efe7d6`  | Chips inactivos, fondos sutiles |
| `borde`                        | `#e6dcc6`  | Bordes de tarjetas/inputs |
| `tinta` (texto fuerte)         | `#1f3d2b`  | Encabezados y texto principal |
| `tierra` (texto tenue)         | `#9a8c6f`  | Texto secundario / descripciones |
| `arcilla` (acento cálido)      | `#b06a28`  | Acento secundario (p. ej. botones de exportar) |

**Sombra de tarjeta estándar:** `0 2px 8px rgba(120,100,60,.08)` (cálida, suave). Se expone como utilidad o clase de componente.

### Colores semánticos de estado

Mapeo único de estado de actividad, **usado consistentemente** en Cumplimiento, Resumen, Programar y Tablero. Cada estado tiene un color de texto/acento y una variante de fondo suave (pastel cálido) para chips:

| Estado        | Texto/acento | Fondo chip |
|---------------|--------------|------------|
| Pendiente     | `#7c6a48`    | `#efe7d6` (arena) |
| Parcial       | `#9a6418`    | `#f6e3c8` (trigo) |
| Cumplida      | `#1f6b3e`    | `#dcebdd` (verde suave) |
| No cumplida   | `#a4442f`    | `#f3d9d2` (arcilla suave) |
| Reprogramada  | `#3e6079`    | `#dde6ec` (azul suave) |

> Nota: los colores de "semáforo" en `src/dominio/` y los KPI por valor (`colorPorcentaje`, `colorSemaforo`, `COLOR_HEX`) se **conservan en su semántica** (verde/amarillo/naranja/rojo), solo se armonizan los tonos si chocan con la paleta. No se cambia la lógica que los elige.

### Tipografía

- **Base:** corregir el `body`, que hoy usa `Arial` (resto del boilerplate de create-next-app) pese a que se carga Geist. Aplicar la fuente sans cargada vía la variable `--font-sans` a todo el `body`.
- **Encabezados:** mismo family, peso 700–800, color `tinta`/`bosque`. La calidez la dan color y forma, no un cambio de familia.
- *(Opcional, decisión menor durante implementación)* sustituir Geist por una sans humanista más cálida vía `next/font` (p. ej. una con formas algo redondeadas). Si se hace, es un único punto de cambio en `layout.tsx`. Baseline = mantener Geist aplicada correctamente.

### Forma y espaciado

- **Tarjetas/paneles:** `border-radius` grande (≈16px, `rounded-2xl`), borde `borde`, superficie `marfil`, sombra cálida estándar.
- **Íconos de sección:** en contenedor circular con tinte (verde o tierra), como en el mockup B.
- **Chips:** `rounded-full`, relleno pastel según estado/selección.
- **Botones:** primario = relleno `bosque` texto blanco, `rounded-lg`; secundario = borde `bosque` texto `bosque`; exportar = borde/textos `arcilla`.
- **Inputs/selects:** superficie `marfil`, borde `borde`, foco con anillo `bosque`.
- **Header:** degradado `bosque-hondo → bosque`, texto blanco (mantiene estructura y menú actuales).

## Superficies a cubrir (component inventory)

Aplicar el sistema de diseño de forma consistente en:

1. **Global** — `globals.css` (tokens + fondo crema + limpieza de boilerplate dark-mode), `layout.tsx` (fuente), `_componentes/nav-principal.tsx` (header degradado, chips de menú móvil).
2. **Login** — `login/page.tsx`.
3. **Inicio** — `page.tsx` (saludo + grid de tarjetas de sección).
4. **Tareas** — `tareas/page.tsx`, `form-solicitar.tsx`, `form-nueva-tarea-maquinaria.tsx`, `picker-lotes-bultos.tsx`.
5. **Programar** — `programar/page.tsx`, `grilla-semana.tsx`, `asignar-tarea-form.tsx`, `boton-descargar-imagen.tsx`.
6. **Cumplimiento** — `cumplimiento/page.tsx`, `dia-maquinaria.tsx`, `dia-no-maquinaria.tsx`, `form-registrar.tsx`, `form-actividad-realizada.tsx`, `form-avance-lote.tsx`.
7. **Resumen** — `resumen/page.tsx`, `resumen-area.tsx` (KPIs, chips de estado, paneles ranking/motivos — ya validado en mockup B).
8. **Tablero** — `tablero/page.tsx`.
9. **Configuración** — `configuracion/page.tsx`, `lotes-lista.tsx`, `form-eliminar.tsx`.
10. **Exportar/imprimir** — `programar/exportar/page.tsx`, `resumen/exportar/page.tsx`, `auto-imprimir.tsx`: armonizar acentos pero **forzar fondo blanco**; añadir reglas `@media print` (`print:bg-white`) donde haga falta.

## Estrategia de implementación (alto nivel)

1. **Fundaciones primero:** definir tokens en `globals.css`, fijar fondo crema en `body`, aplicar fuente, eliminar el bloque `@media (prefers-color-scheme: dark)` del boilerplate.
2. **Reemplazo del color de marca:** cambiar los usos de `[#11603a]` por la utilidad de token `bosque` (`bg-bosque`, `text-bosque`, `border-bosque`). Mecánico y de bajo riesgo.
3. **Componentes compartidos:** header/nav, tarjeta, botón, chip de estado, input — fijar el estilo una vez y reutilizar.
4. **Pantalla por pantalla:** aplicar superficie crema, tarjetas marfil, chips y acentos, en el orden: Inicio → Resumen (referencia ya aprobada) → Cumplimiento → Programar → Tareas → Tablero → Configuración → Login.
5. **Export/print al final:** ajustar y blindar el fondo blanco; verificar PDF e imagen.

## Verificación

- **Typecheck fiable** (tsconfig que excluye `.next`) y `npm run test` sin romper.
- **Verificación visual en navegador** (server local apuntando a la DB de prod, sesión firmada localmente) de cada pantalla en estilo B, comprobando que **no cambia ningún comportamiento** (solo apariencia).
- **Export/print:** descargar la imagen del cronograma (`html2canvas`) y el PDF de Resumen; confirmar fondo blanco y legibilidad.
- **Responsive:** revisar el menú móvil (☰) y los breakpoints.
- **Accesibilidad básica:** contraste de texto sobre crema y sobre verde dentro de rangos legibles.

## Criterios de aceptación

- Todas las pantallas comparten la paleta y los componentes del estilo B de forma coherente.
- El verde de marca queda centralizado en tokens (sin `#11603a` sueltos, salvo donde sea inevitable en export).
- Las vistas de exportación/impresión salen con fondo blanco y legibles.
- Cero cambios de comportamiento: la app hace exactamente lo mismo que antes.
- Typecheck y tests en verde.

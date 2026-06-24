# Rediseño visual (dirección B · cálido del campo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renovar la imagen de toda la app al estilo "Cálido del campo" (paleta terrosa, verde profundo, tarjetas redondeadas), sin cambiar ninguna función ni comportamiento.

**Architecture:** Se centraliza la paleta en tokens de Tailwind v4 (`@theme` en `globals.css`) y un puñado de clases de componente reutilizables (`@layer components`). Luego se migra el verde de marca hardcodeado a tokens y se aplica el estilo pantalla por pantalla. Las vistas de exportación/impresión se blindan con fondo blanco.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4 (`@import "tailwindcss"`, configuración por CSS), Prisma/Neon. Fuente Geist vía `next/font`.

## Global Constraints

- **Solo apariencia.** No se cambia lógica, server actions, validaciones, rutas, props funcionales, ni el contenido textual. (Spec: "Cero cambios de comportamiento".)
- **Verificación = gates, no unit tests.** Como es un cambio visual, cada tarea cierra con: (1) typecheck fiable, (2) `npm run test` en verde (prueba que la lógica no se tocó), (3) verificación visual en navegador. No se escriben tests unitarios de estilo.
- **Vistas de export/impresión con fondo blanco.** `programar/exportar`, `resumen/exportar`, `auto-imprimir.tsx` y la imagen `html2canvas` deben salir con `background:#fff` y alto contraste. El fondo crema solo vive en pantallas normales.
- **No tocar** `cumplimiento/exportar/route.ts` (genera Excel, sin UI).
- **Responsive intacto:** conservar el menú móvil (☰) y los breakpoints actuales.
- **App light-only:** eliminar el bloque `@media (prefers-color-scheme: dark)` del boilerplate.
- **Paleta (verbatim del spec):** `bosque #11603a`, `bosque-hondo #0e5233`, `crema #f6f2e9`, `marfil #fffdf8`, `arena #efe7d6`, `borde #e6dcc6`, `tinta #1f3d2b`, `tierra #9a8c6f`, `arcilla #b06a28`. Sombra tarjeta: `0 2px 8px rgba(120,100,60,.08)`.
- **Estados (verbatim):** Pendiente `#7c6a48`/bg `#efe7d6`; Parcial `#9a6418`/bg `#f6e3c8`; Cumplida `#1f6b3e`/bg `#dcebdd`; No cumplida `#a4442f`/bg `#f3d9d2`; Reprogramada `#3e6079`/bg `#dde6ec`.

---

## Verification Harness (referenciado por todas las tareas)

**A) Typecheck fiable** (el `tsc` directo da falso-verde por `.next`; usar un tsconfig que lo excluye):

```bash
cd /home/derlly/projects/cronograma
cat > tsconfig.tmpcheck.json <<'EOF'
{ "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "plugins": [] },
  "include": ["src/**/*.ts", "src/**/*.tsx", "next-env.d.ts"],
  "exclude": ["node_modules", ".next"] }
EOF
npx tsc --noEmit -p tsconfig.tmpcheck.json && echo "TYPECHECK OK"
rm -f tsconfig.tmpcheck.json tsconfig.tmpcheck.tsbuildinfo
```

**B) Tests** (deben quedar en verde — confirma que la lógica no se tocó):

```bash
cd /home/derlly/projects/cronograma && npm run test
```

**C) Servidor local para verificación visual** (la `DATABASE_URL` real NO está en `.env`; está en `.claude/settings.local.json`):

```bash
cd /home/derlly/projects/cronograma
DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)
DATABASE_URL="$DB" npx next dev -p 3100   # lanzar en background
```

**D) Screenshot de una ruta autenticada** (sesión firmada con el secreto de dev, sin tocar auth). Requiere `playwright-core` y chromium bundled (ver memoria `verificacion-navegador`). Guardar este script como `/tmp/shot.cjs` y llamarlo con `RUTA` y `OUT`:

```js
const { chromium } = require('playwright-core')
const { createHmac } = require('crypto')
const BASE = 'http://localhost:3100'
const ADMIN_ID = 'cmqme5i7300mvod5qt2g5hqco'
const sig = createHmac('sha256', 'cronograma-local-secret').update(ADMIN_ID).digest('hex')
;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1400 } })
  await ctx.addCookies([{ name: 'sesion', value: `${ADMIN_ID}.${sig}`, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
  const p = await ctx.newPage()
  await p.goto(BASE + process.env.RUTA, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  await p.screenshot({ path: process.env.OUT, fullPage: true })
  await b.close(); console.log('shot -> ' + process.env.OUT)
})().catch(e => { console.log('ERR ' + e.message); process.exit(1) })
```

Invocación (ejemplo Inicio):

```bash
export CHROME_PATH=~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
export LD_LIBRARY_PATH=<scratchpad>/deblibs/extract/usr/lib/x86_64-linux-gnu
RUTA="/" OUT=/tmp/inicio.png node /tmp/shot.cjs
```

Luego **leer la imagen** (`Read` sobre el .png) y confirmar: fondo crema, tarjetas marfil con borde/redondeo/sombra, chips de estado con los colores correctos, header en degradado verde, y **ningún elemento desplazado** respecto al layout previo.

**Verificación visual mínima por tarea:** screenshot de la(s) ruta(s) afectada(s) en escritorio; para Inicio/Cumplimiento además a `width:390` (móvil) para confirmar el menú ☰.

---

## Task 1: Fundaciones — tokens, fondo, fuente, limpieza

**Files:**
- Modify: `src/app/globals.css` (reescritura completa)
- Modify: `src/app/layout.tsx` (aplicar fuente al body)

**Interfaces:**
- Produces: utilidades de color Tailwind `bg-bosque|text-bosque|border-bosque|bg-crema|bg-marfil|bg-arena|border-borde|text-tinta|text-tierra|text-arcilla|...`, la sombra `shadow-tarjeta`, y (Task 3) las clases `.tarjeta` y `.chip-estado-*`. Todas las tareas siguientes las consumen.

- [ ] **Step 1: Reescribir `src/app/globals.css`** con tokens + fondo crema + limpieza del boilerplate dark + base de impresión:

```css
@import "tailwindcss";

@theme {
  /* Marca / neutros cálidos */
  --color-bosque: #11603a;
  --color-bosque-hondo: #0e5233;
  --color-crema: #f6f2e9;
  --color-marfil: #fffdf8;
  --color-arena: #efe7d6;
  --color-borde: #e6dcc6;
  --color-tinta: #1f3d2b;
  --color-tierra: #9a8c6f;
  --color-arcilla: #b06a28;

  /* Colores semánticos de estado (texto + fondo de chip) */
  --color-est-pendiente: #7c6a48;
  --color-est-pendiente-bg: #efe7d6;
  --color-est-parcial: #9a6418;
  --color-est-parcial-bg: #f6e3c8;
  --color-est-cumplida: #1f6b3e;
  --color-est-cumplida-bg: #dcebdd;
  --color-est-nocumplida: #a4442f;
  --color-est-nocumplida-bg: #f3d9d2;
  --color-est-reprogramada: #3e6079;
  --color-est-reprogramada-bg: #dde6ec;

  --shadow-tarjeta: 0 2px 8px rgba(120, 100, 60, 0.08);
}

body {
  background: var(--color-crema);
  color: var(--color-tinta);
  font-family: var(--font-geist-sans), system-ui, -apple-system, "Segoe UI", sans-serif;
}

/* Las vistas de exportación/impresión van sobre blanco */
@media print {
  body { background: #ffffff; }
}
```

- [ ] **Step 2: Aplicar la fuente en el body** — en `src/app/layout.tsx`, la `<body>` ya recibe `className="min-h-full flex flex-col"`; el `--font-geist-sans` ya está disponible en `<html>`. El cambio del Step 1 (body usa `var(--font-geist-sans)`) reemplaza el `Arial` anterior. No hace falta editar `layout.tsx` salvo confirmar que `geistSans.variable` sigue en `<html>` (lo está). Marcar este step como verificación, sin cambios si ya se cumple.

- [ ] **Step 3: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 4: Verificación visual** — levantar server (Harness C), screenshot de `/` (Harness D). Expected: el fondo de página ahora es crema; el resto aún luce como antes (verde `#11603a` sigue, las tarjetas todavía con borde gris). No debe verse modo oscuro aunque el SO esté en dark.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "style(base): tokens de paleta cálida, fondo crema y limpieza de boilerplate"
```

---

## Task 2: Migrar el verde de marca a token

**Files (modify):** todos los que contienen `#11603a` EXCEPTO las vistas de export (esas se tratan en Task 12):
- `src/app/_componentes/nav-principal.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`
- `src/app/tareas/page.tsx`, `src/app/tareas/form-nueva-tarea-maquinaria.tsx`, `src/app/tareas/picker-lotes-bultos.tsx`, `src/app/tareas/form-solicitar.tsx`
- `src/app/programar/page.tsx`, `src/app/programar/grilla-semana.tsx`, `src/app/programar/asignar-tarea-form.tsx`, `src/app/programar/boton-descargar-imagen.tsx`
- `src/app/cumplimiento/page.tsx`, `src/app/cumplimiento/dia-maquinaria.tsx`, `src/app/cumplimiento/dia-no-maquinaria.tsx`, `src/app/cumplimiento/form-registrar.tsx`, `src/app/cumplimiento/form-actividad-realizada.tsx`, `src/app/cumplimiento/form-avance-lote.tsx`
- `src/app/resumen/page.tsx`, `src/app/resumen/resumen-area.tsx`
- `src/app/tablero/page.tsx`, `src/app/configuracion/page.tsx`

**Interfaces:**
- Consumes: utilidades `bg-bosque`/`text-bosque`/`border-bosque` (Task 1).
- Produces: app idéntica visualmente pero con el verde centralizado en token.

- [ ] **Step 1: Reemplazo mecánico** de las clases arbitrarias. En cada archivo de la lista:
  - `bg-[#11603a]` → `bg-bosque`
  - `text-[#11603a]` → `text-bosque`
  - `border-[#11603a]` → `border-bosque`
  - `accent-[#11603a]` → `accent-bosque`

  Comando para encontrar lo que falta (excluyendo export):

```bash
grep -rn "\[#11603a\]" src/ | grep -v "/exportar/" | grep -v "auto-imprimir"
```

  Hacerlo archivo por archivo con Edit (replace_all por patrón). NO tocar valores `#11603a` dentro de las vistas `exportar/` ni `auto-imprimir.tsx`.

- [ ] **Step 2: Confirmar que no quedan sueltos** (fuera de export):

```bash
grep -rn "\[#11603a\]" src/ | grep -v "/exportar/" | grep -v "auto-imprimir" || echo "LIMPIO"
```

Expected: `LIMPIO`.

- [ ] **Step 3: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 4: Verificación visual** — screenshot de `/` y `/cumplimiento`. Expected: **idéntico** a antes de esta tarea (mismo verde), solo que ahora vía token.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "style(token): migrar verde de marca #11603a a utilidad bosque"
```

---

## Task 3: Componentes compartidos — clases de tarjeta/chips + header

**Files:**
- Modify: `src/app/globals.css` (añadir `@layer components`)
- Modify: `src/app/_componentes/nav-principal.tsx` (header degradado)

**Interfaces:**
- Produces: clases `.tarjeta`, `.chip-estado`, `.chip-pendiente`, `.chip-parcial`, `.chip-cumplida`, `.chip-nocumplida`, `.chip-reprogramada`. Consumidas por Tasks 4–11.

- [ ] **Step 1: Añadir `@layer components` al final de `globals.css`:**

```css
@layer components {
  /* Superficie estándar de tarjeta/panel */
  .tarjeta {
    background: var(--color-marfil);
    border: 1px solid var(--color-borde);
    border-radius: 1rem; /* 16px */
    box-shadow: var(--shadow-tarjeta);
  }
  /* Chip de estado: base + variantes */
  .chip-estado {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 9999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.2;
  }
  .chip-pendiente    { background: var(--color-est-pendiente-bg);    color: var(--color-est-pendiente); }
  .chip-parcial      { background: var(--color-est-parcial-bg);      color: var(--color-est-parcial); }
  .chip-cumplida     { background: var(--color-est-cumplida-bg);     color: var(--color-est-cumplida); }
  .chip-nocumplida   { background: var(--color-est-nocumplida-bg);   color: var(--color-est-nocumplida); }
  .chip-reprogramada { background: var(--color-est-reprogramada-bg); color: var(--color-est-reprogramada); }
}
```

- [ ] **Step 2: Restilizar el header** en `nav-principal.tsx`. Cambiar la clase del `<header>`:
  - De: `className="bg-[#11603a] text-white print:hidden"` (ya migrado en Task 2 a `bg-bosque`)
  - A: `className="bg-gradient-to-r from-bosque-hondo to-bosque text-white print:hidden"`

  El resto del componente (enlaces, menú ☰, panel móvil) se mantiene igual.

- [ ] **Step 3: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 4: Verificación visual** — screenshot de `/` (escritorio + móvil 390px). Expected: header con degradado verde sutil; menú ☰ intacto en móvil.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/_componentes/nav-principal.tsx
git commit -m "style(componentes): clases .tarjeta/.chip-estado y header en degradado"
```

---

## Task 4: Inicio

**Files:** Modify `src/app/page.tsx`

- [ ] **Step 1: Aplicar estilo B al grid de secciones.** En el `<Link>` de cada sección, reemplazar:
  - De: `className="flex flex-col items-start gap-1 rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:border-bosque hover:shadow-lg"`
  - A: `className="tarjeta flex flex-col items-start gap-2 p-5 transition hover:-translate-y-0.5 hover:border-bosque hover:shadow-md"`

  Envolver el emoji `<span className="text-4xl">` en un círculo con tinte:
  - De: `<span className="text-4xl">{s.icono}</span>`
  - A: `<span className="flex h-14 w-14 items-center justify-center rounded-full bg-arena text-3xl">{s.icono}</span>`

  El subtítulo `text-gray-500` → `text-tierra`. El título ya usa `text-bosque`.

- [ ] **Step 2: Saludo** — `text-gray-500` de la línea "Semana … · …" → `text-tierra`. El `<h1>` ya es `text-bosque`.

- [ ] **Step 3: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 4: Verificación visual** — screenshot `/` (escritorio + 390px). Expected: tarjetas marfil redondeadas con sombra cálida e íconos en círculo arena; coincide con la dirección B del mockup.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "style(inicio): tarjetas de sección en estilo cálido"
```

---

## Task 5: Resumen (referencia aprobada en mockup)

**Files:** Modify `src/app/resumen/page.tsx`, `src/app/resumen/resumen-area.tsx`

- [ ] **Step 1: `resumen/page.tsx` — chips de área.** En el `<Link>` de cada área:
  - Activo: `bg-bosque text-white` (ya migrado) → mantener.
  - Inactivo: `bg-gray-100 text-gray-700` → `bg-arena text-tierra`.
  Botones de navegación de semana `rounded border px-3 py-1 text-sm` → `rounded-lg border border-borde bg-marfil px-3 py-1 text-sm text-tinta`.
  Botones "Exportar PDF": `border-purple-700 text-purple-700 hover:bg-purple-50` → `border-arcilla text-arcilla hover:bg-arena/40`.

- [ ] **Step 2: `resumen-area.tsx` — KPIs.** Las 4 tarjetas `rounded-2xl border p-5` → `tarjeta p-5`. La etiqueta `text-gray-500` → `text-tierra`. Los números mantienen sus colores funcionales (`COLOR_HEX[...]`).

- [ ] **Step 3: `resumen-area.tsx` — chips "Detalle por estado".** Reemplazar las clases de fondo de cada chip por las clases de estado:
  - `bg-green-50` → `chip-estado chip-cumplida` (Cumplidas)
  - `bg-yellow-50` → `chip-estado chip-parcial` (Parciales)
  - `bg-red-50` → `chip-estado chip-nocumplida` (No cumplidas)
  - `bg-blue-50` → `chip-estado chip-reprogramada` (Reprogramadas)
  - `bg-gray-100` → `chip-estado chip-pendiente` (Pendientes)
  Quitar el `rounded-full px-3 py-1` redundante (ya viene en `.chip-estado`).

- [ ] **Step 4: `resumen-area.tsx` — paneles y listas.** Los `rounded-xl border p-4` de Ranking y Motivos → `tarjeta p-4`. Los `rounded border px-3 py-1` de las listas (realizado/nuevas) → `rounded-lg border border-borde bg-marfil px-3 py-1`. Encabezados de sección `font-semibold` → añadir `text-tinta`. El borde inferior del header `border-b` → `border-b border-borde`.

- [ ] **Step 5: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 6: Verificación visual** — screenshot `/resumen?area=cmqmdztof0002od5qdpwck3cl&anio=2026&semana=26`. Expected: coincide con el mockup B aprobado (KPIs marfil, chips pastel cálidos, paneles con sombra suave).

- [ ] **Step 7: Commit**

```bash
git add src/app/resumen/
git commit -m "style(resumen): KPIs, chips de estado y paneles en estilo cálido"
```

---

## Task 6: Cumplimiento

**Files:** Modify `src/app/cumplimiento/page.tsx`, `dia-maquinaria.tsx`, `dia-no-maquinaria.tsx`, `form-registrar.tsx`, `form-actividad-realizada.tsx`, `form-avance-lote.tsx`

**Reglas de mapeo (aplican a todos los archivos de esta tarea):**
- Contenedores tipo tarjeta: `rounded* border` (gris) → `tarjeta` (o `rounded-lg border border-borde bg-marfil` para piezas pequeñas).
- Texto tenue `text-gray-500/600` → `text-tierra`; texto fuerte → `text-tinta`.
- Fondos `bg-gray-50/100` → `bg-arena` (chips/zonas) o `bg-marfil` (superficies).
- Botón primario verde (`bg-bosque text-white`): mantener; redondeo `rounded` → `rounded-lg`.
- Botón outline verde (`border-bosque text-bosque`): mantener; hover `hover:bg-green-50` → `hover:bg-arena/40`.
- Inputs/selects `rounded border` → `rounded-lg border border-borde bg-marfil`; añadir foco `focus:outline-none focus:ring-2 focus:ring-bosque/40`.
- Donde se muestre el ESTADO de una actividad como etiqueta de color, usar `.chip-estado` + la variante correspondiente.

- [ ] **Step 1: `cumplimiento/page.tsx`** — aplicar las reglas a los contenedores de día/actividad y a los chips de filtro/área. Identificar los `bg-gray-*`, `border` y `rounded` y mapearlos.

- [ ] **Step 2: `dia-no-maquinaria.tsx` y `dia-maquinaria.tsx`** — aplicar reglas a los botones (✓ Cumplido = primario; "registrar novedad" enlaces `text-gray-500` → `text-tierra`) y a la zona de novedad (`bg-gray-50` → `bg-arena`).

- [ ] **Step 3: `form-avance-lote.tsx`** — el botón toggle "Registrar avance" (`border-bosque text-bosque hover:bg-green-50`) → `hover:bg-arena/40`; el `<form>` `bg-gray-50` → `bg-arena`; inputs `rounded border` → `rounded-lg border border-borde bg-marfil`; botón "Guardar avance" `rounded bg-bosque` → `rounded-lg bg-bosque`.

- [ ] **Step 4: `form-registrar.tsx` y `form-actividad-realizada.tsx`** — aplicar reglas a selects/inputs/botones según el mapeo.

- [ ] **Step 5: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 6: Tests** — Harness B. Expected: todos en verde (la lógica de cumplimiento intacta).

- [ ] **Step 7: Verificación visual** — screenshot `/cumplimiento` (escritorio + 390px), y abrir el form "Registrar avance" (puede hacerse con un screenshot tras click vía playwright o validación visual de los estilos del form). Expected: superficies marfil/arena, inputs redondeados con foco verde, sin cambios de disposición.

- [ ] **Step 8: Commit**

```bash
git add src/app/cumplimiento/
git commit -m "style(cumplimiento): superficies, formularios y botones en estilo cálido"
```

---

## Task 7: Programar

**Files:** Modify `src/app/programar/page.tsx`, `grilla-semana.tsx`, `asignar-tarea-form.tsx`, `boton-descargar-imagen.tsx`

> **Cuidado:** `grilla-semana.tsx` es la rejilla que luego se exporta como imagen (`boton-descargar-imagen.tsx` usa `html2canvas-pro`). Mantener buen contraste y, si la rejilla tiene fondo, que sea claro (`bg-marfil`/blanco) para que la imagen salga legible. No cambiar la estructura de la tabla.

- [ ] **Step 1: `programar/page.tsx`** — aplicar reglas de mapeo (Task 6) a navegación de semana, chips de área y botones.

- [ ] **Step 2: `grilla-semana.tsx`** — bordes de celda `border-gray-*` → `border-borde`; cabeceras `bg-gray-*` → `bg-arena`; celdas de fondo → `bg-marfil`/blanco. Las tareas/etiquetas dentro de la rejilla mantienen su color funcional; si muestran estado, usar `.chip-estado`.

- [ ] **Step 3: `asignar-tarea-form.tsx`** — inputs/selects/botones según mapeo.

- [ ] **Step 4: `boton-descargar-imagen.tsx`** — botón según mapeo (acento `arcilla` si es de exportación). **No** cambiar la lógica de `html2canvas`.

- [ ] **Step 5: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 6: Verificación visual + export de imagen** — screenshot `/programar`; luego hacer clic en "Descargar imagen" y revisar el PNG generado: debe salir con fondo claro y legible. Expected: rejilla coherente, imagen exportada correcta.

- [ ] **Step 7: Commit**

```bash
git add src/app/programar/page.tsx src/app/programar/grilla-semana.tsx src/app/programar/asignar-tarea-form.tsx src/app/programar/boton-descargar-imagen.tsx
git commit -m "style(programar): rejilla y controles en estilo cálido (imagen export intacta)"
```

---

## Task 8: Tareas

**Files:** Modify `src/app/tareas/page.tsx`, `form-solicitar.tsx`, `form-nueva-tarea-maquinaria.tsx`, `picker-lotes-bultos.tsx`

- [ ] **Step 1:** Aplicar reglas de mapeo (Task 6) a `tareas/page.tsx`: listas/tarjetas de tareas → `tarjeta`; chips → `bg-arena text-tierra`; botones según mapeo.
- [ ] **Step 2:** `form-solicitar.tsx`, `form-nueva-tarea-maquinaria.tsx`, `picker-lotes-bultos.tsx`: inputs/checkbox (`accent-bosque`)/botones según mapeo.
- [ ] **Step 3: Typecheck** — Harness A. Expected: `TYPECHECK OK`.
- [ ] **Step 4: Verificación visual** — screenshot `/tareas`. Expected: coherente con estilo B.
- [ ] **Step 5: Commit**

```bash
git add src/app/tareas/
git commit -m "style(tareas): listas y formularios en estilo cálido"
```

---

## Task 9: Tablero

**Files:** Modify `src/app/tablero/page.tsx`

- [ ] **Step 1:** Aplicar reglas de mapeo (Task 6): tarjetas/celdas mensuales → `tarjeta`/`border-borde`; texto tenue → `text-tierra`; estados → `.chip-estado`.
- [ ] **Step 2: Typecheck** — Harness A. Expected: `TYPECHECK OK`.
- [ ] **Step 3: Verificación visual** — screenshot `/tablero`. Expected: vista mensual coherente con estilo B.
- [ ] **Step 4: Commit**

```bash
git add src/app/tablero/page.tsx
git commit -m "style(tablero): vista mensual en estilo cálido"
```

---

## Task 10: Configuración

**Files:** Modify `src/app/configuracion/page.tsx`, `lotes-lista.tsx`, `form-eliminar.tsx`

> `configuracion/page.tsx` tiene 13 usos del verde (el más cargado): aplicar el mapeo con cuidado, sección por sección (catálogos, usuarios, lotes).

- [ ] **Step 1:** Aplicar reglas de mapeo (Task 6) a las tres archivos: secciones → `tarjeta`; inputs/botones según mapeo; botones de eliminar mantienen su rol destructivo (rojo) pero armonizado si choca.
- [ ] **Step 2: Typecheck** — Harness A. Expected: `TYPECHECK OK`.
- [ ] **Step 3: Tests** — Harness B. Expected: verde.
- [ ] **Step 4: Verificación visual** — screenshot `/configuracion`. Expected: coherente con estilo B.
- [ ] **Step 5: Commit**

```bash
git add src/app/configuracion/
git commit -m "style(configuracion): catálogos, usuarios y lotes en estilo cálido"
```

---

## Task 11: Login

**Files:** Modify `src/app/login/page.tsx`

- [ ] **Step 1:** Aplicar estilo B a la pantalla de login: fondo crema (heredado), tarjeta del formulario → `tarjeta` centrada; inputs `rounded-lg border border-borde bg-marfil focus:ring-2 focus:ring-bosque/40`; botón "Entrar" → primario `rounded-lg bg-bosque text-white`. Logo/título con `text-bosque`.
- [ ] **Step 2: Typecheck** — Harness A. Expected: `TYPECHECK OK`.
- [ ] **Step 3: Verificación visual** — screenshot `/login` (sin sesión: navegar en contexto nuevo sin cookie). Expected: login en estilo B; el flujo de login sigue funcionando.
- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "style(login): formulario en estilo cálido"
```

---

## Task 12: Blindaje de export/impresión

**Files:** Modify `src/app/programar/exportar/page.tsx`, `src/app/resumen/exportar/page.tsx`, `src/app/_componentes/auto-imprimir.tsx`

> Estas vistas se imprimen/exportan a PDF/imagen. Objetivo: **fondo blanco**, alto contraste, y armonizar los acentos con la paleta sin que el crema aparezca en lo impreso.

- [ ] **Step 1: Forzar blanco.** En el contenedor raíz de `programar/exportar/page.tsx` y `resumen/exportar/page.tsx`, asegurar `bg-white` explícito (no heredar crema) y `text-tinta`/negros para texto. Mantener la estructura imprimible.
- [ ] **Step 2: Armonizar acentos** (verde/arcilla) en esas vistas reemplazando `#11603a` por `bosque` SOLO si no compromete el contraste de impresión; los colores funcionales de estado pueden quedar como están.
- [ ] **Step 3: `auto-imprimir.tsx`** — revisar el `#11603a` y reemplazar por `bosque` si es un acento visual; no cambiar la lógica de auto-impresión.
- [ ] **Step 4: Typecheck** — Harness A. Expected: `TYPECHECK OK`.
- [ ] **Step 5: Verificación de export** — abrir `/resumen/exportar?area=...&anio=2026&semana=26` y `/programar/exportar?...`, screenshot, y generar el PDF (imprimir) y la imagen del cronograma. Expected: **fondo blanco**, legible, sin tintes crema.
- [ ] **Step 6: Commit**

```bash
git add src/app/programar/exportar/page.tsx src/app/resumen/exportar/page.tsx src/app/_componentes/auto-imprimir.tsx
git commit -m "style(export): fondo blanco y acentos armonizados en vistas de impresión"
```

---

## Task 13: Pase final de coherencia + verificación completa

**Files:** posibles retoques menores en cualquier archivo ya tocado.

- [ ] **Step 1: Barrido de residuos** — buscar grises/colores sueltos que rompan la coherencia:

```bash
grep -rn "gray-50\|gray-100\|gray-200\|purple-\|#11603a" src/ | grep -v "/exportar/" | grep -v "auto-imprimir"
```

Revisar cada hallazgo: si es una superficie/acento que debería ser cálido, mapearlo; si es funcional (p. ej. un divisor neutro intencional), dejarlo. Ajustar y re-commit por pantalla si hace falta.

- [ ] **Step 2: Typecheck** — Harness A. Expected: `TYPECHECK OK`.
- [ ] **Step 3: Tests** — Harness B. Expected: verde (confirma cero regresión funcional).
- [ ] **Step 4: Recorrido visual completo** — screenshots de `/`, `/tareas`, `/programar`, `/cumplimiento`, `/resumen`, `/tablero`, `/configuracion`, `/login` (escritorio; `/` y `/cumplimiento` también móvil). Confirmar coherencia de paleta, tarjetas, chips y header en todas.
- [ ] **Step 5: Verificación de no-regresión funcional** — repetir el smoke del arreglo previo: registrar avance con cantidad vacía (sigue Pendiente) y con cantidad >0 (pasa a Parcial), y restaurar por DB. Confirma que el rediseño no rompió comportamiento.
- [ ] **Step 6: Commit final si hubo retoques**

```bash
git add src/
git commit -m "style: pase final de coherencia visual"
```

---

## Self-review (cobertura del spec)

- Tokens de paleta → Task 1. ✓
- Colores de estado → Task 3 (clases) + aplicados en Tasks 5/6/7/9. ✓
- Tipografía (arreglar Arial) → Task 1. ✓
- Limpieza dark-mode → Task 1. ✓
- Migración `#11603a` → Task 2. ✓
- Header degradado → Task 3. ✓
- Todas las superficies (Login, Inicio, Tareas, Programar, Cumplimiento, Resumen, Tablero, Configuración) → Tasks 4–11. ✓
- Export/impresión con fondo blanco → Task 12. ✓
- Verificación (typecheck/tests/visual/export/responsive/no-regresión) → Harness + Task 13. ✓
- Sin cambios de comportamiento → gate de tests en Tasks 6/10/13 + smoke en Task 13. ✓

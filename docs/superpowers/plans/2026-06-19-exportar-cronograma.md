# Exportar cronograma (PNG por área + PDF admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Descargar el cronograma de la semana de un área como imagen PNG (WhatsApp) y, para el admin, exportar a PDF los cronogramas de todas las áreas (una por página).

**Architecture:** Se extrae la grilla actual de Programar a un componente presentacional reutilizable `GrillaSemana`. La imagen PNG se genera en el cliente capturando esa grilla con `html2canvas-pro` (entiende los colores `oklch` de Tailwind v4). El PDF del admin es una ruta `/programar/exportar` que renderiza un `GrillaSemana` por área (una por página) y dispara `window.print()` para "Guardar como PDF".

**Tech Stack:** Next.js 16 (App Router, Server/Client Components), React 19, Tailwind v4, Prisma 6, `html2canvas-pro`.

## Global Constraints

- La imagen PNG está disponible para cualquier usuario (área y admin) en su área. El PDF de todas las áreas es **solo ADMIN**.
- No cambia datos, programación, cumplimiento ni resumen: es solo presentación/exportación.
- La grilla debe verse **igual** en pantalla tras extraerla a componente.
- Captura de imagen: usar `html2canvas-pro` (NO `html2canvas` clásico — falla con `oklch`). Importarla de forma dinámica (`await import('html2canvas-pro')`) dentro del handler del botón (usa `document`, solo cliente).
- Nombre del PNG: `cronograma-<area>-S<semana>-<año>.png`.
- En el PDF no debe salir la barra de navegación.
- Gate automático de cada tarea: `npx tsc --noEmit` y `npm run lint` sin errores.
- Spec: `docs/superpowers/specs/2026-06-19-exportar-cronograma-design.md`.

## File Structure

- `src/app/programar/grilla-semana.tsx` — NUEVO. Componente presentacional: encabezado (área · semana · fechas) + tabla responsables × días.
- `src/app/programar/page.tsx` — MODIFICAR. Usar `GrillaSemana`; envolver en `#grilla-export`; botón PNG; enlace PDF (admin).
- `src/app/programar/boton-descargar-imagen.tsx` — NUEVO (cliente). Botón "📷 Descargar imagen".
- `src/app/programar/exportar/page.tsx` — NUEVO (server, solo ADMIN). Todas las áreas, una por página.
- `src/app/programar/exportar/auto-imprimir.tsx` — NUEVO (cliente). Botón + `window.print()` al montar.
- `src/app/_componentes/nav-principal.tsx` — MODIFICAR. `print:hidden` en el `<header>`.
- `package.json` — añadir `html2canvas-pro`.

---

## Task 1: Extraer `GrillaSemana` y usarla en Programar (sin cambio visible)

**Files:**
- Create: `src/app/programar/grilla-semana.tsx`
- Modify: `src/app/programar/page.tsx` (grid inline ~148-189; imports/const sin uso)

**Interfaces:**
- Produces: `GrillaSemana({ areaNombre: string; semana: number; fechas: Date[]; responsables: {id:string;nombre:string}[]; actividades: ActividadGrilla[] })` donde `ActividadGrilla = { id:string; responsableId:string; dia:number; descripcion:string; turno:string; maquina:{nombre:string}|null; lotes:{nombre:string;hectareas:number|null}[] }`. El tipo es estructural: lo que devuelve `listarActividades` lo cumple.

- [ ] **Step 1: Crear el componente `GrillaSemana`**

Crear `src/app/programar/grilla-semana.tsx`:

```tsx
import { InfoLotes } from '../_componentes/info-lotes'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

type ActividadGrilla = {
  id: string
  responsableId: string
  dia: number
  descripcion: string
  turno: string
  maquina: { nombre: string } | null
  lotes: { nombre: string; hectareas: number | null }[]
}

function fmtFecha(f: Date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)
}

export function GrillaSemana({
  areaNombre,
  semana,
  fechas,
  responsables,
  actividades,
}: {
  areaNombre: string
  semana: number
  fechas: Date[]
  responsables: { id: string; nombre: string }[]
  actividades: ActividadGrilla[]
}) {
  const rango = fechas.length === 7 ? `${fmtFecha(fechas[0])} – ${fmtFecha(fechas[6])}` : ''
  return (
    <div className="rounded-xl border bg-white">
      <div className="border-b p-3">
        <div className="text-lg font-bold text-[#11603a]">{areaNombre}</div>
        <div className="text-sm text-gray-500">Semana {semana}{rango ? ` · ${rango}` : ''}</div>
      </div>
      {responsables.length === 0 ? (
        <p className="p-4 text-center text-sm italic text-gray-400">Sin actividades programadas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-gray-50 p-2 text-left">Responsable</th>
                {DIAS.map((d, i) => (
                  <th key={d} className="border bg-gray-50 p-2 text-left">
                    {d}
                    <div className="text-xs font-normal text-gray-400">{fechas[i] ? fmtFecha(fechas[i]) : ''}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {responsables.map((r) => (
                <tr key={r.id}>
                  <td className="border p-2 font-medium">{r.nombre}</td>
                  {DIAS.map((_, i) => {
                    const dia = i + 1
                    const celdas = actividades.filter((a) => a.responsableId === r.id && a.dia === dia)
                    return (
                      <td key={dia} className="border p-2 align-top">
                        {celdas.map((a) => (
                          <div key={a.id} className="mb-1 rounded bg-green-50 p-1">
                            <div>{a.descripcion}</div>
                            {a.turno && <div className="text-xs text-gray-500">{a.turno}</div>}
                            {a.maquina && <div className="text-xs text-gray-500">🚜 {a.maquina.nombre}</div>}
                            <InfoLotes lotes={a.lotes} className="mt-1" />
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Usar `GrillaSemana` en `page.tsx`**

En `src/app/programar/page.tsx`, reemplazar el bloque de la grilla (desde `{responsables.length === 0 ? (` hasta su `)}` de cierre, aprox. líneas 148-189) por:

```tsx
      <div className="mb-6">
        <GrillaSemana
          areaNombre={areaActual.nombre}
          semana={semana}
          fechas={fechas}
          responsables={responsables}
          actividades={actividades}
        />
      </div>
```

- [ ] **Step 3: Importar `GrillaSemana` y limpiar lo que quede sin uso**

En `src/app/programar/page.tsx`:
- Añadir el import: `import { GrillaSemana } from './grilla-semana'`
- Eliminar el import `import { InfoLotes } from '../_componentes/info-lotes'` (ya no se usa en la página).
- Eliminar la constante `const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']` (ya no se usa).
- Eliminar la función `fmtFecha` definida en la página (las líneas `const fmtFecha = (f: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)`) — ya no se usa.
- Mantener `fechas` (se pasa a `GrillaSemana`).

- [ ] **Step 4: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (Si lint marca `DIAS`, `fmtFecha` o `InfoLotes` sin uso, terminar de eliminarlos.)

- [ ] **Step 5: Verificación manual**

Como cualquier usuario con actividades (ej. `maquinaria`/`clave123`) en Programar: el cuadro de la semana se ve igual que antes, ahora con un encabezado "Área · Semana N · fechas" arriba.

- [ ] **Step 6: Commit**

```bash
git add src/app/programar/grilla-semana.tsx src/app/programar/page.tsx
git commit -m "refactor(programar): extraer GrillaSemana (cuadro de la semana reutilizable)"
```

---

## Task 2: Botón "📷 Descargar imagen" (PNG por área)

**Files:**
- Create: `src/app/programar/boton-descargar-imagen.tsx`
- Modify: `src/app/programar/page.tsx` (envolver grilla en `#grilla-export`, añadir botón)
- Modify: `package.json` (dependencia `html2canvas-pro`)

**Interfaces:**
- Consumes: `GrillaSemana` (Task 1).
- Produces: `BotonDescargarImagen({ targetId: string; nombreArchivo: string })` (componente cliente).

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install html2canvas-pro`
Expected: se añade a `dependencies` en `package.json` y termina sin errores.

- [ ] **Step 2: Crear el botón de descarga**

Crear `src/app/programar/boton-descargar-imagen.tsx`:

```tsx
'use client'

export function BotonDescargarImagen({
  targetId,
  nombreArchivo,
}: {
  targetId: string
  nombreArchivo: string
}) {
  async function descargar() {
    const el = document.getElementById(targetId)
    if (!el) return
    try {
      const { default: html2canvas } = await import('html2canvas-pro')
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
      const enlace = document.createElement('a')
      enlace.href = canvas.toDataURL('image/png')
      enlace.download = nombreArchivo
      enlace.click()
    } catch {
      alert('No se pudo generar la imagen.')
    }
  }

  return (
    <button
      type="button"
      onClick={descargar}
      className="rounded border border-[#11603a] px-3 py-1 text-sm font-semibold text-[#11603a] hover:bg-green-50"
    >
      📷 Descargar imagen
    </button>
  )
}
```

- [ ] **Step 3: Envolver la grilla y mostrar el botón en `page.tsx`**

En `src/app/programar/page.tsx`, reemplazar el bloque agregado en Task 1:

```tsx
      <div className="mb-6">
        <GrillaSemana
          areaNombre={areaActual.nombre}
          semana={semana}
          fechas={fechas}
          responsables={responsables}
          actividades={actividades}
        />
      </div>
```

por:

```tsx
      {responsables.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <BotonDescargarImagen
            targetId="grilla-export"
            nombreArchivo={`cronograma-${areaActual.nombre}-S${semana}-${anio}.png`}
          />
        </div>
      )}
      <div id="grilla-export" className="mb-6">
        <GrillaSemana
          areaNombre={areaActual.nombre}
          semana={semana}
          fechas={fechas}
          responsables={responsables}
          actividades={actividades}
        />
      </div>
```

- [ ] **Step 4: Importar el botón**

En `src/app/programar/page.tsx` añadir: `import { BotonDescargarImagen } from './boton-descargar-imagen'`

- [ ] **Step 5: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Verificación manual**

Como `maquinaria` con actividades en Programar: clic en "📷 Descargar imagen" descarga un PNG llamado `cronograma-Maquinaria-S<semana>-<año>.png` con el cuadro y su encabezado. Abrir el PNG para confirmar que se ve completo (colores correctos, sin recortes).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/app/programar/boton-descargar-imagen.tsx src/app/programar/page.tsx
git commit -m "feat(programar): descargar el cronograma del área como imagen PNG"
```

---

## Task 3: PDF de todas las áreas (admin) + ocultar nav en impresión

**Files:**
- Create: `src/app/programar/exportar/page.tsx`
- Create: `src/app/programar/exportar/auto-imprimir.tsx`
- Modify: `src/app/_componentes/nav-principal.tsx` (`print:hidden`)
- Modify: `src/app/programar/page.tsx` (enlace admin)

**Interfaces:**
- Consumes: `GrillaSemana` (Task 1); `listarAreas`, `listarResponsablesPorArea`, `listarActividades` (repo existente); `semanaActual`, `fechasDeSemana` (`@/dominio/semana`).
- Produces: ruta `/programar/exportar?anio=&semana=` (solo ADMIN); `AutoImprimir()` (cliente).

- [ ] **Step 1: Componente cliente que dispara la impresión**

Crear `src/app/programar/exportar/auto-imprimir.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

export function AutoImprimir() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="mb-4 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded bg-[#11603a] px-4 py-2 text-sm font-semibold text-white"
      >
        🖨️ Imprimir / Guardar PDF
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Página de exportación (solo ADMIN, todas las áreas)**

Crear `src/app/programar/exportar/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarResponsablesPorArea, listarActividades } from '@/datos/repositorio'
import { semanaActual, fechasDeSemana } from '@/dominio/semana'
import { GrillaSemana } from '../grilla-semana'
import { AutoImprimir } from './auto-imprimir'

export default async function ExportarPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; semana?: string }>
}) {
  const u = await usuarioActual()
  if (!u || u.rol !== 'ADMIN') redirect('/programar')

  const sp = await searchParams
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana
  const fechas = fechasDeSemana(anio, semana)

  const areas = await listarAreas()
  const datos = await Promise.all(
    areas.map(async (a) => ({
      area: a,
      responsables: await listarResponsablesPorArea(a.id),
      actividades: await listarActividades(a.id, anio, semana),
    })),
  )

  return (
    <main className="mx-auto max-w-6xl p-6">
      <AutoImprimir />
      <h1 className="mb-4 text-2xl font-bold text-[#11603a] print:hidden">
        Exportar cronogramas — Semana {semana}
      </h1>
      <div className="space-y-8">
        {datos.map(({ area, responsables, actividades }, i) => (
          <div key={area.id} style={i < datos.length - 1 ? { breakAfter: 'page' } : undefined}>
            <GrillaSemana
              areaNombre={area.nombre}
              semana={semana}
              fechas={fechas}
              responsables={responsables}
              actividades={actividades}
            />
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Ocultar la barra de navegación al imprimir**

En `src/app/_componentes/nav-principal.tsx`, cambiar la etiqueta `<header>`:

```tsx
    <header className="bg-[#11603a] text-white print:hidden">
```

- [ ] **Step 4: Enlace de exportación para el admin en Programar**

En `src/app/programar/page.tsx`, dentro del bloque de acciones agregado en Task 2, añadir el enlace para admin. El bloque queda así:

```tsx
      {(responsables.length > 0 || esAdmin) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {responsables.length > 0 && (
            <BotonDescargarImagen
              targetId="grilla-export"
              nombreArchivo={`cronograma-${areaActual.nombre}-S${semana}-${anio}.png`}
            />
          )}
          {esAdmin && (
            <a
              href={`/programar/exportar?anio=${anio}&semana=${semana}`}
              target="_blank"
              rel="noopener"
              className="rounded border border-purple-700 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-50"
            >
              🖨️ Exportar PDF (todas las áreas)
            </a>
          )}
        </div>
      )}
```

- [ ] **Step 5: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Verificación manual**

Como `admin`/`clave123` en Programar: aparece "🖨️ Exportar PDF (todas las áreas)". Al hacer clic abre `/programar/exportar` en pestaña nueva, muestra cada área con su cuadro (una por página) y abre el diálogo de impresión; en la vista previa de impresión **no** aparece la barra verde de navegación, y cada área queda en su propia página. Áreas sin actividades aparecen con "Sin actividades programadas". Como usuario de área (no admin) el enlace de PDF **no** aparece, y entrar a `/programar/exportar` redirige a `/programar`.

- [ ] **Step 7: Commit**

```bash
git add src/app/programar/exportar/page.tsx src/app/programar/exportar/auto-imprimir.tsx src/app/_componentes/nav-principal.tsx src/app/programar/page.tsx
git commit -m "feat(programar): exportar PDF de todas las áreas (admin) e ocultar nav al imprimir"
```

---

## Self-Review (autor del plan)

- **Cobertura del spec:** `GrillaSemana` reutilizable (Task 1) ✓; PNG por área con `html2canvas-pro`, import dinámico, nombre de archivo correcto (Task 2) ✓; PDF admin de todas las áreas, una por página, áreas vacías informadas, solo-admin con redirect (Task 3) ✓; nav `print:hidden` (Task 3) ✓; PNG disponible para área y admin, PDF solo admin ✓.
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos:** `GrillaSemana` recibe los mismos props en Programar y en Exportar; `ActividadGrilla` es estructural y lo cumple lo que devuelve `listarActividades` (incluye `responsableId`, `dia`, `descripcion`, `turno`, `maquina`, `lotes`); `BotonDescargarImagen({targetId, nombreArchivo})` coincide con su uso; `html2canvas-pro` default export usado vía import dinámico.
- **Nota de ejecución:** sin cambios de esquema Prisma → no hace falta reiniciar el dev server; el `npm install` de Task 2 sí requiere que el server recargue (Next lo detecta).

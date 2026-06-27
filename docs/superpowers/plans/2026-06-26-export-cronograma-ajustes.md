# Ajustes al export del cronograma (imagen y PDF) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el cronograma exportado (imagen PNG y PDF) salga sin botones de acción, con letra más grande y oscura, y repitiendo el cabezado cada 5 filas; la grilla interactiva en pantalla queda igual.

**Architecture:** Se añade una prop `paraExportar` a `GrillaSemana` que activa los tres cambios (sin controles, letra `text-base text-black`, cabezado repetido cada 5 responsables). La imagen captura una **segunda grilla oculta** (con `paraExportar`) en `programar/page.tsx`, dejando intacta la grilla interactiva; el PDF (`programar/exportar/page.tsx`) pasa `paraExportar` a cada grilla.

**Tech Stack:** Next.js 16 (App Router, RSC + client component para el botón), TypeScript, Tailwind, html2canvas-pro.

## Global Constraints

- Aplica **solo a imagen y PDF**. La grilla interactiva en pantalla **no cambia**.
- Letra de export: cuerpo de la tabla `text-base text-black` (vs `text-sm` en pantalla); nombre de área `text-xl` en export.
- Cabezado repetido: insertar la fila de cabezado antes de cada bloque de 5 responsables (condición exacta: `idx > 0 && idx % 5 === 0`).
- En export NO se renderiza el form de turno (input + ✓) ni "Devolver a asignar"; el turno se muestra como texto.
- No tocar `BotonDescargarImagen` (ya captura `#grilla-export` y fuerza orientación horizontal).
- No cambia datos, esquema ni server actions. "Devolver al banco" está fuera del export; no se toca.
- Convención del repo: componentes/páginas (RSC) sin pruebas unitarias automáticas — se verifican con typecheck + ejecución.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- El build local (`npm run build`) falla en `prisma migrate deploy` por falta de `DATABASE_URL` (esperado); el build real corre en Vercel.

---

### Task 1: Prop `paraExportar` en `GrillaSemana`

**Files:**
- Modify: `src/app/programar/grilla-semana.tsx` (reemplazo completo del archivo)

**Interfaces:**
- Consumes: nada nuevo (usa `InfoLotes`, `actualizarActividadAccion`, `devolverAAsignacionAccion`, ya importados; añade `Fragment` de `react`).
- Produces: `GrillaSemana` ahora acepta `paraExportar?: boolean` (default `false`). Lo consumen Task 2 (page.tsx y exportar/page.tsx).

- [ ] **Step 1: Reemplazar el contenido de `src/app/programar/grilla-semana.tsx`**

Sustituir TODO el archivo por:

```tsx
import { Fragment } from 'react'
import { InfoLotes } from '../_componentes/info-lotes'
import { actualizarActividadAccion, devolverAAsignacionAccion } from './acciones'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

type ActividadGrilla = {
  id: string
  responsableId: string
  dia: number
  descripcion: string
  turno: string
  tareaId: string | null
  maquina: { nombre: string } | null
  lotes: { id: string; nombre: string; hectareas: number | null }[]
  bultosPorLote?: unknown
}

function fmtFecha(f: Date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)
}

export function GrillaSemana({
  areaNombre,
  anio,
  semana,
  fechas,
  responsables,
  actividades,
  turnoEditable = false,
  esMaquinaria,
  paraExportar = false,
}: {
  areaNombre: string
  anio: number
  semana: number
  fechas: Date[]
  responsables: { id: string; nombre: string }[]
  actividades: ActividadGrilla[]
  turnoEditable?: boolean
  esMaquinaria: boolean
  paraExportar?: boolean
}) {
  const rango = fechas.length === 7 ? `${fmtFecha(fechas[0])} – ${fmtFecha(fechas[6])}` : ''
  // En modo export nunca hay controles interactivos (turno como texto, sin "Devolver a asignar").
  const editable = turnoEditable && !paraExportar
  // Fila de cabezado reutilizable: va en <thead> y, al exportar, se repite cada 5 responsables.
  const filaCabezado = (clave: string) => (
    <tr key={clave}>
      <th className="border border-borde bg-arena p-2 text-left">Responsable</th>
      {DIAS.map((d, i) => (
        <th key={d} className="border border-borde bg-arena p-2 text-left">
          {d}
          <div className="text-xs font-normal text-tierra">{fechas[i] ? fmtFecha(fechas[i]) : ''}</div>
        </th>
      ))}
    </tr>
  )
  return (
    <div className="rounded-xl border border-borde bg-white text-tinta">
      <div className="border-b border-borde p-3">
        <div className={`font-bold text-bosque ${paraExportar ? 'text-xl' : 'text-lg'}`}>{areaNombre}</div>
        <div className={paraExportar ? 'text-base text-black' : 'text-sm text-tierra'}>Semana {semana}{rango ? ` · ${rango}` : ''}</div>
      </div>
      {responsables.length === 0 ? (
        <p className="p-4 text-center text-sm italic text-tierra">Sin actividades programadas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse ${paraExportar ? 'text-base text-black' : 'text-sm'}`}>
            <thead>{filaCabezado('head')}</thead>
            <tbody>
              {responsables.map((r, idx) => (
                <Fragment key={r.id}>
                  {paraExportar && idx > 0 && idx % 5 === 0 && filaCabezado(`rep-${idx}`)}
                  <tr>
                    <td className="border border-borde p-2 font-medium">{r.nombre}</td>
                    {DIAS.map((_, i) => {
                      const dia = i + 1
                      const celdas = actividades.filter((a) => a.responsableId === r.id && a.dia === dia)
                      return (
                        <td key={dia} className="border border-borde p-2 align-top">
                          {celdas.map((a) => (
                            <div key={a.id} className="mb-1 rounded-lg bg-green-50 p-1">
                              <div>{a.descripcion}</div>
                              {esMaquinaria && (editable ? (
                                <form action={actualizarActividadAccion} className="mt-0.5 flex items-center gap-1">
                                  <input type="hidden" name="id" value={a.id} />
                                  <input type="hidden" name="descripcion" value={a.descripcion} />
                                  <input type="hidden" name="anio" value={anio} />
                                  <input type="hidden" name="semana" value={semana} />
                                  <input aria-label="Turno" name="turno" defaultValue={a.turno} className="w-20 rounded-lg border border-borde bg-marfil p-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-bosque/40" />
                                  <button type="submit" className="rounded-lg bg-bosque px-1.5 text-xs font-semibold text-white">✓</button>
                                </form>
                              ) : (
                                a.turno && <div className="text-xs text-tierra">{a.turno}</div>
                              ))}
                              {a.maquina && <div className="text-xs text-tierra">🚜 {a.maquina.nombre}</div>}
                              <InfoLotes lotes={a.lotes} bultosPorLote={a.bultosPorLote as Record<string, number> | null} className="mt-1" />
                              {editable && a.tareaId && (
                                <form action={devolverAAsignacionAccion} className="mt-0.5">
                                  <input type="hidden" name="tareaId" value={a.tareaId} />
                                  <input type="hidden" name="anio" value={anio} />
                                  <input type="hidden" name="semana" value={semana} />
                                  <button type="submit" className="text-xs text-amber-700 hover:underline">↩️ Devolver a asignar</button>
                                </form>
                              )}
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

> Cambios respecto al original: import de `Fragment`; prop `paraExportar`; `const editable = turnoEditable && !paraExportar` (reemplaza `turnoEditable` en las dos condiciones de la celda); `filaCabezado` reutilizable usada en `<thead>` y repetida cada 5 filas; clases condicionales de tamaño/color (`text-base text-black` y `text-xl`) en modo export.

- [ ] **Step 2: Typecheck**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add src/app/programar/grilla-semana.tsx
git commit -m "feat(programar): GrillaSemana modo export (sin botones, letra grande, cabezado cada 5 filas)"
```

---

### Task 2: Cablear el modo export en imagen y PDF

**Files:**
- Modify: `src/app/programar/page.tsx` (grilla oculta para la imagen)
- Modify: `src/app/programar/exportar/page.tsx` (pasar `paraExportar`)

**Interfaces:**
- Consumes: `GrillaSemana` con la prop `paraExportar` (Task 1).
- Produces: nada para otras tareas.

- [ ] **Step 1: Imagen — grilla oculta de export en `page.tsx`**

En `src/app/programar/page.tsx`, reemplazar el bloque actual (líneas ~184-195):

```tsx
      <div id="grilla-export" className="mb-6">
        <GrillaSemana
          areaNombre={areaActual.nombre}
          anio={anio}
          semana={semana}
          fechas={fechas}
          responsables={responsablesActivos}
          actividades={actividadesCronograma}
          turnoEditable={futura}
          esMaquinaria={esMaquinaria}
        />
      </div>
```

por:

```tsx
      <div className="mb-6">
        <GrillaSemana
          areaNombre={areaActual.nombre}
          anio={anio}
          semana={semana}
          fechas={fechas}
          responsables={responsablesActivos}
          actividades={actividadesCronograma}
          turnoEditable={futura}
          esMaquinaria={esMaquinaria}
        />
      </div>
      {/* Grilla SOLO para exportar como imagen: recortada (h-0 overflow-hidden) para no
          ocupar espacio ni afectar la pantalla. html2canvas (BotonDescargarImagen) clona
          este #grilla-export y lo renderiza a tamaño completo igualmente. */}
      <div aria-hidden="true" className="h-0 overflow-hidden">
        <div id="grilla-export">
          <GrillaSemana
            areaNombre={areaActual.nombre}
            anio={anio}
            semana={semana}
            fechas={fechas}
            responsables={responsablesActivos}
            actividades={actividadesCronograma}
            esMaquinaria={esMaquinaria}
            paraExportar
          />
        </div>
      </div>
```

> La grilla visible pierde el `id="grilla-export"` (sigue interactiva en pantalla). El `id` pasa a la grilla oculta con `paraExportar`. No se toca `turnoEditable` en la visible.

- [ ] **Step 2: PDF — pasar `paraExportar` en `exportar/page.tsx`**

En `src/app/programar/exportar/page.tsx`, en el `<GrillaSemana>` (líneas ~46-54), añadir la prop `paraExportar`. Reemplazar:

```tsx
            <GrillaSemana
              areaNombre={area.nombre}
              anio={anio}
              semana={semana}
              fechas={fechas}
              responsables={responsables}
              actividades={actividades}
              esMaquinaria={esMaquinariaVar(area, 'programar')}
            />
```

por:

```tsx
            <GrillaSemana
              areaNombre={area.nombre}
              anio={anio}
              semana={semana}
              fechas={fechas}
              responsables={responsables}
              actividades={actividades}
              esMaquinaria={esMaquinariaVar(area, 'programar')}
              paraExportar
            />
```

- [ ] **Step 3: Typecheck**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida.

- [ ] **Step 4: Verificación manual (la hace el controlador con navegador, tras desplegar)**

Tras desplegar a prod, descargar la imagen del cronograma (botón "📷 Descargar imagen") en un área con >5 responsables (p. ej. Ganadería ceba o Maquinaria, 2026-S27) y verificar:
- **Sin botones** "Devolver a asignar" ni form de turno (✓) en la imagen.
- **Letra más grande y oscura** (cuerpo `text-base`, negro) que antes.
- **Cabezado repetido** tras cada 5 filas.
- **Sigue horizontal** (ancho > alto).
- La grilla **en pantalla** sigue igual (con sus botones y form de turno en semana futura).
- Abrir `/programar/exportar?anio=2026&semana=27` (ADMIN) y verificar lo mismo en el PDF.
- Confirmar que la página de programar **no** tiene scroll horizontal nuevo por la grilla oculta.

> Verificación de navegador (memoria): chromium bundled + libs locales con `playwright-core`; descargar el PNG y leer dimensiones del header (IHDR) para confirmar ancho>alto; contar filas de cabezado en el DOM clonado o por inspección.

- [ ] **Step 5: Commit**

```bash
git add src/app/programar/page.tsx src/app/programar/exportar/page.tsx
git commit -m "feat(programar): usar GrillaSemana modo export en imagen (grilla oculta) y PDF"
```

---

## Notas de cierre

- Tras revisar, desplegar con el flujo habitual (`git push` + `npx vercel@latest deploy --prod`). El P1002 de Neon en `prisma migrate deploy` es transitorio: reintentar el deploy.
- Riesgo principal: que html2canvas capture bien la grilla oculta (recortada con `h-0 overflow-hidden`). Si la imagen saliera vacía o recortada, mover la grilla de export a `position:absolute; -left-[100000px]` (fuera de pantalla, en flujo de capa) en vez de `h-0 overflow-hidden`. Verificar en el Step 4.

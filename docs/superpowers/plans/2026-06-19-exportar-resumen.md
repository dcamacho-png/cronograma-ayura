# Exportar Resumen a PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exportar el Resumen del área a PDF (área/semana actual para todos; todas las áreas, una por página, solo admin) mediante una vista de impresión.

**Architecture:** Se extrae el cuerpo del Resumen a un componente reutilizable `ResumenArea` (calcula + renderiza KPIs, detalle por estado, ranking, motivos, hectáreas y cambios). Una ruta `/resumen/exportar` renderiza `ResumenArea` (un área o todas) y dispara `window.print()` para "Guardar como PDF". El `AutoImprimir` del cronograma se vuelve componente compartido.

**Tech Stack:** Next.js 16 (App Router, Server/Client Components), React 19, Tailwind v4, Prisma 6.

## Global Constraints

- El PDF del área actual está disponible para cualquier usuario (de su propia área); el de TODAS las áreas es solo ADMIN.
- Un usuario de área que pida exportar otra área se le fuerza a la suya; si pide `todas=1` y no es admin, redirige a `/resumen`.
- Sin dependencias nuevas (impresión nativa del navegador).
- La pantalla de Resumen se ve igual tras extraer el cuerpo a `ResumenArea`.
- La nav ya tiene `print:hidden` (no se toca).
- No cambian métricas (`dominio/metricas.ts`, `dominio/resumen.ts`) ni otras pantallas.
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` sin errores.
- Spec: `docs/superpowers/specs/2026-06-19-exportar-resumen-design.md`.

## File Structure

- `src/app/resumen/resumen-area.tsx` — NUEVO. Cuerpo del informe (compute + render).
- `src/app/resumen/page.tsx` — MODIFICAR. Usar `ResumenArea`; (Task 2) botones de exportar.
- `src/app/_componentes/auto-imprimir.tsx` — NUEVO (movido desde programar/exportar).
- `src/app/programar/exportar/page.tsx` — MODIFICAR. Import de `AutoImprimir` desde la nueva ruta.
- `src/app/programar/exportar/auto-imprimir.tsx` — ELIMINAR (movido).
- `src/app/resumen/exportar/page.tsx` — NUEVO (server, modos área/todas).

---

## Task 1: Extraer `ResumenArea` y usarlo en Resumen (sin cambio visible)

**Files:**
- Create: `src/app/resumen/resumen-area.tsx`
- Modify: `src/app/resumen/page.tsx`

**Interfaces:**
- Produces: `ResumenArea({ areaNombre: string; semana: number; anio: number; esMaquinaria: boolean; actividades: ActividadResumen[]; responsables: {id:string;nombre:string}[]; motivos: {id:string;nombre:string}[] })`. `ActividadResumen` es estructural; lo que devuelve `listarActividades` lo cumple.

- [ ] **Step 1: Crear `ResumenArea`**

Crear `src/app/resumen/resumen-area.tsx` con exactamente:

```tsx
import { porcentajeCumplimiento, porcentajeReprogramadas, motivosFrecuentes, colorSemaforo } from '@/dominio/metricas'
import {
  colorPorcentaje,
  actividadesConCambio,
  extremosFinalizadas,
  conteoPorEstado,
  hectareasTrabajadasYFaltantes,
} from '@/dominio/resumen'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'

const ESTADOS_ORDEN = [
  { v: 'CUMPLIDA', etq: '✅ Cumplidas' },
  { v: 'PARCIAL', etq: '🟡 Parciales' },
  { v: 'NO_CUMPLIDA', etq: '🔴 No cumplidas' },
  { v: 'REPROGRAMADA', etq: '🔄 Reprogramadas' },
  { v: 'PENDIENTE', etq: '⏳ Pendientes' },
]

const COLOR_HEX: Record<string, string> = {
  gris: '#9ca3af',
  verde: '#2e9e5b',
  amarillo: '#e8b400',
  naranja: '#e8771a',
  rojo: '#d63b3b',
  ninguno: 'transparent',
}

type ActividadResumen = {
  id: string
  estado: string
  descripcion: string
  vecesReprogramada: number
  haFaltante: number | null
  lotes: { nombre: string; hectareas: number | null }[]
  maquina: { nombre: string } | null
  responsable: { nombre: string }
  motivo: { nombre: string } | null
}

export function ResumenArea({
  areaNombre,
  semana,
  anio,
  esMaquinaria,
  actividades,
  responsables,
  motivos,
}: {
  areaNombre: string
  semana: number
  anio: number
  esMaquinaria: boolean
  actividades: ActividadResumen[]
  responsables: { id: string; nombre: string }[]
  motivos: { id: string; nombre: string }[]
}) {
  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const pctRep = porcentajeReprogramadas(dominio)
  const conteo = conteoPorEstado(dominio)
  const { mas, menos } = extremosFinalizadas(dominio)
  const motivosTop = motivosFrecuentes(dominio)
  const cambios = actividadesConCambio(dominio) as unknown as ActividadResumen[]

  const nombrePorId = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombreResp = (id: string) => nombrePorId.get(id) ?? 'Responsable'
  const nombreMotivo = new Map(motivos.map((m) => [m.id, m.nombre]))

  const haActividad = (a: ActividadResumen) => a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)
  const ha = hectareasTrabajadasYFaltantes(
    actividades.map((a) => ({ estado: a.estado, haProgramada: haActividad(a), haFaltante: a.haFaltante ?? 0 })),
  )

  const haPorActividad = new Map<string, number>()
  for (const a of actividades) {
    if (a.estado === 'PENDIENTE') continue
    const realizada = Math.max(0, haActividad(a) - (a.haFaltante ?? 0))
    haPorActividad.set(a.descripcion, (haPorActividad.get(a.descripcion) ?? 0) + realizada)
  }
  const haActividadLista = [...haPorActividad.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="text-gray-900">
      <div className="mb-4 border-b pb-2">
        <div className="text-lg font-bold text-[#11603a]">Resumen — {areaNombre}</div>
        <div className="text-sm text-gray-500">Semana {semana} · {anio}</div>
      </div>

      {/* Tarjetas grandes */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Cumplimiento</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[colorPorcentaje(pct)] }}>
            {pct === null ? '—' : `${pct}%`}
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Cumplidas</div>
          <div className="text-4xl font-extrabold">
            {conteo.CUMPLIDA}<span className="text-2xl font-semibold text-gray-400">/{actividades.length}</span>
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Reprogramadas</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[pctRep > 0 ? 'naranja' : 'verde'] }}>{pctRep}%</div>
        </div>
        {esMaquinaria && (
          <div className="rounded-2xl border p-5">
            <div className="mb-1 text-sm text-gray-500">Hectáreas</div>
            <div className="text-2xl font-extrabold text-[#2e9e5b]">{ha.trabajadas} ha <span className="text-sm font-medium text-gray-500">trabajadas</span></div>
            <div className="text-2xl font-extrabold text-[#e8771a]">{ha.faltantes} ha <span className="text-sm font-medium text-gray-500">faltantes</span></div>
          </div>
        )}
      </div>

      {/* Detalle por estado */}
      <h2 className="mb-2 text-lg font-semibold">📊 Detalle por estado</h2>
      <div className="mb-8 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-green-50 px-3 py-1">✅ Cumplidas: <b>{conteo.CUMPLIDA}</b></span>
        <span className="rounded-full bg-yellow-50 px-3 py-1">🟡 Parciales: <b>{conteo.PARCIAL}</b></span>
        <span className="rounded-full bg-red-50 px-3 py-1">🔴 No cumplidas: <b>{conteo.NO_CUMPLIDA}</b></span>
        <span className="rounded-full bg-blue-50 px-3 py-1">🔄 Reprogramadas: <b>{conteo.REPROGRAMADA}</b></span>
        <span className="rounded-full bg-gray-100 px-3 py-1">⏳ Pendientes: <b>{conteo.PENDIENTE}</b></span>
      </div>

      <div className="mb-8 space-y-3">
        {ESTADOS_ORDEN.map(({ v, etq }) => {
          const acts = actividades.filter((a) => a.estado === v)
          if (acts.length === 0) return null
          const grupos = new Map<string, { descripcion: string; lotes: string[]; maquinas: Set<string>; conteo: number }>()
          for (const a of acts) {
            const lotesNombres = a.lotes.map((l) => l.nombre).sort()
            const clave = `${a.descripcion}|${lotesNombres.join(',')}`
            const g = grupos.get(clave) ?? { descripcion: a.descripcion, lotes: lotesNombres, maquinas: new Set<string>(), conteo: 0 }
            g.conteo += 1
            if (a.maquina) g.maquinas.add(a.maquina.nombre)
            grupos.set(clave, g)
          }
          const items = [...grupos.values()]
          return (
            <div key={v}>
              <div className="text-sm font-semibold">{etq} ({items.length})</div>
              <ul className="ml-4 list-disc text-sm text-gray-600">
                {items.map((g, i) => (
                  <li key={i}>
                    {g.descripcion}
                    {g.conteo > 1 ? ` ·×${g.conteo}` : ''}
                    {g.maquinas.size > 0 ? ` · 🚜 ${[...g.maquinas].join(', ')}` : ''}
                    {g.lotes.length > 0 ? ` · 📍 ${g.lotes.join(', ')}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Ranking simple */}
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">⭐ Ranking (finalizadas)</h2>
          {mas ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>🥇</span>
                <span className="flex-1">Quien más finalizó: <b>{nombreResp(mas.responsableId)}</b></span>
                <span className="font-bold">{mas.finalizadas}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🔻</span>
                <span className="flex-1">Quien menos finalizó: <b>{menos ? nombreResp(menos.responsableId) : '—'}</b></span>
                <span className="font-bold">{menos ? menos.finalizadas : ''}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Sin actividades esta semana.</p>
          )}
        </div>

        {/* Motivos */}
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">⚠️ Motivos más frecuentes</h2>
          {motivosTop.length === 0 ? (
            <p className="text-sm text-gray-500">Sin motivos registrados.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {motivosTop.map((m) => (
                <li key={m.motivoId} className="flex justify-between">
                  <span>{nombreMotivo.get(m.motivoId) ?? 'Motivo'}</span>
                  <b>{m.conteo}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {esMaquinaria && haActividadLista.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">🚜 Hectáreas realizadas por actividad</h2>
          <ul className="space-y-1 text-sm">
            {haActividadLista.map(([desc, haRealizada]) => (
              <li key={desc} className="flex justify-between rounded border px-3 py-1">
                <span>{desc}</span>
                <b>{(Math.round(haRealizada * 10) / 10)} ha</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cambios / reprogramadas */}
      <h2 className="mb-2 text-lg font-semibold">🔄 Actividades cambiadas o reprogramadas</h2>
      {cambios.length === 0 ? (
        <p className="text-sm text-gray-500">Ninguna actividad cambió esta semana. 🎉</p>
      ) : (
        <ul className="space-y-2">
          {cambios.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <span className="flex-1">
                {a.descripcion}
                <span className="text-gray-500"> · {a.responsable.nombre}</span>
                {a.motivo && <span className="text-gray-500"> · {a.motivo.nombre}</span>}
              </span>
              {a.vecesReprogramada > 0 && (
                <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: COLOR_HEX[colorSemaforo(a.vecesReprogramada)] }}>
                  {a.vecesReprogramada}×
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Usar `ResumenArea` en `page.tsx` (reemplazo del cuerpo)**

Reescribir `src/app/resumen/page.tsx` con exactamente:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarResponsablesPorArea, listarMotivos, listarActividades } from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual } from '@/dominio/semana'
import { ResumenArea } from './resumen-area'

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; anio?: string; semana?: string }>
}) {
  const sp = await searchParams
  const areas = await listarAreas()
  if (areas.length === 0) {
    return (
      <main className="p-8">
        <p className="text-gray-600">No hay áreas. Corre <code>npm run db:seed</code>.</p>
      </main>
    )
  }

  const u = await usuarioActual()
  if (!u) redirect('/login')
  const esAdmin = u.rol === 'ADMIN'

  const areaId = esAdmin
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
  const areaActual = areas.find((a) => a.id === areaId)!
  const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana

  const [responsables, motivos, actividades] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarMotivos(),
    listarActividades(areaId, anio, semana),
  ])

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/resumen?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Resumen semanal</h1>

      {esAdmin ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {areas.map((a) => (
            <Link
              key={a.id}
              href={url(a.id, anio, semana)}
              className={`rounded-full px-3 py-1 text-sm ${a.id === areaId ? 'bg-[#11603a] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {a.nombre}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-3 text-sm text-gray-500">Área: <b className="text-gray-800">{areaActual.nombre}</b></div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">← Semana {previa.semana}</Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">Semana {proxima.semana} →</Link>
      </div>

      <ResumenArea
        areaNombre={areaActual.nombre}
        semana={semana}
        anio={anio}
        esMaquinaria={esMaquinaria}
        actividades={actividades}
        responsables={responsables}
        motivos={motivos}
      />
    </main>
  )
}
```

- [ ] **Step 3: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

Como cualquier usuario con datos (ej. `maquinaria`/`clave123`) en Resumen: la pantalla se ve igual que antes (KPIs, detalle por estado, ranking, motivos, hectáreas, cambios), ahora con un encabezado "Resumen — <área> · Semana N · año" arriba del informe.

- [ ] **Step 5: Commit**

```bash
git add src/app/resumen/resumen-area.tsx src/app/resumen/page.tsx
git commit -m "refactor(resumen): extraer ResumenArea (cuerpo del informe reutilizable)"
```

---

## Task 2: Vista de exportación PDF + botones + AutoImprimir compartido

**Files:**
- Create: `src/app/_componentes/auto-imprimir.tsx`
- Delete: `src/app/programar/exportar/auto-imprimir.tsx`
- Modify: `src/app/programar/exportar/page.tsx` (import de AutoImprimir)
- Create: `src/app/resumen/exportar/page.tsx`
- Modify: `src/app/resumen/page.tsx` (botones de exportar)

**Interfaces:**
- Consumes: `ResumenArea` (Task 1); `AutoImprimir` (compartido); `listarAreas`, `listarResponsablesPorArea`, `listarMotivos`, `listarActividades`; `semanaActual`/`fechasDeSemana` no necesarias aquí; `usuarioActual`.
- Produces: `AutoImprimir()` en `@/app/_componentes/auto-imprimir`; ruta `/resumen/exportar?area=&anio=&semana=` y `?todas=1&anio=&semana=`.

- [ ] **Step 1: Mover `AutoImprimir` a componente compartido**

Crear `src/app/_componentes/auto-imprimir.tsx` con exactamente:

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

Borrar el archivo viejo:

Run: `git rm src/app/programar/exportar/auto-imprimir.tsx`

- [ ] **Step 2: Actualizar el import en `programar/exportar/page.tsx`**

En `src/app/programar/exportar/page.tsx`, cambiar:

```tsx
import { AutoImprimir } from './auto-imprimir'
```
por:
```tsx
import { AutoImprimir } from '../../_componentes/auto-imprimir'
```

- [ ] **Step 3: Crear la ruta de exportación del resumen**

Crear `src/app/resumen/exportar/page.tsx` con exactamente:

```tsx
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarResponsablesPorArea, listarMotivos, listarActividades } from '@/datos/repositorio'
import { semanaActual } from '@/dominio/semana'
import { ResumenArea } from '../resumen-area'
import { AutoImprimir } from '../../_componentes/auto-imprimir'

export default async function ExportarResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; anio?: string; semana?: string; todas?: string }>
}) {
  const u = await usuarioActual()
  if (!u) redirect('/login')

  const sp = await searchParams
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana

  const areas = await listarAreas()
  const esMaquinaria = (nombre: string) => nombre.toLowerCase().includes('maquinaria')

  // Modo "todas las áreas": solo ADMIN.
  if (sp.todas === '1') {
    if (u.rol !== 'ADMIN') redirect('/resumen')
    const datos = await Promise.all(
      areas.map(async (a) => ({
        area: a,
        responsables: await listarResponsablesPorArea(a.id),
        motivos: await listarMotivos(),
        actividades: await listarActividades(a.id, anio, semana),
      })),
    )
    return (
      <main className="mx-auto max-w-6xl p-6">
        <AutoImprimir />
        <h1 className="mb-4 text-2xl font-bold text-[#11603a] print:hidden">Resumen — todas las áreas · Semana {semana}</h1>
        <div className="space-y-8">
          {datos.map(({ area, responsables, motivos, actividades }, i) => (
            <div key={area.id} style={i < datos.length - 1 ? { breakAfter: 'page' } : undefined}>
              <ResumenArea
                areaNombre={area.nombre}
                semana={semana}
                anio={anio}
                esMaquinaria={esMaquinaria(area.nombre)}
                actividades={actividades}
                responsables={responsables}
                motivos={motivos}
              />
            </div>
          ))}
        </div>
      </main>
    )
  }

  // Modo un área: ADMIN cualquier área válida; usuario de área queda forzado a la suya.
  const areaId = u.rol === 'ADMIN'
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0]?.id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0]?.id)
  const area = areas.find((a) => a.id === areaId)
  if (!area) redirect('/resumen')

  const [responsables, motivos, actividades] = await Promise.all([
    listarResponsablesPorArea(area.id),
    listarMotivos(),
    listarActividades(area.id, anio, semana),
  ])

  return (
    <main className="mx-auto max-w-6xl p-6">
      <AutoImprimir />
      <ResumenArea
        areaNombre={area.nombre}
        semana={semana}
        anio={anio}
        esMaquinaria={esMaquinaria(area.nombre)}
        actividades={actividades}
        responsables={responsables}
        motivos={motivos}
      />
    </main>
  )
}
```

- [ ] **Step 4: Agregar los botones de exportar en `resumen/page.tsx`**

En `src/app/resumen/page.tsx`, reemplazar el bloque de navegación de semana:

```tsx
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">← Semana {previa.semana}</Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">Semana {proxima.semana} →</Link>
      </div>
```

por:

```tsx
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">← Semana {previa.semana}</Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">Semana {proxima.semana} →</Link>
        <a
          href={`/resumen/exportar?area=${areaId}&anio=${anio}&semana=${semana}`}
          target="_blank"
          rel="noopener"
          className="rounded border border-purple-700 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-50"
        >
          🖨️ Exportar PDF
        </a>
        {esAdmin && (
          <a
            href={`/resumen/exportar?todas=1&anio=${anio}&semana=${semana}`}
            target="_blank"
            rel="noopener"
            className="rounded border border-purple-700 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-50"
          >
            🖨️ Exportar PDF (todas las áreas)
          </a>
        )}
      </div>
```

- [ ] **Step 5: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Verificación manual**

- Como `maquinaria`/`clave123` en Resumen: "🖨️ Exportar PDF" abre `/resumen/exportar` con el informe de su área/semana y el diálogo de impresión; la nav no sale en el PDF.
- Como `admin`/`clave123`: aparece además "🖨️ Exportar PDF (todas las áreas)"; abre la vista con cada área en su propia página.
- Como usuario de área entrando manualmente a `/resumen/exportar?area=<otra área>`: ve el informe de SU área (no la otra). Entrando a `/resumen/exportar?todas=1`: redirige a `/resumen`.
- El PDF del cronograma (`/programar/exportar`) sigue funcionando (AutoImprimir movido).

- [ ] **Step 7: Commit**

```bash
git add src/app/_componentes/auto-imprimir.tsx src/app/programar/exportar/page.tsx src/app/resumen/exportar/page.tsx src/app/resumen/page.tsx
git commit -m "feat(resumen): exportar PDF del área y de todas las áreas (admin); AutoImprimir compartido"
```

---

## Self-Review (autor del plan)

- **Cobertura del spec:** `ResumenArea` reutilizable con compute+render (Task 1) ✓; botón "Exportar PDF" área actual para todos (Task 2) ✓; botón "todas las áreas" solo admin (Task 2) ✓; ruta con modos área/todas, control de acceso (área propia / admin), redirect de no-admin en `todas` (Task 2) ✓; AutoImprimir compartido + programar actualizado (Task 2) ✓; nav `print:hidden` ya existente (sin cambio) ✓; métricas sin cambios ✓.
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos:** `ResumenArea` recibe los mismos props en `resumen/page.tsx` y en la ruta de exportación; `ActividadResumen` es estructural y lo cumple lo que devuelve `listarActividades` (incluye `estado`, `descripcion`, `vecesReprogramada`, `haFaltante`, `lotes`, `maquina`, `responsable`, `motivo`); los `as unknown as ActividadDominio[]` replican el patrón ya usado en la página original; `AutoImprimir` mismo nombre en ambas rutas; los enlaces de exportar usan los parámetros (`area`/`todas`/`anio`/`semana`) que la ruta parsea.
- **Nota de ejecución:** sin cambios de esquema Prisma → no hace falta reiniciar el dev server.

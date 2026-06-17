# Cronograma — Plan 4: Resumen Semanal + Ranking ⭐

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la pantalla "Resumen semanal": número grande de % cumplido (con color semáforo), % de reprogramadas, ranking de responsables (top 3 y 3 más bajos, con estrellas), y la lista de actividades cambiadas/reprogramadas con su motivo y semáforo por veces reprogramada.

**Architecture:** Server Component que lee del repositorio y usa las funciones puras de métricas del Plan 1 (`porcentajeCumplimiento`, `porcentajeReprogramadas`, `rankingResponsables`, `colorSemaforo`) más dos ayudantes nuevos (`colorPorcentaje`, `actividadesConCambio`) testeados. Sin nuevas escrituras (pantalla de solo lectura).

**Tech Stack:** Next.js 16 · TypeScript · Tailwind v4 · Prisma 6 · Vitest.

**Estrategia de pruebas:** Vitest cubre los dos ayudantes puros nuevos. La pantalla se verifica con build + corriendo la app.

---

## Estructura de archivos (Plan 4)

- Create: `src/dominio/resumen.ts` — `colorPorcentaje` + `actividadesConCambio` (puros).
- Create: `src/dominio/resumen.test.ts` — tests.
- Modify: `src/app/_componentes/nav-principal.tsx` — agregar enlace "Resumen".
- Create: `src/app/resumen/page.tsx` — pantalla "Resumen semanal".

---

## Task 1: Ayudantes de resumen (puros, TDD)

**Files:**
- Create: `src/dominio/resumen.ts`
- Create: `src/dominio/resumen.test.ts`

Reglas:
- `colorPorcentaje(pct)`: `null`→'gris'; ≥80→'verde'; ≥60→'amarillo'; resto→'rojo'.
- `actividadesConCambio(actividades)`: filtra las que están en PARCIAL, NO_CUMPLIDA o REPROGRAMADA (las que "cambiaron"), ordenadas por `vecesReprogramada` descendente y luego por `dia` ascendente. No muta el arreglo de entrada.

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/dominio/resumen.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { colorPorcentaje, actividadesConCambio } from './resumen'
import type { Actividad } from './tipos'

function act(parcial: Partial<Actividad>): Actividad {
  return {
    id: 'x', anio: 2026, semana: 25, dia: 1,
    areaId: 'a', fincaId: 'f', responsableId: 'r',
    descripcion: '', turno: '', estado: 'PENDIENTE',
    motivoId: null, nota: null, vecesReprogramada: 0, origenId: null,
    maquinaId: null, areaTareaId: null, horas: null, hectareas: null, planB: null,
    ...parcial,
  }
}

describe('colorPorcentaje', () => {
  it('asigna color por umbrales', () => {
    expect(colorPorcentaje(null)).toBe('gris')
    expect(colorPorcentaje(95)).toBe('verde')
    expect(colorPorcentaje(80)).toBe('verde')
    expect(colorPorcentaje(79)).toBe('amarillo')
    expect(colorPorcentaje(60)).toBe('amarillo')
    expect(colorPorcentaje(59)).toBe('rojo')
    expect(colorPorcentaje(0)).toBe('rojo')
  })
})

describe('actividadesConCambio', () => {
  it('incluye solo PARCIAL / NO_CUMPLIDA / REPROGRAMADA, ordenadas por veces reprogramada desc y luego día asc', () => {
    const acts = [
      act({ id: '1', estado: 'CUMPLIDA' }),
      act({ id: '2', estado: 'PENDIENTE' }),
      act({ id: '3', estado: 'PARCIAL', vecesReprogramada: 0, dia: 5 }),
      act({ id: '4', estado: 'NO_CUMPLIDA', vecesReprogramada: 2, dia: 1 }),
      act({ id: '5', estado: 'REPROGRAMADA', vecesReprogramada: 1, dia: 3 }),
    ]
    const r = actividadesConCambio(acts)
    expect(r.map((a) => a.id)).toEqual(['4', '5', '3'])
  })

  it('no muta el arreglo de entrada', () => {
    const acts = [act({ id: 'a', estado: 'NO_CUMPLIDA' }), act({ id: 'b', estado: 'CUMPLIDA' })]
    const copia = [...acts]
    actividadesConCambio(acts)
    expect(acts).toEqual(copia)
  })
})
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL (no se exporta `colorPorcentaje`).

- [ ] **Step 3: Implementar**

Create `src/dominio/resumen.ts`:
```typescript
import type { Actividad } from './tipos'

export type ColorPorcentaje = 'gris' | 'verde' | 'amarillo' | 'rojo'

// Color semáforo para un % de cumplimiento (número grande / barras).
export function colorPorcentaje(pct: number | null): ColorPorcentaje {
  if (pct === null) return 'gris'
  if (pct >= 80) return 'verde'
  if (pct >= 60) return 'amarillo'
  return 'rojo'
}

const ESTADOS_CON_CAMBIO = ['PARCIAL', 'NO_CUMPLIDA', 'REPROGRAMADA']

// Actividades que "cambiaron" en la semana (no cumplidas del todo o reprogramadas),
// ordenadas por veces reprogramada (desc) y luego por día (asc). No muta la entrada.
export function actividadesConCambio(actividades: Actividad[]): Actividad[] {
  return actividades
    .filter((a) => ESTADOS_CON_CAMBIO.includes(a.estado))
    .sort((a, b) => b.vecesReprogramada - a.vecesReprogramada || a.dia - b.dia)
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `npm test`
Expected: PASS (todos los anteriores + los nuevos de resumen).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/resumen.ts src/dominio/resumen.test.ts
git commit -m "feat: ayudantes de resumen colorPorcentaje y actividadesConCambio (TDD)"
```

---

## Task 2: Enlace "Resumen" en la navegación

**Files:**
- Modify: `src/app/_componentes/nav-principal.tsx`

- [ ] **Step 1: Agregar el enlace**

En `src/app/_componentes/nav-principal.tsx`, dentro del `<nav>`, agregar un tercer enlace después del de Cumplimiento. El bloque `<nav>` debe quedar así:
```tsx
        <nav className="flex gap-4 text-sm">
          <Link href="/programar" className="hover:underline">Programar</Link>
          <Link href="/cumplimiento" className="hover:underline">Cumplimiento</Link>
          <Link href="/resumen" className="hover:underline">Resumen</Link>
        </nav>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 3: Commit**

```bash
git add src/app/_componentes/nav-principal.tsx
git commit -m "feat: enlace Resumen en la navegación"
```

---

## Task 3: Pantalla "Resumen semanal"

**Files:**
- Create: `src/app/resumen/page.tsx`

- [ ] **Step 1: Crear la página**

Create `src/app/resumen/page.tsx`:
```tsx
import Link from 'next/link'
import {
  listarAreas,
  listarResponsablesPorArea,
  listarActividades,
} from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual } from '@/dominio/semana'
import { porcentajeCumplimiento, porcentajeReprogramadas, rankingResponsables, colorSemaforo } from '@/dominio/metricas'
import { colorPorcentaje, actividadesConCambio } from '@/dominio/resumen'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const COLOR_HEX: Record<string, string> = {
  gris: '#9ca3af',
  verde: '#2e9e5b',
  amarillo: '#e8b400',
  naranja: '#e8771a',
  rojo: '#d63b3b',
  ninguno: 'transparent',
}

function estrellasTexto(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))
}

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

  const areaId = sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana

  const [responsables, actividades] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarActividades(areaId, anio, semana),
  ])

  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const pctRep = porcentajeReprogramadas(dominio)
  const { top, bajos } = rankingResponsables(dominio)
  const cambios = actividadesConCambio(dominio) as unknown as typeof actividades

  const nombrePorId = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombre = (id: string) => nombrePorId.get(id) ?? 'Responsable'
  const cumplidas = dominio.filter((a) => a.estado === 'CUMPLIDA').length

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/resumen?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Resumen semanal</h1>

      <div className="mb-3 flex flex-wrap gap-2">
        {areas.map((a) => (
          <Link
            key={a.id}
            href={url(a.id, anio, semana)}
            className={`rounded-full px-3 py-1 text-sm ${
              a.id === areaId ? 'bg-[#11603a] text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {a.nombre}
          </Link>
        ))}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">
          ← Semana {previa.semana}
        </Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">
          Semana {proxima.semana} →
        </Link>
      </div>

      {/* Tarjetas grandes */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Cumplimiento del área</div>
          <div className="text-5xl font-extrabold" style={{ color: COLOR_HEX[colorPorcentaje(pct)] }}>
            {pct === null ? '—' : `${pct}%`}
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Actividades cumplidas</div>
          <div className="text-5xl font-extrabold">
            {cumplidas}
            <span className="text-2xl font-semibold text-gray-400">/{actividades.length}</span>
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Reprogramadas</div>
          <div className="text-5xl font-extrabold" style={{ color: COLOR_HEX[pctRep > 0 ? 'naranja' : 'verde'] }}>
            {pctRep}%
          </div>
        </div>
      </div>

      {/* Ranking */}
      <h2 className="mb-2 text-lg font-semibold">⭐ Ranking de responsables</h2>
      {top.length === 0 ? (
        <p className="mb-8 text-sm text-gray-500">Aún no hay actividades evaluadas esta semana.</p>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="mb-2 text-sm font-semibold text-[#2e9e5b]">TOP 3</div>
            <ul className="space-y-2">
              {top.map((f, i) => (
                <li key={f.responsableId} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#11603a] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium">{nombre(f.responsableId)}</span>
                  <span className="text-[#f5b50a]">{estrellasTexto(f.estrellas)}</span>
                  <span className="w-12 text-right font-bold">{f.porcentaje}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border p-4">
            <div className="mb-2 text-sm font-semibold text-[#d63b3b]">3 MÁS BAJOS</div>
            {bajos.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos suficientes.</p>
            ) : (
              <ul className="space-y-2">
                {bajos.map((f) => (
                  <li key={f.responsableId} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d63b3b] text-xs font-bold text-white">
                      ↓
                    </span>
                    <span className="flex-1 font-medium">{nombre(f.responsableId)}</span>
                    <span className="text-[#f5b50a]">{estrellasTexto(f.estrellas)}</span>
                    <span className="w-12 text-right font-bold">{f.porcentaje}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
              <span className="font-semibold">{DIAS[a.dia] ?? ''}</span>
              <span className="flex-1">
                {a.descripcion}
                <span className="text-gray-500"> · {a.responsable.nombre}</span>
                {a.motivo && <span className="text-gray-500"> · {a.motivo.nombre}</span>}
              </span>
              {a.vecesReprogramada > 0 && (
                <span
                  className="rounded px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: COLOR_HEX[colorSemaforo(a.vecesReprogramada)] }}
                >
                  {a.vecesReprogramada}×
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: "Compiled successfully", sin errores de tipos. Si falla, leer el error y corregir mínimamente (manteniendo estructura/comportamiento) y reportar el ajuste.

- [ ] **Step 3: Commit**

```bash
git add src/app/resumen/page.tsx
git commit -m "feat: pantalla Resumen semanal (números grandes, ranking, cambios)"
```

---

## Task 4: Verificación funcional

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: PASS (incluye `resumen`).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 3: Datos y servidor**

Run: `npm run db:seed`.
Levantar `npm run dev` en segundo plano y verificar:
```bash
curl -s "http://localhost:3000/resumen" | grep -i "Resumen semanal"
```
Expected: contiene "Resumen semanal". Detener el servidor al terminar.

- [ ] **Step 4: Prueba con datos (recomendada con la skill `verify`)**

En el navegador: en **Programar** crear 2–3 actividades en la semana actual; en **Cumplimiento** marcar una Cumplida, otra No cumplida (con motivo), otra Parcial; ir a **Resumen** y confirmar que el % grande, el conteo cumplidas/total, el ranking y la lista de cambios se ven correctos.

---

## Verificación final del Plan 4

- [ ] `npm test` → PASS (incluye `colorPorcentaje` y `actividadesConCambio`).
- [ ] `npm run build` → "Compiled successfully".
- [ ] `/resumen` responde y muestra: % cumplido grande con color, conteo cumplidas/total, % reprogramadas, ranking (top 3 / 3 más bajos con estrellas) y lista de cambios con motivo y semáforo.
- [ ] La barra superior incluye **Resumen**.

Al terminar este plan, el coordinador tiene su vista semanal "de un vistazo". El Plan 5 construye el **Tablero mensual** (cumplimiento por área, tendencia semana a semana, motivos frecuentes).

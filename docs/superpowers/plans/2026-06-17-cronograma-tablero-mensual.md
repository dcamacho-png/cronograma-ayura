# Cronograma — Plan 5: Tablero Mensual 📊

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el "Tablero mensual": % de cumplimiento por área (barras con color semáforo), tendencia semana a semana (barras por semana del mes), motivos más frecuentes, y % de reprogramadas del mes. Vista de solo lectura, comparando todas las áreas.

**Architecture:** Server Component que toma un año + mes, calcula las semanas ISO de ese mes (`semanasDelMes`), trae todas las actividades de esas semanas (todas las áreas) y usa las métricas puras (`cumplimientoPorArea`, `tendenciaSemanal`, `porcentajeCumplimiento`, `porcentajeReprogramadas`, `colorPorcentaje`) más un ayudante nuevo (`motivosFrecuentes`).

**Tech Stack:** Next.js 16 · TypeScript · Tailwind v4 · Prisma 6 · Vitest.

**Estrategia de pruebas:** Vitest cubre los ayudantes puros nuevos (`semanasDelMes`, `motivosFrecuentes`). El repositorio y la pantalla se verifican con build + corriendo la app.

**Definición de "mes":** un mes contiene las semanas ISO cuyo **jueves** cae en ese mes calendario (regla ISO estándar: cada semana pertenece a exactamente un mes, sin solapamiento). Las actividades se guardan por (año, semana ISO), así que el tablero consulta exactamente esas semanas.

---

## Estructura de archivos (Plan 5)

- Modify: `src/dominio/semana.ts` — agregar `semanasDelMes` y `mesActual`.
- Modify: `src/dominio/semana.test.ts` — tests de `semanasDelMes`.
- Modify: `src/dominio/metricas.ts` — agregar `motivosFrecuentes`.
- Modify: `src/dominio/metricas.test.ts` — tests de `motivosFrecuentes`.
- Modify: `src/datos/repositorio.ts` — agregar `listarActividadesDeSemanas`.
- Modify: `src/app/_componentes/nav-principal.tsx` — agregar enlace "Tablero".
- Create: `src/app/tablero/page.tsx` — pantalla "Tablero mensual".

---

## Task 1: `semanasDelMes` y `mesActual` (TDD)

**Files:**
- Modify: `src/dominio/semana.ts`
- Modify: `src/dominio/semana.test.ts`

Regla: `semanasDelMes(anio, mes)` (mes 1-12) devuelve las semanas ISO `{anio, semana}` cuyo jueves cae en ese mes, en orden ascendente. `mesActual()` devuelve el mes calendario actual (usa la fecha del sistema; no se prueba).

- [ ] **Step 1: Agregar los tests que fallan**

Agregar al final de `src/dominio/semana.test.ts`:
```typescript
import { semanasDelMes } from './semana'

describe('semanasDelMes', () => {
  it('junio 2026 = semanas ISO 23 a 26', () => {
    expect(semanasDelMes(2026, 6)).toEqual([
      { anio: 2026, semana: 23 },
      { anio: 2026, semana: 24 },
      { anio: 2026, semana: 25 },
      { anio: 2026, semana: 26 },
    ])
  })
  it('enero 2026 = semanas ISO 1 a 5', () => {
    expect(semanasDelMes(2026, 1)).toEqual([
      { anio: 2026, semana: 1 },
      { anio: 2026, semana: 2 },
      { anio: 2026, semana: 3 },
      { anio: 2026, semana: 4 },
      { anio: 2026, semana: 5 },
    ])
  })
})
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL (no se exporta `semanasDelMes`).

- [ ] **Step 3: Implementar**

Agregar al final de `src/dominio/semana.ts` (ya existe `isoSemanaDeFecha` y la interfaz `Semana` en este archivo):
```typescript
// Semanas ISO cuyo jueves cae en el mes calendario dado (mes: 1-12), en orden.
export function semanasDelMes(anio: number, mes: number): Semana[] {
  const resultado: Semana[] = []
  const vistas = new Set<string>()
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const fecha = new Date(Date.UTC(anio, mes - 1, dia))
    // Jueves de la semana de esta fecha.
    const diaLunes0 = (fecha.getUTCDay() + 6) % 7
    const jueves = new Date(fecha)
    jueves.setUTCDate(fecha.getUTCDate() - diaLunes0 + 3)
    if (jueves.getUTCFullYear() === anio && jueves.getUTCMonth() === mes - 1) {
      const s = isoSemanaDeFecha(fecha)
      const clave = `${s.anio}-${s.semana}`
      if (!vistas.has(clave)) {
        vistas.add(clave)
        resultado.push(s)
      }
    }
  }
  return resultado
}

// Mes calendario actual (usa la fecha del sistema; no determinista, por eso no se prueba).
export function mesActual(): { anio: number; mes: number } {
  const d = new Date()
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 }
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/semana.ts src/dominio/semana.test.ts
git commit -m "feat: semanasDelMes y mesActual (TDD)"
```

---

## Task 2: `motivosFrecuentes` (TDD)

**Files:**
- Modify: `src/dominio/metricas.ts`
- Modify: `src/dominio/metricas.test.ts`

Regla: cuenta cuántas actividades tienen cada `motivoId` (ignorando las que no tienen motivo), y devuelve `{ motivoId, conteo }[]` ordenado de mayor a menor conteo.

- [ ] **Step 1: Agregar los tests que fallan**

Agregar al final de `src/dominio/metricas.test.ts`:
```typescript
import { motivosFrecuentes } from './metricas'

describe('motivosFrecuentes', () => {
  it('cuenta por motivoId e ignora actividades sin motivo, ordenado desc', () => {
    const acts = [
      act({ motivoId: 'clima' }),
      act({ motivoId: 'clima' }),
      act({ motivoId: 'maquina' }),
      act({ motivoId: null }),
    ]
    expect(motivosFrecuentes(acts)).toEqual([
      { motivoId: 'clima', conteo: 2 },
      { motivoId: 'maquina', conteo: 1 },
    ])
  })
  it('devuelve lista vacía si no hay motivos', () => {
    expect(motivosFrecuentes([act({ motivoId: null })])).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL (no se exporta `motivosFrecuentes`).

- [ ] **Step 3: Implementar**

Agregar al final de `src/dominio/metricas.ts`:
```typescript
export interface ConteoMotivo {
  motivoId: string
  conteo: number
}

// Cuenta las actividades por motivo (ignora las que no tienen), de mayor a menor.
export function motivosFrecuentes(actividades: Actividad[]): ConteoMotivo[] {
  const conteo = new Map<string, number>()
  for (const a of actividades) {
    if (!a.motivoId) continue
    conteo.set(a.motivoId, (conteo.get(a.motivoId) ?? 0) + 1)
  }
  return [...conteo.entries()]
    .map(([motivoId, c]) => ({ motivoId, conteo: c }))
    .sort((a, b) => b.conteo - a.conteo)
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts
git commit -m "feat: motivosFrecuentes (TDD)"
```

---

## Task 3: Repositorio — actividades de varias semanas

**Files:**
- Modify: `src/datos/repositorio.ts`

- [ ] **Step 1: Agregar la función**

Agregar al final de `src/datos/repositorio.ts`:
```typescript
// Actividades de un conjunto de semanas (todas las áreas), para el tablero mensual.
export function listarActividadesDeSemanas(semanas: { anio: number; semana: number }[]) {
  if (semanas.length === 0) {
    return prisma.actividad.findMany({ where: { id: '' } }) // lista vacía
  }
  return prisma.actividad.findMany({
    where: { OR: semanas.map((s) => ({ anio: s.anio, semana: s.semana })) },
    include: { area: true, motivo: true },
    orderBy: [{ anio: 'asc' }, { semana: 'asc' }],
  })
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat: repositorio listarActividadesDeSemanas"
```

---

## Task 4: Enlace "Tablero" en la navegación

**Files:**
- Modify: `src/app/_componentes/nav-principal.tsx`

- [ ] **Step 1: Agregar el enlace**

Dentro del `<nav>`, agregar un cuarto enlace después de "Resumen". El bloque `<nav>` debe quedar así:
```tsx
        <nav className="flex gap-4 text-sm">
          <Link href="/programar" className="hover:underline">Programar</Link>
          <Link href="/cumplimiento" className="hover:underline">Cumplimiento</Link>
          <Link href="/resumen" className="hover:underline">Resumen</Link>
          <Link href="/tablero" className="hover:underline">Tablero</Link>
        </nav>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 3: Commit**

```bash
git add src/app/_componentes/nav-principal.tsx
git commit -m "feat: enlace Tablero en la navegación"
```

---

## Task 5: Pantalla "Tablero mensual"

**Files:**
- Create: `src/app/tablero/page.tsx`

- [ ] **Step 1: Crear la página**

Create `src/app/tablero/page.tsx`:
```tsx
import Link from 'next/link'
import { listarAreas, listarMotivos, listarActividadesDeSemanas } from '@/datos/repositorio'
import { semanasDelMes, mesActual } from '@/dominio/semana'
import {
  porcentajeCumplimiento,
  porcentajeReprogramadas,
  cumplimientoPorArea,
  tendenciaSemanal,
  motivosFrecuentes,
} from '@/dominio/metricas'
import { colorPorcentaje } from '@/dominio/resumen'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const COLOR_HEX: Record<string, string> = {
  gris: '#9ca3af',
  verde: '#2e9e5b',
  amarillo: '#e8b400',
  naranja: '#e8771a',
  rojo: '#d63b3b',
}

export default async function TableroPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>
}) {
  const sp = await searchParams
  const hoy = mesActual()
  const anioRaw = Number(sp.anio)
  const mesRaw = Number(sp.mes)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const mes = sp.mes && mesRaw >= 1 && mesRaw <= 12 ? mesRaw : hoy.mes

  const semanas = semanasDelMes(anio, mes)
  const [areas, motivos, actividades] = await Promise.all([
    listarAreas(),
    listarMotivos(),
    listarActividadesDeSemanas(semanas),
  ])

  const dominio = actividades as unknown as ActividadDominio[]
  const pctGeneral = porcentajeCumplimiento(dominio)
  const pctRep = porcentajeReprogramadas(dominio)
  const porArea = cumplimientoPorArea(dominio)
  const tendencia = tendenciaSemanal(dominio)
  const motivosTop = motivosFrecuentes(dominio)

  const pctPorAreaId = new Map(porArea.map((f) => [f.areaId, f.porcentaje]))
  const nombreMotivo = new Map(motivos.map((m) => [m.id, m.nombre]))
  const maxMotivo = motivosTop.reduce((m, x) => Math.max(m, x.conteo), 0)

  const previo = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
  const proximo = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
  const url = (an: number, me: number) => `/tablero?anio=${an}&mes=${me}`

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Tablero mensual</h1>

      <div className="mb-6 flex items-center gap-3">
        <Link href={url(previo.anio, previo.mes)} className="rounded border px-3 py-1 text-sm">← {MESES[previo.mes]}</Link>
        <span className="font-semibold">{MESES[mes]} · {anio}</span>
        <Link href={url(proximo.anio, proximo.mes)} className="rounded border px-3 py-1 text-sm">{MESES[proximo.mes]} →</Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Cumplimiento general del mes</div>
          <div className="text-5xl font-extrabold" style={{ color: COLOR_HEX[colorPorcentaje(pctGeneral)] }}>
            {pctGeneral === null ? '—' : `${pctGeneral}%`}
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Reprogramadas del mes</div>
          <div className="text-5xl font-extrabold" style={{ color: COLOR_HEX[pctRep > 0 ? 'naranja' : 'verde'] }}>
            {pctRep}%
          </div>
        </div>
      </div>

      {/* Cumplimiento por área */}
      <h2 className="mb-3 text-lg font-semibold">📊 Cumplimiento por área</h2>
      <div className="mb-8 space-y-3">
        {areas.map((a) => {
          const p = pctPorAreaId.get(a.id) ?? null
          return (
            <div key={a.id} className="flex items-center gap-3">
              <div className="w-40 text-sm font-medium">{a.nombre}</div>
              <div className="h-6 flex-1 overflow-hidden rounded bg-gray-100">
                <div
                  className="flex h-full items-center justify-end pr-2 text-xs font-bold text-white"
                  style={{ width: `${p ?? 0}%`, backgroundColor: COLOR_HEX[colorPorcentaje(p)] }}
                >
                  {p !== null && p >= 12 ? `${p}%` : ''}
                </div>
              </div>
              <div className="w-12 text-right text-sm font-semibold">{p === null ? '—' : `${p}%`}</div>
            </div>
          )
        })}
      </div>

      {/* Tendencia semana a semana */}
      <h2 className="mb-3 text-lg font-semibold">📈 Tendencia semana a semana</h2>
      {tendencia.length === 0 ? (
        <p className="mb-8 text-sm text-gray-500">No hay actividades evaluadas este mes.</p>
      ) : (
        <div className="mb-8 flex items-end gap-4 rounded-xl border p-4" style={{ height: '160px' }}>
          {tendencia.map((t) => (
            <div key={`${t.anio}-${t.semana}`} className="flex flex-1 flex-col items-center justify-end">
              <div className="mb-1 text-xs font-semibold">{t.porcentaje === null ? '—' : `${t.porcentaje}%`}</div>
              <div
                className="w-full rounded-t"
                style={{ height: `${t.porcentaje ?? 0}px`, backgroundColor: COLOR_HEX[colorPorcentaje(t.porcentaje)] }}
              />
              <div className="mt-1 text-xs text-gray-500">S{t.semana}</div>
            </div>
          ))}
        </div>
      )}

      {/* Motivos más frecuentes */}
      <h2 className="mb-3 text-lg font-semibold">⚠️ Motivos más frecuentes</h2>
      {motivosTop.length === 0 ? (
        <p className="text-sm text-gray-500">No se registraron motivos este mes.</p>
      ) : (
        <div className="space-y-2">
          {motivosTop.map((m) => (
            <div key={m.motivoId} className="flex items-center gap-3">
              <div className="w-40 text-sm">{nombreMotivo.get(m.motivoId) ?? 'Motivo'}</div>
              <div className="h-5 flex-1 overflow-hidden rounded bg-gray-100">
                <div
                  className="h-full rounded bg-gray-400"
                  style={{ width: `${maxMotivo > 0 ? (m.conteo / maxMotivo) * 100 : 0}%` }}
                />
              </div>
              <div className="w-8 text-right text-sm font-semibold">{m.conteo}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: "Compiled successfully", sin errores de tipos. Si falla, leer el error y corregir mínimamente (manteniendo estructura/comportamiento), reportando el ajuste.

- [ ] **Step 3: Commit**

```bash
git add src/app/tablero/page.tsx
git commit -m "feat: pantalla Tablero mensual (por área, tendencia, motivos)"
```

---

## Task 6: Verificación funcional

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: PASS (incluye `semanasDelMes` y `motivosFrecuentes`).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 3: Datos y servidor**

Run: `npm run db:seed`.
Levantar `npm run dev` en segundo plano y verificar:
```bash
curl -s "http://localhost:3000/tablero" | grep -i "Tablero mensual"
```
Expected: contiene "Tablero mensual". Detener el servidor al terminar.

- [ ] **Step 4: Prueba con datos (recomendada con la skill `verify`)**

En el navegador: con actividades de varias áreas marcadas en semanas del mes actual, abrir **Tablero** y confirmar que las barras por área, la tendencia por semana y los motivos se ven coherentes; navegar al mes anterior/siguiente.

---

## Verificación final del Plan 5

- [ ] `npm test` → PASS (incluye `semanasDelMes` y `motivosFrecuentes`).
- [ ] `npm run build` → "Compiled successfully".
- [ ] `/tablero` responde y muestra: % general del mes, % reprogramadas, barras por área con color, tendencia por semana y motivos frecuentes; navegación de mes.
- [ ] La barra superior incluye **Tablero**.

Al terminar este plan, el coordinador tiene la evaluación mensual visual. Solo queda el Plan 6: **login + despliegue** (Supabase + Vercel) para ponerla en la nube.

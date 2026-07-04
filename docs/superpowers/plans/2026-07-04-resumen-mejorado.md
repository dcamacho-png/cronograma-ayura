# /resumen mejorado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar `/resumen`: cuadros-resumen de conteo claros (sin % de reprogramadas), medidas de maquinaria desglosadas (5 totales por unidad + tabla tractor×unidad), y todas las listas de detalle bajo un único "Ver detalle" colapsable.

**Architecture:** Dos funciones nuevas de dominio puras y testeables en `src/dominio/resumen.ts` (`bultosAplicados`, `medidasPorTractor`); el componente `src/app/resumen/resumen-area.tsx` reordena las tarjetas, añade el bloque de medidas de maquinaria y envuelve las listas en un `<details>` nativo. Sin cambios de esquema.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Vitest.

## Global Constraints

- Ante dudas de API de Next, leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
- Vitest: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run`.
- SIN cambios de esquema Prisma. NO tocar el Excel de `/resumen/exportar`.
- Cuadros arriba (5, conteos): Cumplimiento % · Cumplidas (N/total) · No se hizo (N=NO_CUMPLIDA+REPROGRAMADA) · Reprogramadas (N conteo) · Nuevas no programadas (N). Sin "% reprogramadas".
- Maquinaria: 5 totales por unidad (orden: Horas, Bultos aplicados, Ha aplicadas, Kg (granel), Cantidad (estércoles); solo los que tengan dato) + tabla tractor×unidad (ha/hora/kg/cantidad; bultos NO por tractor). Bultos aplicados = suma de `bultosPorLote`.
- Todas las listas de detalle bajo un único `<details><summary>Ver detalle</summary>` colapsado (chips de conteo quedan visibles).
- Reutilizar estilos Tailwind existentes.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Dominio — `bultosAplicados` + `medidasPorTractor`

**Files:**
- Modify: `src/dominio/resumen.ts`
- Test: `src/dominio/resumen.test.ts`

**Interfaces:**
- Produces:
  - `bultosAplicados(filas: { estado: string; bultosPorLote: Record<string, number> | null }[]): number`
  - `medidasPorTractor(filas: { estado: string; unidad: Unidad; haProgramada: number; haRealizada: number | null; maquinaId: string | null; avances: { maquinaId: string | null; cantidad: number }[] }[]): Map<string, Record<Unidad, number>>` (clave = `maquinaId` o `''` para "sin tractor").

- [ ] **Step 1: Escribir los tests (fallan)**

Añadir al final de `src/dominio/resumen.test.ts`:

```ts
import { bultosAplicados, medidasPorTractor } from './resumen'
import type { Unidad } from './unidad'

describe('bultosAplicados', () => {
  it('suma los bultos por lote de las actividades no pendientes', () => {
    expect(bultosAplicados([
      { estado: 'CUMPLIDA', bultosPorLote: { l1: 3, l2: 2 } },
      { estado: 'PARCIAL', bultosPorLote: { l1: 5 } },
    ])).toBe(10)
  })
  it('ignora PENDIENTE y bultosPorLote nulo', () => {
    expect(bultosAplicados([
      { estado: 'PENDIENTE', bultosPorLote: { l1: 9 } },
      { estado: 'CUMPLIDA', bultosPorLote: null },
    ])).toBe(0)
  })
})

describe('medidasPorTractor', () => {
  const fila = (over: Partial<Parameters<typeof medidasPorTractor>[0][number]>) => ({
    estado: 'CUMPLIDA', unidad: 'ha' as Unidad, haProgramada: 0, haRealizada: null, maquinaId: null, avances: [], ...over,
  })
  it('atribuye cada avance a su tractor y unidad', () => {
    const m = medidasPorTractor([
      fila({ unidad: 'ha', avances: [{ maquinaId: 'A', cantidad: 3 }, { maquinaId: 'B', cantidad: 2 }] }),
    ])
    expect(m.get('A')).toEqual({ ha: 3, hora: 0, kg: 0, cantidad: 0 })
    expect(m.get('B')).toEqual({ ha: 2, hora: 0, kg: 0, cantidad: 0 })
  })
  it('sin avances usa haRealizada y el tractor de la actividad', () => {
    const m = medidasPorTractor([fila({ unidad: 'hora', haRealizada: 5, maquinaId: 'A' })])
    expect(m.get('A')).toEqual({ ha: 0, hora: 5, kg: 0, cantidad: 0 })
  })
  it('sin avances, unidad ha CUMPLIDA sin haRealizada usa haProgramada', () => {
    const m = medidasPorTractor([fila({ unidad: 'ha', haProgramada: 4, haRealizada: null, maquinaId: 'A' })])
    expect(m.get('A')).toEqual({ ha: 4, hora: 0, kg: 0, cantidad: 0 })
  })
  it('tractor nulo cae en la clave vacía', () => {
    const m = medidasPorTractor([fila({ unidad: 'kg', haRealizada: 7, maquinaId: null })])
    expect(m.get('')).toEqual({ ha: 0, hora: 0, kg: 7, cantidad: 0 })
  })
  it('ignora PENDIENTE', () => {
    const m = medidasPorTractor([fila({ estado: 'PENDIENTE', haRealizada: 9, maquinaId: 'A' })])
    expect(m.size).toBe(0)
  })
})
```

- [ ] **Step 2: Correr los tests → fallan**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run src/dominio/resumen.test.ts`
Expected: FAIL (no existen `bultosAplicados`/`medidasPorTractor`).

- [ ] **Step 3: Implementar en `resumen.ts`**

Añadir al final de `src/dominio/resumen.ts` (el archivo ya importa `type { Unidad }` y define `const r1`):

```ts
// Total de bultos aplicados del área: suma bultosPorLote de las actividades no pendientes.
// Recibe UNA fila por actividad-grupo (los bultos se comparten entre filas-hermanas).
export function bultosAplicados(
  filas: { estado: string; bultosPorLote: Record<string, number> | null }[],
): number {
  let total = 0
  for (const f of filas) {
    if (f.estado === 'PENDIENTE') continue
    if (!f.bultosPorLote) continue
    for (const n of Object.values(f.bultosPorLote)) total += n
  }
  return r1(total)
}

// Medida realizada por tractor y unidad. Recibe UNA fila por actividad-grupo. Si la
// actividad tiene avances, cada avance se atribuye a su `maquinaId` (o al de la actividad);
// si no, la medida (haRealizada, o haProgramada para ha CUMPLIDA) va al tractor de la
// actividad. Clave '' = "sin tractor".
export function medidasPorTractor(
  filas: {
    estado: string
    unidad: Unidad
    haProgramada: number
    haRealizada: number | null
    maquinaId: string | null
    avances: { maquinaId: string | null; cantidad: number }[]
  }[],
): Map<string, Record<Unidad, number>> {
  const out = new Map<string, Record<Unidad, number>>()
  const bucket = (id: string): Record<Unidad, number> => {
    let r = out.get(id)
    if (!r) { r = { ha: 0, hora: 0, kg: 0, cantidad: 0 }; out.set(id, r) }
    return r
  }
  for (const f of filas) {
    if (f.estado === 'PENDIENTE') continue
    if (f.avances.length > 0) {
      for (const av of f.avances) {
        if (!av.cantidad) continue
        bucket(av.maquinaId ?? f.maquinaId ?? '')[f.unidad] += av.cantidad
      }
    } else {
      const medida = f.haRealizada ?? (f.unidad === 'ha' && f.estado === 'CUMPLIDA' ? f.haProgramada : 0)
      if (medida) bucket(f.maquinaId ?? '')[f.unidad] += medida
    }
  }
  for (const r of out.values()) {
    for (const u of Object.keys(r) as Unidad[]) r[u] = r1(r[u])
  }
  return out
}
```

- [ ] **Step 4: Correr los tests → pasan**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run src/dominio/resumen.test.ts`
Expected: PASS (todos, incluidos los previos).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.

```bash
git add src/dominio/resumen.ts src/dominio/resumen.test.ts
git commit -m "feat(dominio): bultosAplicados + medidasPorTractor para el resumen

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Componente — cuadros de conteo + medidas de tractor + detalle colapsable

**Files:**
- Modify: `src/app/resumen/resumen-area.tsx` (reescritura completa)

**Interfaces:**
- Consumes: `bultosAplicados`, `medidasPorTractor` (Task 1); `medidasPorUnidad`, `colorPorcentaje`, `actividadesConCambio`, `finalizadasPorLabor` (existentes); `porcentajeCumplimiento`, `conteoEstadoActividades`, `agruparPorActividad`, `estadoActividad`, `motivosFrecuentes`, `colorSemaforo` (metricas); `normalizarAvancePorLote` (avance-lote); `unidadDe`, `unidadAbreviada` (unidad).

- [ ] **Step 1: Reescribir `src/app/resumen/resumen-area.tsx`**

Reemplazar TODO el contenido por:

```tsx
import { porcentajeCumplimiento, motivosFrecuentes, colorSemaforo, conteoEstadoActividades, agruparPorActividad, estadoActividad } from '@/dominio/metricas'
import {
  colorPorcentaje,
  actividadesConCambio,
  finalizadasPorLabor,
  medidasPorUnidad,
  medidasPorTractor,
  bultosAplicados,
} from '@/dominio/resumen'
import type { Actividad as ActividadDominio, Estado } from '@/dominio/tipos'
import { unidadDe, unidadAbreviada, type Unidad } from '@/dominio/unidad'
import { normalizarAvancePorLote, type AvanceEntrada } from '@/dominio/avance-lote'

const ESTADOS_ORDEN = [
  { v: ['CUMPLIDA'], etq: '✅ Cumplidas' },
  { v: ['PARCIAL'], etq: '🟡 Parciales' },
  { v: ['NO_CUMPLIDA', 'REPROGRAMADA'], etq: '🔴 No se hizo' },
  { v: ['PENDIENTE'], etq: '⏳ Pendientes' },
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
  tareaId: string | null
  estado: string
  descripcion: string
  vecesReprogramada: number
  haRealizada: number | null
  nota: string | null
  lotes: { nombre: string; hectareas: number | null }[]
  maquinaId: string | null
  maquina: { nombre: string } | null
  responsable: { nombre: string }
  motivo: { nombre: string } | null
  noProgramada: boolean
  // Campos JSON de Prisma: llegan como JsonValue, se castean al usarse (patrón del proyecto).
  avancePorLote: unknown
  bultosPorLote: unknown
}

export function ResumenArea({
  areaNombre,
  semana,
  anio,
  esMaquinaria,
  unidadPorNombre,
  actividades,
  responsables,
  motivos,
}: {
  areaNombre: string
  semana: number
  anio: number
  esMaquinaria: boolean
  unidadPorNombre: Record<string, string>
  actividades: ActividadResumen[]
  responsables: { id: string; nombre: string }[]
  motivos: { id: string; nombre: string }[]
}) {
  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const conteo = conteoEstadoActividades(dominio)
  const totalActividades = agruparPorActividad(dominio).size
  const reprogramadas = [...agruparPorActividad(dominio).values()].filter((filas) => filas.some((f) => f.vecesReprogramada > 0)).length
  const laboresFinalizadas = esMaquinaria ? finalizadasPorLabor(dominio) : []
  const motivosTop = motivosFrecuentes(dominio)
  const cambios = actividadesConCambio(dominio) as unknown as ActividadResumen[]

  const nombrePorId = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombreResp = (id: string) => nombrePorId.get(id) ?? 'Responsable'
  const nombreMaquina = new Map(
    actividades.filter((a) => a.maquinaId && a.maquina).map((a) => [a.maquinaId as string, a.maquina!.nombre]),
  )
  const nombreMotivo = new Map(motivos.map((m) => [m.id, m.nombre]))

  const haActividad = (a: ActividadResumen) => a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)

  // Una sola "actividad" por grupo (tareaId): estado agrupado y medida tomada UNA vez.
  const actividadesUnicas = [...agruparPorActividad(actividades).values()].map((filas) => {
    const base = filas[0]
    return {
      id: base.id,
      estado: estadoActividad(filas.map((f) => ({ estado: f.estado as Estado }))),
      descripcion: base.descripcion,
      unidad: unidadDe(unidadPorNombre, base.descripcion),
      haProgramada: haActividad(base),
      haRealizada: base.haRealizada ?? null,
      lotes: base.lotes,
      maquinaId: base.maquinaId,
      maquinas: new Set(filas.map((f) => f.maquina?.nombre).filter((n): n is string => !!n)),
      responsable: base.responsable,
      noProgramada: base.noProgramada,
      bultosPorLote: base.bultosPorLote as Record<string, number> | null,
      avances: Object.values(normalizarAvancePorLote(base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null)).flat().map((e) => ({ maquinaId: e.maquinaId, cantidad: e.cantidad })),
    }
  })

  const nuevas = actividadesUnicas.filter((a) => a.noProgramada)

  const totales = medidasPorUnidad(
    actividadesUnicas.map((a) => ({ estado: a.estado, haProgramada: a.haProgramada, haRealizada: a.haRealizada, unidad: a.unidad })),
  )
  const bultos = bultosAplicados(actividadesUnicas.map((a) => ({ estado: a.estado, bultosPorLote: a.bultosPorLote })))
  const porTractor = medidasPorTractor(
    actividadesUnicas.map((a) => ({ estado: a.estado, unidad: a.unidad, haProgramada: a.haProgramada, haRealizada: a.haRealizada, maquinaId: a.maquinaId, avances: a.avances })),
  )

  const medidas = [
    { etq: 'Horas', v: totales.hora },
    { etq: 'Bultos aplicados', v: bultos },
    { etq: 'Ha aplicadas', v: totales.ha },
    { etq: 'Kg (granel)', v: totales.kg },
    { etq: 'Cantidad (estércoles)', v: totales.cantidad },
  ].filter((m) => m.v > 0)

  const UNIDADES_TABLA: { u: Unidad; etq: string }[] = [
    { u: 'hora', etq: 'Horas' }, { u: 'ha', etq: 'Ha' }, { u: 'kg', etq: 'Kg' }, { u: 'cantidad', etq: 'Cantidad' },
  ]
  const filasTractor = [...porTractor.entries()]
  const colsTractor = UNIDADES_TABLA.filter(({ u }) => filasTractor.some(([, r]) => r[u] > 0))

  // Lista "realizado por actividad": suma la medida (única) por descripción.
  const medidaPorActividad = new Map<string, { valor: number; unidad: Unidad }>()
  for (const a of actividadesUnicas) {
    if (a.estado === 'PENDIENTE') continue
    const realizada = a.haRealizada ?? (a.unidad === 'ha' && a.estado === 'CUMPLIDA' ? a.haProgramada : 0)
    const prev = medidaPorActividad.get(a.descripcion)
    medidaPorActividad.set(a.descripcion, { valor: (prev?.valor ?? 0) + realizada, unidad: a.unidad })
  }
  const medidaActividadLista = [...medidaPorActividad.entries()].sort((a, b) => b[1].valor - a[1].valor)

  return (
    <div className="text-tinta">
      <div className="mb-4 border-b border-borde pb-2">
        <div className="text-lg font-bold text-bosque">Resumen — {areaNombre}</div>
        <div className="text-sm text-tierra">Semana {semana} · {anio}</div>
      </div>

      {/* Cuadros-resumen */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Cumplimiento</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[colorPorcentaje(pct)] }}>{pct === null ? '—' : `${pct}%`}</div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Cumplidas</div>
          <div className="text-4xl font-extrabold">{conteo.CUMPLIDA}<span className="text-2xl font-semibold text-tierra">/{totalActividades}</span></div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">No se hizo</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[conteo.NO_CUMPLIDA + conteo.REPROGRAMADA > 0 ? 'naranja' : 'verde'] }}>{conteo.NO_CUMPLIDA + conteo.REPROGRAMADA}</div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Reprogramadas</div>
          <div className="text-4xl font-extrabold">{reprogramadas}</div>
        </div>
        <div className="tarjeta p-5">
          <div className="mb-1 text-sm text-tierra">Nuevas (no programadas)</div>
          <div className="text-4xl font-extrabold">{nuevas.length}</div>
        </div>
      </div>

      {/* Medidas de maquinaria */}
      {esMaquinaria && (medidas.length > 0 || filasTractor.length > 0) && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-tinta">🚜 Medidas de tractores</h2>
          {medidas.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {medidas.map((m) => (
                <div key={m.etq} className="tarjeta p-4">
                  <div className="mb-1 text-xs text-tierra">{m.etq}</div>
                  <div className="text-2xl font-extrabold text-[#2e9e5b]">{m.v}</div>
                </div>
              ))}
            </div>
          )}
          {filasTractor.length > 0 && colsTractor.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-tierra">
                    <th scope="col" className="p-2">Tractor</th>
                    {colsTractor.map(({ u, etq }) => (<th key={u} scope="col" className="p-2">{etq}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {filasTractor.map(([id, r]) => (
                    <tr key={id || 'sin'} className="border-b border-borde/60">
                      <td className="p-2 font-medium">{id === '' ? '— sin tractor —' : (nombreMaquina.get(id) ?? 'Tractor')}</td>
                      {colsTractor.map(({ u }) => (<td key={u} className="p-2">{r[u] > 0 ? r[u] : '—'}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Chips de conteo (visibles) */}
      <h2 className="mb-2 text-lg font-semibold text-tinta">📊 Detalle por estado</h2>
      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <span className="chip-estado chip-cumplida">✅ Cumplidas: <b>{conteo.CUMPLIDA}</b></span>
        <span className="chip-estado chip-parcial">🟡 Parciales: <b>{conteo.PARCIAL}</b></span>
        <span className="chip-estado chip-nocumplida">🔴 No se hizo: <b>{conteo.NO_CUMPLIDA + conteo.REPROGRAMADA}</b></span>
        <span className="chip-estado chip-pendiente">⏳ Pendientes: <b>{conteo.PENDIENTE}</b></span>
      </div>

      {/* Detalle colapsable */}
      <details className="mb-8">
        <summary className="mb-4 cursor-pointer select-none text-sm font-semibold text-bosque hover:underline">Ver detalle</summary>

        <div className="mb-8 space-y-3">
          {ESTADOS_ORDEN.map(({ v, etq }) => {
            const acts = actividadesUnicas.filter((a) => v.includes(a.estado))
            if (acts.length === 0) return null
            const grupos = new Map<string, { descripcion: string; lotes: string[]; maquinas: Set<string>; conteo: number }>()
            for (const a of acts) {
              const lotesNombres = a.lotes.map((l) => l.nombre).sort()
              const clave = `${a.descripcion}|${lotesNombres.join(',')}`
              const g = grupos.get(clave) ?? { descripcion: a.descripcion, lotes: lotesNombres, maquinas: new Set<string>(), conteo: 0 }
              g.conteo += 1
              for (const m of a.maquinas) g.maquinas.add(m)
              grupos.set(clave, g)
            }
            const items = [...grupos.values()]
            return (
              <div key={v.join(',')}>
                <div className="text-sm font-semibold text-tinta">{etq} ({acts.length})</div>
                <ul className="ml-4 list-disc text-sm text-tierra">
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
          {esMaquinaria && (
            <div className="tarjeta p-4">
              <h2 className="mb-3 text-lg font-semibold text-tinta">🏁 Finalizadas por labor</h2>
              {laboresFinalizadas.length === 0 ? (
                <p className="text-sm text-tierra">Sin actividades finalizadas.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {laboresFinalizadas.map((l) => (
                    <li key={l.descripcion} className="flex flex-wrap items-center gap-x-2">
                      <span className="flex-1 font-medium">{l.descripcion}</span>
                      {l.tractor && (<span className="text-tierra">🚜 {nombreMaquina.get(l.tractor.id) ?? 'Tractor'} ({l.tractor.conteo})</span>)}
                      {l.responsable && (<span className="text-tierra">👤 {nombreResp(l.responsable.id)} ({l.responsable.conteo})</span>)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="tarjeta p-4">
            <h2 className="mb-3 text-lg font-semibold text-tinta">⚠️ Motivos más frecuentes</h2>
            {motivosTop.length === 0 ? (
              <p className="text-sm text-tierra">Sin motivos registrados.</p>
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

        {esMaquinaria && medidaActividadLista.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-2 text-lg font-semibold text-tinta">🚜 Realizado por actividad</h2>
            <ul className="space-y-1 text-sm">
              {medidaActividadLista.map(([desc, { valor, unidad }]) => (
                <li key={desc} className="flex justify-between rounded-lg border border-borde bg-marfil px-3 py-1">
                  <span>{desc}</span>
                  <b>{Math.round(valor * 10) / 10} {unidadAbreviada(unidad)}</b>
                </li>
              ))}
            </ul>
          </div>
        )}

        {nuevas.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-2 text-lg font-semibold text-tinta">🆕 Actividades nuevas (no programadas) ({nuevas.length})</h2>
            <ul className="space-y-1 text-sm">
              {nuevas.map((a) => (
                <li key={a.id} className="rounded-lg border border-borde bg-marfil px-3 py-1">
                  {a.descripcion}
                  <span className="text-tierra"> · {a.responsable.nombre}</span>
                  {a.lotes.length > 0 ? (<span className="text-tierra"> · 📍 {a.lotes.map((l) => l.nombre).join(', ')}</span>) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2 className="mb-2 text-lg font-semibold text-tinta">🔄 Actividades cambiadas o reprogramadas</h2>
        {cambios.length === 0 ? (
          <p className="text-sm text-tierra">Ninguna actividad cambió esta semana. 🎉</p>
        ) : (
          <ul className="space-y-2">
            {cambios.map((a) => (
              <li key={a.id} className="flex items-center gap-3 tarjeta p-3 text-sm">
                <span className="flex-1">
                  {a.descripcion}
                  <span className="text-tierra"> · {a.responsable.nombre}</span>
                  {a.motivo && <span className="text-tierra"> · {a.motivo.nombre}</span>}
                  {a.nota && <span className="text-xs text-tierra">· {a.nota}</span>}
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
      </details>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

(Nota: `resumen/page.tsx` pasa `actividades={actividades}` directo desde `listarActividades` (incluye `avancePorLote`/`bultosPorLote`); como en `ActividadResumen` esos dos campos son `unknown`, el `JsonValue` de Prisma es asignable y NO hay que tocar `page.tsx`.)

- [ ] **Step 3: Vitest (regresión)**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run` → todo verde.

- [ ] **Step 4: Commit**

```bash
git add src/app/resumen/resumen-area.tsx
git commit -m "feat(resumen): cuadros de conteo + medidas de tractor + detalle colapsable

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras las tareas)

Server local (`next dev`) apuntando a la DB real + cookie de sesión firmada (ADMIN; ver memoria `verificacion-navegador`). SOLO LECTURA:

1. En un área de **maquinaria** con avances de 2+ tractores: confirmar los **5 cuadros-resumen** (Cumplimiento %, Cumplidas N/total, No se hizo N, Reprogramadas N, Nuevas N) — sin "% reprogramadas".
2. **Medidas:** los totales por unidad (Horas/Bultos/Ha/Kg/Cantidad, solo los que tengan dato) y la **tabla tractor×unidad** con sumas coherentes (suma de columnas ≈ total por unidad, salvo bultos que no está en la tabla).
3. **"Ver detalle"** está **colapsado** por defecto; al abrirlo aparecen todas las listas (por estado, motivos, finalizadas, nuevas, realizado por actividad, cambiadas/reprogramadas).
4. Área **estándar:** sin bloque de medidas ni tabla de tractores; cuadros y detalle funcionan igual.

## Nota

Sin cambios de esquema. El Excel de `/resumen/exportar` no se toca. Los bultos solo se totalizan a nivel de área (no por tractor, porque no se registran por avance).

# Tarjeta de nuevas en Resumen + Exportar Excel en Cumplimiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar una tarjeta con el conteo de actividades nuevas no programadas en el Resumen, y permitir descargar un `.xlsx` del cumplimiento del área/semana actuales (habilitado solo cuando no quedan pendientes).

**Architecture:** Parte A: una tarjeta más en la grilla de `resumen-area.tsx`. Parte B: un helper de dominio puro `filaCumplimiento` (con test), un Route Handler `cumplimiento/exportar/route.ts` que arma el Excel con `exceljs`, y un botón en `cumplimiento/page.tsx` que enlaza a esa ruta (deshabilitado mientras haya pendientes).

**Tech Stack:** Next.js 16 (App Router, Route Handlers), Prisma 6 (Postgres/Neon), React 19, Tailwind v4, Vitest, exceljs.

## Global Constraints

- Columnas del Excel, en este orden exacto: **Día · Fecha · Responsable · Actividad · Máquina · Lote(s) · Estado · Medida realizada · Unidad**.
- Excel `.xlsx` real con **exceljs**; alcance = **área y semana actuales**, una sola hoja; incluye todas las actividades (programadas y no programadas).
- Botón "📥 Descargar Excel": **visible pero deshabilitado** (gris + tooltip) mientras `pendientes > 0`; habilitado (enlace) cuando `pendientes === 0`.
- Estado en texto plano: `PENDIENTE→Pendiente, CUMPLIDA→Cumplida, PARCIAL→Parcial, NO_CUMPLIDA→No cumplida, REPROGRAMADA→Reprogramada`.
- Columna Unidad y Medida quedan **vacías** cuando la actividad no tiene `haRealizada`.
- Unidad por actividad se deriva de su descripción contra el catálogo (`unidadPorNombre`), fallback `ha`.
- Auth del route: sin sesión → redirige a `/login`; admin cualquier área válida, usuario de área forzado a la suya (igual que `cumplimiento/page.tsx`).
- NO hay migraciones. Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` (y `npm test` donde aplique). NO ejecutar app/seed/build local (base en Neon).
- AGENTS.md: este NO es el Next.js estándar — antes de escribir el Route Handler, leer la guía en `node_modules/next/dist/docs/` (route handlers / `NextResponse`).
- Spec: `docs/superpowers/specs/2026-06-20-resumen-card-y-export-cumplimiento-design.md`.

## File Structure

- `src/app/resumen/resumen-area.tsx` — agregar la tarjeta de nuevas (Parte A).
- `src/dominio/cumplimiento-export.ts` — NUEVO: `COLUMNAS_CUMPLIMIENTO`, `filaCumplimiento`, tipo `ActividadExport` (Parte B).
- `src/dominio/cumplimiento-export.test.ts` — NUEVO: test del helper.
- `src/app/cumplimiento/exportar/route.ts` — NUEVO: Route Handler GET que devuelve el `.xlsx`.
- `src/app/cumplimiento/page.tsx` — agregar el botón de descarga.
- `package.json` — agregar dependencia `exceljs`.

---

## Task 1: Parte A — Tarjeta "Nuevas (no programadas)" en Resumen

**Files:**
- Modify: `src/app/resumen/resumen-area.tsx` (grilla de tarjetas, ~líneas 111-134)

**Interfaces:**
- Consumes: la variable `nuevas` ya existe en el componente (`const nuevas = actividades.filter((a) => a.noProgramada)`).
- Produces: nada para otras tareas.

- [ ] **Step 1: Agregar la tarjeta a la grilla**

En `src/app/resumen/resumen-area.tsx`, dentro del `<div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">`, después del bloque `{esMaquinaria && (...)}` de la tarjeta "Realizado" (justo antes de cerrar ese `</div>` de la grilla), agregar:

```tsx
        <div className="rounded-2xl border p-5">
          <div className="mb-1 text-sm text-gray-500">Nuevas (no programadas)</div>
          <div className="text-4xl font-extrabold">{nuevas.length}</div>
        </div>
```

- [ ] **Step 2: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/resumen/resumen-area.tsx
git commit -m "feat(resumen): tarjeta con el conteo de actividades nuevas no programadas"
```

---

## Task 2: Parte B — Helper de dominio `filaCumplimiento` (TDD)

**Files:**
- Create: `src/dominio/cumplimiento-export.ts`
- Create: `src/dominio/cumplimiento-export.test.ts`

**Interfaces:**
- Consumes: `normalizarUnidad`, `unidadAbreviada`, `type Unidad` de `src/dominio/unidad.ts` (ya existen).
- Produces:
  - `COLUMNAS_CUMPLIMIENTO: readonly string[]` = `['Día','Fecha','Responsable','Actividad','Máquina','Lote(s)','Estado','Medida realizada','Unidad']`.
  - `type ActividadExport = { dia, descripcion, estado, haRealizada: number|null, responsable: {nombre}, maquina: {nombre}|null, lotes: {nombre}[] }`.
  - `filaCumplimiento(a: ActividadExport, fecha: string, unidadPorNombre: Record<string,string>): (string|number)[]` — devuelve los 9 valores en el orden de `COLUMNAS_CUMPLIMIENTO`.

- [ ] **Step 1: Escribir el test (RED)**

Crear `src/dominio/cumplimiento-export.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { filaCumplimiento, COLUMNAS_CUMPLIMIENTO, type ActividadExport } from './cumplimiento-export'

const mapa: Record<string, string> = { ESTERCOLERO: 'hora', GRANEL: 'kg', ENCALADORA: 'ha' }

function act(p: Partial<ActividadExport>): ActividadExport {
  return {
    dia: 1,
    descripcion: 'ENCALADORA',
    estado: 'CUMPLIDA',
    haRealizada: 3,
    responsable: { nombre: 'Ana' },
    maquina: { nombre: '6603' },
    lotes: [{ nombre: 'L1' }],
    ...p,
  }
}

describe('COLUMNAS_CUMPLIMIENTO', () => {
  it('tiene las 9 columnas en el orden acordado', () => {
    expect([...COLUMNAS_CUMPLIMIENTO]).toEqual([
      'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad',
    ])
  })
})

describe('filaCumplimiento', () => {
  it('actividad de ha con medida', () => {
    expect(filaCumplimiento(act({}), '15 jun', mapa)).toEqual(
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 3, 'ha'],
    )
  })
  it('actividad de hora usa "horas"', () => {
    expect(filaCumplimiento(act({ descripcion: 'ESTERCOLERO', haRealizada: 6 }), '16 jun', mapa)).toEqual(
      ['Lun', '16 jun', 'Ana', 'ESTERCOLERO', '6603', 'L1', 'Cumplida', 6, 'horas'],
    )
  })
  it('actividad de kg', () => {
    expect(filaCumplimiento(act({ descripcion: 'GRANEL', haRealizada: 100 }), '', mapa)).toEqual(
      ['Lun', '', 'Ana', 'GRANEL', '6603', 'L1', 'Cumplida', 100, 'kg'],
    )
  })
  it('sin medida deja medida y unidad vacías; traduce el estado', () => {
    expect(filaCumplimiento(act({ haRealizada: null, estado: 'NO_CUMPLIDA' }), '', mapa)).toEqual(
      ['Lun', '', 'Ana', 'ENCALADORA', '6603', 'L1', 'No cumplida', '', ''],
    )
  })
  it('descripción fuera del catálogo → ha; máquina y lotes vacíos; día 3 = Mié', () => {
    expect(filaCumplimiento(act({ descripcion: 'Algo libre', haRealizada: 2, maquina: null, lotes: [], dia: 3 }), '', mapa)).toEqual(
      ['Mié', '', 'Ana', 'Algo libre', '', '', 'Cumplida', 2, 'ha'],
    )
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: FAIL — "Cannot find module './cumplimiento-export'".

- [ ] **Step 3: Implementar el helper (GREEN)**

Crear `src/dominio/cumplimiento-export.ts`:

```ts
import { normalizarUnidad, unidadAbreviada, type Unidad } from './unidad'

export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad',
] as const

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADO_TXT: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CUMPLIDA: 'Cumplida',
  PARCIAL: 'Parcial',
  NO_CUMPLIDA: 'No cumplida',
  REPROGRAMADA: 'Reprogramada',
}

export type ActividadExport = {
  dia: number
  descripcion: string
  estado: string
  haRealizada: number | null
  responsable: { nombre: string }
  maquina: { nombre: string } | null
  lotes: { nombre: string }[]
}

// Fila del Excel para una actividad, en el orden de COLUMNAS_CUMPLIMIENTO.
// `fecha` la calcula el llamador (fecha corta del día). La unidad se deriva de
// la descripción contra el catálogo; medida y unidad quedan vacías sin haRealizada.
export function filaCumplimiento(
  a: ActividadExport,
  fecha: string,
  unidadPorNombre: Record<string, string>,
): (string | number)[] {
  const unidad: Unidad = normalizarUnidad(unidadPorNombre[a.descripcion])
  return [
    DIAS[a.dia] ?? '',
    fecha,
    a.responsable.nombre,
    a.descripcion,
    a.maquina?.nombre ?? '',
    a.lotes.map((l) => l.nombre).join(', '),
    ESTADO_TXT[a.estado] ?? a.estado,
    a.haRealizada ?? '',
    a.haRealizada == null ? '' : unidadAbreviada(unidad),
  ]
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: PASS (2 describe verdes).

- [ ] **Step 5: Correr la suite completa**

Run: `npm test`
Expected: PASS (suite actual 76 → 82, output limpio).

- [ ] **Step 6: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts
git commit -m "feat(dominio): helper filaCumplimiento para el export de cumplimiento"
```

---

## Task 3: Parte B — Dependencia exceljs + Route Handler + botón

**Files:**
- Modify: `package.json` (dependencia `exceljs`)
- Create: `src/app/cumplimiento/exportar/route.ts`
- Modify: `src/app/cumplimiento/page.tsx` (botón en la barra de acciones, ~líneas 117-133)

**Interfaces:**
- Consumes: `COLUMNAS_CUMPLIMIENTO`, `filaCumplimiento` (Task 2); `usuarioActual` de `@/auth/sesion`; `listarAreas`, `listarActividades`, `listarActividadesEstipuladas` de `@/datos/repositorio`; `fechasDeSemana` de `@/dominio/semana`.
- Produces: ruta `GET /cumplimiento/exportar?area=&anio=&semana=` que descarga el `.xlsx`.

- [ ] **Step 1: Instalar exceljs**

Run: `npm install exceljs`
Expected: se agrega a `dependencies` en `package.json` y queda en `package-lock.json`. (No ejecuta build ni base.)

- [ ] **Step 2: Leer la guía de Route Handlers de esta versión de Next**

Run: `ls node_modules/next/dist/docs/` y leer el documento de **route handlers / Response**.
Motivo (AGENTS.md): esta versión de Next puede diferir de lo conocido. Confirmar la firma `export async function GET(req)`, el uso de `NextResponse` y cómo se devuelven binarios y `Content-Disposition`. Ajustar el código del Step 3 si la guía indica algo distinto.

- [ ] **Step 3: Crear el Route Handler**

Crear `src/app/cumplimiento/exportar/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { usuarioActual } from '@/auth/sesion'
import { listarAreas, listarActividades, listarActividadesEstipuladas } from '@/datos/repositorio'
import { fechasDeSemana } from '@/dominio/semana'
import { COLUMNAS_CUMPLIMIENTO, filaCumplimiento } from '@/dominio/cumplimiento-export'

// exceljs necesita runtime Node (no edge).
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const u = await usuarioActual()
  if (!u) return NextResponse.redirect(new URL('/login', req.url))

  const sp = req.nextUrl.searchParams
  const areas = await listarAreas()
  const esAdmin = u.rol === 'ADMIN'
  const areaParam = sp.get('area')
  const areaId = esAdmin
    ? (areaParam && areas.some((a) => a.id === areaParam) ? areaParam : areas[0]?.id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0]?.id)
  const area = areas.find((a) => a.id === areaId)
  if (!area) return new NextResponse('Área no encontrada', { status: 404 })

  const anio = Number(sp.get('anio'))
  const semana = Number(sp.get('semana'))
  if (!Number.isInteger(anio) || !Number.isInteger(semana)) {
    return new NextResponse('Parámetros inválidos', { status: 400 })
  }

  const [actividades, estipuladas] = await Promise.all([
    listarActividades(area.id, anio, semana),
    listarActividadesEstipuladas(),
  ])
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
  const fechas = fechasDeSemana(anio, semana)
  const fmtFecha = (f: Date) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Cumplimiento')
  const header = ws.addRow([...COLUMNAS_CUMPLIMIENTO])
  header.font = { bold: true }
  for (const a of actividades) {
    const fecha = fechas[a.dia - 1] ? fmtFecha(fechas[a.dia - 1]) : ''
    ws.addRow(filaCumplimiento(a, fecha, unidadPorNombre))
  }

  const buffer = await wb.xlsx.writeBuffer()
  const safe = area.nombre.replace(/[^\p{L}\p{N}]+/gu, '-')
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cumplimiento-${safe}-S${semana}-${anio}.xlsx"`,
    },
  })
}
```

Nota: si `tsc` se queja del tipo de `buffer` en `new NextResponse(...)`, envolver con `new Uint8Array(buffer)` en vez del cast `as ArrayBuffer`.

- [ ] **Step 4: Agregar el botón en la página de cumplimiento**

En `src/app/cumplimiento/page.tsx`, en la barra de acciones, **después** del bloque del botón "Semana {proxima.semana} →" (el `{pendientes > 0 ? (...) : (...)}` que termina antes del `<span className="ml-auto ...">Cumplido:</span>`), insertar:

```tsx
        {pendientes > 0 ? (
          <span
            className="cursor-not-allowed rounded border px-3 py-1 text-sm text-gray-300"
            title="Registra todas las actividades para descargar el Excel"
          >
            📥 Descargar Excel
          </span>
        ) : (
          <a
            href={`/cumplimiento/exportar?area=${areaId}&anio=${anio}&semana=${semana}`}
            className="rounded border border-[#11603a] px-3 py-1 text-sm font-semibold text-[#11603a] hover:bg-green-50"
          >
            📥 Descargar Excel
          </a>
        )}
```

- [ ] **Step 5: Verificar typecheck, lint y tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; suite verde (82).

- [ ] **Step 6: Verificación manual (diferida al despliegue)**

No se ejecuta en local (base en Neon). Tras desplegar: en Cumplimiento con pendientes, el botón está gris; al registrar todas, se habilita y descarga `cumplimiento-<area>-S<semana>-<anio>.xlsx` que abre en Excel con las 9 columnas. La tarjeta de nuevas aparece en Resumen.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/app/cumplimiento/exportar/route.ts src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): descargar Excel (.xlsx) del área/semana cuando no hay pendientes"
```

---

## Fase de despliegue (después del plan)

1. `git push` (respaldo).
2. **Deploy manual por CLI** (no hay auto-deploy): `npx vercel --prod --yes --scope ayura-llanos`.
3. Verificación manual según Task 3 Step 6.

---

## Self-Review (autor del plan)

**1. Cobertura de la spec:**
- Parte A (tarjeta de nuevas, pantalla + PDF) → Task 1. ✓
- exceljs como dependencia → Task 3 Step 1. ✓
- Helper puro `filaCumplimiento` + test → Task 2. ✓
- Columnas en orden exacto (9) → Task 2 (`COLUMNAS_CUMPLIMIENTO` + test) y Task 3 (header). ✓
- Route handler con auth (login/área), alcance área+semana, una hoja, `Content-Disposition` → Task 3 Step 3. ✓
- Botón visible/deshabilitado con tooltip según `pendientes` → Task 3 Step 4. ✓
- Estado en texto plano; medida/unidad vacías sin haRealizada → Task 2 (helper + tests). ✓
- Sin migraciones; gate tsc/lint/test; despliegue manual CLI → constraints + fase de despliegue. ✓
- AGENTS.md (leer docs de Next antes del route) → Task 3 Step 2. ✓

**2. Placeholders:** no hay "TBD"/"etc."/"manejar casos"; todo el código está completo. ✓

**3. Consistencia de tipos:**
- `COLUMNAS_CUMPLIMIENTO` (9, mismo orden) usado en Task 2 (definición + test) y Task 3 (header). ✓
- `filaCumplimiento(a, fecha, unidadPorNombre)` firma idéntica en definición (Task 2) y uso (Task 3). ✓
- `ActividadExport` cubre los campos que `listarActividades` ya incluye (responsable, maquina, lotes, estado, haRealizada, dia, descripcion). ✓
- `unidadAbreviada`/`normalizarUnidad` existen en `unidad.ts` (de features previas). ✓

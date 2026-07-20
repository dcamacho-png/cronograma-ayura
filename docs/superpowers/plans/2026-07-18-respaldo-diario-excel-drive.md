# Respaldo diario del Excel maestro a Google Drive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada noche generar un único Excel maestro (todas las áreas y semanas) y sobrescribirlo en una carpeta de Google Drive, automáticamente vía Vercel Cron + Apps Script.

**Architecture:** Se extrae la construcción de filas del export interactivo a un módulo compartido puro (`src/datos/export-cumplimiento.ts`). Una nueva ruta `GET /api/backup-drive`, protegida por `CRON_SECRET`, arma el maestro con ese módulo, lo serializa con ExcelJS y lo hace POST a un Apps Script Web App que lo guarda en Drive. Un `vercel.json` dispara la ruta diario a las 23:59 COT.

**Tech Stack:** Next.js (App Router, runtime nodejs), ExcelJS (ya presente), Prisma, Vitest, `fetch` nativo, Google Apps Script. **Sin dependencias npm nuevas.**

## Global Constraints

- Sin dependencias npm nuevas (nada de `googleapis`); POST con `fetch` nativo.
- La función de dominio `filasCumplimiento`/`filasCumplimientoGrupo` (`src/dominio/cumplimiento-export.ts`) NO se modifica; sus 26 tests deben seguir verdes.
- Columna `Semana` en formato `AÑO-SNN` (ej. `2026-S29`), igual que `/consulta`.
- Maestro: solo actividades **propias** de cada área (sin doble conteo), solo estado `CUMPLIDA`/`PARCIAL`, orden Área → Semana → día.
- Nombre fijo del archivo en Drive: `cumplimiento-maestro.xlsx` (se sobrescribe).
- Cron en UTC: `59 4 * * *` = 23:59 hora Colombia (UTC-5).
- Env Sensitive en Vercel (producción): `CRON_SECRET`, `DRIVE_WEBHOOK_URL`, `DRIVE_WEBHOOK_TOKEN`.
- Este proyecto NO usa `npx tsc --noEmit` para verificar (falso-verde por `.next`); la verificación es `npm test` + build/deploy.

---

### Task 1: Módulo compartido de construcción de filas + refactor del export interactivo

Extrae la lógica de agrupar/filtrar/armar filas (hoy embebida en `exportar/route.ts`) a un módulo reutilizable y hace que la ruta interactiva lo use. Comportamiento visible idéntico (por área, una semana, con la columna `Semana` que ya se agregó).

**Files:**
- Create: `src/datos/export-cumplimiento.ts`
- Create: `src/datos/export-cumplimiento.test.ts`
- Modify: `src/app/cumplimiento/exportar/route.ts`

**Interfaces:**
- Consumes: `filasCumplimientoGrupo`, `COLUMNAS_CUMPLIMIENTO` (de `@/dominio/cumplimiento-export`); `agruparPorActividad`, `estadoActividad` (de `@/dominio/metricas`).
- Produces:
  - `type ActExportRaw` — forma mínima de una actividad cargada con relaciones.
  - `type CtxFilas = { unidadPorNombre: Record<string,string>; nombreMaquina: (id: string|null)=>string; nombreResponsable: (id: string|null)=>string; fechaDeDia: (dia: number)=>string }`
  - `construirFilasCumplimiento(items: ActExportRaw[], ctx: CtxFilas, ejecutadaPor: (grupo: ActExportRaw[]) => string): (string|number)[][]`

- [ ] **Step 1: Write the failing test**

Crear `src/datos/export-cumplimiento.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { construirFilasCumplimiento, type ActExportRaw, type CtxFilas } from './export-cumplimiento'

const ctx: CtxFilas = {
  unidadPorNombre: {},
  nombreMaquina: () => '',
  nombreResponsable: () => '',
  fechaDeDia: (d) => `d${d}`,
}

const base: ActExportRaw = {
  id: 'a1', tareaId: 't1', dia: 2, descripcion: 'Fumigar', estado: 'CUMPLIDA',
  haRealizada: 3, centroCosto: null, nota: null, unidadRealizada: null,
  responsable: { nombre: 'Ana' }, maquina: null, finca: { nombre: 'F1' },
  lotes: [{ id: 'l1', nombre: 'L1' }],
  bultosPorLote: null, lotesHechos: null, avancePorLote: null,
  tarea: { detalle: null }, area: { nombre: 'Ganadería' },
}

describe('construirFilasCumplimiento', () => {
  it('emite una fila para una actividad CUMPLIDA', () => {
    const filas = construirFilasCumplimiento([base], ctx, () => '')
    expect(filas).toHaveLength(1)
    expect(filas[0][3]).toBe('Fumigar') // col Actividad (índice 3 en COLUMNAS_CUMPLIMIENTO)
  })

  it('descarta estados que no son CUMPLIDA/PARCIAL', () => {
    const noCumplida = { ...base, id: 'a2', tareaId: 't2', estado: 'NO_CUMPLIDA' }
    expect(construirFilasCumplimiento([noCumplida], ctx, () => '')).toEqual([])
  })

  it('agrupa filas-hermanas del mismo tareaId en una sola actividad', () => {
    const hermana = { ...base, id: 'a1b', responsable: { nombre: 'Beto' } }
    const filas = construirFilasCumplimiento([base, hermana], ctx, () => '')
    expect(filas).toHaveLength(1) // una actividad, no una por responsable
    expect(filas[0][2]).toBe('Ana, Beto') // col Responsable
  })

  it('pasa la etiqueta ejecutadaPor a la columna correspondiente', () => {
    const filas = construirFilasCumplimiento([base], ctx, () => 'Maquinaria')
    expect(filas[0][13]).toBe('Maquinaria') // col "Ejecutada por"
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/datos/export-cumplimiento.test.ts`
Expected: FAIL — `Cannot find module './export-cumplimiento'` (o export inexistente).

- [ ] **Step 3: Write minimal implementation**

Crear `src/datos/export-cumplimiento.ts`:

```ts
import { filasCumplimientoGrupo, type ActividadExport } from '@/dominio/cumplimiento-export'
import { agruparPorActividad, estadoActividad } from '@/dominio/metricas'
import type { Estado } from '@/dominio/tipos'
import type { AvanceEntrada } from '@/dominio/avance-lote'
import type { BultosPorLote } from '@/dominio/bultos'

// Forma mínima de una actividad cargada con relaciones que necesitan el agrupado
// (id/tareaId), el filtro de estado (estado/dia) y el mapeo a ActividadExport.
// Los campos JSON llegan crudos de Prisma (unknown) y se castean al mapear.
export type ActExportRaw = {
  id: string
  tareaId: string | null
  dia: number
  descripcion: string
  estado: string
  haRealizada: number | null
  centroCosto: string | null
  nota: string | null
  unidadRealizada?: string | null
  responsable: { nombre: string }
  maquina: { nombre: string } | null
  finca: { nombre: string } | null
  lotes: { id: string; nombre: string }[]
  bultosPorLote: unknown
  lotesHechos: unknown
  avancePorLote: unknown
  tarea?: { detalle: string | null } | null
  area?: { nombre: string } | null
}

export type CtxFilas = {
  unidadPorNombre: Record<string, string>
  nombreMaquina: (id: string | null) => string
  nombreResponsable: (id: string | null) => string
  fechaDeDia: (dia: number) => string
}

function aExport(a: ActExportRaw): ActividadExport {
  return {
    ...a,
    bultosPorLote: a.bultosPorLote as BultosPorLote | null,
    lotesHechos: a.lotesHechos as string[] | null,
    avancePorLote: a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
    detalle: a.tarea?.detalle ?? null,
  }
}

// Filas de cumplimiento (sin las columnas Semana/Área) de un conjunto de actividades
// de UN (área, año, semana). Agrupa por actividad, deja solo CUMPLIDA/PARCIAL y delega
// el armado a la función de dominio pura. `ejecutadaPor` etiqueta cada grupo.
export function construirFilasCumplimiento(
  items: ActExportRaw[],
  ctx: CtxFilas,
  ejecutadaPor: (grupo: ActExportRaw[]) => string,
): (string | number)[][] {
  const filas: (string | number)[][] = []
  for (const grupo of agruparPorActividad(items).values()) {
    const e = estadoActividad(grupo.map((a) => ({ estado: a.estado as Estado })))
    if (e !== 'CUMPLIDA' && e !== 'PARCIAL') continue
    for (const fila of filasCumplimientoGrupo(
      grupo.map(aExport),
      ctx.fechaDeDia(grupo[0].dia),
      ctx.unidadPorNombre,
      { fechaDeDia: ctx.fechaDeDia, nombreMaquina: ctx.nombreMaquina, nombreResponsable: ctx.nombreResponsable },
      ejecutadaPor(grupo),
    )) {
      filas.push(fila)
    }
  }
  return filas
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/datos/export-cumplimiento.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor the interactive route to use the shared builder**

Reemplazar en `src/app/cumplimiento/exportar/route.ts` el bloque `aExport` + `agregarGrupos` (líneas ~61-90) por el uso del módulo. El resultado del cuerpo, desde la creación del workbook, queda así:

```ts
  const semanaLabel = `${anio}-S${semana}`
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Cumplimiento')
  const header = ws.addRow(['Semana', ...COLUMNAS_CUMPLIMIENTO])
  header.font = { bold: true }
  const fechaDeDia = (dia: number) => (fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : '')

  const ctx = { unidadPorNombre, nombreMaquina, nombreResponsable, fechaDeDia }
  // Actividades propias del área.
  for (const fila of construirFilasCumplimiento(actividades, ctx, () => '')) {
    ws.addRow([semanaLabel, ...fila])
  }
  // Actividades que esta área solicitó a otra (ejecutadas por la otra área).
  for (const fila of construirFilasCumplimiento(solicitadas, ctx, (grupo) => grupo[0].area?.nombre ?? '')) {
    ws.addRow([semanaLabel, ...fila])
  }
```

Actualizar los imports de `route.ts`: quitar los que ya no se usan directamente y agregar el builder. El bloque de imports de dominio queda:

```ts
import { COLUMNAS_CUMPLIMIENTO } from '@/dominio/cumplimiento-export'
import { construirFilasCumplimiento } from '@/datos/export-cumplimiento'
```

Eliminar de `route.ts` los imports ahora huérfanos: `filasCumplimientoGrupo`, `agruparPorActividad`, `estadoActividad`, `type Estado`, `type AvanceEntrada`, `type BultosPorLote`. (Conservar `fechasDeSemana`, `usuarioActual`, los `listar*`, `ExcelJS`, `NextRequest/NextResponse`.)

- [ ] **Step 6: Run the full test suite (regression + new)**

Run: `npm test`
Expected: PASS — los 26 de `cumplimiento-export.test.ts` + los 4 nuevos de `export-cumplimiento.test.ts`, sin fallos.

- [ ] **Step 7: Verify the route still builds**

Run: `npm run build`
Expected: build sin errores de tipos ni lint en `route.ts` (imports huérfanos eliminados).

- [ ] **Step 8: Commit**

```bash
git add src/datos/export-cumplimiento.ts src/datos/export-cumplimiento.test.ts src/app/cumplimiento/exportar/route.ts
git commit -m "refactor(export): módulo compartido de filas + columna Semana en el export interactivo"
```

---

### Task 2: Ensamblador del Excel maestro (puro, testeable)

Función que, dadas todas las actividades y los catálogos globales, agrupa por (área, año, semana), antepone las columnas `Semana` y `Área`, ordena Área → Semana → día y devuelve todas las filas del maestro. Sin Prisma ni ExcelJS: puro y testeable.

**Files:**
- Modify: `src/datos/export-cumplimiento.ts` (agregar `COLUMNAS_MAESTRO` y `construirFilasMaestro`)
- Modify: `src/datos/export-cumplimiento.test.ts` (agregar describe para el maestro)

**Interfaces:**
- Consumes: `construirFilasCumplimiento`, `ActExportRaw` (Task 1); `COLUMNAS_CUMPLIMIENTO` (dominio); `fechasDeSemana` (de `@/dominio/semana`).
- Produces:
  - `COLUMNAS_MAESTRO: readonly string[]` = `['Semana', 'Área', ...COLUMNAS_CUMPLIMIENTO]`
  - `type ActMaestro = ActExportRaw & { areaId: string; anio: number; semana: number; area: { nombre: string } }`
  - `construirFilasMaestro(actividades: ActMaestro[], catalogo: { nombre: string; unidad: string }[], maquinas: { id: string; nombre: string }[], responsables: { id: string; nombre: string }[]): (string|number)[][]`

- [ ] **Step 1: Write the failing test**

Agregar al final de `src/datos/export-cumplimiento.test.ts`:

```ts
import { construirFilasMaestro, COLUMNAS_MAESTRO, type ActMaestro } from './export-cumplimiento'

const actMaestro = (over: Partial<ActMaestro>): ActMaestro => ({
  ...base, areaId: 'ar1', anio: 2026, semana: 29, area: { nombre: 'Ganadería' }, ...over,
})

describe('construirFilasMaestro', () => {
  it('antepone Semana y Área a cada fila', () => {
    const filas = construirFilasMaestro([actMaestro({})], [], [], [])
    expect(filas).toHaveLength(1)
    expect(filas[0][0]).toBe('2026-S29') // Semana
    expect(filas[0][1]).toBe('Ganadería') // Área
    expect(filas[0][5]).toBe('Fumigar') // Actividad = 3 + 2 columnas antepuestas
  })

  it('ordena por Área, luego Semana', () => {
    const filas = construirFilasMaestro([
      actMaestro({ id: 'x', tareaId: 'tx', area: { nombre: 'Nelore' }, areaId: 'ar2', semana: 28 }),
      actMaestro({ id: 'y', tareaId: 'ty', area: { nombre: 'Ganadería' }, areaId: 'ar1', semana: 30 }),
      actMaestro({ id: 'z', tareaId: 'tz', area: { nombre: 'Ganadería' }, areaId: 'ar1', semana: 29 }),
    ], [], [], [])
    expect(filas.map((f) => [f[1], f[0]])).toEqual([
      ['Ganadería', '2026-S29'],
      ['Ganadería', '2026-S30'],
      ['Nelore', '2026-S28'],
    ])
  })

  it('el header maestro tiene Semana y Área al frente', () => {
    expect(COLUMNAS_MAESTRO[0]).toBe('Semana')
    expect(COLUMNAS_MAESTRO[1]).toBe('Área')
    expect(COLUMNAS_MAESTRO.length).toBe(18) // 2 + 16 columnas de cumplimiento
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/datos/export-cumplimiento.test.ts`
Expected: FAIL — `construirFilasMaestro`/`COLUMNAS_MAESTRO`/`ActMaestro` no existen.

- [ ] **Step 3: Write minimal implementation**

Agregar a `src/datos/export-cumplimiento.ts`:

```ts
import { COLUMNAS_CUMPLIMIENTO } from '@/dominio/cumplimiento-export'
import { fechasDeSemana } from '@/dominio/semana'

export const COLUMNAS_MAESTRO = ['Semana', 'Área', ...COLUMNAS_CUMPLIMIENTO] as const

export type ActMaestro = ActExportRaw & {
  areaId: string
  anio: number
  semana: number
  area: { nombre: string }
}

// Arma TODAS las filas del maestro: agrupa por (área, año, semana), antepone
// [Semana, Área] y ordena Área → Semana → día (el día viene del orden interno de
// construirFilasCumplimiento). Solo propias por área ⇒ cada actividad una sola vez.
export function construirFilasMaestro(
  actividades: ActMaestro[],
  catalogo: { nombre: string; unidad: string }[],
  maquinas: { id: string; nombre: string }[],
  responsables: { id: string; nombre: string }[],
): (string | number)[][] {
  const unidadPorNombre = Object.fromEntries(catalogo.map((e) => [e.nombre, e.unidad]))
  const mapMaquina = new Map(maquinas.map((m) => [m.id, m.nombre]))
  const mapResponsable = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombreMaquina = (id: string | null) => (id ? mapMaquina.get(id) ?? '' : '')
  const nombreResponsable = (id: string | null) => (id ? mapResponsable.get(id) ?? '' : '')
  const fmtFecha = (f: Date) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  // Agrupar por (área, año, semana).
  const grupos = new Map<string, { areaNombre: string; anio: number; semana: number; items: ActMaestro[] }>()
  for (const a of actividades) {
    const k = `${a.areaId}|${a.anio}|${a.semana}`
    const g = grupos.get(k) ?? { areaNombre: a.area.nombre, anio: a.anio, semana: a.semana, items: [] }
    g.items.push(a)
    grupos.set(k, g)
  }
  const ordenados = [...grupos.values()].sort(
    (x, y) => x.areaNombre.localeCompare(y.areaNombre) || x.anio - y.anio || x.semana - y.semana,
  )

  const filas: (string | number)[][] = []
  for (const g of ordenados) {
    const fechas = fechasDeSemana(g.anio, g.semana)
    const fechaDeDia = (dia: number) => (fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : '')
    const ctx: CtxFilas = { unidadPorNombre, nombreMaquina, nombreResponsable, fechaDeDia }
    const semanaLabel = `${g.anio}-S${g.semana}`
    for (const fila of construirFilasCumplimiento(g.items, ctx, () => '')) {
      filas.push([semanaLabel, g.areaNombre, ...fila])
    }
  }
  return filas
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/datos/export-cumplimiento.test.ts`
Expected: PASS (los 4 de Task 1 + los 3 nuevos = 7).

- [ ] **Step 5: Commit**

```bash
git add src/datos/export-cumplimiento.ts src/datos/export-cumplimiento.test.ts
git commit -m "feat(export): ensamblador del Excel maestro (Semana + Área, orden y agrupación)"
```

---

### Task 3: Repositorio `listarActividadesTodas` + ruta cron `/api/backup-drive`

Agrega la consulta global y la ruta que arma el maestro, lo serializa y lo sube a Drive. La ruta se protege con `CRON_SECRET` y se verifica manualmente tras el deploy.

**Files:**
- Modify: `src/datos/repositorio.ts` (agregar `listarActividadesTodas`)
- Create: `src/app/api/backup-drive/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `construirFilasMaestro`, `COLUMNAS_MAESTRO`, `type ActMaestro` (Task 2); `listarActividadesEstipuladas`, `listarMaquinas`, `listarResponsablesTodos` (repositorio existente).
- Produces: `listarActividadesTodas()` — todas las actividades con las mismas relaciones que `listarActividades` más `area: true`.

- [ ] **Step 1: Agregar `listarActividadesTodas` al repositorio**

En `src/datos/repositorio.ts`, justo después de `listarActividadesSolicitadas` (≈ línea 107), agregar:

```ts
// TODAS las actividades (todas las áreas y semanas), con las relaciones del export.
// Para el respaldo maestro a Drive: se agrupa por (área, año, semana) en memoria.
export function listarActividadesTodas() {
  return prisma.actividad.findMany({
    include: {
      responsable: true,
      finca: true,
      motivo: true,
      maquina: true,
      areaTarea: true,
      area: true,
      tarea: { select: { detalle: true } },
      lotes: true,
    },
    orderBy: [{ anio: 'asc' }, { semana: 'asc' }, { dia: 'asc' }],
  })
}
```

- [ ] **Step 2: Crear la ruta cron**

Crear `src/app/api/backup-drive/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { listarActividadesTodas, listarActividadesEstipuladas, listarMaquinas, listarResponsablesTodos } from '@/datos/repositorio'
import { construirFilasMaestro, COLUMNAS_MAESTRO, type ActMaestro } from '@/datos/export-cumplimiento'

// exceljs necesita runtime Node (no edge).
export const runtime = 'nodejs'
// La ruta puede tardar; se ejecuta como cron nocturno.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Autorización: Vercel Cron inyecta "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const url = process.env.DRIVE_WEBHOOK_URL
  const token = process.env.DRIVE_WEBHOOK_TOKEN
  if (!url || !token) {
    return new NextResponse('faltan DRIVE_WEBHOOK_URL / DRIVE_WEBHOOK_TOKEN', { status: 500 })
  }

  const [actividades, estipuladas, maquinas, responsables] = await Promise.all([
    listarActividadesTodas(),
    listarActividadesEstipuladas(),
    listarMaquinas(),
    listarResponsablesTodos(),
  ])

  const filas = construirFilasMaestro(
    actividades as unknown as ActMaestro[],
    estipuladas,
    maquinas,
    responsables,
  )

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Cumplimiento')
  const header = ws.addRow([...COLUMNAS_MAESTRO])
  header.font = { bold: true }
  for (const fila of filas) ws.addRow(fila)
  const buffer = await wb.xlsx.writeBuffer()

  // Subir a la Web App de Apps Script (form-urlencoded: token + archivo en base64).
  const body = new URLSearchParams({
    token,
    file: Buffer.from(buffer).toString('base64'),
  })
  const res = await fetch(url, { method: 'POST', body })
  const texto = (await res.text()).trim()
  if (!res.ok || texto !== 'ok') {
    return new NextResponse(`fallo al subir a Drive: ${res.status} ${texto}`, { status: 500 })
  }

  return NextResponse.json({ filas: filas.length, bytes: (buffer as ArrayBuffer).byteLength })
}
```

- [ ] **Step 3: Crear `vercel.json` con el cron**

Crear `vercel.json` en la raíz del repo:

```json
{
  "crons": [
    { "path": "/api/backup-drive", "schedule": "59 4 * * *" }
  ]
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: build sin errores; la ruta `/api/backup-drive` aparece listada como Route (ƒ / Dynamic).

- [ ] **Step 5: Run the full test suite (no debe romperse nada)**

Run: `npm test`
Expected: PASS (7 en export-cumplimiento + 26 en cumplimiento-export + el resto del proyecto).

- [ ] **Step 6: Commit**

```bash
git add src/datos/repositorio.ts src/app/api/backup-drive/route.ts vercel.json
git commit -m "feat(backup): ruta cron /api/backup-drive que sube el Excel maestro a Drive"
```

---

### Task 4: Apps Script + guía de configuración

Documento con el script que la usuaria pega en su cuenta de Google y los pasos exactos (carpeta, publicar Web App, env vars en Vercel, deploy, verificación).

**Files:**
- Create: `docs/BACKUP-DRIVE.md`

- [ ] **Step 1: Escribir la guía**

Crear `docs/BACKUP-DRIVE.md`:

````markdown
# Respaldo diario del Excel maestro a Google Drive

Cada noche (23:59 hora Colombia) la app regenera el Excel maestro completo (todas las
áreas y semanas) y lo sobrescribe en una carpeta de tu Google Drive.

## 1. Crear la carpeta en Drive

1. En Google Drive, creá una carpeta (p. ej. "Respaldos cronograma").
2. Abrí la carpeta y mirá la URL: `https://drive.google.com/drive/folders/XXXXXXXX`.
   El `XXXXXXXX` es el **FOLDER_ID**. Anotalo.

## 2. Crear el Apps Script

1. Andá a https://script.google.com → **Nuevo proyecto**.
2. Borrá todo y pegá esto (reemplazá los dos valores de arriba):

```javascript
function doPost(e) {
  var TOKEN = 'PON_AQUI_UN_SECRETO_LARGO';       // inventá una cadena larga
  var FOLDER_ID = 'PON_AQUI_EL_FOLDER_ID';        // de la URL de la carpeta
  var NAME = 'cumplimiento-maestro.xlsx';
  if (!e || !e.parameter || e.parameter.token !== TOKEN) {
    return ContentService.createTextOutput('unauthorized');
  }
  var bytes = Utilities.base64Decode(e.parameter.file);
  var blob = Utilities.newBlob(
    bytes,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    NAME
  );
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var it = folder.getFilesByName(NAME);
  while (it.hasNext()) it.next().setTrashed(true); // sobrescribe (Drive guarda versiones)
  folder.createFile(blob);
  return ContentService.createTextOutput('ok');
}
```

3. **Implementar → Nueva implementación** → tipo **Aplicación web**:
   - "Ejecutar como": **Yo**.
   - "Quién tiene acceso": **Cualquier persona**.
   - Implementar → autorizá los permisos que pide (es tu propia cuenta).
4. Copiá la **URL de la app web** (termina en `/exec`). Ese es el `DRIVE_WEBHOOK_URL`.
   El `TOKEN` que pusiste arriba es el `DRIVE_WEBHOOK_TOKEN`.

## 3. Variables de entorno en Vercel

En el proyecto `cronograma-ayura` → Settings → Environment Variables (Production, marcar
**Sensitive**):

- `DRIVE_WEBHOOK_URL` = la URL `/exec` de la Web App.
- `DRIVE_WEBHOOK_TOKEN` = el mismo TOKEN del script.
- `CRON_SECRET` = una cadena larga inventada (Vercel la usa para autorizar el cron).

O por CLI:

```bash
npx vercel@latest env add DRIVE_WEBHOOK_URL production
npx vercel@latest env add DRIVE_WEBHOOK_TOKEN production
npx vercel@latest env add CRON_SECRET production
```

## 4. Desplegar

```bash
npx vercel@latest deploy --prod
```

El cron (definido en `vercel.json`) solo se activa en despliegues de producción.

## 5. Verificar (manual, una vez)

Disparar la ruta con el secreto y confirmar que aparece el archivo en la carpeta:

```bash
curl -i -H "Authorization: Bearer <CRON_SECRET>" \
  https://cronograma-ayura.vercel.app/api/backup-drive
```

Esperado: `200` con `{"filas":N,"bytes":M}` y `cumplimiento-maestro.xlsx` creado/actualizado
en la carpeta de Drive.
````

- [ ] **Step 2: Commit**

```bash
git add docs/BACKUP-DRIVE.md
git commit -m "docs(backup): guía de Apps Script + configuración del respaldo a Drive"
```

---

## Verificación final (post-deploy, con la usuaria)

No es un paso de código, sino la validación end-to-end una vez que la usuaria hizo el Apps
Script y cargó las env vars:

1. `npx vercel@latest deploy --prod`.
2. `curl` a `/api/backup-drive` con el `CRON_SECRET` → esperar `200 {"filas":...}`.
3. Confirmar en Drive que `cumplimiento-maestro.xlsx` está y abre bien (columnas Semana + Área
   al frente, todas las áreas/semanas, solo CUMPLIDA/PARCIAL).
4. Dejar que el cron corra esa noche y confirmar que el archivo se actualiza solo.

## Notas de riesgo

- **Zona horaria:** `59 4 * * *` es UTC = 23:59 COT. Si Colombia cambiara de offset, revisar.
- **Tamaño del POST:** base64 de un xlsx de miles de filas queda muy por debajo del límite de
  Apps Script (~50MB) — sin problema por años.
- **Idempotencia:** un fallo puntual no pierde datos; al regenerar todo cada noche, la próxima
  corrida corrige. Por eso v1 no lleva reintentos.
- **Plan Vercel:** un cron diario (una vez al día) entra incluso en el plan Hobby.

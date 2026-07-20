# Respaldo a Drive por área (hoja General + hojas por mes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el respaldo nocturno a Drive genere **un archivo Excel por área**, cada uno con una hoja **General** (toda la info del área) + una **hoja por mes**, en vez de un único archivo con una sola hoja.

**Architecture:** Un helper de dominio `mesDeSemana` + un assembler puro `construirLibrosPorArea` (reemplaza `construirFilasMaestro`) producen, por área, la estructura de hojas. La ruta cron recorre las áreas y hace un POST por área a la Web App de Apps Script (que ahora acepta el nombre de archivo).

**Tech Stack:** Next.js (App Router, runtime nodejs), ExcelJS, Prisma, Vitest, `fetch` nativo, Google Apps Script. Sin dependencias npm nuevas.

## Global Constraints

- Un `.xlsx` por área con datos; **sin** archivo cruzado entre áreas. Áreas sin filas (solo estados que no son CUMPLIDA/PARCIAL) se omiten.
- Hoja `General`: columnas `['Mes','Semana',...COLUMNAS_CUMPLIMIENTO]`, orden Mes→Semana→día. Hojas por mes: nombre `AÑO-MM`, columnas `['Semana',...COLUMNAS_CUMPLIMIENTO]`, orden Semana→día; meses en **orden cronológico ascendente** tras `General`.
- Mes de una semana = mes del **jueves** de esa semana ISO.
- Solo actividades **propias** por área, solo `CUMPLIDA`/`PARCIAL`.
- Se **elimina** `construirFilasMaestro` y `COLUMNAS_MAESTRO` (y sus tests); se conservan `ActMaestro`, `ActExportRaw`, `CtxFilas`, `construirFilasCumplimiento`.
- Nombre de archivo: `cumplimiento-${area.replace(/[^\p{L}\p{N}]+/gu,'-')}.xlsx`.
- Sin cambios al cron/horario, tope de programación, ni autorización. Sin dependencias npm nuevas.
- Verificar con `npm test` (Vitest) y `npx next build` (el `npm run build` local falla por `DIRECT_URL` ausente — usar `npx next build`; no tocar la DB).
- El archivo de tests del assembler es `src/datos/export-cumplimiento.test.ts`.

---

### Task 1: Helper de dominio `mesDeSemana` + tests

**Files:**
- Modify: `src/dominio/semana.ts` (agregar la función después de `fechasDeSemana`)
- Modify: `src/dominio/semana.test.ts` (agregar `describe`)

**Interfaces:**
- Produces: `mesDeSemana(anio: number, semana: number): { anio: number; mes: number }`

- [ ] **Step 1: Write the failing test**

Agregar al final de `src/dominio/semana.test.ts` (asegurar que `mesDeSemana` esté en el import de `'./semana'`):

```ts
describe('mesDeSemana', () => {
  it('semana normal → su mes', () => {
    expect(mesDeSemana(2026, 30)).toEqual({ anio: 2026, mes: 7 }) // lunes 20-jul
  })
  it('semana que cruza fin de mes → mes del jueves', () => {
    // 2026-W27: lunes 29-jun, jueves 2-jul → julio (no junio)
    expect(mesDeSemana(2026, 27)).toEqual({ anio: 2026, mes: 7 })
  })
  it('agosto', () => {
    expect(mesDeSemana(2026, 35)).toEqual({ anio: 2026, mes: 8 }) // jueves 27-ago
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dominio/semana.test.ts`
Expected: FAIL — `mesDeSemana is not a function` / no exportada.

- [ ] **Step 3: Write minimal implementation**

Agregar en `src/dominio/semana.ts` justo después de `fechasDeSemana` (que ya existe):

```ts
// Mes calendario (1-12) al que pertenece una semana ISO: el del JUEVES de esa semana
// (misma convención que semanasDelMes), para que una semana no se parta entre dos meses.
export function mesDeSemana(anio: number, semana: number): { anio: number; mes: number } {
  const jueves = fechasDeSemana(anio, semana)[3] // [0]=lunes ... [3]=jueves
  return { anio: jueves.getUTCFullYear(), mes: jueves.getUTCMonth() + 1 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dominio/semana.test.ts`
Expected: PASS (existentes + 3 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/semana.ts src/dominio/semana.test.ts
git commit -m "feat(semana): helper mesDeSemana (mes del jueves de la semana ISO)"
```

---

### Task 2: Assembler `construirLibrosPorArea` (reemplaza el maestro plano)

**Files:**
- Modify: `src/datos/export-cumplimiento.ts` (agregar `construirLibrosPorArea` + tipos; eliminar `construirFilasMaestro` y `COLUMNAS_MAESTRO`)
- Modify: `src/datos/export-cumplimiento.test.ts` (reemplazar el `describe('construirFilasMaestro')` por `describe('construirLibrosPorArea')`)

**Interfaces:**
- Consumes: `construirFilasCumplimiento`, `ActMaestro`, `CtxFilas` (ya en el archivo); `COLUMNAS_CUMPLIMIENTO` (dominio); `fechasDeSemana`, `mesDeSemana` (dominio, Task 1).
- Produces:
  - `type HojaExport = { nombre: string; columnas: string[]; filas: (string|number)[][] }`
  - `type LibroArea = { area: string; hojas: HojaExport[] }` (hojas[0] = General, luego meses asc)
  - `construirLibrosPorArea(actividades: ActMaestro[], catalogo: {nombre;unidad}[], maquinas: {id;nombre}[], responsables: {id;nombre}[]): LibroArea[]`

- [ ] **Step 1: Write the failing test**

En `src/datos/export-cumplimiento.test.ts`, **eliminar** el bloque `describe('construirFilasMaestro', …)` completo (líneas ~45-77: el import mid-file de `construirFilasMaestro/COLUMNAS_MAESTRO/ActMaestro`, el helper `actMaestro` y el describe). Reemplazarlo por (importando `construirLibrosPorArea`, `ActMaestro`, y re-declarando el helper `actMaestro`):

```ts
import { construirLibrosPorArea, type ActMaestro } from './export-cumplimiento'

const actMaestro = (over: Partial<ActMaestro>): ActMaestro => ({
  ...base, areaId: 'ar1', anio: 2026, semana: 30, area: { nombre: 'Ganadería' }, ...over,
})

describe('construirLibrosPorArea', () => {
  it('un libro por área, ordenado por nombre; área sin datos (no CUMPLIDA/PARCIAL) omitida', () => {
    const gan = actMaestro({ id: 'g1', tareaId: 'tg1' })
    const nel = actMaestro({ id: 'n1', tareaId: 'tn1', areaId: 'ar2', area: { nombre: 'Nelore' } })
    const noData = actMaestro({ id: 'x', tareaId: 'tx', areaId: 'ar3', area: { nombre: 'Zzz' }, estado: 'NO_CUMPLIDA' })
    const libros = construirLibrosPorArea([nel, gan, noData], [], [], [])
    expect(libros.map((l) => l.area)).toEqual(['Ganadería', 'Nelore'])
  })

  it('hoja General con columnas [Mes, Semana, ...] y una hoja por mes en orden ascendente', () => {
    const jul = actMaestro({ id: 'j', tareaId: 'tj', semana: 27 }) // W27 → 2026-07
    const ago = actMaestro({ id: 'a', tareaId: 'ta', semana: 35 }) // W35 → 2026-08
    const [libro] = construirLibrosPorArea([ago, jul], [], [], [])
    expect(libro.hojas.map((h) => h.nombre)).toEqual(['General', '2026-07', '2026-08'])
    const general = libro.hojas[0]
    expect(general.columnas[0]).toBe('Mes')
    expect(general.columnas[1]).toBe('Semana')
    expect(general.filas).toHaveLength(2)
    expect(general.filas[0][0]).toBe('2026-07') // Mes de la primera fila (orden asc)
    expect(general.filas[1][0]).toBe('2026-08')
  })

  it('cada hoja de mes tiene columnas [Semana, ...] y solo las filas de ese mes', () => {
    const jul = actMaestro({ id: 'j', tareaId: 'tj', semana: 27 })
    const ago = actMaestro({ id: 'a', tareaId: 'ta', semana: 35 })
    const [libro] = construirLibrosPorArea([jul, ago], [], [], [])
    const hojaJul = libro.hojas.find((h) => h.nombre === '2026-07')!
    expect(hojaJul.columnas[0]).toBe('Semana')
    expect(hojaJul.filas).toHaveLength(1)
    expect(hojaJul.filas[0][0]).toBe('2026-S27')
    const hojaAgo = libro.hojas.find((h) => h.nombre === '2026-08')!
    expect(hojaAgo.filas).toHaveLength(1)
    expect(hojaAgo.filas[0][0]).toBe('2026-S35')
  })
})
```

(Nota: `base` es el `ActExportRaw` ya declarado arriba en el archivo para los tests de `construirFilasCumplimiento`; reutilizarlo.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/datos/export-cumplimiento.test.ts`
Expected: FAIL — `construirLibrosPorArea` no existe (y `construirFilasMaestro`/`COLUMNAS_MAESTRO` ya no se importan).

- [ ] **Step 3: Write minimal implementation**

En `src/datos/export-cumplimiento.ts`:

(a) Actualizar el import de dominio de la línea 6 para incluir `mesDeSemana`:

```ts
import { fechasDeSemana, mesDeSemana } from '@/dominio/semana'
```

(b) **Eliminar** `export const COLUMNAS_MAESTRO = …` y toda la función `export function construirFilasMaestro(…) { … }`. **Conservar** `ActMaestro` (se sigue usando como tipo de entrada).

(c) Agregar al final del archivo:

```ts
export type HojaExport = { nombre: string; columnas: string[]; filas: (string | number)[][] }
export type LibroArea = { area: string; hojas: HojaExport[] } // hojas[0] = General, luego meses asc

const COLS_GENERAL: string[] = ['Mes', 'Semana', ...COLUMNAS_CUMPLIMIENTO]
const COLS_MES: string[] = ['Semana', ...COLUMNAS_CUMPLIMIENTO]

// Un libro (archivo) por área con datos: hoja "General" (todas las filas del área con
// columnas Mes+Semana, orden Mes→Semana) + una hoja por mes (nombre "AÑO-MM", columnas
// Semana+…, orden Semana), en orden cronológico ascendente. Solo propias, solo CUMPLIDA/PARCIAL.
export function construirLibrosPorArea(
  actividades: ActMaestro[],
  catalogo: { nombre: string; unidad: string }[],
  maquinas: { id: string; nombre: string }[],
  responsables: { id: string; nombre: string }[],
): LibroArea[] {
  const unidadPorNombre = Object.fromEntries(catalogo.map((e) => [e.nombre, e.unidad]))
  const mapMaquina = new Map(maquinas.map((m) => [m.id, m.nombre]))
  const mapResponsable = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombreMaquina = (id: string | null) => (id ? mapMaquina.get(id) ?? '' : '')
  const nombreResponsable = (id: string | null) => (id ? mapResponsable.get(id) ?? '' : '')
  const fmtFecha = (f: Date) =>
    new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  // Agrupar por área.
  const porArea = new Map<string, { areaNombre: string; items: ActMaestro[] }>()
  for (const a of actividades) {
    const g = porArea.get(a.areaId) ?? { areaNombre: a.area.nombre, items: [] }
    g.items.push(a)
    porArea.set(a.areaId, g)
  }

  const libros: LibroArea[] = []
  const areas = [...porArea.values()].sort((x, y) => x.areaNombre.localeCompare(y.areaNombre))
  for (const area of areas) {
    // Agrupar las actividades del área por (año, semana) y armar sus filas.
    const porSemana = new Map<string, { anio: number; semana: number; items: ActMaestro[] }>()
    for (const a of area.items) {
      const k = `${a.anio}|${a.semana}`
      const g = porSemana.get(k) ?? { anio: a.anio, semana: a.semana, items: [] }
      g.items.push(a)
      porSemana.set(k, g)
    }
    type FilaMes = { anioMes: number; mesLabel: string; semana: number; semanaLabel: string; fila: (string | number)[] }
    const todas: FilaMes[] = []
    for (const s of porSemana.values()) {
      const fechas = fechasDeSemana(s.anio, s.semana)
      const fechaDeDia = (dia: number) => (fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : '')
      const ctx: CtxFilas = { unidadPorNombre, nombreMaquina, nombreResponsable, fechaDeDia }
      const { anio: ma, mes } = mesDeSemana(s.anio, s.semana)
      const mesLabel = `${ma}-${String(mes).padStart(2, '0')}`
      const semanaLabel = `${s.anio}-S${s.semana}`
      for (const fila of construirFilasCumplimiento(s.items, ctx, () => '')) {
        todas.push({ anioMes: ma * 100 + mes, mesLabel, semana: s.semana, semanaLabel, fila })
      }
    }
    if (todas.length === 0) continue // área sin datos → sin archivo

    const general: HojaExport = {
      nombre: 'General',
      columnas: COLS_GENERAL,
      filas: [...todas]
        .sort((a, b) => a.anioMes - b.anioMes || a.semana - b.semana)
        .map((r) => [r.mesLabel, r.semanaLabel, ...r.fila]),
    }
    // "AÑO-MM" ordena lexicográficamente = cronológico.
    const meses = [...new Set(todas.map((r) => r.mesLabel))].sort()
    const hojasMes: HojaExport[] = meses.map((mesLabel) => ({
      nombre: mesLabel,
      columnas: COLS_MES,
      filas: todas
        .filter((r) => r.mesLabel === mesLabel)
        .sort((a, b) => a.semana - b.semana)
        .map((r) => [r.semanaLabel, ...r.fila]),
    }))

    libros.push({ area: area.areaNombre, hojas: [general, ...hojasMes] })
  }
  return libros
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/datos/export-cumplimiento.test.ts`
Expected: PASS (los de `construirFilasCumplimiento` + los 3 nuevos de `construirLibrosPorArea`).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. (Si algún otro test referenciaba `construirFilasMaestro`/`COLUMNAS_MAESTRO`, no debería — solo estaban en este archivo de test y en la ruta, que se actualiza en Task 3.)

- [ ] **Step 6: Commit**

```bash
git add src/datos/export-cumplimiento.ts src/datos/export-cumplimiento.test.ts
git commit -m "feat(export): construirLibrosPorArea (General + hojas por mes); quita el maestro plano"
```

---

### Task 3: Ruta cron — un archivo por área

**Files:**
- Modify: `src/app/api/backup-drive/route.ts`

**Interfaces:**
- Consumes: `construirLibrosPorArea`, `ActMaestro` (Task 2).

- [ ] **Step 1: Reescribir el cuerpo de generación/subida**

En `src/app/api/backup-drive/route.ts`:

(a) Cambiar el import de `@/datos/export-cumplimiento`:

```ts
import { construirLibrosPorArea, type ActMaestro } from '@/datos/export-cumplimiento'
```

(b) Reemplazar TODO el bloque dentro del `try { … }` (desde `const filas = …` hasta el `return NextResponse.json(...)` de éxito) por:

```ts
    const libros = construirLibrosPorArea(
      actividades as unknown as ActMaestro[],
      estipuladas,
      maquinas,
      responsables,
    )

    const fallidas: string[] = []
    for (const libro of libros) {
      const wb = new ExcelJS.Workbook()
      for (const hoja of libro.hojas) {
        const ws = wb.addWorksheet(hoja.nombre)
        const header = ws.addRow(hoja.columnas)
        header.font = { bold: true }
        for (const fila of hoja.filas) ws.addRow(fila)
      }
      const buffer = await wb.xlsx.writeBuffer()
      const safe = libro.area.replace(/[^\p{L}\p{N}]+/gu, '-')
      const body = new URLSearchParams({
        token,
        name: `cumplimiento-${safe}.xlsx`,
        file: Buffer.from(buffer).toString('base64'),
      })
      const res = await fetch(url, { method: 'POST', body })
      const texto = (await res.text()).trim()
      if (!res.ok || texto !== 'ok') {
        console.error(`[backup-drive] fallo al subir "${libro.area}": ${res.status} ${texto}`)
        fallidas.push(libro.area)
      }
    }

    if (fallidas.length > 0) {
      return new NextResponse(`fallaron áreas: ${fallidas.join(', ')}`, { status: 500 })
    }
    return NextResponse.json({ archivos: libros.length, areas: libros.map((l) => l.area) })
```

(Conservar sin cambios: los `export const runtime`/`maxDuration`, el guard de `CRON_SECRET`, el guard de `DRIVE_WEBHOOK_URL`/`TOKEN`, el `Promise.all` de carga de datos, el `try/catch` con su `console.error` final.)

- [ ] **Step 2: Verificar compilación**

Run: `npx next build`
Expected: compila sin errores; `/api/backup-drive` aparece como ruta Dynamic. No debe quedar ninguna referencia a `construirFilasMaestro`/`COLUMNAS_MAESTRO`.

- [ ] **Step 3: Full suite**

Run: `npm test`
Expected: PASS (sin regresiones).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/backup-drive/route.ts
git commit -m "feat(backup): un archivo por área (General + hojas por mes) en el cron a Drive"
```

---

### Task 4: Apps Script (aceptar nombre de archivo) + guía

**Files:**
- Modify: `docs/BACKUP-DRIVE.md`

- [ ] **Step 1: Actualizar el script y la guía**

En `docs/BACKUP-DRIVE.md`:

(a) En el bloque ```javascript del `doPost`, cambiar la línea del nombre fijo:

De:
```javascript
  var NAME = 'cumplimiento-maestro.xlsx';
```
A:
```javascript
  var NAME = (e.parameter.name || 'cumplimiento-maestro.xlsx');
```

(b) Actualizar la descripción del principio para reflejar la estructura nueva. Reemplazar la línea introductoria por:

```markdown
Cada noche (23:59 hora Colombia) la app genera **un archivo Excel por área** en tu carpeta de Drive.
Cada archivo (`cumplimiento-<Área>.xlsx`) tiene una hoja **General** (toda la info del área) y una
**hoja por mes**. Se sobrescriben cada noche.
```

(c) Agregar, después del bloque del script, una nota de **re-implementación** (el `/exec` corre la versión desplegada, no el editor):

```markdown
> **Al cambiar el código del Apps Script** (por esta actualización): pegá el código nuevo, guardá
> (💾) y **volvé a implementar** para que la URL `/exec` use la versión nueva:
> **Implementar → Administrar implementaciones → ✏️ (editar) → Versión: Nueva versión → Implementar**.
> La URL `/exec` NO cambia, así que no hay que tocar las variables en Vercel.
```

(d) En la sección de verificación, ajustar el resultado esperado:

```markdown
Esperado: `200` con `{"archivos":N,"areas":[...]}` y, en la carpeta de Drive, **un archivo por área**
(`cumplimiento-<Área>.xlsx`), cada uno con hoja `General` + hojas por mes. (El viejo
`cumplimiento-maestro.xlsx` queda sin usar; se puede borrar a mano.)
```

- [ ] **Step 2: Commit**

```bash
git add docs/BACKUP-DRIVE.md
git commit -m "docs(backup): Apps Script acepta nombre + estructura por área/mes"
```

---

## Verificación final (post-deploy, con la usuaria)

1. La usuaria pega el `doPost` actualizado y **re-implementa** (nueva versión) la Web App.
2. `npx vercel@latest deploy --prod`.
3. `curl -H "Authorization: Bearer <CRON_SECRET>" .../api/backup-drive` → `200 {"archivos":N,...}`.
4. En Drive: un archivo por área, con hoja `General` + hojas por mes en orden ascendente. Borrar el
   viejo `cumplimiento-maestro.xlsx`.

## Notas de riesgo

- **Re-implementación del Apps Script** es imprescindible: sin eso, `/exec` sigue corriendo la versión
  vieja (nombre fijo) y todos los archivos se pisarían en uno solo.
- **N POSTs secuenciales** (una por área, 4-6). Muy por debajo de `maxDuration=60`.
- **Semanas que cruzan meses:** van al mes del jueves (una semana no se parte).
- **Fallo parcial:** si una área falla, se suben las demás y la ruta responde 500 nombrándola; el cron
  nocturno idempotente lo corrige a la próxima.

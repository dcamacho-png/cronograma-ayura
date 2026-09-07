# Potreros retirados y mapa nuevo de Entremontes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poder retirar un potrero (que deje de ofrecerse al programar sin perder su historial) y con eso adoptar el levantamiento GIS de Entremontes: borrar 43 potreros nunca usados, retirar 52 con historial y crear los 58 del mapa nuevo.

**Architecture:** Una bandera `activo` en `Lote`, igual que `Responsable.activo`. `listarLotes()` filtra activos, lo que cubre de un solo cambio los selectores de las cuatro pantallas que la consumen; `/configuracion` usa una consulta aparte que ve todo. La decisión de "se puede borrar" vive en el dominio como función pura para poder probarla, y el repositorio la aplica dentro de la transacción del borrado. El paso de datos de Entremontes es un script de un solo uso con ensayo en seco y respaldo.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 6 + Postgres (Neon), Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-07-potreros-retirados-y-mapa-entremontes-design.md`

## Global Constraints

- El código y los comentarios van **en español**, como el resto del repositorio.
- **No se reescribe historial.** Ninguna tarea modifica `Actividad`, `Tarea` ni `NotaConservatorio`.
- El paso de datos toca **solo la finca Entremontes**: filtra por su `fincaId` y opera sobre listas explícitas de identificadores.
- Las migraciones de Prisma se aplican por `prisma migrate deploy` en el build de Vercel, que usa `DIRECT_URL` (host de Neon **sin** `-pooler`). No correr `migrate dev` ni `migrate reset` contra producción.
- La `DATABASE_URL` de producción no está en `.env`: sale de `.claude/settings.local.json`. Los scripts la leen del archivo; no interpolarla en la línea de órdenes.
- `npx tsc --noEmit` da falso verde por `.next`: usar **`npx tsc -p tsconfig.check.json --noEmit`**.

---

### Task 1: Regla de dominio "¿se puede borrar este potrero?"

Función pura que decide si un potrero puede borrarse y arma el texto del motivo. La necesita el repositorio (Task 2) y la pantalla (Task 3).

**Files:**
- Create: `src/dominio/lote-retiro.ts`
- Test: `src/dominio/lote-retiro.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type ReferenciasLote = { actividades: number; tareas: number; tareasMulti: number; notas: number }`
  - `totalReferencias(r: ReferenciasLote): number`
  - `puedeBorrarse(r: ReferenciasLote): boolean`
  - `textoReferencias(r: ReferenciasLote): string`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/dominio/lote-retiro.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  totalReferencias, puedeBorrarse, textoReferencias, type ReferenciasLote,
} from './lote-retiro'

const refs = (p: Partial<ReferenciasLote> = {}): ReferenciasLote =>
  ({ actividades: 0, tareas: 0, tareasMulti: 0, notas: 0, ...p })

describe('totalReferencias', () => {
  it('suma las cuatro relaciones', () => {
    expect(totalReferencias(refs({ actividades: 2, tareas: 1, tareasMulti: 3, notas: 1 }))).toBe(7)
  })
  it('sin referencias suma 0', () => {
    expect(totalReferencias(refs())).toBe(0)
  })
})

describe('puedeBorrarse', () => {
  it('un potrero sin ninguna referencia se puede borrar', () => {
    expect(puedeBorrarse(refs())).toBe(true)
  })
  it('una sola referencia de cualquier tipo lo bloquea', () => {
    expect(puedeBorrarse(refs({ actividades: 1 }))).toBe(false)
    expect(puedeBorrarse(refs({ tareas: 1 }))).toBe(false)
    expect(puedeBorrarse(refs({ tareasMulti: 1 }))).toBe(false)
    expect(puedeBorrarse(refs({ notas: 1 }))).toBe(false)
  })
})

describe('textoReferencias', () => {
  it('singular y plural de actividades', () => {
    expect(textoReferencias(refs({ actividades: 1 }))).toBe('1 actividad')
    expect(textoReferencias(refs({ actividades: 3 }))).toBe('3 actividades')
  })
  it('las dos relaciones de tarea se suman en un solo término', () => {
    expect(textoReferencias(refs({ tareas: 1, tareasMulti: 2 }))).toBe('3 tareas')
    expect(textoReferencias(refs({ tareasMulti: 1 }))).toBe('1 tarea')
  })
  it('nota en singular y plural', () => {
    expect(textoReferencias(refs({ notas: 1 }))).toBe('1 nota del conversatorio')
    expect(textoReferencias(refs({ notas: 2 }))).toBe('2 notas del conversatorio')
  })
  it('varias clases se enumeran separadas por coma, en orden fijo', () => {
    expect(textoReferencias(refs({ actividades: 2, tareas: 3, notas: 1 })))
      .toBe('2 actividades, 3 tareas, 1 nota del conversatorio')
  })
  it('sin referencias da texto vacío', () => {
    expect(textoReferencias(refs())).toBe('')
  })
})
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `npx vitest run src/dominio/lote-retiro.test.ts`
Expected: FAIL — `Cannot find module './lote-retiro'`

- [ ] **Step 3: Escribir la implementación mínima**

Crear `src/dominio/lote-retiro.ts`:

```ts
// Un potrero se puede BORRAR solo si nada lo referencia. Si tiene historial se
// RETIRA (bandera `activo`), que lo saca de los selectores conservando el pasado.
//
// Importa contar las cuatro relaciones: `actividades` y `tareasMulti` son
// muchos-a-muchos IMPLÍCITAS, así que borrar el potrero no falla — Prisma elimina
// las filas intermedias y el potrero desaparece del historial sin aviso.
export type ReferenciasLote = {
  actividades: number
  tareas: number
  tareasMulti: number
  notas: number
}

export function totalReferencias(r: ReferenciasLote): number {
  return r.actividades + r.tareas + r.tareasMulti + r.notas
}

export function puedeBorrarse(r: ReferenciasLote): boolean {
  return totalReferencias(r) === 0
}

const termino = (n: number, singular: string, plural: string) =>
  n === 0 ? null : `${n} ${n === 1 ? singular : plural}`

// "2 actividades, 3 tareas, 1 nota del conversatorio". Las dos relaciones de tarea
// (lote único y multi-lote) son la misma cosa para quien lee, así que se suman.
export function textoReferencias(r: ReferenciasLote): string {
  return [
    termino(r.actividades, 'actividad', 'actividades'),
    termino(r.tareas + r.tareasMulti, 'tarea', 'tareas'),
    termino(r.notas, 'nota del conversatorio', 'notas del conversatorio'),
  ].filter(Boolean).join(', ')
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `npx vitest run src/dominio/lote-retiro.test.ts`
Expected: PASS — 9 pruebas

- [ ] **Step 5: Commit**

```bash
git add src/dominio/lote-retiro.ts src/dominio/lote-retiro.test.ts
git commit -m "feat(potreros): regla de dominio para borrar o retirar un potrero"
```

---

### Task 2: Columna `activo` y consultas del repositorio

Agrega el campo, hace que `listarLotes()` devuelva solo activos, agrega la consulta que ve todo y la que voltea la bandera, y pone la guarda en el borrado.

Las consultas de Prisma no tienen pruebas unitarias en este repositorio (todas las pruebas son de dominio puro, sin base de datos). Se verifican con el chequeo de tipos, la compilación y la verificación en navegador de la Task 4.

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Lote`, ~línea 193)
- Create: `prisma/migrations/20260907120000_lote_activo/migration.sql`
- Modify: `src/datos/repositorio.ts:665-678` (`listarLotes`, `eliminarLote`)

**Interfaces:**
- Consumes: `puedeBorrarse`, `textoReferencias`, `type ReferenciasLote` de `@/dominio/lote-retiro` (Task 1); `BloqueoError` de `@/datos/repositorio` (ya existe, línea 384).
- Produces:
  - `listarLotes()` — sin cambio de firma; ahora solo activos.
  - `listarLotesTodos()` — activos y retirados, con `_count` de las cuatro relaciones.
  - `setLoteActivo(id: string, activo: boolean)`
  - `eliminarLote(id: string)` — ahora lanza `BloqueoError` si el potrero tiene referencias.

- [ ] **Step 1: Agregar el campo al esquema**

En `prisma/schema.prisma`, dentro de `model Lote`, después de `tipoPasto`:

```prisma
model Lote {
  id          String      @id @default(cuid())
  nombre      String      @unique
  hectareas   Float?
  tipoPasto   String?
  // Un potrero retirado (activo=false) no se ofrece al programar ni al registrar,
  // pero conserva su nombre y su medida en todo lo ya registrado.
  activo      Boolean     @default(true)
  fincaId     String
  // …resto igual
}
```

- [ ] **Step 2: Escribir la migración a mano**

Crear `prisma/migrations/20260907120000_lote_activo/migration.sql`:

```sql
-- Potrero retirado: sale de los selectores conservando su historial.
-- Aditiva y con TRUE por defecto: al desplegar nada cambia de comportamiento.
ALTER TABLE "Lote" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
```

- [ ] **Step 3: Regenerar el cliente de Prisma**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 4: Cambiar las consultas**

En `src/datos/repositorio.ts`, reemplazar el bloque de `listarLotes` y `eliminarLote` (líneas 665-678) por:

```ts
// Catálogo de potreros para elegir al programar y registrar: solo los ACTIVOS.
// Un solo filtro aquí cubre los selectores de /configuracion, /conservatorio,
// /cumplimiento y /tareas, que son las cuatro pantallas que la consumen.
export function listarLotes() {
  return prisma.lote.findMany({
    where: { activo: true },
    include: { finca: true },
    orderBy: [{ finca: { nombre: 'asc' } }, { nombre: 'asc' }],
  })
}

// Activos y retirados, con el conteo de referencias de cada uno. Solo para
// /configuracion, que es donde se administran. Los retirados van al final.
export function listarLotesTodos() {
  return prisma.lote.findMany({
    include: {
      finca: true,
      _count: { select: { actividades: true, tareas: true, tareasMulti: true, notasConservatorio: true } },
    },
    orderBy: [{ activo: 'desc' }, { finca: { nombre: 'asc' } }, { nombre: 'asc' }],
  })
}

export function setLoteActivo(id: string, activo: boolean) {
  return prisma.lote.update({ where: { id }, data: { activo } })
}

export function crearLote(nombre: string, fincaId: string, hectareas: number | null, tipoPasto: string | null) {
  return prisma.lote.create({ data: { nombre, fincaId, hectareas, tipoPasto } })
}

// Borra el potrero SOLO si nada lo referencia. `actividades` y `tareasMulti` son
// muchos-a-muchos implícitas: sin esta guarda el borrado no falla, elimina las filas
// intermedias y saca el potrero del historial en silencio. El conteo va DENTRO de la
// transacción para que no se cuele una referencia entre la lectura y el borrado.
export async function eliminarLote(id: string) {
  return prisma.$transaction(async (tx) => {
    const lote = await tx.lote.findUnique({
      where: { id },
      select: {
        nombre: true,
        _count: { select: { actividades: true, tareas: true, tareasMulti: true, notasConservatorio: true } },
      },
    })
    if (!lote) throw new BloqueoError('Ese potrero ya no existe.')
    const refs: ReferenciasLote = {
      actividades: lote._count.actividades,
      tareas: lote._count.tareas,
      tareasMulti: lote._count.tareasMulti,
      notas: lote._count.notasConservatorio,
    }
    if (!puedeBorrarse(refs)) {
      throw new BloqueoError(
        `No se puede eliminar "${lote.nombre}": tiene ${textoReferencias(refs)}. `
        + 'Retíralo en su lugar: deja de aparecer al programar y conserva el historial.',
      )
    }
    return tx.lote.delete({ where: { id } })
  })
}
```

Agregar el import junto a los otros de dominio, arriba del archivo:

```ts
import { puedeBorrarse, textoReferencias, type ReferenciasLote } from '@/dominio/lote-retiro'
```

- [ ] **Step 5: Verificar tipos, pruebas y compilación**

```bash
npx vitest run
npx tsc -p tsconfig.check.json --noEmit
npx eslint src
DATABASE_URL="postgresql://u:p@localhost:5432/none" SESION_SECRET=dev npx next build
```

Expected: pruebas en verde (las de Task 1 incluidas), `tsc` sin salida, `eslint` sin errores nuevos, "Compiled successfully".

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260907120000_lote_activo src/datos/repositorio.ts
git commit -m "feat(potreros): bandera activo, consulta de retirados y guarda en el borrado"
```

---

### Task 3: Retirar y reactivar desde /configuracion

La lista de potreros muestra activos y retirados, permite retirar y reactivar, y ofrece eliminar solo cuando el potrero no tiene referencias.

**Files:**
- Modify: `src/app/configuracion/lotes-lista.tsx` (archivo completo)
- Modify: `src/app/configuracion/page.tsx:67` (`listarLotes()` → `listarLotesTodos()`) y `:140-142` (encabezado y props)
- Modify: `src/app/configuracion/acciones.ts:5` (import) y agregar dos acciones

**Interfaces:**
- Consumes: `listarLotesTodos()`, `setLoteActivo()` (Task 2); `correr()` y `texto()` de `acciones.ts` (ya existen).
- Produces: `retirarLoteAccion(form: FormData)`, `reactivarLoteAccion(form: FormData)`.

- [ ] **Step 1: Agregar las dos acciones**

En `src/app/configuracion/acciones.ts`, agregar `setLoteActivo` al import de `@/datos/repositorio` (línea 5) y, junto a `eliminarLoteAccion` (~línea 169):

```ts
export async function retirarLoteAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  await correr(() => setLoteActivo(id, false), 'Potrero retirado.')
}

export async function reactivarLoteAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  await correr(() => setLoteActivo(id, true), 'Potrero reactivado.')
}
```

`correr()` ya exige rol ADMIN y redirige con el aviso, así que no hace falta más autorización.

- [ ] **Step 2: Reescribir la lista de potreros**

Reemplazar `src/app/configuracion/lotes-lista.tsx` completo:

```tsx
'use client'

import { useState } from 'react'
import { FormEliminar } from './form-eliminar'

type Lote = {
  id: string
  nombre: string
  hectareas: number | null
  tipoPasto: string | null
  activo: boolean
  referencias: number
  finca: { nombre: string }
}

// Lista de potreros con buscador. Los retirados (no se ofrecen al programar) van
// atenuados y con su marca; eliminar solo se ofrece cuando nada los referencia,
// porque borrar un potrero usado lo saca del historial.
export function LotesLista({
  lotes,
  eliminar,
  retirar,
  reactivar,
}: {
  lotes: Lote[]
  eliminar: (formData: FormData) => void | Promise<void>
  retirar: (formData: FormData) => void | Promise<void>
  reactivar: (formData: FormData) => void | Promise<void>
}) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const filtrados = term
    ? lotes.filter(
        (l) => l.nombre.toLowerCase().includes(term) || l.finca.nombre.toLowerCase().includes(term),
      )
    : lotes
  const activos = lotes.filter((l) => l.activo).length

  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar potrero por nombre o finca…"
        className="mb-2 w-full rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
      />
      <p className="mb-2 text-xs text-tierra">
        {filtrados.length} de {lotes.length} · {activos} activos · {lotes.length - activos} retirados
      </p>
      <ul className="mb-3 max-h-72 space-y-1 overflow-y-auto">
        {filtrados.map((l) => (
          <li key={l.id} className={`flex items-center gap-2 text-sm ${l.activo ? '' : 'opacity-60'}`}>
            <span className="flex-1">
              {l.nombre}
              {!l.activo && (
                <span className="ml-2 rounded-full bg-arena px-2 py-0.5 text-xs font-semibold text-tierra">
                  retirado
                </span>
              )}
              <span className="text-tierra">
                {' · '}
                {l.finca.nombre}
                {l.hectareas ? ` · ${l.hectareas} ha` : ''}
                {l.tipoPasto ? ` · ${l.tipoPasto}` : ''}
              </span>
            </span>
            {l.activo ? (
              <form action={retirar}>
                <input type="hidden" name="id" value={l.id} />
                <button className="text-xs text-tierra hover:text-tinta hover:underline">retirar</button>
              </form>
            ) : (
              <form action={reactivar}>
                <input type="hidden" name="id" value={l.id} />
                <button className="text-xs font-semibold text-bosque hover:underline">reactivar</button>
              </form>
            )}
            {l.referencias === 0 ? (
              <FormEliminar accion={eliminar} id={l.id} etiqueta={l.nombre} />
            ) : (
              <span
                className="text-xs text-tierra/50"
                title={`Tiene ${l.referencias} registro(s) en el historial: retíralo en vez de eliminarlo.`}
              >
                en uso
              </span>
            )}
          </li>
        ))}
        {filtrados.length === 0 && <li className="text-sm text-tierra/60">Sin resultados.</li>}
      </ul>
    </>
  )
}
```

- [ ] **Step 3: Conectar la página**

En `src/app/configuracion/page.tsx`:

1. En el import de `@/datos/repositorio`, cambiar `listarLotes` por `listarLotesTodos`.
2. En el `Promise.all` (línea 67), cambiar `listarLotes()` por `listarLotesTodos()`.
3. En el import de `./acciones`, agregar `retirarLoteAccion` y `reactivarLoteAccion`.
4. Reemplazar el encabezado y el uso del componente (líneas 140-142) por:

```tsx
          <h3 className="mb-2 font-semibold text-tinta">
            Lotes / Potreros ({lotes.filter((l) => l.activo).length} activos)
          </h3>
          <p className="mb-3 text-xs text-tierra">
            Al crear actividades eliges el lote y la finca queda automática. Un potrero
            <b> retirado</b> deja de aparecer al programar y registrar, pero conserva su historial.
          </p>
          <LotesLista
            lotes={lotes.map((l) => ({
              id: l.id,
              nombre: l.nombre,
              hectareas: l.hectareas,
              tipoPasto: l.tipoPasto,
              activo: l.activo,
              referencias: l._count.actividades + l._count.tareas + l._count.tareasMulti + l._count.notasConservatorio,
              finca: { nombre: l.finca.nombre },
            }))}
            eliminar={eliminarLoteAccion}
            retirar={retirarLoteAccion}
            reactivar={reactivarLoteAccion}
          />
```

- [ ] **Step 4: Verificar tipos, pruebas y compilación**

```bash
npx vitest run
npx tsc -p tsconfig.check.json --noEmit
npx eslint src
DATABASE_URL="postgresql://u:p@localhost:5432/none" SESION_SECRET=dev npx next build
```

Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add src/app/configuracion
git commit -m "feat(configuracion): retirar y reactivar potreros; eliminar solo si no tienen historial"
```

---

### Task 4: Verificar en el navegador que un potrero retirado desaparece de los selectores

Es lo único que las pruebas de dominio no pueden cubrir: que el filtro llegue a los selectores. Se hace contra un **schema Postgres aislado** en la misma base Neon, con un fixture mínimo (el seed completo tarda ~10 minutos).

**Files:**
- Create: `<scratchpad>/retiro/env-prueba.mjs`, `<scratchpad>/retiro/fixture.mjs`, `<scratchpad>/retiro/servidor.mjs`, `<scratchpad>/retiro/probar.mjs`

**Interfaces:**
- Consumes: la app tal como quedó tras las Tasks 2 y 3.
- Produces: nada de código de producción. Todo lo de esta tarea es descartable.

- [ ] **Step 1: Preparar el entorno aislado**

`env-prueba.mjs` (lee la cadena de producción y le agrega un schema propio):

```js
import { readFileSync } from 'node:fs'
const cfg = readFileSync('/home/derlly/projects/cronograma/.claude/settings.local.json', 'utf8')
const prod = cfg.match(/postgresql:\/\/[^'"]+/)[0]
export const SCHEMA = 'prueba_retiro'
const con = (u) => `${u}${u.includes('?') ? '&' : '?'}schema=${SCHEMA}`
export const env = {
  ...process.env,
  DATABASE_URL: con(prod),
  DIRECT_URL: con(prod.replace('-pooler', '')),   // migrate deploy necesita la directa
  SESION_SECRET: 'cronograma-local-secret',
}
```

- [ ] **Step 2: Crear el schema y sembrar el fixture mínimo**

Correr `prisma migrate deploy` con ese entorno (un script node que haga `spawnSync('npx', ['prisma','migrate','deploy'], { env, cwd: repo, stdio:'inherit' })`), y después `fixture.mjs`:

```js
import { env } from './env-prueba.mjs'
process.env.DATABASE_URL = env.DATABASE_URL
const { PrismaClient } = await import('/home/derlly/projects/cronograma/node_modules/@prisma/client/default.js')
const { hashPassword } = await import('/home/derlly/projects/cronograma/src/auth/password.ts')
const p = new PrismaClient()

const area = await p.area.create({ data: { nombre: 'Maquinaria' } })
const finca = await p.finca.create({ data: { nombre: 'Entremontes' } })
const resp = await p.responsable.create({ data: { nombre: 'Andrés Mosquera', areaId: area.id } })
const usuario = await p.usuario.create({
  data: { usuario: 'maquinaria', nombre: 'Maquinaria', rol: 'AREA', areaId: area.id, hash: hashPassword('prueba123') },
})
const activo1 = await p.lote.create({ data: { nombre: 'POTRERO ACTIVO A', fincaId: finca.id, hectareas: 5 } })
const activo2 = await p.lote.create({ data: { nombre: 'POTRERO ACTIVO B', fincaId: finca.id, hectareas: 3 } })
const retirado = await p.lote.create({ data: { nombre: 'POTRERO RETIRADO', fincaId: finca.id, hectareas: 9, activo: false } })

// Una actividad de la semana en curso, con un potrero activo, para abrir el form de avance.
const hoy = new Date()
const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()))
d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
const anio = d.getUTCFullYear()
const semana = Math.ceil(((d - new Date(Date.UTC(anio, 0, 1))) / 86400000 + 1) / 7)
const tarea = await p.tarea.create({ data: { areaId: area.id, descripcion: 'RASTRA', estado: 'PROGRAMADA', anioSel: anio, semanaSel: semana } })
await p.actividad.create({
  data: { anio, semana, dia: 1, descripcion: 'RASTRA', areaId: area.id, responsableId: resp.id,
          tareaId: tarea.id, estado: 'PENDIENTE', fincaId: finca.id, lotes: { connect: [{ id: activo1.id }] } },
})
console.log(JSON.stringify({ anio, semana, areaId: area.id, usuarioId: usuario.id,
  activo1: activo1.id, activo2: activo2.id, retirado: retirado.id }))
await p.$disconnect()
```

Si `hashPassword` no se puede importar desde `.ts` en un `.mjs`, usar `npx tsx` para correr el fixture con extensión `.mts`.

- [ ] **Step 3: Levantar la app contra ese schema**

`servidor.mjs` hace `spawn('npx', ['next','dev','--port','3100'], { env, cwd: repo, stdio:'inherit' })`.
Esperar la línea "Ready in" antes de seguir (un `until grep -q "Ready in" servidor.log` en segundo plano).

- [ ] **Step 4: Escribir y correr la comprobación**

`probar.mjs`, con la cookie firmada a mano (la sesión es HMAC sin tabla; en dev el secreto es `cronograma-local-secret`):

```js
import { createHmac } from 'node:crypto'
import { chromium } from 'playwright-core'

const BASE = 'http://localhost:3100'
const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'
const esc = JSON.parse(process.argv[2])
const ok = [], fallos = []
const check = (c, m) => (c ? ok.push(m) : fallos.push(m))

const nav = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await nav.newContext()
await ctx.addCookies([{
  name: 'sesion',
  value: `${esc.usuarioId}.${createHmac('sha256', 'cronograma-local-secret').update(esc.usuarioId).digest('hex')}`,
  domain: 'localhost', path: '/',
}])
const page = await ctx.newPage()

// 1. El potrero retirado no se puede anexar en el formulario de avance.
await page.goto(`${BASE}/cumplimiento?area=${esc.areaId}&anio=${esc.anio}&semana=${esc.semana}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.locator('li', { hasText: 'RASTRA' }).last().getByRole('button', { name: 'Registrar avance' }).click()
await page.waitForTimeout(500)
const opciones = await page.locator('select').last().locator('option').allInnerTexts()
check(!opciones.some((o) => o.includes('RETIRADO')), 'el potrero retirado NO se ofrece para anexar')
check(opciones.some((o) => o.includes('ACTIVO B')), 'los potreros activos sí se ofrecen')

// 2. Tampoco al crear una tarea en el banco.
await page.goto(`${BASE}/tareas?area=${esc.areaId}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const textoTareas = await page.locator('main').innerText()
check(!textoTareas.includes('POTRERO RETIRADO'), 'el potrero retirado no aparece en el banco de tareas')

await ctx.close(); await nav.close()
console.log('\n=== RESULTADO ===')
for (const m of ok) console.log('  OK   ' + m)
for (const m of fallos) console.log('  FALLA ' + m)
process.exit(fallos.length ? 1 : 0)
```

Correr con `LD_LIBRARY_PATH` apuntando al directorio de las libs de chromium
(`find /tmp/claude-1000 -name "libnspr4.so*"`).
Expected: 3 OK, 0 fallas.

- [ ] **Step 5: Ejercitar la guarda del borrado directamente**

El botón de eliminar no aparece cuando el potrero tiene historial, así que la negativa
del repositorio hay que provocarla a mano. Crear `guarda.mts` y correrlo con `npx tsx`
desde el repositorio, con el entorno del schema aislado:

```ts
import { env } from '<scratchpad>/retiro/env-prueba.mjs'
process.env.DATABASE_URL = env.DATABASE_URL
const { eliminarLote, BloqueoError } = await import('./src/datos/repositorio')
const esc = JSON.parse(process.argv[2])

// El potrero con una actividad enganchada debe negarse.
try {
  await eliminarLote(esc.activo1)
  console.log('  FALLA borró un potrero con historial')
} catch (e) {
  const ok = e instanceof BloqueoError && /1 actividad/.test(e.message)
  console.log((ok ? '  OK   ' : '  FALLA ') + 'se niega y explica el motivo: ' + (e as Error).message)
}

// El potrero sin nada enganchado sí se borra.
await eliminarLote(esc.activo2)
console.log('  OK   borró el potrero sin historial')
```

Expected: la primera llamada lanza `BloqueoError` con el texto "tiene 1 actividad…", la
segunda borra sin error.

- [ ] **Step 6: Comprobar /configuracion y borrar el schema**

Con un usuario ADMIN en el fixture (o cambiando el rol del existente), verificar a mano en `/configuracion` que "POTRERO RETIRADO" aparece atenuado con su marca y con el botón **reactivar**, y que el potrero con actividad muestra "en uso" en vez del botón de eliminar.

Después: `DROP SCHEMA IF EXISTS "prueba_retiro" CASCADE`.

- [ ] **Step 7: Commit**

No hay código de producción que commitear en esta tarea. Anotar el resultado de la verificación en el mensaje del commit de la tarea siguiente.

---

### Task 5: Desplegar el soporte de retiro (antes de tocar datos)

La columna `activo` tiene que existir en producción **antes** del paso de datos. El despliegue es seguro por sí solo: la migración pone `true` en todo, así que ningún potrero se retira todavía.

**Files:** ninguno. Solo git y Vercel.

- [ ] **Step 1: Empujar a GitHub**

```bash
git push origin master
```

- [ ] **Step 2: Desplegar a producción**

```bash
npx --yes vercel --prod --yes --scope ayura-llanos
```

El build corre `prisma migrate deploy && next build`. Si la sesión del CLI dice "Logged out", correr `npx --yes vercel teams ls` primero: revalida el token.

- [ ] **Step 3: Verificar el despliegue**

```bash
npx --yes vercel ls cronograma-ayura --scope ayura-llanos
curl -s -o /dev/null -w "%{http_code}\n" https://cronograma-ayura.vercel.app/login
```

Expected: el despliegue más reciente en `Production` / `Ready`, y HTTP 200.

Y comprobar que la columna llegó, con un script que lea la `DATABASE_URL` del archivo de settings:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='Lote' AND column_name='activo';
```

Expected: `activo | boolean | NO | true`.

- [ ] **Step 4: Confirmar que nada se retiró todavía**

```sql
SELECT count(*) FROM "Lote" WHERE activo = false;
```

Expected: `0`.

---

### Task 6: Paso de datos de Entremontes

Borra 43 potreros nunca usados, retira 52 con historial y crea los 58 del mapa nuevo. Script de un solo uso, con ensayo en seco por defecto.

**Files:**
- Create: `<scratchpad>/entremontes/aplicar-mapa.mjs`
- Reusa: `<scratchpad>/leer_xls.py` (lector del `.xls`), `<scratchpad>/plan-retiro.json` (los 43 + los 52), `<scratchpad>/a-crear.json` (los 58)

**Interfaces:**
- Consumes: la columna `activo` en producción (Task 5).
- Produces: nada de código. Deja `respaldo-mapa-entremontes.json` con el estado previo completo.

- [ ] **Step 1: Regenerar las tres listas desde el archivo y la base**

Correr, en este orden, para que las listas reflejen la base **de hoy** (la app está en uso):

```bash
python3 leer_xls.py          # valida la lectura del .xls
node uso-completo.mjs        # referencias por potrero de Entremontes
python3 plan_seguro.py       # el pareo de los 93 ya actualizados
```

y después los dos que arman las listas: el que separa `plan-retiro.json` (borrar /
inactivar) y el que arma `a-crear.json` (los polígonos del Excel que no casan con los 93).

`leer_xls.py` tiene que imprimir el encabezado con `Nombre del área` y `Área (ha)`
**completos**; si sale `Nombre del áre`, está cortando las tildes y las cifras no son
de fiar (ver el spec).

Expected: 43 a borrar (118,4 ha), 52 a retirar (445,8 ha), 58 a crear (443,7 ha). Si los números cambiaron, **parar** y reportar antes de escribir.

- [ ] **Step 2: Escribir el script**

`aplicar-mapa.mjs`:

```js
// Adopta el mapa nuevo de Entremontes. Ensayo en seco salvo que se pase --aplicar.
import { readFileSync, writeFileSync } from 'node:fs'
const DIR = new URL('.', import.meta.url).pathname
const cfg = readFileSync('/home/derlly/projects/cronograma/.claude/settings.local.json', 'utf8')
process.env.DATABASE_URL = cfg.match(/postgresql:\/\/[^'"]+/)[0]
const { PrismaClient } = await import('/home/derlly/projects/cronograma/node_modules/@prisma/client/default.js')
const prisma = new PrismaClient()
const aplicar = process.argv[2] === '--aplicar'

const { borrar, inactivar } = JSON.parse(readFileSync(`${DIR}plan-retiro.json`, 'utf8'))
const crear = JSON.parse(readFileSync(`${DIR}a-crear.json`, 'utf8'))
const finca = await prisma.finca.findFirst({ where: { nombre: { contains: 'ntremontes', mode: 'insensitive' } } })

// Respaldo completo del estado previo de la finca.
const previo = await prisma.lote.findMany({
  where: { fincaId: finca.id },
  include: { _count: { select: { actividades: true, tareas: true, tareasMulti: true, notasConservatorio: true } } },
})
writeFileSync(`${DIR}respaldo-mapa-entremontes.json`, JSON.stringify(previo, null, 1))

// Re-verificar EN ESTE MOMENTO que los 43 siguen sin referencias.
const ids = borrar.map((l) => l.id)
const frescos = await prisma.lote.findMany({
  where: { id: { in: ids } },
  include: { _count: { select: { actividades: true, tareas: true, tareasMulti: true, notasConservatorio: true } } },
})
const seguros = [], bloqueados = []
for (const l of frescos) {
  const n = l._count.actividades + l._count.tareas + l._count.tareasMulti + l._count.notasConservatorio
  if (l.fincaId !== finca.id) bloqueados.push(`${l.nombre}: no es de Entremontes`)
  else if (n > 0) bloqueados.push(`${l.nombre}: apareció con ${n} referencia(s)`)
  else seguros.push(l)
}
console.log(`borrar: ${seguros.length}/${borrar.length} | retirar: ${inactivar.length} | crear: ${crear.length}`)
for (const b of bloqueados) console.log('  se salta →', b)

if (!aplicar) {
  console.log('\n(ensayo en seco: nada se escribió; correr con --aplicar)')
} else {
  await prisma.$transaction([
    ...seguros.map((l) => prisma.lote.delete({ where: { id: l.id } })),
    ...inactivar.map((l) => prisma.lote.update({ where: { id: l.id }, data: { activo: false } })),
    ...crear.map((e) => prisma.lote.create({
      data: { nombre: e.nombre, fincaId: finca.id, hectareas: e.ha, tipoPasto: e.especie || null },
    })),
  ])
  console.log(`\n✔ ${seguros.length} borrados, ${inactivar.length} retirados, ${crear.length} creados`)
}

// Verificación posterior.
const activos = await prisma.lote.aggregate({ where: { fincaId: finca.id, activo: true }, _sum: { hectareas: true }, _count: true })
const retirados = await prisma.lote.count({ where: { fincaId: finca.id, activo: false } })
const quedan = await prisma.lote.count({ where: { id: { in: ids } } })
console.log(`activos: ${activos._count} (${activos._sum.hectareas?.toFixed(1)} ha) | retirados: ${retirados} | de los borrados quedan: ${quedan}`)
await prisma.$disconnect()
```

- [ ] **Step 3: Correr el ensayo en seco**

Run: `node aplicar-mapa.mjs`
Expected: `borrar: 43/43 | retirar: 52 | crear: 58`, sin ninguna línea "se salta". Si alguna aparece, revisarla antes de continuar.

- [ ] **Step 4: Aplicar**

Run: `node aplicar-mapa.mjs --aplicar`
Expected: `✔ 43 borrados, 52 retirados, 58 creados` y después
`activos: 151 (1326.6 ha) | retirados: 52 | de los borrados quedan: 0`.

- [ ] **Step 5: Verificar que el historial quedó intacto**

`verificar-historial.mjs`:

```js
import { readFileSync } from 'node:fs'
const DIR = new URL('.', import.meta.url).pathname
const cfg = readFileSync('/home/derlly/projects/cronograma/.claude/settings.local.json', 'utf8')
process.env.DATABASE_URL = cfg.match(/postgresql:\/\/[^'"]+/)[0]
const { PrismaClient } = await import('/home/derlly/projects/cronograma/node_modules/@prisma/client/default.js')
const p = new PrismaClient()
const previo = JSON.parse(readFileSync(`${DIR}respaldo-mapa-entremontes.json`, 'utf8'))
const antes = new Map(previo.map((l) => [l.id,
  l._count.actividades + l._count.tareas + l._count.tareasMulti + l._count.notasConservatorio]))

// 1. Los retirados conservan TODAS sus referencias.
const retirados = await p.lote.findMany({
  where: { activo: false },
  include: { _count: { select: { actividades: true, tareas: true, tareasMulti: true, notasConservatorio: true } } },
})
let malos = 0, total = 0
for (const l of retirados) {
  const n = l._count.actividades + l._count.tareas + l._count.tareasMulti + l._count.notasConservatorio
  total += n
  if (antes.get(l.id) !== n) { malos++; console.log(`  ✗ ${l.nombre}: tenía ${antes.get(l.id)}, ahora ${n}`) }
}
console.log(`retirados: ${retirados.length} | referencias conservadas: ${retirados.length - malos}/${retirados.length} | total ${total}`)

// 2. Una actividad de un potrero retirado sigue nombrándolo con su medida.
const ej = await p.actividad.findFirst({
  where: { lotes: { some: { nombre: 'LAGUNA1' } } },
  include: { lotes: { select: { nombre: true, hectareas: true, activo: true } } },
})
console.log('ejemplo LAGUNA1 →', JSON.stringify(ej?.lotes));

// 3. Las otras fincas no se movieron.
for (const f of await p.finca.findMany({ orderBy: { nombre: 'asc' } })) {
  const a = await p.lote.aggregate({ where: { fincaId: f.id, activo: true }, _sum: { hectareas: true }, _count: true })
  console.log(`${f.nombre}: ${a._count} activos, ${(a._sum.hectareas ?? 0).toFixed(1)} ha`)
}
await p.$disconnect()
```

Expected: `referencias conservadas: 52/52 | total 731`; el ejemplo muestra
`LAGUNA1` con `18.92` ha y `activo: false`; Acajure 422,9 ha y Normandía 221,8 ha
sin cambio, Entremontes 151 activos con 1.326,6 ha.

- [ ] **Step 6: Comprobar en la app desplegada**

Entrar a `/configuracion` y confirmar el contador `151 activos · 52 retirados` para Entremontes, y que al programar en `/programar` o registrar un avance en `/cumplimiento` los desplegables ofrecen los nombres nuevos ("Laguna 1", "Chile 1-A", "Orosol Sección A") y ninguno de los retirados.

- [ ] **Step 7: Anotar el resultado**

Actualizar la memoria del proyecto (`potreros-entremontes-2026-09-06.md`) con el cierre: el mapa nuevo quedó adoptado, cuántos se borraron, retiraron y crearon, y dónde quedó el respaldo.

---

## Notas de ejecución

- **El orden importa:** la Task 5 (despliegue) tiene que ir antes de la Task 6, porque el script escribe `activo=false` en una columna que solo existe después de la migración.
- **Reversión:** `respaldo-mapa-entremontes.json` tiene el estado previo de los 188 potreros. Los 52 retirados y los 58 creados se revierten con una consulta; los 43 borrados se re-crean desde el respaldo (no tenían referencias, así que no hay nada más que restaurar).
- **La base es real y está en uso.** Nunca `deleteMany` global, nunca `migrate reset`. Todo por lista explícita de identificadores y con `fincaId` verificado.

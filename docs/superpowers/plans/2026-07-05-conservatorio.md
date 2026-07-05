# Conservatorio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pantalla `/conservatorio` donde cada área escribe temas cortos para hablar con gerencia (Visor), que los marca como hablados y se ocultan a un historial.

**Architecture:** Modelo Prisma nuevo `NotaConservatorio` (aparte del banco `Tarea`). Permisos por rol: áreas crean/ven lo suyo; gerencia(VISOR)/admin ven todo y marcan. Helpers de dominio puros para separar/agrupar notas. Pantalla RSC minimalista con un form cliente para agregar.

**Tech Stack:** Next.js (App Router, esta versión con breaking changes — ver `AGENTS.md`), React Server Components, Server Actions, Prisma + Postgres (Neon), Vitest, Tailwind v4.

## Global Constraints

- **UI lo más limpia posible:** al entrar se ve solo el campo para agregar (si aplica) + lista de temas activos (texto · fecha · etiqueta de lote si tiene). Finca/lote ocultos tras "➕ contexto". Historial "Ya hablados" colapsado. Sin conteos ni adornos.
- **Fechas visibles:** cada nota muestra su fecha de creación, discreta, con `Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })`.
- **Visibilidad:** AREA ve/crea solo su área; ADMIN y VISOR ven todas, agrupadas por área.
- **Marcar/reabrir:** solo ADMIN y VISOR. **Crear:** solo AREA (con `areaId`). **Borrar:** ADMIN cualquiera; AREA solo su nota **pendiente**.
- **Sin editar** texto, sin adjuntos, sin notificaciones, sin atar a semana, sin export.
- **Typecheck:** `npx tsc --noEmit -p tsconfig.check.json` (el `tsc` normal da falso-verde por `.next`).
- **DB local = DB de producción (Neon):** el `DATABASE_URL` sale de `.claude/settings.local.json` (`grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1`). Las migraciones aditivas son seguras.

---

## File Structure

- `prisma/schema.prisma` — modelo `NotaConservatorio` + relaciones inversas en `Area`/`Finca`/`Lote` (**modificar**).
- `prisma/migrations/<timestamp>_conservatorio/migration.sql` — migración (**crear**, vía prisma).
- `src/auth/permisos.ts` — `conservatorio` en los 3 sets + `puedeMarcarConservatorio` (**modificar**).
- `src/auth/permisos.test.ts` — tests (**modificar**).
- `src/app/configuracion/usuario-pantallas.tsx` — item `conservatorio` en `PANTALLAS` (**modificar**).
- `src/app/_componentes/secciones.ts` — entrada de navegación (**modificar**).
- `src/dominio/conservatorio.ts` — `separarNotas`, `agruparPorArea` (**crear**).
- `src/dominio/conservatorio.test.ts` — tests (**crear**).
- `src/datos/repositorio.ts` — CRUD de notas (**modificar**).
- `src/app/conservatorio/acciones.ts` — server actions (**crear**).
- `src/app/conservatorio/form-nueva-nota.tsx` — form cliente para agregar (**crear**).
- `src/app/conservatorio/page.tsx` — la pantalla (**crear**).

---

### Task 1: Modelo `NotaConservatorio` + migración

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_conservatorio/migration.sql` (vía prisma)

**Interfaces:**
- Produces: tabla `NotaConservatorio` y el tipo generado de Prisma con relaciones `area`, `finca`, `lote`.

- [ ] **Step 1: Añadir el modelo en `prisma/schema.prisma`**

Al final del archivo, agregar:

```prisma
model NotaConservatorio {
  id        String    @id @default(cuid())
  texto     String
  hablado   Boolean   @default(false)
  creadaEn  DateTime  @default(now())
  habladaEn DateTime?

  areaId String
  area   Area   @relation(fields: [areaId], references: [id])

  fincaId String?
  finca   Finca?  @relation(fields: [fincaId], references: [id])
  loteId  String?
  lote    Lote?   @relation(fields: [loteId], references: [id])

  @@index([areaId, hablado])
}
```

- [ ] **Step 2: Añadir las relaciones inversas**

En `model Area` (tras la línea `usuarios    Usuario[]`), agregar:
```prisma
  notasConservatorio NotaConservatorio[]
```
En `model Finca` (tras `lotes       Lote[]`), agregar:
```prisma
  notasConservatorio NotaConservatorio[]
```
En `model Lote` (tras `tareasMulti Tarea[]     @relation("TareaLotesMulti")`), agregar:
```prisma
  notasConservatorio NotaConservatorio[]
```

- [ ] **Step 3: Crear y aplicar la migración**

Run:
```bash
export DATABASE_URL="$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)"
npx prisma migrate dev --name conservatorio
```
Expected: crea `prisma/migrations/<timestamp>_conservatorio/migration.sql` con `CREATE TABLE "NotaConservatorio" ...` y termina con `✔ Generated Prisma Client`. (Migración aditiva; no toca tablas existentes.)

Si Prisma reporta *drift* y ofrece resetear: **NO** resetear. Cancelar y usar en su lugar:
```bash
npx prisma migrate dev --name conservatorio --create-only
npx prisma migrate deploy
npx prisma generate
```

- [ ] **Step 4: Verificar el cliente generado (typecheck)**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores (el modelo compila; aún nadie lo usa).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): modelo NotaConservatorio (temas del conservatorio)"
```

---

### Task 2: Permisos (`conservatorio` + `puedeMarcarConservatorio`)

**Files:**
- Modify: `src/auth/permisos.ts`
- Modify: `src/auth/permisos.test.ts`
- Modify: `src/app/configuracion/usuario-pantallas.tsx`

**Interfaces:**
- Consumes: `UsuarioPermiso = { rol: string; pantallas: string | null }`.
- Produces:
  - `pantallasDe` incluye `'conservatorio'` para AREA (por defecto), ADMIN y VISOR.
  - `puedeMarcarConservatorio(u: UsuarioPermiso): boolean` → `u.rol === 'ADMIN' || u.rol === 'VISOR'`.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/auth/permisos.test.ts`: cambiar el import de la primera línea a
`import { pantallasDe, puedeVer, esSoloLectura, puedeMarcarConservatorio } from './permisos'`.

Dentro del `describe('pantallasDe', ...)`, **reemplazar** el test `'VISOR ve exactamente las 3 pantallas de solo lectura (sin cumplimiento)'` y el `'VISOR ignora el CSV de pantallas'` por:

```typescript
  it('VISOR ve 4 pantallas de solo lectura (resumen/programar/tablero/conservatorio)', () => {
    const s = pantallasDe({ rol: 'VISOR', pantallas: null })
    expect([...s].sort()).toEqual(['conservatorio', 'programar', 'resumen', 'tablero'])
    expect(s.has('cumplimiento')).toBe(false)
    expect(s.has('tareas')).toBe(false)
    expect(s.has('consulta')).toBe(false)
    expect(s.has('configuracion')).toBe(false)
  })

  it('VISOR ignora el CSV de pantallas', () => {
    const s = pantallasDe({ rol: 'VISOR', pantallas: 'tareas,configuracion,cumplimiento' })
    expect([...s].sort()).toEqual(['conservatorio', 'programar', 'resumen', 'tablero'])
  })

  it('AREA por defecto incluye conservatorio', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: null })
    expect(s.has('conservatorio')).toBe(true)
  })
```

Y actualizar el test `'AREA sin pantallas usa el set por defecto (sin tablero)'` para reflejar el nuevo default (ahora incluye `conservatorio`):

```typescript
  it('AREA sin pantallas usa el set por defecto (sin tablero)', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: null })
    expect([...s].sort()).toEqual(['conservatorio', 'consulta', 'cumplimiento', 'programar', 'resumen', 'tareas'])
    expect(s.has('tablero')).toBe(false)
    expect(s.has('configuracion')).toBe(false)
  })
```

Añadir al `describe('esSoloLectura', ...)` o al final del archivo un nuevo describe:

```typescript
describe('puedeMarcarConservatorio', () => {
  it('solo ADMIN y VISOR marcan', () => {
    expect(puedeMarcarConservatorio({ rol: 'ADMIN', pantallas: null })).toBe(true)
    expect(puedeMarcarConservatorio({ rol: 'VISOR', pantallas: null })).toBe(true)
    expect(puedeMarcarConservatorio({ rol: 'AREA', pantallas: null })).toBe(false)
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/auth/permisos.test.ts`
Expected: FAIL — `puedeMarcarConservatorio is not a function` y los sets de VISOR/AREA aún no incluyen `conservatorio`.

- [ ] **Step 3: Implementar en `src/auth/permisos.ts`**

Reemplazar las tres constantes de arriba y añadir el helper:

```typescript
export const PANTALLAS_ASIGNABLES = ['tareas', 'programar', 'cumplimiento', 'resumen', 'tablero', 'consulta', 'conservatorio'] as const
export const DEFAULT_AREA = ['tareas', 'programar', 'cumplimiento', 'resumen', 'consulta', 'conservatorio'] as const
export const PANTALLAS_VISOR = ['resumen', 'programar', 'tablero', 'conservatorio'] as const
```

Y al final del archivo:

```typescript
// Marcar/reabrir temas del Conservatorio: solo gerencia (Visor) y admin.
export function puedeMarcarConservatorio(u: UsuarioPermiso): boolean {
  return u.rol === 'ADMIN' || u.rol === 'VISOR'
}
```

- [ ] **Step 4: Añadir el toggle en Configuración (`src/app/configuracion/usuario-pantallas.tsx`)**

En la constante `PANTALLAS`, tras `{ clave: 'consulta', etiqueta: 'Consulta' },` agregar:
```tsx
  { clave: 'conservatorio', etiqueta: 'Conservatorio' },
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run src/auth/permisos.test.ts`
Expected: PASS (todos).

- [ ] **Step 6: Commit**

```bash
git add src/auth/permisos.ts src/auth/permisos.test.ts src/app/configuracion/usuario-pantallas.tsx
git commit -m "feat(permisos): pantalla conservatorio (AREA/ADMIN/VISOR) + puedeMarcarConservatorio"
```

---

### Task 3: Dominio — `separarNotas` y `agruparPorArea`

**Files:**
- Create: `src/dominio/conservatorio.ts`
- Create: `src/dominio/conservatorio.test.ts`

**Interfaces:**
- Produces:
  - `separarNotas<T extends { hablado: boolean }>(notas: T[]): { pendientes: T[]; hablados: T[] }`
  - `agruparPorArea<T extends { area: { nombre: string } }>(notas: T[]): [string, T[]][]` (entradas ordenadas por nombre de área asc, preservando el orden de entrada dentro de cada grupo).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/dominio/conservatorio.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { separarNotas, agruparPorArea } from './conservatorio'

describe('separarNotas', () => {
  it('divide en pendientes y hablados', () => {
    const notas = [
      { id: 'a', hablado: false },
      { id: 'b', hablado: true },
      { id: 'c', hablado: false },
    ]
    const { pendientes, hablados } = separarNotas(notas)
    expect(pendientes.map((n) => n.id)).toEqual(['a', 'c'])
    expect(hablados.map((n) => n.id)).toEqual(['b'])
  })

  it('listas vacías si no hay notas', () => {
    expect(separarNotas([])).toEqual({ pendientes: [], hablados: [] })
  })
})

describe('agruparPorArea', () => {
  it('agrupa por nombre de área, ordenado alfabéticamente', () => {
    const notas = [
      { id: '1', area: { nombre: 'Maíz' } },
      { id: '2', area: { nombre: 'Ganadería' } },
      { id: '3', area: { nombre: 'Maíz' } },
    ]
    const grupos = agruparPorArea(notas)
    expect(grupos.map(([nombre]) => nombre)).toEqual(['Ganadería', 'Maíz'])
    expect(grupos[1][1].map((n) => n.id)).toEqual(['1', '3'])
  })

  it('lista vacía => sin grupos', () => {
    expect(agruparPorArea([])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run src/dominio/conservatorio.test.ts`
Expected: FAIL — no existe `./conservatorio`.

- [ ] **Step 3: Implementar `src/dominio/conservatorio.ts`**

```typescript
// Helpers puros del Conservatorio: separar pendientes/hablados y agrupar por área.

export function separarNotas<T extends { hablado: boolean }>(
  notas: T[],
): { pendientes: T[]; hablados: T[] } {
  const pendientes: T[] = []
  const hablados: T[] = []
  for (const n of notas) (n.hablado ? hablados : pendientes).push(n)
  return { pendientes, hablados }
}

export function agruparPorArea<T extends { area: { nombre: string } }>(
  notas: T[],
): [string, T[]][] {
  const mapa = new Map<string, T[]>()
  for (const n of notas) {
    const arr = mapa.get(n.area.nombre) ?? []
    arr.push(n)
    mapa.set(n.area.nombre, arr)
  }
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run src/dominio/conservatorio.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/conservatorio.ts src/dominio/conservatorio.test.ts
git commit -m "feat(dominio): separarNotas + agruparPorArea (conservatorio)"
```

---

### Task 4: Repositorio — CRUD de notas

**Files:**
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Consumes: `prisma` (ya importado en el archivo).
- Produces:
  - `crearNotaConservatorio(input: { areaId: string; texto: string; loteId: string | null }): Promise<...>`
  - `listarNotasConservatorio(areaId: string | null): Promise<Nota[]>` — con `area`, `finca`, `lote:{finca}`; orden `hablado asc, creadaEn desc`.
  - `notaConservatorioPorId(id: string): Promise<{ areaId: string; hablado: boolean } | null>`
  - `marcarNotaHablada(id: string)`, `reabrirNotaConservatorio(id: string)`, `borrarNotaConservatorio(id: string)`.

- [ ] **Step 1: Implementar las funciones**

Añadir al final de `src/datos/repositorio.ts`:

```typescript
// ————— Conservatorio —————

export async function crearNotaConservatorio(input: {
  areaId: string
  texto: string
  loteId: string | null
}) {
  // La finca se deriva del lote elegido (si hay), para poder mostrarla sin join extra.
  let fincaId: string | null = null
  if (input.loteId) {
    const lote = await prisma.lote.findUnique({ where: { id: input.loteId } })
    fincaId = lote?.fincaId ?? null
  }
  return prisma.notaConservatorio.create({
    data: { areaId: input.areaId, texto: input.texto, loteId: input.loteId, fincaId },
  })
}

export function listarNotasConservatorio(areaId: string | null) {
  return prisma.notaConservatorio.findMany({
    where: areaId ? { areaId } : undefined,
    include: { area: true, finca: true, lote: { include: { finca: true } } },
    orderBy: [{ hablado: 'asc' }, { creadaEn: 'desc' }],
  })
}

export function notaConservatorioPorId(id: string) {
  return prisma.notaConservatorio.findUnique({
    where: { id },
    select: { areaId: true, hablado: true },
  })
}

export function marcarNotaHablada(id: string) {
  return prisma.notaConservatorio.update({
    where: { id },
    data: { hablado: true, habladaEn: new Date() },
  })
}

export function reabrirNotaConservatorio(id: string) {
  return prisma.notaConservatorio.update({
    where: { id },
    data: { hablado: false, habladaEn: null },
  })
}

export function borrarNotaConservatorio(id: string) {
  return prisma.notaConservatorio.delete({ where: { id } })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(repo): CRUD de NotaConservatorio (crear/listar/marcar/reabrir/borrar)"
```

---

### Task 5: Server actions

**Files:**
- Create: `src/app/conservatorio/acciones.ts`

**Interfaces:**
- Consumes: `usuarioActual` (`@/auth/sesion`), `puedeMarcarConservatorio` (`@/auth/permisos`), y las funciones de repositorio de Task 4.
- Produces: `crearNotaAccion`, `marcarHabladaAccion`, `reabrirNotaAccion`, `borrarNotaAccion` (todas `(form: FormData) => Promise<void>`).

- [ ] **Step 1: Implementar `src/app/conservatorio/acciones.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import {
  crearNotaConservatorio,
  notaConservatorioPorId,
  marcarNotaHablada,
  reabrirNotaConservatorio,
  borrarNotaConservatorio,
} from '@/datos/repositorio'
import { usuarioActual } from '@/auth/sesion'
import { puedeMarcarConservatorio } from '@/auth/permisos'

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}
function textoOpcional(form: FormData, clave: string): string | null {
  const v = texto(form, clave)
  return v === '' ? null : v
}

export async function crearNotaAccion(form: FormData) {
  const u = await usuarioActual()
  // Solo un usuario de área con área asignada crea notas (para su propia área).
  if (!u || u.rol !== 'AREA' || !u.areaId) return
  const t = texto(form, 'texto')
  if (!t) return
  await crearNotaConservatorio({ areaId: u.areaId, texto: t, loteId: textoOpcional(form, 'loteId') })
  revalidatePath('/conservatorio')
}

export async function marcarHabladaAccion(form: FormData) {
  const u = await usuarioActual()
  if (!u || !puedeMarcarConservatorio(u)) return
  const id = texto(form, 'id')
  if (!id) return
  await marcarNotaHablada(id)
  revalidatePath('/conservatorio')
}

export async function reabrirNotaAccion(form: FormData) {
  const u = await usuarioActual()
  if (!u || !puedeMarcarConservatorio(u)) return
  const id = texto(form, 'id')
  if (!id) return
  await reabrirNotaConservatorio(id)
  revalidatePath('/conservatorio')
}

export async function borrarNotaAccion(form: FormData) {
  const u = await usuarioActual()
  if (!u) return
  const id = texto(form, 'id')
  if (!id) return
  const nota = await notaConservatorioPorId(id)
  if (!nota) return
  // ADMIN borra cualquiera; el área solo su propia nota mientras esté pendiente.
  const permitido = u.rol === 'ADMIN' || (u.rol === 'AREA' && nota.areaId === u.areaId && !nota.hablado)
  if (!permitido) return
  await borrarNotaConservatorio(id)
  revalidatePath('/conservatorio')
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/conservatorio/acciones.ts
git commit -m "feat(conservatorio): server actions (crear/marcar/reabrir/borrar) con permisos"
```

---

### Task 6: Pantalla + form + navegación

**Files:**
- Create: `src/app/conservatorio/form-nueva-nota.tsx`
- Create: `src/app/conservatorio/page.tsx`
- Modify: `src/app/_componentes/secciones.ts`

**Interfaces:**
- Consumes: acciones de Task 5, helpers de Task 3, repositorio de Task 4, `SelectFincaLote` (`@/app/_componentes/select-finca-lote`), `puedeVer`/`puedeMarcarConservatorio` (`@/auth/permisos`), `usuarioActual` (`@/auth/sesion`).

- [ ] **Step 1: Entrada de navegación (`src/app/_componentes/secciones.ts`)**

En el array `SECCIONES`, tras la entrada de `consulta`, agregar:
```typescript
  { clave: 'conservatorio', href: '/conservatorio', texto: 'Conservatorio', icono: '🗣️', descripcion: 'Temas para hablar con gerencia' },
```

- [ ] **Step 2: Form cliente `src/app/conservatorio/form-nueva-nota.tsx`**

```tsx
'use client'

import { SelectFincaLote } from '@/app/_componentes/select-finca-lote'

type Lote = { id: string; nombre: string; finca: { nombre: string } }

// Alta minimalista de un tema: una línea (texto + "+") y un desplegable opcional
// "➕ contexto" con el selector finca→lote (envía loteId).
export function FormNuevaNota({
  lotes,
  accion,
}: {
  lotes: Lote[]
  accion: (formData: FormData) => void | Promise<void>
}) {
  return (
    <form action={accion} className="mb-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          name="texto"
          required
          placeholder="Escribe un tema para hablar…"
          className="flex-1 rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
        />
        <button className="rounded-lg bg-bosque px-4 py-2 text-sm font-semibold text-white">+</button>
      </div>
      <details className="text-sm text-tierra">
        <summary className="cursor-pointer select-none">➕ contexto (finca/potrero)</summary>
        <div className="mt-2 max-w-xs">
          <SelectFincaLote lotes={lotes} name="loteId" />
        </div>
      </details>
    </form>
  )
}
```

- [ ] **Step 3: Pantalla `src/app/conservatorio/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { listarNotasConservatorio, listarLotes } from '@/datos/repositorio'
import { usuarioActual } from '@/auth/sesion'
import { puedeVer, puedeMarcarConservatorio } from '@/auth/permisos'
import { separarNotas, agruparPorArea } from '@/dominio/conservatorio'
import { FormNuevaNota } from './form-nueva-nota'
import { crearNotaAccion, marcarHabladaAccion, reabrirNotaAccion, borrarNotaAccion } from './acciones'

const fmtFecha = (f: Date) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

export default async function ConservatorioPage() {
  const u = await usuarioActual()
  if (!u) redirect('/login')
  if (!puedeVer(u, 'conservatorio')) redirect('/')

  const verTodas = u.rol === 'ADMIN' || u.rol === 'VISOR'
  const puedeMarcar = puedeMarcarConservatorio(u)
  const puedeCrear = u.rol === 'AREA' && !!u.areaId

  const notas = await listarNotasConservatorio(verTodas ? null : (u.areaId ?? '__none__'))
  const lotes = puedeCrear ? await listarLotes() : []
  const { pendientes, hablados } = separarNotas(notas)

  // Etiqueta de contexto (potrero) si la nota tiene lote.
  const etiquetaLote = (n: (typeof notas)[number]) =>
    n.lote ? `${n.lote.finca.nombre} · ${n.lote.nombre}` : null

  // Una fila de tema (texto · fecha · etiqueta · acciones según permisos).
  const filaNota = (n: (typeof notas)[number], enHistorial: boolean) => (
    <li key={n.id} className="flex items-start gap-2 border-b border-borde/60 py-2 last:border-0">
      <div className="flex-1">
        <p className="text-sm text-tinta">{n.texto}</p>
        <p className="text-xs text-tierra">
          {fmtFecha(n.creadaEn)}
          {etiquetaLote(n) && <span className="ml-2 rounded bg-arena px-1.5 py-0.5">{etiquetaLote(n)}</span>}
        </p>
      </div>
      {!enHistorial && puedeMarcar && (
        <form action={marcarHabladaAccion}>
          <input type="hidden" name="id" value={n.id} />
          <button className="text-sm font-semibold text-bosque hover:underline" title="Marcar como hablado">✓</button>
        </form>
      )}
      {!enHistorial && u.rol === 'AREA' && n.areaId === u.areaId && (
        <form action={borrarNotaAccion}>
          <input type="hidden" name="id" value={n.id} />
          <button className="text-sm text-tierra hover:text-arcilla" title="Borrar">×</button>
        </form>
      )}
      {enHistorial && puedeMarcar && (
        <form action={reabrirNotaAccion}>
          <input type="hidden" name="id" value={n.id} />
          <button className="text-xs text-tierra hover:underline">↩ reabrir</button>
        </form>
      )}
    </li>
  )

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-bosque">🗣️ Conservatorio</h1>

      {puedeCrear && <FormNuevaNota lotes={lotes} accion={crearNotaAccion} />}
      {u.rol === 'AREA' && !u.areaId && (
        <p className="mb-4 rounded-lg bg-arena p-3 text-sm text-tierra">Tu usuario no tiene área asignada.</p>
      )}

      {pendientes.length === 0 ? (
        <p className="text-sm text-tierra">No hay temas pendientes.</p>
      ) : verTodas ? (
        agruparPorArea(pendientes).map(([area, ns]) => (
          <section key={area} className="mb-5">
            <h2 className="mb-1 text-sm font-semibold text-bosque">{area}</h2>
            <ul>{ns.map((n) => filaNota(n, false))}</ul>
          </section>
        ))
      ) : (
        <ul className="mb-5">{pendientes.map((n) => filaNota(n, false))}</ul>
      )}

      {hablados.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer select-none text-sm font-semibold text-tierra">Ya hablados</summary>
          <div className="mt-2">
            {verTodas
              ? agruparPorArea(hablados).map(([area, ns]) => (
                  <section key={area} className="mb-4">
                    <h3 className="mb-1 text-xs font-semibold text-tierra">{area}</h3>
                    <ul>{ns.map((n) => filaNota(n, true))}</ul>
                  </section>
                ))
              : <ul>{hablados.map((n) => filaNota(n, true))}</ul>}
          </div>
        </details>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.
Run: `export DATABASE_URL="$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)" && npx next build`
Expected: `✓ Compiled successfully` y la ruta `/conservatorio` aparece en la tabla de rutas.

- [ ] **Step 5: Commit**

```bash
git add src/app/conservatorio src/app/_componentes/secciones.ts
git commit -m "feat(conservatorio): pantalla minimalista + form + navegación"
```

---

### Task 7: Verificación end-to-end

**Files:** ninguno.

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: PASS (incluye `permisos` y `conservatorio` nuevos).

- [ ] **Step 2: Typecheck total**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 3: Build**

Run: `export DATABASE_URL="$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)" && npx next build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Prueba en vivo (server local + cookie firmada)**

Levantar `next dev` con `DATABASE_URL` de prod. Firmar la cookie de sesión (secreto dev `cronograma-local-secret`, ver técnica en la memoria `verificacion-navegador`). Comprobar:
- Como usuario **AREA**: aparece el form; crear un tema (con y sin potrero) → se ve en su lista; el "×" borra el suyo; NO aparece "✓"; no ve temas de otras áreas.
- Como **VISOR**/**ADMIN**: los temas aparecen agrupados por área; el "✓" mueve la nota a "Ya hablados"; "↩ reabrir" la devuelve; NO aparece el form de crear (VISOR).
- Home del VISOR ahora muestra 4 tarjetas (resumen, programar, tablero, conservatorio).
- Limpiar por id las notas de prueba creadas (y cualquier usuario de prueba) al terminar.

- [ ] **Step 5: Deploy (tras aprobación del usuario)**

```bash
git push origin master
npx vercel@latest deploy --prod --yes
```
Verificar `https://cronograma-ayura.vercel.app` responde. (El build remoto corre `prisma migrate deploy` y aplica la migración de Task 1.)

---

## Self-Review

**Spec coverage:**
- Decisión 1 (nota nueva + finca/lote opcional) → Task 1 (modelo) + Task 6 (form con `SelectFincaLote`). ✅
- Decisión 2 (lista corrida, sin semana) → modelo sin campos de semana. ✅
- Decisión 3 (visibilidad área/gerencia/admin) → Task 4 (`listarNotasConservatorio(areaId|null)`) + Task 6 (`verTodas`). ✅
- Decisión 4 (marcar/ocultar + historial + reabrir) → Task 4/5 (`marcar`/`reabrir`) + Task 6 (`<details>` "Ya hablados"). ✅
- Decisión 5 (borrar: área pendiente / admin) → Task 5 (`borrarNotaAccion` con chequeo). ✅
- Decisión 6 (fechas) → Task 6 (`fmtFecha`). ✅
- Decisión 7 (UI minimalista) → Task 6 + Global Constraints. ✅
- Permisos (`conservatorio` en sets, `puedeMarcarConservatorio`) → Task 2. ✅
- Navegación + toggles config → Task 6 (secciones) + Task 2 (usuario-pantallas). ✅
- Dominio testeable → Task 3. ✅
- Migración → Task 1. ✅
- Solo AREA crea; admin/gerencia gestionan → Task 5 (`crearNotaAccion` gatea a AREA). ✅

**Placeholder scan:** sin TBD/TODO; todo el código concreto. ✅

**Type consistency:** `crearNotaConservatorio({areaId,texto,loteId})`, `listarNotasConservatorio(areaId|null)`, `notaConservatorioPorId`, `marcarNotaHablada`, `reabrirNotaConservatorio`, `borrarNotaConservatorio`, `separarNotas`, `agruparPorArea`, `puedeMarcarConservatorio` usados con el mismo nombre/firma en todas las tareas. El form envía `texto` y `loteId`; las acciones leen esos names. ✅

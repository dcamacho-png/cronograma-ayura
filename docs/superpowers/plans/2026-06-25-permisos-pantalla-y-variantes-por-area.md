# Permisos de pantalla por usuario + variantes por área — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al admin control de qué pantallas ve cada usuario, y elegir por área la variante (Estándar/Maquinaria) de cada una de las 4 pantallas operativas, reemplazando la detección por nombre.

**Architecture:** Dos funciones puras nuevas (`auth/permisos.ts`, `dominio/variante.ts`) concentran las reglas; el resto son cambios de cableado. La persistencia son columnas añadidas a `Usuario` (`pantallas` CSV) y `Area` (4 booleanos). La nav y cada página filtran/leen de estas reglas. La UI de administración vive en Configuración.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Prisma + Neon Postgres, Vitest, Tailwind v4.

## Global Constraints

- **Sin cambios de lógica de negocio.** Solo cambia *de dónde sale* el booleano `esMaquinaria` (de nombre → bandera) y *quién ve* cada pantalla. La lógica de cumplimiento/métricas/turnos no se toca. (Spec.)
- **Claves de pantalla canónicas:** `tareas`, `programar`, `cumplimiento`, `resumen`, `tablero`. `configuracion` NO es asignable a usuarios de área; `inicio` siempre visible. (Spec.)
- **ADMIN ve todo siempre**, ignorando `pantallas`. (Spec.)
- **Migración aditiva y compatible:** columnas con default; backfill marca maquinaria a las áreas con nombre que contiene "maquinaria". El código viejo ignora columnas nuevas, así que aplicar la migración antes del deploy es seguro. (Spec.)
- **Base compartida:** local y producción usan la MISMA base Neon (ver memoria `despliegue-nube`). La migración se aplica una sola vez.
- **Typecheck fiable:** `npx tsc --noEmit` da falso-verde por `.next`; usar el tsconfig temporal del harness (abajo). (memoria `tsc-local-no-fiable`.)
- **Las 136 pruebas actuales deben quedar verdes** (no-regresión).

---

## Verification Harness (referenciado por las tareas)

**A) Typecheck fiable:**

```bash
cd /home/derlly/projects/cronograma
cat > tsconfig.tmpcheck.json <<'EOF'
{ "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "plugins": [] },
  "include": ["src/**/*.ts", "src/**/*.tsx", "next-env.d.ts"],
  "exclude": ["node_modules", ".next"] }
EOF
npx tsc --noEmit -p tsconfig.tmpcheck.json && echo "TYPECHECK OK"
rm -f tsconfig.tmpcheck.json tsconfig.tmpcheck.tsbuildinfo
```

**B) Tests:** `cd /home/derlly/projects/cronograma && npm run test`

**C) Servidor local para verificación visual** (la `DATABASE_URL` real está en `.claude/settings.local.json`):

```bash
cd /home/derlly/projects/cronograma
DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)
DATABASE_URL="$DB" npx next dev -p 3100   # background
```

**D) Screenshot autenticado** (admin): usar el script `/tmp/.../scratchpad/shot.cjs` del trabajo previo (cookie `sesion` firmada con `cronograma-local-secret`, `ADMIN_ID=cmqme5i7300mvod5qt2g5hqco`), con `CHROME_PATH` al chromium bundled y `LD_LIBRARY_PATH` a los deblibs. Ver memoria `verificacion-navegador`.

---

## Task 1: Esquema y migración

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260625120000_permisos_pantalla_y_variantes/migration.sql`

**Interfaces:**
- Produces: columna `Usuario.pantallas (String?)`; columnas `Area.maqTareas/maqProgramar/maqCumplimiento/maqResumen (Boolean, default false)`. El cliente Prisma regenerado expone estos campos en los tipos `Usuario` y `Area`.

- [ ] **Step 1: Editar `prisma/schema.prisma`.** En `model Usuario`, tras `areaId String?` agregar:

```prisma
  pantallas String?
```

En `model Area`, tras `nombre String @unique` agregar:

```prisma
  maqTareas       Boolean @default(false)
  maqProgramar    Boolean @default(false)
  maqCumplimiento Boolean @default(false)
  maqResumen      Boolean @default(false)
```

- [ ] **Step 2: Crear la migración SQL** en `prisma/migrations/20260625120000_permisos_pantalla_y_variantes/migration.sql`:

```sql
ALTER TABLE "Usuario" ADD COLUMN "pantallas" TEXT;
ALTER TABLE "Area" ADD COLUMN "maqTareas" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Area" ADD COLUMN "maqProgramar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Area" ADD COLUMN "maqCumplimiento" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Area" ADD COLUMN "maqResumen" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Area"
   SET "maqTareas" = true, "maqProgramar" = true, "maqCumplimiento" = true, "maqResumen" = true
 WHERE lower("nombre") LIKE '%maquinaria%';
```

- [ ] **Step 3: Aplicar la migración y regenerar el cliente** (apunta a la base Neon real):

```bash
cd /home/derlly/projects/cronograma
DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)
DATABASE_URL="$DB" npx prisma migrate deploy
DATABASE_URL="$DB" npx prisma generate
```

Expected: la migración `20260625120000_permisos_pantalla_y_variantes` aplicada; "Generated Prisma Client".

- [ ] **Step 4: Verificar el backfill** (el área de maquinaria quedó marcada):

```bash
cd /home/derlly/projects/cronograma
DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)
DATABASE_URL="$DB" node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.area.findMany({select:{nombre:true,maqTareas:true,maqResumen:true}}).then(a=>{console.log(a);return p.\$disconnect()})"
```

Expected: el área cuyo nombre contiene "maquinaria" muestra `maqTareas:true, maqResumen:true`; las demás `false`.

- [ ] **Step 5: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): pantallas por usuario y variantes de maquinaria por área"
```

---

## Task 2: `auth/permisos.ts` — reglas de visibilidad (TDD)

**Files:**
- Create: `src/auth/permisos.ts`
- Test: `src/auth/permisos.test.ts`

**Interfaces:**
- Produces:
  - `type UsuarioPermiso = { rol: string; pantallas: string | null }`
  - `const PANTALLAS_ASIGNABLES: readonly string[]` = `['tareas','programar','cumplimiento','resumen','tablero']`
  - `const DEFAULT_AREA: readonly string[]` = `['tareas','programar','cumplimiento','resumen']`
  - `function pantallasDe(u: UsuarioPermiso): Set<string>`
  - `function puedeVer(u: UsuarioPermiso, clave: string): boolean`

> Nota: `vitest.config.ts` incluye `src/**/*.test.ts`; este test corre aunque esté bajo `src/auth/`.

- [ ] **Step 1: Escribir el test** en `src/auth/permisos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pantallasDe, puedeVer } from './permisos'

describe('pantallasDe', () => {
  it('ADMIN ve todo, incluida configuracion', () => {
    const s = pantallasDe({ rol: 'ADMIN', pantallas: null })
    for (const k of ['tareas', 'programar', 'cumplimiento', 'resumen', 'tablero', 'configuracion']) {
      expect(s.has(k)).toBe(true)
    }
  })

  it('AREA sin pantallas usa el set por defecto (sin tablero)', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: null })
    expect([...s].sort()).toEqual(['cumplimiento', 'programar', 'resumen', 'tareas'])
    expect(s.has('tablero')).toBe(false)
    expect(s.has('configuracion')).toBe(false)
  })

  it('AREA con CSV parsea e intersecta con las asignables', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: 'tareas,resumen,tablero' })
    expect([...s].sort()).toEqual(['resumen', 'tablero', 'tareas'])
  })

  it('AREA nunca obtiene configuracion aunque esté en el CSV', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: 'configuracion,tareas' })
    expect(s.has('configuracion')).toBe(false)
    expect(s.has('tareas')).toBe(true)
  })

  it('AREA con CSV vacío => set vacío de asignables', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: '' })
    expect(s.size).toBe(0)
  })

  it('ignora claves desconocidas y espacios', () => {
    const s = pantallasDe({ rol: 'AREA', pantallas: ' tareas , inventada ,resumen ' })
    expect([...s].sort()).toEqual(['resumen', 'tareas'])
  })
})

describe('puedeVer', () => {
  it('refleja el set', () => {
    expect(puedeVer({ rol: 'AREA', pantallas: null }, 'tareas')).toBe(true)
    expect(puedeVer({ rol: 'AREA', pantallas: null }, 'tablero')).toBe(false)
    expect(puedeVer({ rol: 'ADMIN', pantallas: null }, 'configuracion')).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla** — `npx vitest run src/auth/permisos.test.ts`. Expected: FAIL ("Cannot find module './permisos'").

- [ ] **Step 3: Implementar** `src/auth/permisos.ts`:

```ts
export type UsuarioPermiso = { rol: string; pantallas: string | null }

export const PANTALLAS_ASIGNABLES = ['tareas', 'programar', 'cumplimiento', 'resumen', 'tablero'] as const
export const DEFAULT_AREA = ['tareas', 'programar', 'cumplimiento', 'resumen'] as const

const ASIGNABLES = new Set<string>(PANTALLAS_ASIGNABLES)

export function pantallasDe(u: UsuarioPermiso): Set<string> {
  if (u.rol === 'ADMIN') return new Set<string>([...PANTALLAS_ASIGNABLES, 'configuracion'])
  if (u.pantallas == null) return new Set<string>(DEFAULT_AREA)
  const claves = u.pantallas
    .split(',')
    .map((c) => c.trim())
    .filter((c) => ASIGNABLES.has(c))
  return new Set<string>(claves)
}

export function puedeVer(u: UsuarioPermiso, clave: string): boolean {
  return pantallasDe(u).has(clave)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa** — `npx vitest run src/auth/permisos.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/permisos.ts src/auth/permisos.test.ts
git commit -m "feat(auth): reglas de visibilidad de pantallas por usuario"
```

---

## Task 3: `dominio/variante.ts` — resolución de variante (TDD)

**Files:**
- Create: `src/dominio/variante.ts`
- Test: `src/dominio/variante.test.ts`

**Interfaces:**
- Produces:
  - `type AreaVariante = { maqTareas: boolean; maqProgramar: boolean; maqCumplimiento: boolean; maqResumen: boolean }`
  - `type PantallaVariante = 'tareas' | 'programar' | 'cumplimiento' | 'resumen'`
  - `function esMaquinaria(area: AreaVariante, pantalla: PantallaVariante): boolean`

- [ ] **Step 1: Escribir el test** en `src/dominio/variante.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { esMaquinaria } from './variante'

const base = { maqTareas: false, maqProgramar: false, maqCumplimiento: false, maqResumen: false }

describe('esMaquinaria', () => {
  it('default (todo false) => estándar en toda pantalla', () => {
    expect(esMaquinaria(base, 'tareas')).toBe(false)
    expect(esMaquinaria(base, 'resumen')).toBe(false)
  })

  it('cada bandera mapea a su pantalla', () => {
    expect(esMaquinaria({ ...base, maqTareas: true }, 'tareas')).toBe(true)
    expect(esMaquinaria({ ...base, maqTareas: true }, 'programar')).toBe(false)
    expect(esMaquinaria({ ...base, maqProgramar: true }, 'programar')).toBe(true)
    expect(esMaquinaria({ ...base, maqCumplimiento: true }, 'cumplimiento')).toBe(true)
    expect(esMaquinaria({ ...base, maqResumen: true }, 'resumen')).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla** — `npx vitest run src/dominio/variante.test.ts`. Expected: FAIL ("Cannot find module './variante'").

- [ ] **Step 3: Implementar** `src/dominio/variante.ts`:

```ts
export type AreaVariante = {
  maqTareas: boolean
  maqProgramar: boolean
  maqCumplimiento: boolean
  maqResumen: boolean
}

export type PantallaVariante = 'tareas' | 'programar' | 'cumplimiento' | 'resumen'

export function esMaquinaria(area: AreaVariante, pantalla: PantallaVariante): boolean {
  switch (pantalla) {
    case 'tareas':
      return area.maqTareas
    case 'programar':
      return area.maqProgramar
    case 'cumplimiento':
      return area.maqCumplimiento
    case 'resumen':
      return area.maqResumen
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa** — `npx vitest run src/dominio/variante.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/variante.ts src/dominio/variante.test.ts
git commit -m "feat(dominio): resolución de variante de pantalla por área"
```

---

## Task 4: Navegación por permisos

**Files:**
- Modify: `src/app/_componentes/secciones.ts`
- Test: `src/app/_componentes/secciones.test.ts`
- Modify: `src/app/_componentes/nav-principal.tsx`
- Modify: `src/app/layout.tsx:34`
- Modify: `src/app/page.tsx:10`

**Interfaces:**
- Consumes: `puedeVer`, `UsuarioPermiso` (Task 2).
- Produces: `seccionesVisibles(usuario: UsuarioPermiso): Seccion[]`; cada `Seccion` gana un campo `clave: string`.

- [ ] **Step 1: Escribir el test** en `src/app/_componentes/secciones.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { seccionesVisibles } from './secciones'

describe('seccionesVisibles', () => {
  it('AREA por defecto ve 4 (sin tablero ni configuracion)', () => {
    const claves = seccionesVisibles({ rol: 'AREA', pantallas: null }).map((s) => s.clave)
    expect(claves.sort()).toEqual(['cumplimiento', 'programar', 'resumen', 'tareas'])
  })

  it('ADMIN ve también tablero y configuracion', () => {
    const claves = seccionesVisibles({ rol: 'ADMIN', pantallas: null }).map((s) => s.clave)
    expect(claves).toContain('tablero')
    expect(claves).toContain('configuracion')
  })

  it('AREA con tablero concedido lo ve', () => {
    const claves = seccionesVisibles({ rol: 'AREA', pantallas: 'tareas,tablero' }).map((s) => s.clave)
    expect(claves).toContain('tablero')
    expect(claves).not.toContain('configuracion')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla** — `npx vitest run src/app/_componentes/secciones.test.ts`. Expected: FAIL (`seccionesVisibles` espera un rol string / no existe `clave`).

- [ ] **Step 3: Reescribir** `src/app/_componentes/secciones.ts`:

```ts
import { puedeVer, type UsuarioPermiso } from '@/auth/permisos'

export type Seccion = {
  clave: string
  href: string
  texto: string
  icono: string
  descripcion: string
}

export const SECCIONES: Seccion[] = [
  { clave: 'tareas', href: '/tareas', texto: 'Tareas', icono: '📋', descripcion: 'Banco de actividades por área' },
  { clave: 'programar', href: '/programar', texto: 'Programar', icono: '🗓️', descripcion: 'Cronograma de la semana' },
  { clave: 'cumplimiento', href: '/cumplimiento', texto: 'Cumplimiento', icono: '✅', descripcion: 'Registrar lo cumplido' },
  { clave: 'resumen', href: '/resumen', texto: 'Resumen', icono: '📊', descripcion: 'Indicadores de la semana' },
  { clave: 'tablero', href: '/tablero', texto: 'Tablero', icono: '📈', descripcion: 'Vista mensual' },
  { clave: 'configuracion', href: '/configuracion', texto: 'Configuración', icono: '⚙️', descripcion: 'Catálogos y usuarios (solo admin)' },
]

// Secciones visibles según los permisos del usuario.
export function seccionesVisibles(usuario: UsuarioPermiso): Seccion[] {
  return SECCIONES.filter((s) => puedeVer(usuario, s.clave))
}
```

- [ ] **Step 4: Actualizar `nav-principal.tsx`.** Cambiar la firma del prop y el llamado:
  - El tipo del prop: de `usuario: { nombre: string; rol: string } | null` a `usuario: { nombre: string; rol: string; pantallas: string | null } | null`.
  - La línea de `enlaces`:

```tsx
  const enlaces = usuario
    ? [{ href: '/', texto: 'Inicio', icono: '🏠' }, ...seccionesVisibles({ rol: usuario.rol, pantallas: usuario.pantallas })]
    : []
```

- [ ] **Step 5: Actualizar `src/app/layout.tsx`** (línea ~34) para pasar `pantallas`:

```tsx
        <NavPrincipal usuario={u ? { nombre: u.nombre, rol: u.rol, pantallas: u.pantallas } : null} />
```

- [ ] **Step 6: Actualizar `src/app/page.tsx`** (Inicio, línea ~10):

```tsx
  const secciones = seccionesVisibles({ rol: u.rol, pantallas: u.pantallas })
```

(El `import` de `seccionesVisibles` ya existe; `u` viene de `usuarioActual()` y trae `pantallas`.)

- [ ] **Step 7: Tests** — Harness B. Expected: verde (incluye el test nuevo y los 136 previos).

- [ ] **Step 8: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 9: Commit**

```bash
git add src/app/_componentes/secciones.ts src/app/_componentes/secciones.test.ts src/app/_componentes/nav-principal.tsx src/app/layout.tsx src/app/page.tsx
git commit -m "feat(nav): visibilidad de secciones por permisos de usuario"
```

---

## Task 5: Refuerzo en servidor (guards por página)

**Files (modify):** `src/app/tareas/page.tsx`, `src/app/programar/page.tsx`, `src/app/cumplimiento/page.tsx`, `src/app/resumen/page.tsx`, `src/app/tablero/page.tsx`

**Interfaces:**
- Consumes: `puedeVer` (Task 2), `usuarioActual` (existente).

> Patrón: cada página ya hace `const u = await usuarioActual(); if (!u) redirect('/login')`. Añadir, **justo después** de obtener `u` (y de fijar `esAdmin` donde exista), el guard de pantalla. En `tablero/page.tsx` ya hay `if (!u || u.rol !== 'ADMIN') redirect('/programar')`: reemplazarlo por el guard de pantalla (ADMIN pasa por `puedeVer`, y un AREA con tablero concedido también).

- [ ] **Step 1: `tareas/page.tsx`** — añadir import y guard. Tras `if (!u) redirect('/login')`:

```tsx
import { puedeVer } from '@/auth/permisos'
// ...
  if (!puedeVer(u, 'tareas')) redirect('/')
```

- [ ] **Step 2: `programar/page.tsx`** — igual con `'programar'`:

```tsx
import { puedeVer } from '@/auth/permisos'
// ...
  if (!puedeVer(u, 'programar')) redirect('/')
```

- [ ] **Step 3: `cumplimiento/page.tsx`** — igual con `'cumplimiento'`:

```tsx
import { puedeVer } from '@/auth/permisos'
// ...
  if (!puedeVer(u, 'cumplimiento')) redirect('/')
```

- [ ] **Step 4: `resumen/page.tsx`** — igual con `'resumen'`:

```tsx
import { puedeVer } from '@/auth/permisos'
// ...
  if (!puedeVer(u, 'resumen')) redirect('/')
```

- [ ] **Step 5: `tablero/page.tsx`** — reemplazar el guard de admin por el de pantalla:

```tsx
import { puedeVer } from '@/auth/permisos'
// ...
  const u = await usuarioActual()
  if (!u) redirect('/login')
  if (!puedeVer(u, 'tablero')) redirect('/')
```

(Quitar la línea previa `if (!u || u.rol !== 'ADMIN') redirect('/programar')`.)

- [ ] **Step 6: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 7: Verificación manual** — levantar server (Harness C). Con un usuario de área sin Tablero, `GET /tablero` debe redirigir a `/`. Comprobación rápida con curl siguiendo redirecciones desde una sesión de área (o screenshot). Expected: no se ve el Tablero; redirección a Inicio.

- [ ] **Step 8: Commit**

```bash
git add src/app/tareas/page.tsx src/app/programar/page.tsx src/app/cumplimiento/page.tsx src/app/resumen/page.tsx src/app/tablero/page.tsx
git commit -m "feat(auth): guard de pantalla por permisos en cada página"
```

---

## Task 6: Reemplazar detección por nombre con `esMaquinaria(area, pantalla)`

**Files (modify):** `src/app/tareas/page.tsx`, `src/app/tareas/form-solicitar.tsx`, `src/app/programar/page.tsx`, `src/app/programar/exportar/page.tsx`, `src/app/cumplimiento/page.tsx`, `src/app/resumen/page.tsx`, `src/app/resumen/exportar/page.tsx`

**Interfaces:**
- Consumes: `esMaquinaria` (Task 3); el objeto `area` ya trae las banderas `maq*` (Task 1).

> Buscar todos los usos a reemplazar: `grep -rn "includes('maquinaria')" src/`.

- [ ] **Step 1: `programar/page.tsx`** — reemplazar:
  - De: `const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')`
  - A: `const esMaquinaria = esMaquinariaVar(areaActual, 'programar')`
  - Import: `import { esMaquinaria as esMaquinariaVar } from '@/dominio/variante'`

- [ ] **Step 2: `cumplimiento/page.tsx`** — reemplazar:
  - De: `const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')`
  - A: `const esMaquinaria = esMaquinariaVar(areaActual, 'cumplimiento')`
  - Import: `import { esMaquinaria as esMaquinariaVar } from '@/dominio/variante'`

- [ ] **Step 3: `resumen/page.tsx`** — reemplazar:
  - De: `const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')`
  - A: `const esMaquinaria = esMaquinariaVar(areaActual, 'resumen')`
  - Import: `import { esMaquinaria as esMaquinariaVar } from '@/dominio/variante'`

- [ ] **Step 4: `resumen/exportar/page.tsx` y `programar/exportar/page.tsx`** — estas iteran áreas. Reemplazar la función local:
  - En `resumen/exportar`: `const esMaquinaria = (nombre: string) => nombre.toLowerCase().includes('maquinaria')` y sus llamadas `esMaquinaria(area.nombre)` por `esMaquinariaVar(area, 'resumen')`. Import `esMaquinaria as esMaquinariaVar` de `@/dominio/variante`.
  - En `programar/exportar`: la prop `esMaquinaria={area.nombre.toLowerCase().includes('maquinaria')}` pasa a `esMaquinaria={esMaquinariaVar(area, 'programar')}`. Import `esMaquinaria as esMaquinariaVar`.

- [ ] **Step 5: `tareas/page.tsx`** — dos cambios:
  - El `esMaquinaria` del área actual: `const esMaquinaria = esMaquinariaVar(areaActual, 'tareas')` (import de variante).
  - Eliminar `const maquinariaArea = ...` y `const maquinariaAreaId = ...`. La prop a `FormSolicitar` cambia: en lugar de `maquinariaAreaId={maquinariaAreaId}`, pasar las áreas con su bandera:

```tsx
        <FormSolicitar
          solicitanteAreaId={areaId}
          areas={areas.map((a) => ({ id: a.id, nombre: a.nombre, maqTareas: a.maqTareas }))}
          estipuladas={estipuladas}
          lotes={lotes}
          accion={crearSolicitudAccion}
        />
```

- [ ] **Step 6: `tareas/form-solicitar.tsx`** — ajustar el tipo de `areas` y la decisión de variante:
  - Cambiar el tipo: `type Area = { id: string; nombre: string; maqTareas: boolean }`.
  - Quitar el prop `maquinariaAreaId` (y su tipo).
  - Reemplazar `const esMaquinaria = areaEjecutoraId !== '' && areaEjecutoraId === maquinariaAreaId` por:

```tsx
  const esMaquinaria = areas.find((a) => a.id === areaEjecutoraId)?.maqTareas ?? false
```

- [ ] **Step 7: Confirmar que no quedan detecciones por nombre:**

```bash
grep -rn "includes('maquinaria')" src/ || echo "LIMPIO"
```

Expected: `LIMPIO`.

- [ ] **Step 8: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 9: Tests** — Harness B. Expected: verde (la lógica de maquinaria no cambió, solo su origen).

- [ ] **Step 10: Verificación visual** — Harness C/D. Screenshot de `/cumplimiento` y `/tareas` para el área de maquinaria: deben verse idénticos a antes (formularios con máquina/medida). Expected: sin cambios visibles.

- [ ] **Step 11: Commit**

```bash
git add src/app/tareas/page.tsx src/app/tareas/form-solicitar.tsx src/app/programar/page.tsx src/app/programar/exportar/page.tsx src/app/cumplimiento/page.tsx src/app/resumen/page.tsx src/app/resumen/exportar/page.tsx
git commit -m "feat: variante de maquinaria desde banderas de área (reemplaza detección por nombre)"
```

---

## Task 7: UI de administración en Configuración

**Files:**
- Create: `src/app/configuracion/usuario-pantallas.tsx`
- Create: `src/app/configuracion/area-variantes.tsx`
- Modify: `src/datos/repositorio.ts` (2 funciones nuevas)
- Modify: `src/app/configuracion/acciones.ts` (2 acciones nuevas)
- Modify: `src/app/configuracion/page.tsx` (cablear ambos)

**Interfaces:**
- Consumes: `PANTALLAS_ASIGNABLES` (Task 2), `listarUsuarios`/`listarAreas` (existentes, ya traen los campos nuevos).
- Produces: `setPantallasUsuario(id, pantallas)`, `setVariantesArea(id, flags)` en repositorio; `actualizarPantallasUsuarioAccion(form)`, `actualizarVariantesAreaAccion(form)` en acciones.

- [ ] **Step 1: Funciones de repositorio** — añadir al final de `src/datos/repositorio.ts`:

```ts
export function setPantallasUsuario(id: string, pantallas: string | null) {
  return prisma.usuario.update({ where: { id }, data: { pantallas } })
}

export function setVariantesArea(
  id: string,
  flags: { maqTareas: boolean; maqProgramar: boolean; maqCumplimiento: boolean; maqResumen: boolean },
) {
  return prisma.area.update({ where: { id }, data: flags })
}
```

- [ ] **Step 2: Acciones** — en `src/app/configuracion/acciones.ts`, añadir el import a `@/datos/repositorio` (`setPantallasUsuario, setVariantesArea`) y:

```ts
export async function actualizarPantallasUsuarioAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  const claves = form.getAll('pantalla').filter((v): v is string => typeof v === 'string')
  const csv = claves.length > 0 ? claves.join(',') : ''
  await correr(() => setPantallasUsuario(id, csv), 'Pantallas del usuario actualizadas.')
}

export async function actualizarVariantesAreaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) faltanDatos()
  const flag = (k: string) => form.get(k) === '1'
  await correr(
    () => setVariantesArea(id, {
      maqTareas: flag('maqTareas'),
      maqProgramar: flag('maqProgramar'),
      maqCumplimiento: flag('maqCumplimiento'),
      maqResumen: flag('maqResumen'),
    }),
    'Variantes del área actualizadas.',
  )
}
```

- [ ] **Step 3: Componente `usuario-pantallas.tsx`** (cliente):

```tsx
'use client'

const PANTALLAS: { clave: string; etiqueta: string }[] = [
  { clave: 'tareas', etiqueta: 'Tareas' },
  { clave: 'programar', etiqueta: 'Programar' },
  { clave: 'cumplimiento', etiqueta: 'Cumplimiento' },
  { clave: 'resumen', etiqueta: 'Resumen' },
  { clave: 'tablero', etiqueta: 'Tablero' },
]

// pantallas: CSV guardado (null = set por defecto de área: las 4 menos Tablero)
function setActual(pantallas: string | null): Set<string> {
  if (pantallas == null) return new Set(['tareas', 'programar', 'cumplimiento', 'resumen'])
  return new Set(pantallas.split(',').map((c) => c.trim()).filter(Boolean))
}

export function UsuarioPantallas({
  id,
  esAdmin,
  pantallas,
  accion,
}: {
  id: string
  esAdmin: boolean
  pantallas: string | null
  accion: (formData: FormData) => void | Promise<void>
}) {
  if (esAdmin) return <span className="text-xs text-tierra">ve todo (admin)</span>
  const activas = setActual(pantallas)
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {PANTALLAS.map((p) => (
        <label key={p.clave} className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="pantalla" value={p.clave} defaultChecked={activas.has(p.clave)} className="accent-bosque" />
          {p.etiqueta}
        </label>
      ))}
      <button className="rounded-lg bg-bosque px-2 py-1 text-xs font-semibold text-white">Guardar</button>
    </form>
  )
}
```

- [ ] **Step 4: Componente `area-variantes.tsx`** (cliente, con aviso suave):

```tsx
'use client'

import { useState } from 'react'

const CAMPOS: { name: string; etiqueta: string }[] = [
  { name: 'maqTareas', etiqueta: 'Tareas' },
  { name: 'maqProgramar', etiqueta: 'Programar' },
  { name: 'maqCumplimiento', etiqueta: 'Cumplimiento' },
  { name: 'maqResumen', etiqueta: 'Resumen' },
]

export function AreaVariantes({
  id,
  nombre,
  valores,
  accion,
}: {
  id: string
  nombre: string
  valores: { maqTareas: boolean; maqProgramar: boolean; maqCumplimiento: boolean; maqResumen: boolean }
  accion: (formData: FormData) => void | Promise<void>
}) {
  const [estado, setEstado] = useState(valores)
  const set = (name: string, v: boolean) => setEstado((p) => ({ ...p, [name]: v }))
  const valoresArr = [estado.maqTareas, estado.maqProgramar, estado.maqCumplimiento, estado.maqResumen]
  const incoherente = valoresArr.some(Boolean) && !valoresArr.every(Boolean)

  return (
    <form action={accion} className="flex flex-col gap-2 rounded-lg border border-borde bg-marfil p-3 text-sm">
      <input type="hidden" name="id" value={id} />
      <div className="font-semibold text-tinta">{nombre}</div>
      <div className="flex flex-wrap gap-3">
        {CAMPOS.map((c) => {
          const on = estado[c.name as keyof typeof estado]
          return (
            <label key={c.name} className="flex items-center gap-1 text-xs">
              <input type="hidden" name={c.name} value={on ? '1' : '0'} />
              <input type="checkbox" checked={on} onChange={(e) => set(c.name, e.target.checked)} className="accent-bosque" />
              {c.etiqueta}: <b>{on ? 'Maquinaria' : 'Estándar'}</b>
            </label>
          )
        })}
      </div>
      {incoherente && (
        <p className="text-xs text-arcilla">
          ⚠️ Las 4 pantallas no coinciden. Es válido, pero puede dar combinaciones raras (p. ej. asignar máquina sin poder registrar su medida). Conviene igualarlas.
        </p>
      )}
      <button className="self-start rounded-lg bg-bosque px-3 py-1 text-xs font-semibold text-white">Guardar variantes</button>
    </form>
  )
}
```

> Nota: el `<input type="hidden" name>` lleva el valor `'1'/'0'` que lee la acción; la casilla visible solo controla el estado del hidden vía React (por eso el hidden va dentro del label y se actualiza con `estado`).

- [ ] **Step 5: Cablear en `configuracion/page.tsx`.**
  - Imports nuevos: `UsuarioPantallas` de `./usuario-pantallas`, `AreaVariantes` de `./area-variantes`, y las acciones `actualizarPantallasUsuarioAccion`, `actualizarVariantesAreaAccion`.
  - En la sección **Usuarios**, dentro del `<li>` de cada usuario, tras el `<span>` de datos, añadir:

```tsx
                <UsuarioPantallas
                  id={us.id}
                  esAdmin={us.rol === 'ADMIN'}
                  pantallas={us.pantallas}
                  accion={actualizarPantallasUsuarioAccion}
                />
```

  - En la sección **Áreas** (la del `<section>` de "Áreas"), tras la lista de chips de áreas, añadir un bloque de variantes por área:

```tsx
          <div className="mt-3 flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-tinta">Variante por pantalla</h4>
            {areas.map((a) => (
              <AreaVariantes
                key={a.id}
                id={a.id}
                nombre={a.nombre}
                valores={{ maqTareas: a.maqTareas, maqProgramar: a.maqProgramar, maqCumplimiento: a.maqCumplimiento, maqResumen: a.maqResumen }}
                accion={actualizarVariantesAreaAccion}
              />
            ))}
          </div>
```

- [ ] **Step 6: Typecheck** — Harness A. Expected: `TYPECHECK OK`.

- [ ] **Step 7: Verificación visual** — Harness C/D. Screenshot de `/configuracion`: la sección Usuarios muestra casillas por usuario (admin = "ve todo"); la sección Áreas muestra los toggles por pantalla y el aviso suave cuando no coinciden. Expected: controles presentes y en estilo cálido.

- [ ] **Step 8: Verificación funcional (round-trip)** — con el server local: en `/configuracion` desmarcar Tablero/algo a un usuario de área y Guardar; confirmar en DB que `Usuario.pantallas` quedó con el CSV esperado; cambiar una variante de un área y confirmar `Area.maq*`. Luego **restaurar** los valores (volver a dejar el usuario en su set y el área como estaba) para no dejar datos de prueba en producción.

```bash
DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1)
DATABASE_URL="$DB" node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.usuario.findMany({select:{usuario:true,pantallas:true}}).then(r=>{console.log(r);return p.\$disconnect()})"
```

- [ ] **Step 9: Commit**

```bash
git add src/datos/repositorio.ts src/app/configuracion/
git commit -m "feat(configuracion): UI para pantallas por usuario y variantes por área"
```

---

## Task 8: Verificación completa y despliegue

**Files:** posibles retoques menores.

- [ ] **Step 1: Typecheck** — Harness A. Expected: `TYPECHECK OK`.
- [ ] **Step 2: Tests** — Harness B. Expected: todos verdes (136 previos + nuevos de Tasks 2/3/4).
- [ ] **Step 3: Recorrido de no-regresión** — con el server local, recorrer como ADMIN `/`, `/tareas`, `/programar`, `/cumplimiento`, `/resumen`, `/tablero`, `/configuracion`: todo se ve y funciona como antes (el ADMIN ve todo; la variante de maquinaria del área correspondiente sigue mostrando los formularios de máquina/medida). Screenshots de `/` y `/configuracion`.
- [ ] **Step 4: Verificación de permisos** — crear (o usar) un usuario de área, recortarle pantallas en Configuración, e iniciar sesión como ese usuario (o simular su cookie): confirmar que la nav solo muestra lo permitido y que las URLs vetadas redirigen a `/`. Restaurar permisos al terminar.
- [ ] **Step 5: Desplegar a producción** (la migración se aplica en el build con `prisma migrate deploy`; si ya se aplicó en Task 1 a la base compartida, es no-op):

```bash
cd /home/derlly/projects/cronograma
git push origin master
npx vercel@latest deploy --prod
```

Expected: build OK, `READY`, aliasado a la URL pública. (Auto-deploy GitHub→Vercel NO está conectado; se publica por CLI. Ver memoria `despliegue-nube`.)

- [ ] **Step 6: Verificar en vivo** — `curl -s https://cronograma-ayura.vercel.app/login` responde 200; entrar como admin y confirmar Configuración con los controles nuevos.

---

## Self-review (cobertura del spec)

- Modelo de datos (`Usuario.pantallas`, 4 booleanos en `Area`) → Task 1. ✓
- Migración aditiva + backfill por nombre → Task 1. ✓
- `permisos.ts` (pantallasDe/puedeVer, default, admin, CSV, configuracion nunca) → Task 2. ✓
- `variante.ts` (esMaquinaria por pantalla) → Task 3. ✓
- Navegación por permisos (seccionesVisibles(usuario), nav, layout, inicio) → Task 4. ✓
- Refuerzo en servidor (guards + redirect) → Task 5. ✓
- Reemplazo de detección por nombre en las 4 pantallas + exports + FormSolicitar → Task 6. ✓
- UI de administración (usuarios + áreas + aviso suave) + acciones + repositorio → Task 7. ✓
- Pruebas unitarias nuevas + no-regresión 136 → Tasks 2/3/4/8. ✓
- Sin cambios de lógica de negocio (solo origen del booleano y visibilidad) → gates de tests en Tasks 4/6/8. ✓
- Despliegue por CLI con migración en build → Task 8. ✓

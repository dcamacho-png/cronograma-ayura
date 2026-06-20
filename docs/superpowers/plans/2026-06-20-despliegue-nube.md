# Despliegue a la nube (Plan 6) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el código y la configuración listos para publicar la app en Vercel con base Postgres (Neon) y login actual; los pasos de cuentas/despliegue quedan en una guía para ejecutarse después con la usuaria.

**Architecture:** Se cambia Prisma de SQLite a Postgres y se regenera una migración inicial offline (sin DB viva, vía `migrate diff`). El seed se reconcilia al catálogo curado (incluye Maiz-Riego). El build aplica migraciones en cada despliegue (`prisma migrate deploy`) y `postinstall` genera el cliente. La cookie de sesión se endurece (`secure` en producción + expiración). Una guía `docs/DESPLIEGUE.md` documenta los pasos manuales (GitHub, Neon, Vercel).

**Tech Stack:** Next.js 16, Prisma 6, Postgres (Neon), Vercel.

## Global Constraints

- Host Vercel + base Neon Postgres; login actual (usuario/contraseña). Costo objetivo $0.
- No hay datos de producción que preservar (la base local es de prueba) → se regenera la migración inicial para Postgres.
- Seed reconciliado al catálogo curado: 4 áreas (Maiz-Riego, Maquinaria, Ganadería ceba, Nelore), sus responsables y 5 usuarios (admin, ganaderia, maquinaria, nelore, maizriego); contraseña `clave123`.
- Cookie de sesión: `httpOnly`, `sameSite:'lax'`, `path:'/'`, `secure` solo en producción, `maxAge` 30 días.
- `SESION_SECRET` por variable de entorno (fallback solo para local).
- **No ejecutar `npm run dev` ni `npm run build` localmente durante la implementación**: tras cambiar a Postgres no hay base local conectada; la verificación es `npx tsc --noEmit`, `npm run lint` y `npm test` (no tocan la base). La aplicación real de migraciones + seed se hace en la fase manual contra Neon.
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` sin errores (y `npm test` donde aplique).
- Spec: `docs/superpowers/specs/2026-06-19-despliegue-nube-design.md`.

## File Structure

- `prisma/schema.prisma` — provider → `postgresql`.
- `prisma/migrations/` — borrar migraciones SQLite; crear `0_init/migration.sql` (Postgres) + `migration_lock.toml`.
- `prisma/seed.ts` — AREAS / RESPONSABLES / USUARIOS reconciliados.
- `package.json` — `postinstall` + `build`.
- `src/auth/sesion.ts` — cookie endurecida.
- `docs/DESPLIEGUE.md` — guía de pasos manuales.

---

## Task 1: Prisma a Postgres + migración inicial regenerada

**Files:**
- Modify: `prisma/schema.prisma` (datasource)
- Delete: `prisma/migrations/*` (migraciones SQLite)
- Create: `prisma/migrations/0_init/migration.sql`, `prisma/migrations/migration_lock.toml`

**Interfaces:**
- Produces: esquema con `provider = "postgresql"` y una única migración `0_init` con SQL de Postgres que crea TODO el modelo actual.

- [ ] **Step 1: Cambiar el provider a postgresql**

En `prisma/schema.prisma`, el bloque datasource queda:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

(El bloque `generator client { provider = "prisma-client-js" }` no cambia.)

- [ ] **Step 2: Borrar las migraciones SQLite**

Run: `rm -rf prisma/migrations`
Expected: la carpeta queda eliminada (se regenera en el paso siguiente).

- [ ] **Step 3: Generar la migración inicial de Postgres (offline, sin DB)**

Run:
```bash
mkdir -p prisma/migrations/0_init
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
```
Expected: `prisma/migrations/0_init/migration.sql` contiene `CREATE TABLE "Area" ...`, `CREATE TABLE "Usuario" ...`, `CREATE TABLE "Responsable" ...` (con columna `activo`), `CREATE TABLE "Lote" ...`, `CREATE TABLE "Actividad" ...` (con `maquinaId`, `haFaltante`, etc.), y las tablas de relación N–N de lotes. Verifica que NO esté vacío y que sea SQL de Postgres (tipos `TEXT`, `DOUBLE PRECISION`, `BOOLEAN`, claves foráneas con `ADD CONSTRAINT`).

- [ ] **Step 4: Fijar el lock del provider**

Crear `prisma/migrations/migration_lock.toml` con:

```toml
provider = "postgresql"
```

- [ ] **Step 5: Regenerar el cliente Prisma**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" sin errores (no se conecta a ninguna base).

- [ ] **Step 6: Verificar typecheck, lint y tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; 64 tests verdes (no dependen de la base).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(deploy): Prisma a Postgres + migración inicial 0_init regenerada"
```

---

## Task 2: Seed reconciliado al catálogo curado (incluye Maiz-Riego)

**Files:**
- Modify: `prisma/seed.ts` (`AREAS`, `RESPONSABLES`, bloque `USUARIOS`)

**Interfaces:**
- Consumes: esquema Postgres (Task 1).

- [ ] **Step 1: Áreas**

En `prisma/seed.ts`, reemplazar la constante `AREAS` por:

```ts
const AREAS = ['Maiz-Riego', 'Maquinaria', 'Ganadería ceba', 'Nelore']
```

- [ ] **Step 2: Responsables por área**

Reemplazar el objeto `RESPONSABLES` por:

```ts
const RESPONSABLES: Record<string, string[]> = {
  'Maiz-Riego': ['Alexander', 'Alexis Rojas', 'Dairon Rojas', 'Diego Gomez'],
  Maquinaria: [
    'Andrés Mosquera',
    'Carlos Botiva',
    'Daveis Ramírez',
    'Jaime Nevado',
    'Jairo Leal',
    'José Losada',
    'Luis Olaya',
    'Santos Bastos',
  ],
  'Ganadería ceba': [
    'Alirio Bravo',
    'David Zuleta',
    'Duván Peña',
    'Guillermo Bravo',
    'Jhones Andrés',
    'Julieth Camacho',
    'Raúl Piñeros',
    'Vaqueros Acajure',
    'Vaqueros Entremontes',
  ],
  Nelore: ['Antonio Medina', 'Daniela', 'J Moreno - Contratista', 'Oscar Carrillo', 'Rodolfo Ducuara'],
}
```

- [ ] **Step 3: Usuarios**

En `prisma/seed.ts`, reemplazar el arreglo `USUARIOS` por:

```ts
  const USUARIOS: { usuario: string; nombre: string; rol: string; area: string | null }[] = [
    { usuario: 'admin', nombre: 'Coordinación general', rol: 'ADMIN', area: null },
    { usuario: 'ganaderia', nombre: 'Ganadería ceba', rol: 'AREA', area: 'Ganadería ceba' },
    { usuario: 'maquinaria', nombre: 'Maquinaria', rol: 'AREA', area: 'Maquinaria' },
    { usuario: 'nelore', nombre: 'Nelore', rol: 'AREA', area: 'Nelore' },
    { usuario: 'maizriego', nombre: 'Maíz y Riego', rol: 'AREA', area: 'Maiz-Riego' },
  ]
```

- [ ] **Step 4: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (El seed no se ejecuta aquí: requiere la base Neon; se corre en la fase manual.)

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(deploy): seed reconciliado al catálogo curado (áreas Maiz-Riego, responsables y usuarios)"
```

---

## Task 3: Configuración de producción (build, cookie, .gitignore, guía)

**Files:**
- Modify: `package.json` (`scripts`)
- Modify: `src/auth/sesion.ts` (cookie en `crearSesion`)
- Verify: `.gitignore`
- Create: `docs/DESPLIEGUE.md`

**Interfaces:**
- Consumes: Prisma Postgres (Task 1).

- [ ] **Step 1: Scripts de build/postinstall**

En `package.json`, en `"scripts"`, dejar:

```json
    "build": "prisma migrate deploy && next build",
    "postinstall": "prisma generate"
```

(Mantener los demás scripts: `dev`, `start`, `lint`, `test`, `test:watch`, `db:seed`. Agregar `postinstall` si no existe; cambiar `build` de `"next build"` al valor de arriba.)

- [ ] **Step 2: Endurecer la cookie de sesión**

En `src/auth/sesion.ts`, reemplazar el `c.set(...)` dentro de `crearSesion` por:

```ts
  c.set(COOKIE, `${usuarioId}.${firmar(usuarioId)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  })
```

(El resto del archivo no cambia.)

- [ ] **Step 3: Verificar `.gitignore`**

Run: `grep -nE '^\.env|^\*\.db|/node_modules|^/\.next|\.vercel' .gitignore`
Expected: aparecen `.env*`, `*.db`, `/node_modules`, `/.next/`, `.vercel`. (Ya están; si faltara alguno, agregarlo.) Confirmar además que `.env` y `prisma/dev.db` NO están versionados: `git ls-files .env prisma/dev.db` debe salir vacío.

- [ ] **Step 4: Crear la guía de despliegue**

Crear `docs/DESPLIEGUE.md` con:

```markdown
# Guía de despliegue — Cronograma Ayurá (Vercel + Neon)

Objetivo: publicar la app en internet para que los coordinadores entren desde cualquier lado.
Todo en planes gratis. Sigue los pasos en orden.

## 1. GitHub (respaldo del código)
1. Crea una cuenta en https://github.com (si no tienes).
2. Crea un repositorio nuevo y vacío, por ejemplo `cronograma-ayura` (privado).
3. En la terminal del proyecto, conéctalo y sube el código:
   ```
   git remote add origin https://github.com/<TU_USUARIO>/cronograma-ayura.git
   git push -u origin master
   ```

## 2. Neon (base de datos Postgres)
1. Crea una cuenta en https://neon.tech (gratis).
2. Crea un proyecto. Copia la **cadena de conexión** (Connection string), algo como:
   `postgresql://usuario:clave@ep-xxxx.neon.tech/neondb?sslmode=require`
3. Entrega esa cadena para configurar la base (es el `DATABASE_URL`).

## 3. Cargar la base (una sola vez)
Con esa cadena en una variable `DATABASE_URL`, se aplican las migraciones y se cargan los catálogos:
```
DATABASE_URL="<cadena de Neon>" npx prisma migrate deploy
DATABASE_URL="<cadena de Neon>" npm run db:seed
```
Esto crea las tablas y siembra áreas, fincas, lotes (356), máquinas, actividades de maquinaria y los usuarios (contraseña inicial `clave123`).

## 4. Vercel (publicar la app)
1. Crea una cuenta en https://vercel.com (entra con tu GitHub).
2. "Add New… → Project" → importa el repositorio `cronograma-ayura`.
3. En **Environment Variables** agrega:
   - `DATABASE_URL` = la cadena de Neon.
   - `SESION_SECRET` = un texto largo y aleatorio (por ejemplo, genera uno con `openssl rand -hex 32`).
4. "Deploy". Al terminar tendrás una URL `https://<algo>.vercel.app`.

## 5. Primer ingreso y seguridad
1. Abre la URL y entra como `admin` / `clave123`.
2. Ve a **Configuración → Usuarios** y **cambia las contraseñas** de todos (admin y cada área).
3. Comparte la URL con los coordinadores y sus usuarios.

## Actualizaciones futuras
Cada vez que se cambie el código: `git push`. Vercel vuelve a publicar solo y aplica migraciones nuevas.

## Notas
- El plan gratis de Neon "duerme" la base por inactividad; la primera carga tras un rato puede tardar ~1 segundo.
- El desarrollo local también usa la base de Neon (pon la misma `DATABASE_URL` en el archivo `.env`).
```

- [ ] **Step 5: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (No correr `npm run build` localmente: `prisma migrate deploy` necesita la base Neon.)

- [ ] **Step 6: Commit**

```bash
git add package.json src/auth/sesion.ts docs/DESPLIEGUE.md .gitignore
git commit -m "feat(deploy): build con migrate deploy, cookie segura en producción y guía de despliegue"
```

---

## Fase manual (después del plan, guiada con la usuaria — NO la ejecutan subagentes)

Estos pasos requieren cuentas y paneles; se hacen siguiendo `docs/DESPLIEGUE.md`:
1. Crear repo en GitHub y `git push`.
2. Crear proyecto Neon y obtener `DATABASE_URL`.
3. `prisma migrate deploy` + `npm run db:seed` contra Neon (lo corre Claude desde la PC con la cadena).
4. Crear proyecto en Vercel, configurar `DATABASE_URL` y `SESION_SECRET`, desplegar.
5. Verificar ingreso en la URL y cambiar contraseñas.

---

## Self-Review (autor del plan)

- **Cobertura del spec:** Prisma a Postgres + migración inicial regenerada offline (Task 1) ✓; seed reconciliado con Maiz-Riego/responsables/usuarios (Task 2) ✓; build con `migrate deploy` + `postinstall generate` (Task 3) ✓; cookie `secure`+`maxAge` y `SESION_SECRET` (Task 3) ✓; `.gitignore` verificado (Task 3) ✓; guía `docs/DESPLIEGUE.md` (Task 3) ✓; pasos manuales documentados en la fase manual ✓.
- **Placeholders:** ninguno; el código/SQL/guía están completos. Los `<TU_USUARIO>` / `<cadena de Neon>` en la guía son marcadores que la usuaria rellena (es su intención, no código).
- **Consistencia:** nombres de áreas/usuarios idénticos entre spec y plan; `provider = "postgresql"` en schema y `migration_lock.toml`; `build`/`postinstall` coherentes (postinstall genera, build aplica migraciones); cookie con las 5 opciones del spec.
- **Nota de ejecución:** tras Task 1 la app no corre localmente hasta conectar Neon (fase manual); por eso la verificación es tsc/lint/test, no `dev`/`build`. Sin reinicio de dev server (de hecho, dejará de servir queries hasta tener Neon).

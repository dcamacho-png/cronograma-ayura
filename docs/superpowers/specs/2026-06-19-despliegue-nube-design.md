# Despliegue a la nube (Plan 6): Vercel + Neon Postgres, login actual

Estado: APROBADO (2026-06-19)

## Objetivo

Publicar la app en internet para que los coordinadores inicien sesión desde cualquier dispositivo, sin depender de la computadora local. Host: **Vercel**. Base de datos: **Neon (Postgres)**. Login: el **actual** (usuario/contraseña propio). Costo objetivo: **$0** (planes gratis) para ~6–20 usuarios.

## Contexto técnico

- Next.js 16 (App Router) + Prisma 6. Hoy `datasource provider = "sqlite"`, `url = env("DATABASE_URL")`; migraciones en formato SQLite.
- Auth propia: `src/auth/sesion.ts` (cookie `sesion` firmada con HMAC usando `process.env.SESION_SECRET`, con fallback inseguro para local). La cookie hoy es `httpOnly + sameSite:lax + path:'/'` (sin `secure`, sin expiración).
- Seed (`prisma/seed.ts`) siembra catálogos + usuarios (contraseña `clave123`). `prisma/lotes.json` ya trae 356 lotes (incluye Normandia y la corrección ALCARAVAN).
- No hay datos de producción que preservar (la base local es de prueba).
- El repo NO tiene remoto aún.

## Decisiones acordadas

- **Host:** Vercel (HTTPS y URL `…vercel.app`). **Base:** Neon Postgres (gratis).
- **Login:** mantener el actual; solo endurecer (secreto fuerte + cookie segura). Supabase Auth queda para después.
- **Conexión/despliegue:** vía **GitHub** (repo → Vercel conecta y autopublica en cada push; además respalda el código).
- **Seed reconciliado** al estado curado actual (incluye **Maiz-Riego** combinado).

## Parte 1 — Cambios de código y configuración

### 1.1 Prisma a Postgres

- `prisma/schema.prisma`: `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`.
- Regenerar migraciones para Postgres: como no hay datos de producción, **borrar** la carpeta `prisma/migrations/` (SQLite) y crear una **migración inicial** Postgres (`migrate dev --name init` contra la base Neon, o equivalente con `migrate diff`). El resultado: una sola migración `*_init` con SQL de Postgres.
- Consecuencia: el desarrollo local también usará Postgres (Neon) vía `DATABASE_URL`; ya no el archivo SQLite. Se documenta en el instructivo.

### 1.2 Seed reconciliado (refleja el catálogo curado)

En `prisma/seed.ts`:

- `AREAS = ['Maiz-Riego', 'Maquinaria', 'Ganadería ceba', 'Nelore']`
- `RESPONSABLES`:
  - `'Maiz-Riego'`: `['Alexander', 'Alexis Rojas', 'Dairon Rojas', 'Diego Gomez']`
  - `'Maquinaria'`: `['Andrés Mosquera', 'Carlos Botiva', 'Daveis Ramírez', 'Jaime Nevado', 'Jairo Leal', 'José Losada', 'Luis Olaya', 'Santos Bastos']`
  - `'Ganadería ceba'`: `['Alirio Bravo', 'David Zuleta', 'Duván Peña', 'Guillermo Bravo', 'Jhones Andrés', 'Julieth Camacho', 'Raúl Piñeros', 'Vaqueros Acajure', 'Vaqueros Entremontes']`
  - `'Nelore'`: `['Antonio Medina', 'Daniela', 'J Moreno - Contratista', 'Oscar Carrillo', 'Rodolfo Ducuara']`
- `USUARIOS`:
  - `{ usuario: 'admin', nombre: 'Coordinación general', rol: 'ADMIN', area: null }`
  - `{ usuario: 'ganaderia', nombre: 'Ganadería ceba', rol: 'AREA', area: 'Ganadería ceba' }`
  - `{ usuario: 'maquinaria', nombre: 'Maquinaria', rol: 'AREA', area: 'Maquinaria' }`
  - `{ usuario: 'nelore', nombre: 'Nelore', rol: 'AREA', area: 'Nelore' }`
  - `{ usuario: 'maizriego', nombre: 'Maíz y Riego', rol: 'AREA', area: 'Maiz-Riego' }`
- `FINCAS`, `MOTIVOS`, `ACTIVIDADES_ESTIPULADAS`, máquinas (11 tractores) y `lotes.json`: sin cambios.
- Se conserva el comportamiento idempotente actual (responsables solo si `count===0`; usuarios por `upsert`; lotes por `upsert`).

### 1.3 Build/despliegue (Vercel)

- `package.json`:
  - `"build": "prisma generate && prisma migrate deploy && next build"` (genera cliente y aplica migraciones en cada despliegue).
  - Mantener `"postinstall": "prisma generate"` si ya existe, o agregarlo (para que el cliente esté generado tras `npm install`). (Verificar duplicación; si `build` ya genera, basta uno.)
- Vercel detecta Next.js automáticamente; no se requiere `vercel.json`.
- El **seed** NO corre en cada build (no es idempotente al 100% para responsables). Se ejecuta **una sola vez** manualmente contra Neon tras la primera migración (paso del instructivo).

### 1.4 Seguridad

- `src/auth/sesion.ts`, en `crearSesion`, la cookie pasa a:
  ```ts
  c.set(COOKIE, `${usuarioId}.${firmar(usuarioId)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  })
  ```
- `SESION_SECRET`: variable de entorno obligatoria en Vercel (valor largo aleatorio). El fallback `'cronograma-local-secret'` se mantiene solo para desarrollo, pero el instructivo exige fijar uno fuerte en producción.
- Tras el primer despliegue: **cambiar las contraseñas** por defecto (`clave123`) de todos los usuarios desde Configuración.

### 1.5 `.gitignore`

- Verificar/asegurar que ignore: `.env`, `*.db` / `prisma/dev.db`, `node_modules`, `.next`. (No subir secretos ni la base local a GitHub.)

### 1.6 Instructivo de despliegue

- Crear `docs/DESPLIEGUE.md` con los pasos manuales (Parte 2), en español sencillo.

## Parte 2 — Pasos manuales (los hace la usuaria; la guío)

1. **GitHub:** crear cuenta + repositorio; subir el código (`git remote add` + `push`).
2. **Neon:** crear cuenta + proyecto Postgres; copiar la **cadena de conexión** (`DATABASE_URL`) y entregármela.
3. **Migración + carga inicial:** con esa `DATABASE_URL`, se corre `prisma migrate deploy` y `npm run db:seed` contra Neon (lo hace Claude desde la PC, una vez).
4. **Vercel:** crear cuenta; "Import" del repo de GitHub; configurar variables de entorno `DATABASE_URL` (la de Neon) y `SESION_SECRET` (valor fuerte); desplegar.
5. **Verificar:** abrir la URL `…vercel.app`, iniciar sesión (admin / usuarios de área), **cambiar contraseñas**, compartir el enlace.

## Qué NO cambia

- Pantallas, lógica de negocio, métricas, exportaciones: sin cambios.
- El modelo de datos (tablas) es el mismo; solo cambia el motor (SQLite → Postgres) y se regenera la migración inicial.

## Pruebas

- `npx tsc --noEmit` y `npm run lint` limpios; suite de dominio (64) sigue verde (no depende de la base).
- Verificación de base: tras `migrate deploy` + `db:seed` contra Neon, confirmar conteos (4 áreas, 5 usuarios, 356 lotes, 11 máquinas, responsables esperados).
- Verificación e2e en la nube: iniciar sesión en la URL de Vercel como admin y como un área; ver el inicio (menú) y navegar; crear una tarea de prueba.

## Riesgos / notas

- Cambiar de SQLite a Postgres regenera migraciones; al ser base nueva no hay pérdida de datos de producción (la local es de prueba).
- Neon "pausa" la base por inactividad en el plan gratis (la primera petición tras inactividad puede tardar ~1s); aceptable para uso interno.
- Sin GitHub Actions ni CI; el despliegue es el de Vercel al hacer push.
- El seed de responsables solo corre con tabla vacía; cambios posteriores se hacen en Configuración (no re-seed).

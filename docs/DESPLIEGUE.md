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

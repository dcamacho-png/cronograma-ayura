# Diseño — Usuarios y vistas por área (login local)

**Fecha:** 2026-06-18 · **Estado:** Aprobado · **Alcance:** login sencillo en local (se reforzará con Supabase Auth en el Plan 6).

## Objetivo
Cada área tiene un usuario que ve y maneja **solo su área**; un usuario de **coordinación general (Admin)** ve **todo**.

## Datos
- **Usuario**: `{ id, usuario (único, login), nombre, hash (contraseña encriptada), rol: 'AREA'|'ADMIN', areaId? }`. `Area` gana `usuarios Usuario[]`.

## Acceso (auth local)
- Contraseñas con **hash** (scrypt + salt). Login = usuario + contraseña.
- **Sesión** = cookie httpOnly firmada (HMAC) con el id del usuario. Helpers: `usuarioActual()`, `iniciarSesion`, `cerrarSesion`.
- Página **/login**. Sin sesión → redirige a /login. Botón **Cerrar sesión** en la barra (muestra el usuario actual).
- Seguridad sencilla para local; en la nube (Plan 6) se reemplaza por Supabase Auth.

## Roles y vistas
- **AREA** (ej. Ganadería): queda **fijo en su área**. Ve **Tareas · Programar · Cumplimiento · Resumen** solo de su área (sin selector de áreas). Puede **solicitar a otras áreas** y ver "Mis solicitudes"; le llegan las solicitudes de otras. **No** ve Tablero ni Configuración.
- **ADMIN** (coordinación general): ve **todo** — selector de áreas habilitado, **Tablero mensual** y **Configuración** (catálogos + usuarios). Protección: Tablero y Configuración solo Admin.

## Usuarios sembrados
- `admin` (rol ADMIN) + uno por área (`ganaderia`, `maquinaria`, `maiz`, `riego`, `nelore`), rol AREA, con contraseña por defecto. Se cambian luego.

## Gestión de usuarios (Admin, en Configuración)
- Sección "Usuarios": listar, **crear** (usuario, nombre, contraseña, rol, área), **cambiar contraseña**, **eliminar**.

## Fases de construcción
1. Esquema Usuario + seed + helpers auth (hash/sesión) + login/logout + redirección.
2. Scoping por rol (área fija; admin ve todo; Tablero/Configuración solo admin; nav por rol).
3. Gestión de usuarios en Configuración (admin).

## Pruebas
- TDD del hash/verify de contraseña. El resto (sesión, scoping, pantallas) por build + e2e + curl. Reiniciar `npm run dev` tras la migración.

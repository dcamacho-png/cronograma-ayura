# Página de inicio tipo menú (iconos grandes) + barra con íconos y menú móvil

Estado: APROBADO (2026-06-19)

## Problema / petición

La barra de menú de arriba se ve "muy plana" en PC. Se quiere:
1. Una **página de inicio tipo menú** con **iconos grandes** (tarjetas clicables) hacia cada sección.
2. La **barra superior** con **íconos** por sección y, en celular, un **menú compacto (☰)**.

## Decisiones acordadas

- El menú de iconos grandes es la **página de inicio** (`/`): al iniciar sesión se llega ahí; el logo y el enlace "🏠 Inicio" regresan a ella.
- La **barra de arriba** se mantiene para cambiar de sección rápido, ahora con íconos; en celular colapsa en un botón ☰ que despliega un panel con los enlaces + usuario/cerrar sesión.
- Colores (verde Ayurá), filtrado por rol (admin ve todo; área no ve Tablero ni Configuración) y resaltado de la sección activa: sin cambios de criterio.

## Catálogo compartido de secciones

Archivo nuevo: `src/app/_componentes/secciones.ts`

```ts
export type Seccion = {
  href: string
  texto: string
  icono: string
  descripcion: string
  soloAdmin?: boolean
}

export const SECCIONES: Seccion[] = [
  { href: '/tareas', texto: 'Tareas', icono: '📋', descripcion: 'Banco de actividades por área' },
  { href: '/programar', texto: 'Programar', icono: '🗓️', descripcion: 'Cronograma de la semana' },
  { href: '/cumplimiento', texto: 'Cumplimiento', icono: '✅', descripcion: 'Registrar lo cumplido' },
  { href: '/resumen', texto: 'Resumen', icono: '📊', descripcion: 'Indicadores de la semana' },
  { href: '/tablero', texto: 'Tablero', icono: '📈', descripcion: 'Vista mensual (solo admin)', soloAdmin: true },
  { href: '/configuracion', texto: 'Configuración', icono: '⚙️', descripcion: 'Catálogos y usuarios (solo admin)', soloAdmin: true },
]

// Secciones visibles según el rol.
export function seccionesVisibles(rol: string): Seccion[] {
  return rol === 'ADMIN' ? SECCIONES : SECCIONES.filter((s) => !s.soloAdmin)
}
```

Lo usan la página de inicio (tarjetas) y la barra (enlaces con ícono).

## Componentes y cambios

### 1. Página de inicio `src/app/page.tsx` (Server Component)

- Reemplaza el actual `redirect('/programar')`.
- `usuarioActual()`; si no hay sesión, `redirect('/login')`.
- Saludo: `Hola, <nombre> 👋` + subtítulo `Semana <n> · <año>` (usando `semanaActual()`).
- Grilla de tarjetas grandes a partir de `seccionesVisibles(u.rol)`: cada tarjeta es un `Link` a `s.href` con `s.icono` (grande), `s.texto` (título) y `s.descripcion`.
- Grilla responsiva: 2 columnas en celular, 3 en pantallas medianas+ (`grid grid-cols-2 gap-4 md:grid-cols-3`).
- Estilo de tarjeta: `rounded-2xl border p-5`, hover con leve elevación/sombra y borde verde.

### 2. Barra `src/app/_componentes/nav-principal.tsx` (client)

- El logo "🌱 Cronograma Ayurá" pasa a ser un `Link` a `/`.
- Enlaces = `[{ href: '/', texto: 'Inicio', icono: '🏠' }, ...seccionesVisibles(usuario.rol)]`. Cada enlace muestra `icono + texto`. La sección activa se resalta como hoy (subrayado/negrita; `usePathname`).
- **Menú compacto en celular:** estado `abierto` (`useState`).
  - En pantallas medianas+ (`md:`): enlaces en fila (como hoy) y a la derecha nombre + "Cerrar sesión".
  - En pantallas chicas: se ve el logo y, a la derecha, un botón ☰ (`md:hidden`). Al tocarlo, `abierto` alterna a un panel debajo (`md:hidden`) con los enlaces apilados (ícono + texto) y al final nombre + "Cerrar sesión".
  - Al hacer clic en un enlace del panel, `setAbierto(false)` (se cierra solo).
- Se conserva `print:hidden` en el `<header>`.

### 3. Redirecciones de inicio

- `src/app/login/acciones.ts`: tras `crearSesion`, `redirect('/')` (antes `/programar`).
- `src/middleware.ts`: usuario con sesión que entra a `/login` → `redirect('/')` (antes `/programar`).

## Qué NO cambia

- Páginas de Tareas, Programar, Cumplimiento, Resumen, Tablero, Configuración: sin cambios.
- Auth, datos, métricas: sin cambios.
- Filtrado por rol: el mismo criterio (no-admin sin Tablero/Configuración), ahora centralizado en `seccionesVisibles`.

## Pruebas

- Sin lógica de dominio nueva → sin tests unitarios nuevos. Verificación: `npx tsc --noEmit` y `npm run lint` limpios; suite existente (61) sigue verde.
- Verificación manual:
  - Iniciar sesión (admin) → llega a la página de inicio con 6 tarjetas grandes; cada una abre su sección. Logo / "🏠 Inicio" regresan al inicio.
  - Como área (ej. maquinaria) → 4 tarjetas (sin Tablero ni Configuración).
  - Barra en PC: enlaces con íconos, sección activa resaltada.
  - En ventana angosta (celular): aparece ☰; al abrirlo se ven los enlaces apilados + Cerrar sesión; al elegir uno se cierra.

## Notas técnicas

- Sin cambios de esquema Prisma → no hace falta reiniciar el dev server.
- `nav-principal` ya es `'use client'`; el menú móvil usa `useState` (no requiere librerías).

# Inicio tipo menú + barra con íconos y menú móvil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la home en un menú de iconos grandes y mejorar la barra superior (íconos por sección + menú compacto ☰ en celular).

**Architecture:** Un catálogo compartido `SECCIONES` (href, texto, ícono, descripción, soloAdmin) alimenta tanto la página de inicio (tarjetas grandes) como la barra. La home (`/`) deja de redirigir y muestra el menú; login y middleware pasan a llevar a `/`. La barra (client) gana íconos, enlace "Inicio", logo enlazado a `/` y un panel ☰ en pantallas chicas.

**Tech Stack:** Next.js 16 (App Router, Server/Client Components), React 19, Tailwind v4.

## Global Constraints

- El menú de iconos grandes es la página de inicio (`/`); el logo y "🏠 Inicio" regresan a ella.
- Filtrado por rol: admin ve todo; área NO ve Tablero ni Configuración. Centralizado en `seccionesVisibles(rol)`.
- Colores verde Ayurá (`#11603a`) y resaltado de sección activa: criterio sin cambios.
- En celular la barra colapsa en ☰; en escritorio (`md:`) los enlaces van en fila.
- No cambian otras páginas, auth, datos ni métricas.
- Sin dependencias nuevas (menú móvil con `useState`).
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` sin errores.
- Spec: `docs/superpowers/specs/2026-06-19-inicio-menu-y-barra-design.md`.

## File Structure

- `src/app/_componentes/secciones.ts` — NUEVO. Catálogo `SECCIONES` + `seccionesVisibles(rol)`.
- `src/app/page.tsx` — MODIFICAR. Home = menú de iconos grandes.
- `src/app/login/acciones.ts` — MODIFICAR. Redirige a `/` tras login.
- `src/middleware.ts` — MODIFICAR. Usuario con sesión en `/login` → `/`.
- `src/app/_componentes/nav-principal.tsx` — MODIFICAR. Íconos + Inicio + logo→/ + menú ☰ móvil.

---

## Task 1: Catálogo `SECCIONES` + home tipo menú + redirecciones

**Files:**
- Create: `src/app/_componentes/secciones.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/login/acciones.ts` (línea 16)
- Modify: `src/middleware.ts` (línea ~11)

**Interfaces:**
- Produces: `SECCIONES: Seccion[]` y `seccionesVisibles(rol: string): Seccion[]` donde `Seccion = { href: string; texto: string; icono: string; descripcion: string; soloAdmin?: boolean }`.

- [ ] **Step 1: Crear el catálogo compartido**

Crear `src/app/_componentes/secciones.ts`:

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

- [ ] **Step 2: Home como menú de iconos grandes**

Reemplazar todo `src/app/page.tsx` por:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { semanaActual } from '@/dominio/semana'
import { seccionesVisibles } from './_componentes/secciones'

export default async function Home() {
  const u = await usuarioActual()
  if (!u) redirect('/login')
  const secciones = seccionesVisibles(u.rol)
  const hoy = semanaActual()

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl font-extrabold text-[#11603a]">Hola, {u.nombre} 👋</h1>
      <p className="mb-6 text-sm text-gray-500">Semana {hoy.semana} · {hoy.anio}</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex flex-col items-start gap-1 rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:border-[#11603a] hover:shadow-lg"
          >
            <span className="text-4xl">{s.icono}</span>
            <span className="text-lg font-bold text-[#11603a]">{s.texto}</span>
            <span className="text-sm text-gray-500">{s.descripcion}</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Redirigir a `/` tras iniciar sesión**

En `src/app/login/acciones.ts`, cambiar la línea `redirect('/programar')` (dentro de `iniciarSesionAccion`, después de `crearSesion`) por:

```ts
  redirect('/')
```

- [ ] **Step 4: Middleware lleva a `/` al entrar logueado a /login**

En `src/middleware.ts`, en el bloque `if (tieneSesion && esLogin)`, cambiar:

```ts
    return NextResponse.redirect(new URL('/programar', req.url))
```
por:
```ts
    return NextResponse.redirect(new URL('/', req.url))
```

- [ ] **Step 5: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Verificación manual**

Iniciar sesión como `admin`/`clave123` → llega a la home con 6 tarjetas grandes (Tareas, Programar, Cumplimiento, Resumen, Tablero, Configuración), saludo "Hola, …" y "Semana N · año"; cada tarjeta abre su sección. Como `maquinaria` → 4 tarjetas (sin Tablero/Configuración).

- [ ] **Step 7: Commit**

```bash
git add src/app/_componentes/secciones.ts src/app/page.tsx src/app/login/acciones.ts src/middleware.ts
git commit -m "feat(inicio): home tipo menú con iconos grandes; login/middleware llevan a /"
```

---

## Task 2: Barra superior con íconos + menú móvil (☰)

**Files:**
- Modify: `src/app/_componentes/nav-principal.tsx`

**Interfaces:**
- Consumes: `seccionesVisibles(rol)` (Task 1).

- [ ] **Step 1: Reescribir `NavPrincipal`**

Reemplazar todo `src/app/_componentes/nav-principal.tsx` por:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cerrarSesionAccion } from '@/app/login/acciones'
import { seccionesVisibles } from './secciones'

export function NavPrincipal({ usuario }: { usuario: { nombre: string; rol: string } | null }) {
  const ruta = usePathname()
  const [abierto, setAbierto] = useState(false)

  const enlaces = usuario
    ? [{ href: '/', texto: 'Inicio', icono: '🏠' }, ...seccionesVisibles(usuario.rol)]
    : []

  const claseEnlace = (href: string) =>
    ruta === href ? 'font-semibold underline underline-offset-4' : 'opacity-90 hover:underline'

  return (
    <header className="bg-[#11603a] text-white print:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 gap-y-2 px-6 py-3">
        <Link href="/" className="font-bold">🌱 Cronograma Ayurá</Link>

        {usuario && (
          <>
            {/* Escritorio: enlaces en fila */}
            <nav className="ml-2 hidden flex-wrap gap-3 text-sm md:flex">
              {enlaces.map((e) => (
                <Link key={e.href} href={e.href} className={`inline-flex items-center gap-1 ${claseEnlace(e.href)}`}>
                  <span>{e.icono}</span>{e.texto}
                </Link>
              ))}
            </nav>

            {/* Escritorio: usuario a la derecha */}
            <div className="ml-auto hidden items-center gap-3 text-sm md:flex">
              <span className="opacity-90">{usuario.nombre}</span>
              <form action={cerrarSesionAccion}>
                <button className="rounded bg-white/15 px-2 py-1 hover:bg-white/25">Cerrar sesión</button>
              </form>
            </div>

            {/* Celular: botón ☰ */}
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              aria-label="Menú"
              className="ml-auto rounded bg-white/15 px-3 py-1 text-lg leading-none hover:bg-white/25 md:hidden"
            >
              {abierto ? '✕' : '☰'}
            </button>
          </>
        )}
      </div>

      {/* Celular: panel desplegable */}
      {usuario && abierto && (
        <div className="border-t border-white/20 px-4 pb-3 md:hidden">
          <nav className="flex flex-col">
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                onClick={() => setAbierto(false)}
                className={`flex items-center gap-2 rounded px-3 py-2.5 text-[15px] hover:bg-white/10 ${ruta === e.href ? 'bg-white/15 font-semibold' : ''}`}
              >
                <span>{e.icono}</span>{e.texto}
              </Link>
            ))}
          </nav>
          <div className="mt-2 flex items-center gap-3 border-t border-white/20 px-3 pt-3 text-sm">
            <span className="flex-1 opacity-90">👤 {usuario.nombre}</span>
            <form action={cerrarSesionAccion}>
              <button className="rounded bg-white/15 px-2 py-1 hover:bg-white/25">Cerrar sesión</button>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Verificación manual**

- En PC: la barra muestra 🏠 Inicio + las secciones con su ícono; la sección actual resaltada; el logo regresa a la home; nombre + "Cerrar sesión" a la derecha.
- En ventana angosta (celular): solo logo + ☰; al tocar ☰ se abre el panel con los enlaces apilados (con ícono) + 👤 nombre + "Cerrar sesión"; al elegir un enlace, el menú se cierra.
- Como `maquinaria`: no aparecen Tablero ni Configuración (ni en barra ni en panel).

- [ ] **Step 4: Commit**

```bash
git add src/app/_componentes/nav-principal.tsx
git commit -m "feat(nav): barra con íconos, enlace Inicio y menú compacto (☰) en celular"
```

---

## Self-Review (autor del plan)

- **Cobertura del spec:** catálogo `SECCIONES` + `seccionesVisibles` (Task 1) ✓; home tipo menú con iconos grandes, saludo y semana, filtrado por rol, grilla responsiva (Task 1) ✓; login y middleware llevan a `/` (Task 1) ✓; barra con íconos + enlace Inicio + logo→/ + resaltado activo + menú ☰ móvil que se cierra al navegar (Task 2) ✓; `print:hidden` conservado (Task 2) ✓; sin deps nuevas ✓.
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos:** `seccionesVisibles(rol: string)` se usa igual en home y nav; `Seccion` tiene `href/texto/icono/descripcion/soloAdmin?`; la home usa `icono/texto/descripcion`, la nav usa `icono/texto` + el objeto extra `{href:'/',texto:'Inicio',icono:'🏠'}` (sin `descripcion`, no se usa en la barra); `usuarioActual()` expone `nombre` y `rol` (ya usados en el layout); `semanaActual()` devuelve `{anio, semana}`.
- **Nota de ejecución:** sin cambios de esquema Prisma → no hace falta reiniciar el dev server.

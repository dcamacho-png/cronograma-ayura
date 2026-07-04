# Pantalla "Consulta" de actividades culminadas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nueva pantalla `/consulta` (solo lectura) para buscar por filtros las actividades CUMPLIDA del área (propias + las que el área solicitó a otras), y ocultar de "Mis solicitudes a otras áreas" las que ya tienen ≥1 actividad cumplida.

**Architecture:** Un repo query `consultarCulminadas(areaId, filtros)` alimenta una página server `/consulta` con un form de filtros GET. `listarSolicitudesDeArea` gana un conteo de actividades CUMPLIDA por tarea para que `/tareas` oculte las culminadas. Un permiso `consulta` nuevo + entrada de navegación + casilla en /configuración hacen la pantalla accesible y asignable. Sin cambios de esquema.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma/Postgres, TypeScript, Tailwind v4.

## Global Constraints

- Ante dudas de API de Next, leer `node_modules/next/dist/docs/`.
- El repo NO tiene tests para capa de datos/UI: el ciclo de verificación de cada tarea es typecheck + build. Verificación funcional en vivo al final.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
- SIN cambios de esquema Prisma.
- Consulta del área = `Actividad` `estado='CUMPLIDA'` con `areaId=areaSel` OR `tarea.solicitadaPorAreaId=areaSel`. Filtros: responsable, finca, centro de costo, potrero (todos opcionales, AND).
- "Culminada" para ocultar de "Mis solicitudes" = la tarea tiene ≥1 actividad CUMPLIDA.
- Permiso `consulta` se añade a `PANTALLAS_ASIGNABLES` y `DEFAULT_AREA` (visible por defecto, configurable por usuario).
- Reutilizar estilos Tailwind existentes.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Repo — `consultarCulminadas` + conteo de cumplidas en `listarSolicitudesDeArea`

**Files:**
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Produces:
  - `consultarCulminadas(areaId: string, filtros?: { responsableId?: string|null; fincaId?: string|null; centroCosto?: string|null; loteId?: string|null }): Promise<Actividad[]>` con includes `responsable, finca, maquina, lotes, area, tarea{solicitadaPorAreaId}`.
  - `listarSolicitudesDeArea(areaId)` ahora incluye `_count: { actividades }` (contando solo CUMPLIDA).

- [ ] **Step 1: Añadir `consultarCulminadas`**

En `src/datos/repositorio.ts`, junto a las demás funciones de lectura de actividades (p. ej. tras `listarActividadesSolicitadas`), añadir:

```ts
// Actividades CUMPLIDA del área para la pantalla de Consulta (solo lectura): propias
// (areaId) o solicitadas por el área a otras (tarea.solicitadaPorAreaId). Filtros opcionales.
export function consultarCulminadas(
  areaId: string,
  filtros: { responsableId?: string | null; fincaId?: string | null; centroCosto?: string | null; loteId?: string | null } = {},
) {
  return prisma.actividad.findMany({
    where: {
      estado: 'CUMPLIDA',
      OR: [{ areaId }, { tarea: { solicitadaPorAreaId: areaId } }],
      ...(filtros.responsableId ? { responsableId: filtros.responsableId } : {}),
      ...(filtros.fincaId ? { fincaId: filtros.fincaId } : {}),
      ...(filtros.centroCosto ? { centroCosto: filtros.centroCosto } : {}),
      ...(filtros.loteId ? { lotes: { some: { id: filtros.loteId } } } : {}),
    },
    include: {
      responsable: true,
      finca: true,
      maquina: true,
      lotes: true,
      area: true,
      tarea: { select: { solicitadaPorAreaId: true } },
    },
    orderBy: [{ anio: 'desc' }, { semana: 'desc' }, { dia: 'asc' }],
  })
}
```

- [ ] **Step 2: Añadir el conteo de CUMPLIDA a `listarSolicitudesDeArea`**

Reemplazar la función `listarSolicitudesDeArea` por:

```ts
export function listarSolicitudesDeArea(areaId: string) {
  return prisma.tarea.findMany({
    where: { solicitadaPorAreaId: areaId },
    include: {
      area: true,
      lotes: true,
      _count: { select: { actividades: { where: { estado: 'CUMPLIDA' } } } },
    },
    orderBy: { descripcion: 'asc' },
  })
}
```

(La relación `Tarea.actividades` existe en el esquema. El conteo filtrado por relación queda en `tarea._count.actividades` = nº de actividades CUMPLIDA.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

(El único consumidor de `listarSolicitudesDeArea` es `src/app/tareas/page.tsx`; añadir `_count` no rompe sus lecturas actuales.)

- [ ] **Step 4: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(repo): consultarCulminadas + conteo de cumplidas por solicitud

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Página `/consulta` + filtros

**Files:**
- Create: `src/app/consulta/page.tsx`
- Create: `src/app/consulta/filtros-consulta.tsx`

**Interfaces:**
- Consumes: `consultarCulminadas` (Task 1); `listarAreas`, `listarResponsablesPorArea`, `listarFincas`, `listarLotes` (existentes); `usuarioActual`, `puedeVer`; `normalizarAvancePorLote` (dominio).
- Produces: la ruta `/consulta` (aún no enlazada ni con permiso hasta Task 4; se prueba directo por URL con un usuario ADMIN, cuyo `puedeVer('consulta')` ya es true tras Task 4 — para verificar el build de esta tarea basta typecheck+build).

- [ ] **Step 1: Crear `filtros-consulta.tsx`**

Crear `src/app/consulta/filtros-consulta.tsx` (form GET nativo; sin JS de cliente):

```tsx
type Opt = { id: string; nombre: string }

// Filtros de la Consulta como <form method="get">: al enviar navega a /consulta con los
// query params. `area` va en hidden para conservar el área seleccionada.
export function FiltrosConsulta({
  areaId,
  responsables,
  fincas,
  lotes,
  centros,
  sel,
}: {
  areaId: string
  responsables: Opt[]
  fincas: Opt[]
  lotes: Opt[]
  centros: string[]
  sel: { responsable: string; finca: string; centro: string; lote: string }
}) {
  return (
    <form method="get" action="/consulta" className="flex flex-wrap items-end gap-2 rounded-lg border border-borde bg-arena/30 p-3 text-xs">
      <input type="hidden" name="area" value={areaId} />
      <label className="flex flex-col">
        Responsable
        <select name="responsable" defaultValue={sel.responsable} className="rounded-lg border border-borde bg-marfil p-1 text-sm">
          <option value="">— todos —</option>
          {responsables.map((r) => (<option key={r.id} value={r.id}>{r.nombre}</option>))}
        </select>
      </label>
      <label className="flex flex-col">
        Finca
        <select name="finca" defaultValue={sel.finca} className="rounded-lg border border-borde bg-marfil p-1 text-sm">
          <option value="">— todas —</option>
          {fincas.map((f) => (<option key={f.id} value={f.id}>{f.nombre}</option>))}
        </select>
      </label>
      <label className="flex flex-col">
        Centro de costo
        <select name="centro" defaultValue={sel.centro} className="rounded-lg border border-borde bg-marfil p-1 text-sm">
          <option value="">— todos —</option>
          {centros.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </label>
      <label className="flex flex-col">
        Potrero
        <select name="lote" defaultValue={sel.lote} className="rounded-lg border border-borde bg-marfil p-1 text-sm">
          <option value="">— todos —</option>
          {lotes.map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
        </select>
      </label>
      <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">Buscar</button>
      <a href={`/consulta?area=${areaId}`} className="self-center text-tierra underline">Limpiar</a>
    </form>
  )
}
```

- [ ] **Step 2: Crear `page.tsx`**

Crear `src/app/consulta/page.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { puedeVer } from '@/auth/permisos'
import { listarAreas, listarResponsablesPorArea, listarFincas, listarLotes, consultarCulminadas } from '@/datos/repositorio'
import { normalizarAvancePorLote, type AvanceEntrada } from '@/dominio/avance-lote'
import { FiltrosConsulta } from './filtros-consulta'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default async function ConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; responsable?: string; finca?: string; centro?: string; lote?: string }>
}) {
  const sp = await searchParams
  const areas = await listarAreas()
  if (areas.length === 0) {
    return (<main className="p-8"><p className="text-tierra">No hay áreas.</p></main>)
  }
  const u = await usuarioActual()
  if (!u) redirect('/login')
  if (!puedeVer(u, 'consulta')) redirect('/')
  const esAdmin = u.rol === 'ADMIN'
  const areaId = esAdmin
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
  const areaActual = areas.find((a) => a.id === areaId)!

  const filtros = {
    responsableId: sp.responsable || null,
    fincaId: sp.finca || null,
    centroCosto: sp.centro || null,
    loteId: sp.lote || null,
  }
  const [responsables, fincas, lotes, resultados, todasDelArea] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarFincas(),
    listarLotes(),
    consultarCulminadas(areaId, filtros),
    consultarCulminadas(areaId, {}),
  ])
  const centros = [...new Set(todasDelArea.map((a) => a.centroCosto).filter((c): c is string => !!c))].sort()

  const potrerosConMedida = (a: (typeof resultados)[number]) => {
    const av = normalizarAvancePorLote(a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null)
    return a.lotes.map((l) => {
      const total = (av[l.id] ?? []).reduce((s, e) => s + e.cantidad, 0)
      return total > 0 ? `${l.nombre}: ${total}` : l.nombre
    })
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-bosque">🔎 Consulta de culminadas</h1>

      {esAdmin ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {areas.map((a) => (
            <Link key={a.id} href={`/consulta?area=${a.id}`} className={`rounded-full px-3 py-1 text-sm ${a.id === areaId ? 'bg-bosque text-white' : 'bg-arena text-tierra'}`}>
              {a.nombre}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-3 text-sm text-tierra">Área: <b className="text-tinta">{areaActual.nombre}</b></div>
      )}

      <FiltrosConsulta
        areaId={areaId}
        responsables={responsables}
        fincas={fincas}
        lotes={lotes}
        centros={centros}
        sel={{ responsable: filtros.responsableId ?? '', finca: filtros.fincaId ?? '', centro: filtros.centroCosto ?? '', lote: filtros.loteId ?? '' }}
      />

      {resultados.length === 0 ? (
        <p className="mt-4 text-sm text-tierra">No hay actividades culminadas con esos filtros.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-tierra">
                <th className="p-2">Semana</th>
                <th className="p-2">Día</th>
                <th className="p-2">Descripción</th>
                <th className="p-2">Responsable</th>
                <th className="p-2">Área ejec.</th>
                <th className="p-2">Finca</th>
                <th className="p-2">Potreros (medida)</th>
                <th className="p-2">Medida total</th>
                <th className="p-2">Centro de costo</th>
                <th className="p-2">Máquina</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((a) => {
                const ejecutadaPorOtra = a.tarea?.solicitadaPorAreaId === areaId && a.areaId !== areaId
                const potreros = potrerosConMedida(a)
                return (
                  <tr key={a.id} className="border-b border-borde/60 align-top">
                    <td className="p-2 whitespace-nowrap">{a.anio}-S{a.semana}</td>
                    <td className="p-2">{DIAS[a.dia] ?? a.dia}</td>
                    <td className="p-2">{a.descripcion}</td>
                    <td className="p-2">{a.responsable?.nombre ?? '—'}</td>
                    <td className="p-2">{ejecutadaPorOtra ? (a.area?.nombre ?? '—') : '—'}</td>
                    <td className="p-2">{a.finca?.nombre ?? '—'}</td>
                    <td className="p-2">{potreros.length > 0 ? potreros.join(', ') : '—'}</td>
                    <td className="p-2 whitespace-nowrap">{a.haRealizada != null ? `${a.haRealizada} ${a.unidadRealizada ?? ''}`.trim() : '—'}</td>
                    <td className="p-2">{a.centroCosto ?? '—'}</td>
                    <td className="p-2">{a.maquina?.nombre ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully` (debe aparecer la ruta `/consulta`).

- [ ] **Step 4: Commit**

```bash
git add src/app/consulta/page.tsx src/app/consulta/filtros-consulta.tsx
git commit -m "feat(consulta): pantalla de culminadas con filtros (responsable/finca/centro/potrero)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `/tareas` — ocultar solicitudes ya culminadas

**Files:**
- Modify: `src/app/tareas/page.tsx`

**Interfaces:**
- Consumes: `listarSolicitudesDeArea` con `_count.actividades` (Task 1).

- [ ] **Step 1: Filtrar las solicitudes con ≥1 CUMPLIDA**

En `src/app/tareas/page.tsx`, después de obtener `solicitudes` del `Promise.all` (línea ~48-54), añadir:

```ts
  // Ocultar de "Mis solicitudes" las que ya tienen ≥1 actividad CUMPLIDA (viven en Consulta).
  const solicitudesVisibles = solicitudes.filter((s) => s._count.actividades === 0)
```

- [ ] **Step 2: Usar `solicitudesVisibles` en el render**

En la sección "📨 Mis solicitudes a otras áreas" (línea ~176 y ~180), reemplazar los dos usos de `solicitudes` por `solicitudesVisibles`:
- `{solicitudes.length === 0 ? (` → `{solicitudesVisibles.length === 0 ? (`
- `{solicitudes.map((s) => (` → `{solicitudesVisibles.map((s) => (`

(El texto vacío "No has solicitado tareas a otras áreas." queda igual; ahora también aplica cuando todas están culminadas.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/app/tareas/page.tsx
git commit -m "feat(tareas): ocultar de 'Mis solicitudes' las que ya tienen una actividad cumplida

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Permiso `consulta` + navegación + configuración

**Files:**
- Modify: `src/auth/permisos.ts`
- Modify: `src/app/_componentes/secciones.ts`
- Modify: `src/app/configuracion/usuario-pantallas.tsx`

**Interfaces:**
- Produces: la clave de permiso `consulta` reconocida por `puedeVer`, la sección en la navegación y la casilla en /configuración.

- [ ] **Step 1: `permisos.ts` — añadir `consulta`**

Reemplazar las líneas 3-4 de `src/auth/permisos.ts`:
```ts
export const PANTALLAS_ASIGNABLES = ['tareas', 'programar', 'cumplimiento', 'resumen', 'tablero'] as const
export const DEFAULT_AREA = ['tareas', 'programar', 'cumplimiento', 'resumen'] as const
```
por:
```ts
export const PANTALLAS_ASIGNABLES = ['tareas', 'programar', 'cumplimiento', 'resumen', 'tablero', 'consulta'] as const
export const DEFAULT_AREA = ['tareas', 'programar', 'cumplimiento', 'resumen', 'consulta'] as const
```

- [ ] **Step 2: `secciones.ts` — añadir la sección**

En `src/app/_componentes/secciones.ts`, dentro del arreglo `SECCIONES`, añadir (antes de la de 'configuracion'):
```ts
  { clave: 'consulta', href: '/consulta', texto: 'Consulta', icono: '🔎', descripcion: 'Actividades culminadas del área' },
```

- [ ] **Step 3: `usuario-pantallas.tsx` — añadir la casilla**

En `src/app/configuracion/usuario-pantallas.tsx`, en el arreglo `PANTALLAS` (líneas ~3-9), añadir tras la de 'tablero':
```ts
  { clave: 'consulta', etiqueta: 'Consulta' },
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/auth/permisos.ts src/app/_componentes/secciones.ts src/app/configuracion/usuario-pantallas.tsx
git commit -m "feat(consulta): permiso 'consulta' + navegación + casilla en configuración

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras todas las tareas)

Server local (`next dev`) apuntando a la DB real + cookie de sesión firmada (ADMIN; ver memoria `verificacion-navegador`). SOLO LECTURA (no crea datos), salvo un pequeño montaje reversible si hace falta una solicitud culminada de prueba:

1. **Consulta renderiza:** entrar a `/consulta` (aparece en la navegación); ver la tabla de actividades CUMPLIDA del área con sus columnas (medida, potreros, responsable, finca, centro de costo, máquina).
2. **Filtros:** aplicar cada filtro (responsable, finca, centro de costo, potrero) y confirmar que acota; "Limpiar" los quita.
3. **Solicitud culminada:** para una tarea `solicitadaPorAreaId=X` con ≥1 actividad CUMPLIDA, confirmar que aparece en Consulta de X (columna "Área ejec." muestra la otra área) y que **NO** aparece en `/tareas` "Mis solicitudes"; una DEVUELTA sigue en "Mis solicitudes". (Si no existe el dato, montar uno reversible: crear una actividad CUMPLIDA con `tareaId` de una solicitud en semana futura y borrarla al terminar.)
4. Verificar en Neon si se necesitó sembrar/limpiar; no dejar datos de prueba.

## Nota

Sin cambios de esquema. La pantalla es solo lectura; el resto de la app no se ve afectado (Consulta solo lee `Actividad`/`Tarea`; el cambio en `/tareas` es un filtro de visualización).

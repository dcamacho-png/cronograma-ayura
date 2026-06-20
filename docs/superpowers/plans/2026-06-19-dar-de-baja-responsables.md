# Dar de baja responsables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poder dar de baja (inactivar) un responsable para que deje de aparecer en Programar, conservando todo su historial; eliminar real solo para quienes no tienen actividades.

**Architecture:** Se agrega un campo `activo` a `Responsable`. Programar filtra a los activos (grilla y desplegable de asignar). Configuración gana un botón "Dar de baja"/"Reactivar" y muestra el ✕ eliminar solo cuando el responsable no tiene actividades. Resumen y Cumplimiento no cambian (listan por actividad, así que el historial del inactivo sigue visible).

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), Prisma 6/SQLite, React 19, Tailwind v4, TypeScript.

## Global Constraints

- "Dar de baja" NO borra nada; solo marca `activo = false`.
- En **Programar** aparecen SOLO responsables activos (grilla y desplegable de asignar).
- Historial intacto: las actividades del inactivo siguen en la base y visibles en **Resumen** y **Cumplimiento** (sin cambios en esas pantallas).
- En **Configuración → Responsables**: botón "Dar de baja"/"Reactivar", etiqueta "(inactivo)", y ✕ eliminar SOLO si el responsable no tiene actividades.
- `crearResponsable` no cambia (el campo `activo` toma su default `true`).
- Cambio de esquema Prisma → tras migrar, reiniciar `npm run dev`.
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint` sin errores.
- Spec: `docs/superpowers/specs/2026-06-19-dar-de-baja-responsables-design.md`.

## File Structure

- `prisma/schema.prisma` — añadir `activo` a `Responsable`.
- `prisma/migrations/<timestamp>_responsable_activo/migration.sql` — NUEVO (ALTER TABLE).
- `src/datos/repositorio.ts` — `setResponsableActivo`; `listarResponsablesTodos` con `_count`.
- `src/app/programar/page.tsx` — filtrar a activos.
- `src/app/configuracion/acciones.ts` — `cambiarEstadoResponsableAccion`.
- `src/app/configuracion/page.tsx` — UI de dar de baja/reactivar + ✕ condicional.

---

## Task 1: Campo `activo` + repo (migración, setResponsableActivo, conteo)

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Responsable`, líneas ~39-45)
- Create: `prisma/migrations/<timestamp>_responsable_activo/migration.sql`
- Modify: `src/datos/repositorio.ts` (`listarResponsablesTodos`; nueva `setResponsableActivo`)

**Interfaces:**
- Produces: `Responsable` tiene `activo: boolean`. `setResponsableActivo(id: string, activo: boolean)`. `listarResponsablesTodos()` ahora incluye `area` y `_count: { actividades: number }`.

- [ ] **Step 1: Añadir `activo` al esquema**

En `prisma/schema.prisma`, el modelo `Responsable` queda:

```prisma
model Responsable {
  id          String      @id @default(cuid())
  nombre      String
  areaId      String
  area        Area        @relation(fields: [areaId], references: [id])
  actividades Actividad[]
  activo      Boolean     @default(true)
}
```

- [ ] **Step 2: Crear la migración manualmente y aplicarla**

`prisma migrate dev` requiere TTY interactivo (no disponible aquí). En su lugar, crear el archivo de migración a mano y aplicarlo con `migrate deploy`.

Crear `prisma/migrations/20260619130000_responsable_activo/migration.sql` con:

```sql
-- AlterTable
ALTER TABLE "Responsable" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
```

(Si ya existe una migración con timestamp ≥ ese, usa uno mayor para que quede de último en orden alfabético.)

Luego aplicar y regenerar el cliente:

Run:
```bash
npx prisma migrate deploy
npx prisma generate
```
Expected: "migrations have been applied" (o que la nueva quede aplicada) y el cliente se regenera sin errores.

- [ ] **Step 3: `setResponsableActivo` en el repo**

En `src/datos/repositorio.ts`, junto a las demás funciones de responsables, añadir:

```ts
export function setResponsableActivo(id: string, activo: boolean) {
  return prisma.responsable.update({ where: { id }, data: { activo } })
}
```

- [ ] **Step 4: `listarResponsablesTodos` con conteo de actividades**

En `src/datos/repositorio.ts`, reemplazar `listarResponsablesTodos`:

```ts
export function listarResponsablesTodos() {
  return prisma.responsable.findMany({
    include: { area: true, _count: { select: { actividades: true } } },
    orderBy: { nombre: 'asc' },
  })
}
```

- [ ] **Step 5: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Confirmar la columna en la base (opcional pero recomendado)**

Run: `npx prisma db execute --schema prisma/schema.prisma --stdin <<< "SELECT count(*) AS n, sum(activo) AS activos FROM Responsable;"`
Expected: termina sin error (todas las filas existentes quedaron `activo = 1`).

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/datos/repositorio.ts
git commit -m "feat(responsables): campo activo + setResponsableActivo + conteo de actividades"
```

---

## Task 2: Programar muestra solo responsables activos

**Files:**
- Modify: `src/app/programar/page.tsx`

**Interfaces:**
- Consumes: `Responsable.activo` (Task 1).

- [ ] **Step 1: Derivar la lista de activos**

En `src/app/programar/page.tsx`, justo después de la línea `const esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')`, añadir:

```ts
  const responsablesActivos = responsables.filter((r) => r.activo)
```

- [ ] **Step 2: Usar activos en la sección "Tareas por asignar"**

En el mismo archivo, en el bloque "Tareas por asignar", cambiar la condición de vacío y el prop del formulario:

- Cambiar `{responsables.length === 0 ? (` por `{responsablesActivos.length === 0 ? (`
- En `<AsignarTareaForm ... responsables={responsables} ... />` cambiar a `responsables={responsablesActivos}`

- [ ] **Step 3: Usar activos en la barra de acciones y en la grilla**

En el mismo archivo:
- Cambiar `{(responsables.length > 0 || esAdmin) && (` por `{(responsablesActivos.length > 0 || esAdmin) && (`
- Dentro de ese bloque, cambiar `{responsables.length > 0 && (` (el que envuelve `BotonDescargarImagen`) por `{responsablesActivos.length > 0 && (`
- En `<GrillaSemana ... responsables={responsables} ... />` cambiar a `responsables={responsablesActivos}`

(El resto del archivo no cambia: `ocupacion`, `actividades`, etc. siguen igual.)

- [ ] **Step 4: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

(Requiere Task 3 para poder inactivar desde la UI; si aún no está, inactivar uno temporalmente con:
`npx prisma db execute --schema prisma/schema.prisma --stdin <<< "UPDATE Responsable SET activo=0 WHERE nombre='<alguno>';"` y revertir luego.)
Como `maquinaria`/`clave123` en Programar: un responsable inactivo no aparece en el desplegable de asignar ni en la grilla; los activos sí.

- [ ] **Step 6: Commit**

```bash
git add src/app/programar/page.tsx
git commit -m "feat(programar): mostrar solo responsables activos (grilla y asignar)"
```

---

## Task 3: Configuración — Dar de baja / Reactivar + eliminar condicional

**Files:**
- Modify: `src/app/configuracion/acciones.ts` (import + nueva acción)
- Modify: `src/app/configuracion/page.tsx` (sección Responsables)

**Interfaces:**
- Consumes: `setResponsableActivo` (Task 1); `listarResponsablesTodos` con `activo` y `_count.actividades` (Task 1).
- Produces: `cambiarEstadoResponsableAccion(form)` (server action; campos `id`, `activo` = `'1'`/`'0'`).

- [ ] **Step 1: Acción para dar de baja / reactivar**

En `src/app/configuracion/acciones.ts`:

Añadir `setResponsableActivo` al import existente de `@/datos/repositorio` (junto a `crearResponsable`, `eliminarResponsable`, etc.).

Añadir la acción (junto a las demás de responsables):

```ts
export async function cambiarEstadoResponsableAccion(form: FormData) {
  const id = texto(form, 'id')
  const activo = texto(form, 'activo') === '1'
  if (!id) faltanDatos()
  await correr(
    () => setResponsableActivo(id, activo),
    activo ? 'Responsable reactivado.' : 'Responsable dado de baja.',
  )
}
```

- [ ] **Step 2: UI de la sección Responsables**

En `src/app/configuracion/page.tsx`:

Añadir al import de `./acciones` la acción `cambiarEstadoResponsableAccion` (junto a `crearResponsableAccion` y `eliminarResponsableAccion`).

Reemplazar el `.map` de la lista de responsables (el bloque que hoy renderiza cada `<li>` con nombre · área y el `FormEliminar`) por:

```tsx
            {responsables.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded bg-gray-100 px-2 py-1 text-sm">
                <span className={r.activo ? '' : 'text-gray-400'}>
                  {r.nombre} <span className="text-gray-500">· {r.area.nombre}</span>
                  {!r.activo && <span className="text-gray-400"> · (inactivo)</span>}
                </span>
                <form action={cambiarEstadoResponsableAccion}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="activo" value={r.activo ? '0' : '1'} />
                  <button className="text-xs font-semibold text-[#11603a] hover:underline">
                    {r.activo ? 'Dar de baja' : 'Reactivar'}
                  </button>
                </form>
                {r._count.actividades === 0 && (
                  <FormEliminar accion={eliminarResponsableAccion} id={r.id} etiqueta={r.nombre} />
                )}
              </li>
            ))}
```

(El formulario de "crear responsable" debajo no cambia.)

- [ ] **Step 3: Verificar typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

Como `admin`/`clave123` en Configuración → Responsables:
- Un responsable con historial muestra "Dar de baja" y NO muestra ✕ (eliminar). Al darlo de baja: aparece "(inactivo)" y el botón cambia a "Reactivar", con aviso "Responsable dado de baja."; deja de aparecer en Programar (grilla y asignar). Reactivar lo devuelve.
- Un responsable sin actividades muestra ✕ y se puede eliminar (borrado real), además de "Dar de baja".

- [ ] **Step 5: Commit**

```bash
git add src/app/configuracion/acciones.ts src/app/configuracion/page.tsx
git commit -m "feat(configuracion): dar de baja/reactivar responsables; eliminar solo sin historial"
```

---

## Self-Review (autor del plan)

- **Cobertura del spec:** campo `activo` + migración (Task 1) ✓; `setResponsableActivo` y `listarResponsablesTodos` con `_count` (Task 1) ✓; Programar solo activos en grilla y asignar (Task 2) ✓; Configuración con Dar de baja/Reactivar, "(inactivo)" y ✕ solo sin historial (Task 3) ✓; Resumen/Cumplimiento sin cambios ✓; `crearResponsable` sin cambios ✓.
- **Placeholders:** ninguno; todo el código está completo (el `<timestamp>` de la migración es un nombre de carpeta con valor exacto sugerido `20260619130000`).
- **Consistencia de tipos:** `setResponsableActivo(id, activo)` igual en repo, acción y plan; `cambiarEstadoResponsableAccion` lee `id`/`activo`; la UI envía `activo='1'|'0'`; `r.activo` y `r._count.actividades` provienen de `listarResponsablesTodos` (Task 1); `responsablesActivos` se deriva de `listarResponsablesPorArea` que devuelve el modelo completo (incluye `activo`).
- **Nota de ejecución:** Task 1 cambia el esquema → tras migrar/generar, reiniciar `npm run dev` antes de probar Tasks 2-3.

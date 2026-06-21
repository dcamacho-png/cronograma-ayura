# Banco/solicitudes: detalle, "Otra…" en desplegable, lotes en mis solicitudes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a `/tareas`: (1) lotes visibles en "Mis solicitudes a otras áreas"; (2) "Otra…" como opción del desplegable de actividad (en vez de un campo aparte) en los formularios de maquinaria; (3) un cuadro multilínea de "Detalle / instrucciones" (`Tarea.detalle`) en los formularios de maquinaria, visible para maquinaria en su banco.

**Architecture:** Columna nullable `Tarea.detalle String?` (migración aditiva). El desplegable de actividad gana opción `__otra__` (mismo patrón que `FormRegistrar`), eliminando el input "Otra" siempre visible; las acciones resuelven la descripción en consecuencia y leen `detalle`. El detalle y los lotes se muestran en el banco y en "Mis solicitudes".

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 6 (Postgres/Neon), React 19, Tailwind v4.

## Global Constraints

- #2 y #3 aplican a AMBOS formularios de maquinaria: `FormNuevaTareaMaquinaria` (banco propio) y `FormSolicitar` (solicitar a maquinaria). Otras áreas (texto libre simple) NO cambian.
- #2: el `<select name="estipulada">` gana `<option value="__otra__">Otra…</option>` tras el catálogo; se ELIMINA el `<label>Otra (opcional)<input name="otra"></label>` siempre visible; cuando `estipulada === '__otra__'` se muestra `<input name="otra">`.
- #2 resolución en acciones: `const est = textoOpcional(form,'estipulada'); const descripcion = est === '__otra__' ? textoOpcional(form,'otra') : (est ?? textoOpcional(form,'descripcion'))`.
- #3: `Tarea.detalle String?` (acepta null directo, se pasa tal cual). Textarea multilínea, OPCIONAL. `crearTarea` y `crearSolicitud` ganan `detalle: string | null = null` como ÚLTIMO parámetro.
- #1: `listarSolicitudesDeArea` agrega `lotes: true` al include; "Mis solicitudes" muestra `<InfoLotes lotes={s.lotes} />`.
- Visualización del detalle: `📝 {detalle}` con `whitespace-pre-line`, texto pequeño gris, en el banco "Tareas pendientes" (bajo InfoLotes) y en "Mis solicitudes".
- `conBultos = usaBultos(estipulada)`: con `'__otra__'` da false → no aparece el picker de bultos (correcto).
- El detalle NO se copia a la Actividad al asignar. NO tocar bultos, Programar/grilla, Resumen ni otras áreas.
- Migración nueva: `prisma/migrations/20260621160000_tarea_detalle/migration.sql`.
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint`. NO ejecutar app/seed/build local (base en Neon). `npx prisma generate` sí.
- AGENTS.md: los formularios son `'use client'`; seguir el patrón `__otra__` de `FormRegistrar`.
- Spec: `docs/superpowers/specs/2026-06-21-banco-detalle-otra-design.md`.

## File Structure

- `prisma/schema.prisma` — `detalle String?` en `Tarea`.
- `prisma/migrations/20260621160000_tarea_detalle/migration.sql` — NUEVO.
- `src/datos/repositorio.ts` — `crearTarea` (+detalle), `crearSolicitud` (+detalle), `listarSolicitudesDeArea` (+lotes).
- `src/app/tareas/acciones.ts` — `crearTareaAccion` y `crearSolicitudAccion` (resolución __otra__ + detalle).
- `src/app/tareas/form-nueva-tarea-maquinaria.tsx` — "Otra…" en el desplegable + textarea detalle.
- `src/app/tareas/form-solicitar.tsx` — "Otra…" en el desplegable + textarea detalle.
- `src/app/tareas/page.tsx` — detalle en el banco; lotes + detalle en "Mis solicitudes".

---

## Task 1: Esquema + migración + repositorio

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Tarea`)
- Create: `prisma/migrations/20260621160000_tarea_detalle/migration.sql`
- Modify: `src/datos/repositorio.ts` (`crearTarea` ~201-220; `crearSolicitud` ~465; `listarSolicitudesDeArea` ~465-470)

**Interfaces:**
- Produces:
  - `Tarea.detalle` (String nullable).
  - `crearTarea(areaId, descripcion, loteIds, bultosPorLote?, detalle?: string | null)` — nuevo param final default `null`, guardado.
  - `crearSolicitud(areaEjecutoraId, descripcion, solicitadaPorAreaId, loteIds, bultosPorLote?, detalle?: string | null)` — ídem.
  - `listarSolicitudesDeArea` devuelve también `lotes`.

- [ ] **Step 1: Campo en el esquema**

En `prisma/schema.prisma`, modelo `Tarea`, junto a `bultosPorLote Json?` (~línea 124), agregar:

```prisma
  detalle String?
```

- [ ] **Step 2: Migración**

Crear `prisma/migrations/20260621160000_tarea_detalle/migration.sql`:

```sql
-- Detalle / instrucciones libres de la tarea (visible para el área ejecutora)
ALTER TABLE "Tarea" ADD COLUMN "detalle" TEXT;
```

- [ ] **Step 3: Regenerar el cliente**

Run: `npx prisma generate`
Expected: "Generated Prisma Client ...".

- [ ] **Step 4: `crearTarea` guarda el detalle**

En `src/datos/repositorio.ts`, reemplazar la firma y el `data` de `crearTarea`:

```ts
export async function crearTarea(
  areaId: string,
  descripcion: string,
  loteIds: string[],
  bultosPorLote: Record<string, number> | null = null,
  detalle: string | null = null,
) {
  let fincaId: string | null = null
  if (loteIds.length > 0) {
    const primer = await prisma.lote.findUnique({ where: { id: loteIds[0] } })
    fincaId = primer?.fincaId ?? null
  }
  return prisma.tarea.create({
    data: {
      areaId,
      descripcion,
      fincaId,
      detalle,
      lotes: { connect: loteIds.map((id) => ({ id })) },
      ...(bultosPorLote ? { bultosPorLote } : {}),
    },
  })
}
```

- [ ] **Step 5: `crearSolicitud` guarda el detalle**

En `src/datos/repositorio.ts`, reemplazar `crearSolicitud`:

```ts
export function crearSolicitud(
  areaEjecutoraId: string,
  descripcion: string,
  solicitadaPorAreaId: string,
  loteIds: string[],
  bultosPorLote: Record<string, number> | null = null,
  detalle: string | null = null,
) {
  return prisma.tarea.create({
    data: {
      areaId: areaEjecutoraId,
      descripcion,
      solicitadaPorAreaId,
      detalle,
      lotes: { connect: loteIds.map((id) => ({ id })) },
      ...(bultosPorLote ? { bultosPorLote } : {}),
    },
  })
}
```

- [ ] **Step 6: `listarSolicitudesDeArea` incluye los lotes**

En `src/datos/repositorio.ts`, en `listarSolicitudesDeArea`, agregar `lotes` al include:

```ts
export function listarSolicitudesDeArea(areaId: string) {
  return prisma.tarea.findMany({
    where: { solicitadaPorAreaId: areaId },
    include: { area: true, lotes: true },
    orderBy: { descripcion: 'asc' },
  })
}
```

- [ ] **Step 7: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (Las llamadas actuales en las acciones siguen válidas por los defaults; se actualizan en Task 2.)

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260621160000_tarea_detalle/migration.sql src/datos/repositorio.ts
git commit -m "feat(datos): Tarea.detalle; crearTarea/crearSolicitud lo guardan; solicitudes incluyen lotes"
```

---

## Task 2: Formularios ("Otra…" + detalle) + acciones

**Files:**
- Modify: `src/app/tareas/form-nueva-tarea-maquinaria.tsx`
- Modify: `src/app/tareas/form-solicitar.tsx`
- Modify: `src/app/tareas/acciones.ts` (`crearTareaAccion` ~28-41; `crearSolicitudAccion` ~66-76)

**Interfaces:**
- Consumes: `crearTarea(..., detalle)`, `crearSolicitud(..., detalle)` (Task 1).
- Produces: ambos forms de maquinaria envían `estipulada` (que puede ser `__otra__`), `otra` (solo si `__otra__`), y `detalle`.

- [ ] **Step 1: `FormNuevaTareaMaquinaria` — "Otra…" + detalle**

En `src/app/tareas/form-nueva-tarea-maquinaria.tsx`:

1. En el `<select name="estipulada">`, agregar la opción "Otra…" tras el `map`:

```tsx
          {estipuladas.map((e) => (
            <option key={e.id} value={e.nombre}>{e.nombre}</option>
          ))}
          <option value="__otra__">Otra…</option>
        </select>
      </label>
```

2. REEMPLAZAR el bloque `<label className="flex flex-1 flex-col text-sm">Otra (opcional)<input name="otra" …/></label>` por (solo visible al elegir "Otra…"):

```tsx
      {estipulada === '__otra__' && (
        <label className="flex flex-1 flex-col text-sm">
          Otra (escribe la actividad)
          <input name="otra" placeholder="¿Qué actividad?" className="rounded border p-2" />
        </label>
      )}
```

3. ANTES del `<button>+ Agregar al banco`, agregar el textarea de detalle:

```tsx
      <label className="flex w-full flex-col text-sm">
        Detalle / instrucciones (opcional)
        <textarea name="detalle" rows={2} placeholder="Ej: aplicar urea, 2 bultos/ha" className="rounded border p-2 text-sm" />
      </label>
```

- [ ] **Step 2: `FormSolicitar` — "Otra…" + detalle**

En `src/app/tareas/form-solicitar.tsx`, dentro de la rama `{esMaquinaria ? (<> … </>) : (...)}`:

1. En el `<select name="estipulada">`, agregar tras el `map`:

```tsx
              {estipuladas.map((e) => (
                <option key={e.id} value={e.nombre}>{e.nombre}</option>
              ))}
              <option value="__otra__">Otra…</option>
            </select>
          </label>
```

2. REEMPLAZAR el `<label className="flex flex-col text-sm">Otra (opcional)<input name="otra" …/></label>` por:

```tsx
          {estipulada === '__otra__' && (
            <label className="flex flex-col text-sm">
              Otra (escribe la actividad)
              <input name="otra" placeholder="¿Qué actividad?" className="rounded border p-2 text-sm" />
            </label>
          )}
```

3. Tras el bloque de lotes (`<label>{conBultos ? … }</label>`) y antes de cerrar el `</>`, agregar el textarea:

```tsx
          <label className="flex flex-col text-sm">
            Detalle / instrucciones (opcional)
            <textarea name="detalle" rows={2} placeholder="Ej: aplicar urea, 2 bultos/ha" className="rounded border p-2 text-sm" />
          </label>
```

- [ ] **Step 3: `crearTareaAccion` — resolución __otra__ + detalle**

En `src/app/tareas/acciones.ts`, reemplazar `crearTareaAccion`:

```ts
export async function crearTareaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const est = textoOpcional(form, 'estipulada')
  const descripcion = est === '__otra__'
    ? textoOpcional(form, 'otra')
    : (est ?? textoOpcional(form, 'descripcion'))
  if (!areaId || !descripcion) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  for (const id of loteIds) {
    const b = numeroOpcional(form, `bultos_${id}`)
    if (b != null) bultos[id] = b
  }
  const detalle = textoOpcional(form, 'detalle')
  await crearTarea(areaId, descripcion, loteIds, Object.keys(bultos).length > 0 ? bultos : null, detalle)
  revalidatePath('/tareas')
}
```

- [ ] **Step 4: `crearSolicitudAccion` — resolución __otra__ + detalle**

En `src/app/tareas/acciones.ts`, reemplazar `crearSolicitudAccion`:

```ts
export async function crearSolicitudAccion(form: FormData) {
  const solicitanteAreaId = texto(form, 'solicitanteAreaId')
  const areaEjecutoraId = texto(form, 'areaEjecutoraId')
  const est = textoOpcional(form, 'estipulada')
  const descripcion = est === '__otra__'
    ? textoOpcional(form, 'otra')
    : (est ?? textoOpcional(form, 'descripcion'))
  if (!solicitanteAreaId || !areaEjecutoraId || !descripcion || areaEjecutoraId === solicitanteAreaId) return
  const loteIds = form.getAll('loteId').map((v) => String(v).trim()).filter(Boolean)
  const bultos: Record<string, number> = {}
  for (const id of loteIds) {
    const b = numeroOpcional(form, `bultos_${id}`)
    if (b != null) bultos[id] = b
  }
  const detalle = textoOpcional(form, 'detalle')
  await crearSolicitud(areaEjecutoraId, descripcion, solicitanteAreaId, loteIds, Object.keys(bultos).length > 0 ? bultos : null, detalle)
  revalidatePath('/tareas')
}
```

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/tareas/form-nueva-tarea-maquinaria.tsx src/app/tareas/form-solicitar.tsx src/app/tareas/acciones.ts
git commit -m "feat(tareas): 'Otra…' en el desplegable y detalle de tarea en formularios de maquinaria"
```

---

## Task 3: Visualización — detalle en banco + lotes/detalle en mis solicitudes

**Files:**
- Modify: `src/app/tareas/page.tsx` (banco list ~122-133; mis solicitudes ~166-176)

**Interfaces:**
- Consumes: `t.detalle` y `s.detalle` (Task 1, escalares Prisma); `s.lotes` (Task 1, include).

- [ ] **Step 1: Detalle en el banco "Tareas pendientes"**

En `src/app/tareas/page.tsx`, en el `<li>` de cada tarea pendiente, tras `<InfoLotes lotes={t.lotes} />`, agregar:

```tsx
                    <InfoLotes lotes={t.lotes} />
                    {t.detalle && (
                      <div className="mt-1 whitespace-pre-line text-xs text-gray-600">📝 {t.detalle}</div>
                    )}
```

- [ ] **Step 2: Lotes + detalle en "Mis solicitudes a otras áreas"**

En `src/app/tareas/page.tsx`, reemplazar el `<li>` de cada solicitud (el bloque `solicitudes.map((s) => (...))`) por:

```tsx
            {solicitudes.map((s) => (
              <li key={s.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span>
                    {s.descripcion} <span className="text-gray-500">· para {s.area.nombre}</span>
                  </span>
                  <span className={s.estado === 'PROGRAMADA' ? 'text-[#2e9e5b]' : 'text-gray-500'}>
                    {s.estado === 'PROGRAMADA' ? '✅ Programada' : '🕓 En banco'}
                  </span>
                </div>
                <InfoLotes lotes={s.lotes} />
                {s.detalle && (
                  <div className="mt-1 whitespace-pre-line text-xs text-gray-600">📝 {s.detalle}</div>
                )}
              </li>
            ))}
```

(`InfoLotes` ya está importado en `page.tsx`. `s.lotes` viene del nuevo include; `s.detalle` es escalar.)

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (Si `tsc` se queja del tipo de `s.lotes` en `InfoLotes`, los lotes traen `{id, nombre, hectareas}`, compatibles con `LoteInfo`.)

- [ ] **Step 4: Commit**

```bash
git add src/app/tareas/page.tsx
git commit -m "feat(tareas): mostrar detalle en el banco y lotes+detalle en 'Mis solicitudes'"
```

---

## Fase de despliegue (después del plan)

1. `git push` (respaldo).
2. **Deploy manual por CLI:** `npx vercel --prod --yes --scope ayura-llanos`. El build corre `prisma migrate deploy && next build` → aplica `20260621160000_tarea_detalle` (aditiva).
3. Verificación manual: solicitar a maquinaria eligiendo "Otra…" (escribir actividad) + detalle + lotes; ver el detalle y los lotes en el banco de maquinaria y en "Mis solicitudes" del solicitante.

---

## Self-Review (autor del plan)

**1. Cobertura de la spec:**
- #1 lotes en mis solicitudes → Task 1 Step 6 (include) + Task 3 Step 2 (InfoLotes). ✓
- #2 "Otra…" en desplegable + quitar input fijo → Task 2 Steps 1-2; resolución en acciones → Task 2 Steps 3-4. ✓
- #3 `Tarea.detalle` + migración → Task 1 Steps 1-2; textarea en ambos forms → Task 2 Steps 1-2; guardado → Task 1 Steps 4-5 + Task 2 Steps 3-4; visible en banco + mis solicitudes → Task 3. ✓
- Ambos forms de maquinaria → Task 2 cubre los dos. ✓
- Detalle no se copia a Actividad → no se toca asignarTarea. ✓

**2. Placeholders:** sin "TBD"/"etc."; código completo. ✓

**3. Consistencia de tipos:**
- `crearTarea(..., detalle?)` y `crearSolicitud(..., detalle?)` definidos en Task 1, llamados con `detalle` en Task 2. ✓
- Resolución `est === '__otra__' ? otra : (est ?? descripcion)` idéntica en ambas acciones (Task 2 Steps 3-4), coherente con la opción `__otra__` de los forms (Steps 1-2). ✓
- `listarSolicitudesDeArea` (+lotes) en Task 1 consumido por `s.lotes` en Task 3. ✓
- `t.detalle`/`s.detalle` (String? Prisma) renderizados con guard de verdad en Task 3. ✓
- `detalle: string | null` consistente (acciones pasan `textoOpcional` → `string | null`). ✓

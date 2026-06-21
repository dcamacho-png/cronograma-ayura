# Varios responsables + devolver solicitud al solicitante — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) Asignar varios responsables a una actividad creando una copia por responsable×día; (B) un botón "Devolver al solicitante" que regresa una tarea solicitada al área que la pidió (estado DEVUELTA, sin eliminarla), con un botón "Reenviar" para mandarla de nuevo.

**Architecture:** A cambia `asignarTarea(responsableIds[])` + casillas en el form + doble bucle responsable×día. B usa un nuevo valor `'DEVUELTA'` de `Tarea.estado` (sin migración) con dos acciones (devolver/reenviar) y botones en `/tareas`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 6 (Postgres/Neon), React 19, Tailwind v4.

## Global Constraints

- **Sin migración:** A no cambia el esquema; B reutiliza `Tarea.estado` (String) con nuevo valor `'DEVUELTA'`.
- Parte A: una **copia de la actividad por responsable × día**; cada actividad conserva un único `responsableId`. La detección de conflictos se hace por cada responsable y se DEDUPLICA por `${dia}-${tipo}`.
- Parte A: en `asignar-tarea-form.tsx` el responsable pasa de `<select>` a **casillas** (`<input type="checkbox" name="responsableId">`). El botón "Asignar →" se deshabilita si no hay responsables marcados o si hay conflicto de turno.
- Parte B: `estado='DEVUELTA'` con `anioSel/semanaSel=null` saca la tarea del banco de maquinaria (que lista `PENDIENTE` con `anioSel=null`) SIN eliminarla. "Reenviar" la vuelve a `PENDIENTE` (`anioSel/semanaSel=null`).
- Parte B: el botón "↩️ Devolver al solicitante" reemplaza a "eliminar" SOLO en tareas con `solicitadaPorArea`; las tareas propias conservan "eliminar".
- Parte B: en "📨 Mis solicitudes a otras áreas", `DEVUELTA` → "🔴 No realizada" + botón "Reenviar"; `PROGRAMADA` → "✅ Programada"; resto → "🕓 En banco".
- NO tocar cumplimiento, grilla, ni otras áreas más allá de lo descrito.
- Gate de cada tarea: `npx tsc --noEmit` y `npm run lint`. NO ejecutar app/seed/build local (base en Neon).
- AGENTS.md: `asignar-tarea-form.tsx` es `'use client'`; seguir el patrón de casillas de días.
- Spec: `docs/superpowers/specs/2026-06-21-multi-responsable-y-devolver-solicitud-design.md`.

## File Structure

- `src/datos/repositorio.ts` — `asignarTarea` (responsableIds); `devolverAlSolicitante`, `reenviarSolicitud` (nuevas).
- `src/app/programar/asignar-tarea-form.tsx` — responsables como casillas.
- `src/app/programar/acciones.ts` — `asignarTareaAccion` (responsableIds).
- `src/app/tareas/acciones.ts` — `devolverAlSolicitanteAccion`, `reenviarSolicitudAccion`.
- `src/app/tareas/page.tsx` — botón "Devolver al solicitante" en el banco; "🔴 No realizada" + "Reenviar" en "Mis solicitudes".

---

## Task 1: Parte A — Varios responsables por actividad

**Files:**
- Modify: `src/datos/repositorio.ts` (`asignarTarea` ~248-313)
- Modify: `src/app/programar/acciones.ts` (`asignarTareaAccion` ~86-105)
- Modify: `src/app/programar/asignar-tarea-form.tsx`

**Interfaces:**
- Produces: `asignarTarea(tareaId, responsableIds: string[], dias, loteIdFallback, turno, maquinaPorDia?)` — crea una actividad por responsable×día.

- [ ] **Step 1: `asignarTarea` acepta varios responsables**

En `src/datos/repositorio.ts`, en `asignarTarea`:

1. Cambiar la firma `responsableId: string,` por:

```ts
  responsableIds: string[],
```

2. Reemplazar el bloque de detección de conflictos (el `const conflictos = detectarConflictosAsignacion(...)` y su `if`) por (detección por responsable + dedup):

```ts
    const conflictosRaw = responsableIds.flatMap((rid) =>
      detectarConflictosAsignacion(existentes, diasUnicos, rid, maquinaPorDia, turno),
    )
    const vistos = new Set<string>()
    const conflictos = conflictosRaw.filter((c) => {
      const k = `${c.dia}-${c.tipo}`
      if (vistos.has(k)) return false
      vistos.add(k)
      return true
    })
    if (conflictos.length > 0) {
      return { ok: false as const, motivo: 'conflicto' as const, conflictos }
    }
```

3. Reemplazar el bucle de creación (el `for (const dia of diasUnicos) { await tx.actividad.create({...}); creadas += 1 }`) por un doble bucle:

```ts
    let creadas = 0
    for (const rid of responsableIds) {
      for (const dia of diasUnicos) {
        await tx.actividad.create({
          data: {
            anio,
            semana,
            dia,
            descripcion: tarea.descripcion,
            turno: turno.trim() || turnoPorDia(dia),
            vecesReprogramada: tarea.vecesReprogramada,
            areaId: tarea.areaId,
            fincaId,
            responsableId: rid,
            maquinaId: maquinaPorDia[dia] ?? null,
            tareaId: tarea.id,
            lotes: { connect: loteIds.map((id) => ({ id })) },
            ...(tarea.bultosPorLote != null ? { bultosPorLote: tarea.bultosPorLote as Prisma.InputJsonValue } : {}),
          },
        })
        creadas += 1
      }
    }
```

(El resto de `asignarTarea` —lookup de tarea, diasUnicos, loteIds/fincaId, `tx.tarea.update(estado:'PROGRAMADA')`, return— no cambia.)

- [ ] **Step 2: `asignarTareaAccion` lee varios responsables**

En `src/app/programar/acciones.ts`, en `asignarTareaAccion`:

1. Reemplazar `const responsableId = texto(form, 'responsableId')` por:

```ts
  const responsableIds = form.getAll('responsableId').map((v) => String(v)).filter(Boolean)
```

2. Reemplazar la guarda `if (!tareaId || !responsableId || dias.length === 0) return` por:

```ts
  if (!tareaId || responsableIds.length === 0 || dias.length === 0) return
```

3. Reemplazar la llamada `const res = await asignarTarea(tareaId, responsableId, dias, loteId, turno, maquinaPorDia)` por:

```ts
  const res = await asignarTarea(tareaId, responsableIds, dias, loteId, turno, maquinaPorDia)
```

- [ ] **Step 3: Casillas de responsables en el formulario**

En `src/app/programar/asignar-tarea-form.tsx`:

1. Reemplazar el estado `const [responsableId, setResponsableId] = useState(responsables[0]?.id ?? '')` por:

```tsx
  const [responsableIds, setResponsableIds] = useState<string[]>(responsables[0] ? [responsables[0].id] : [])
  const toggleResp = (id: string) =>
    setResponsableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
```

2. Reemplazar el cálculo `const diasOcupadosResp = [...dias]...` por (conflictos por responsable):

```tsx
  const conflictosResp = responsableIds.flatMap((rid) =>
    [...dias]
      .sort((a, b) => a - b)
      .filter((d) =>
        ocupacion.some(
          (o) => o.dia === d && o.turno === turnoEfectivo(turno, d) && o.responsableId === rid,
        ),
      )
      .map((d) => ({ rid, dia: d })),
  )
```

3. Reemplazar el `<label>` del Responsable (el bloque `<label …>Responsable<select name="responsableId" …>…</select></label>`) por casillas:

```tsx
      <div className="flex flex-col text-xs">
        Responsables
        <div className="flex flex-wrap gap-1">
          {responsables.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 has-[:checked]:border-[#11603a] has-[:checked]:bg-green-50"
            >
              <input
                type="checkbox"
                name="responsableId"
                value={r.id}
                checked={responsableIds.includes(r.id)}
                onChange={() => toggleResp(r.id)}
                className="accent-[#11603a]"
              />
              {r.nombre}
            </label>
          ))}
        </div>
      </div>
```

4. Reemplazar el aviso `{diasOcupadosResp.length > 0 && (<p>…</p>)}` por:

```tsx
      {conflictosResp.length > 0 && (
        <p className="w-full text-xs font-medium text-red-700">
          ⚠️ Conflicto de turno: {conflictosResp.map((c) => `${responsables.find((r) => r.id === c.rid)?.nombre ?? ''} (${DIAS[c.dia - 1]})`).join(', ')}
        </p>
      )}
```

5. Reemplazar el `disabled={diasOcupadosResp.length > 0}` del `<button>` por:

```tsx
        disabled={responsableIds.length === 0 || conflictosResp.length > 0}
```

(La sección "Máquina por día" usa `ocupacion` por día/turno y NO depende del responsable: no cambia.)

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/datos/repositorio.ts src/app/programar/acciones.ts src/app/programar/asignar-tarea-form.tsx
git commit -m "feat(programar): asignar varios responsables (una copia por responsable x día)"
```

---

## Task 2: Parte B — Devolver solicitud al solicitante + reenviar

**Files:**
- Modify: `src/datos/repositorio.ts` (agregar `devolverAlSolicitante`, `reenviarSolicitud` cerca de `crearSolicitud`/`listarSolicitudesDeArea`)
- Modify: `src/app/tareas/acciones.ts` (imports + 2 acciones nuevas)
- Modify: `src/app/tareas/page.tsx` (banco: botón condicional; mis solicitudes: estado + reenviar)

**Interfaces:**
- Produces: `devolverAlSolicitante(id)`, `reenviarSolicitud(id)`; acciones `devolverAlSolicitanteAccion`, `reenviarSolicitudAccion`.

- [ ] **Step 1: Funciones de repositorio**

En `src/datos/repositorio.ts`, agregar (junto a `crearSolicitud`/`listarSolicitudesDeArea`):

```ts
// Maquinaria devuelve una tarea solicitada al área que la pidió (no la elimina).
export function devolverAlSolicitante(id: string) {
  return prisma.tarea.update({
    where: { id },
    data: { estado: 'DEVUELTA', anioSel: null, semanaSel: null },
  })
}

// El área solicitante vuelve a enviar al banco de la ejecutora una tarea devuelta.
export function reenviarSolicitud(id: string) {
  return prisma.tarea.update({
    where: { id },
    data: { estado: 'PENDIENTE', anioSel: null, semanaSel: null },
  })
}
```

- [ ] **Step 2: Acciones**

En `src/app/tareas/acciones.ts`:

1. Agregar al import desde `@/datos/repositorio` (junto a `crearSolicitud`):

```ts
  crearSolicitud,
  devolverAlSolicitante,
  reenviarSolicitud,
```

2. Agregar las dos acciones (p. ej. tras `crearSolicitudAccion`):

```ts
export async function devolverAlSolicitanteAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await devolverAlSolicitante(id)
  revalidatePath('/tareas')
}

export async function reenviarSolicitudAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await reenviarSolicitud(id)
  revalidatePath('/tareas')
}
```

- [ ] **Step 3: Botón "Devolver al solicitante" en el banco**

En `src/app/tareas/page.tsx`:

1. Agregar al import desde `./acciones` (línea ~16) `devolverAlSolicitanteAccion` y `reenviarSolicitudAccion`:

```tsx
import { crearTareaAccion, eliminarTareaAccion, programarTareaAccion, crearSolicitudAccion, devolverAlSolicitanteAccion, reenviarSolicitudAccion } from './acciones'
```

2. Reemplazar el `<form action={eliminarTareaAccion}>…eliminar…</form>` (en el `<li>` del banco) por el condicional:

```tsx
                  {t.solicitadaPorArea ? (
                    <form action={devolverAlSolicitanteAccion}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="text-sm text-amber-700 hover:underline">↩️ Devolver al solicitante</button>
                    </form>
                  ) : (
                    <form action={eliminarTareaAccion}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="text-sm text-red-600 hover:underline">eliminar</button>
                    </form>
                  )}
```

- [ ] **Step 4: Estado "🔴 No realizada" + botón "Reenviar" en Mis solicitudes**

En `src/app/tareas/page.tsx`, en el `<li>` de "Mis solicitudes":

1. Reemplazar el `<span>` de estado:

```tsx
                  <span className={s.estado === 'PROGRAMADA' ? 'text-[#2e9e5b]' : s.estado === 'DEVUELTA' ? 'text-red-600' : 'text-gray-500'}>
                    {s.estado === 'PROGRAMADA' ? '✅ Programada' : s.estado === 'DEVUELTA' ? '🔴 No realizada' : '🕓 En banco'}
                  </span>
```

2. Tras el bloque `{s.detalle && (…)}` (y antes de cerrar el `</li>`), agregar el botón reenviar:

```tsx
                {s.estado === 'DEVUELTA' && (
                  <form action={reenviarSolicitudAccion} className="mt-1">
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-xs font-semibold text-purple-700 hover:underline">Reenviar</button>
                  </form>
                )}
```

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/datos/repositorio.ts src/app/tareas/acciones.ts src/app/tareas/page.tsx
git commit -m "feat(tareas): devolver solicitud al solicitante (estado DEVUELTA) + botón reenviar"
```

---

## Fase de despliegue (después del plan)

1. `git push` (respaldo).
2. **Deploy manual por CLI:** `npx vercel --prod --yes --scope ayura-llanos` (sin migración nueva; solo build).
3. Verificación manual: (A) asignar una tarea a 2 responsables → aparece en la fila de cada uno en la grilla; (B) solicitar a maquinaria una tarea; en el banco de maquinaria usar "Devolver al solicitante" → desaparece del banco de maquinaria y en "Mis solicitudes" del solicitante sale "🔴 No realizada"; usar "Reenviar" → vuelve al banco de maquinaria.

---

## Self-Review (autor del plan)

**1. Cobertura de la spec:**
- A: `asignarTarea(responsableIds[])` + conflictos por responsable + dedup + doble bucle → Task 1 Step 1. ✓
- A: `asignarTareaAccion` lee `getAll('responsableId')` → Task 1 Step 2. ✓
- A: casillas de responsables + conflictosResp + botón deshabilitado → Task 1 Step 3. ✓
- B: `devolverAlSolicitante`/`reenviarSolicitud` (estado DEVUELTA/PENDIENTE, anioSel/semanaSel null) → Task 2 Step 1. ✓
- B: acciones → Task 2 Step 2. ✓
- B: botón "Devolver al solicitante" solo en solicitadas, "eliminar" en propias → Task 2 Step 3. ✓
- B: estado "🔴 No realizada" + "Reenviar" en Mis solicitudes → Task 2 Step 4. ✓
- Sin migración (A no toca esquema; B usa estado texto). ✓

**2. Placeholders:** sin "TBD"/"etc."; código completo. ✓

**3. Consistencia de tipos:**
- `asignarTarea(..., responsableIds: string[], ...)` definido en Task 1 Step 1, llamado con `responsableIds` en Task 1 Step 2. ✓
- `responsableIds`/`toggleResp`/`conflictosResp` coherentes en el form (Task 1 Step 3). ✓
- `devolverAlSolicitante`/`reenviarSolicitud` (Task 2 Step 1) ↔ acciones (Step 2) ↔ forms en page.tsx (Steps 3-4). ✓
- Estado `'DEVUELTA'` consistente entre repo (Step 1) y el render de Mis solicitudes (Step 4). ✓
- `t.solicitadaPorArea` (ya en listarTareasPendientes include) usado en Task 2 Step 3; `s.estado`/`s.id` en Step 4. ✓

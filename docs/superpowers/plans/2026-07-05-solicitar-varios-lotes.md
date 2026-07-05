# Solicitar varios lotes (independiente de la actividad) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir elegir varios lotes al solicitar una actividad a otra área, sin importar el tipo de actividad (estándar o maquinaria sin bultos).

**Architecture:** Cambio solo de UI en componentes cliente. El backend (`crearSolicitud`/`editarSolicitud` vía `acciones.ts`) ya lee `form.getAll('loteId')`, así que soporta N lotes sin cambios. Se reutiliza `PickerLotesBultos` (checkboxes multi-lote con persistencia entre fincas) agregándole un modo `sinCantidad` que oculta el campo numérico.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4.

## Global Constraints

- **No tocar** servidor, dominio (`src/dominio/**`), server actions (`src/app/tareas/acciones.ts`) ni esquema/base de datos. El cambio es exclusivamente en componentes cliente `'use client'`.
- **No** pedir cantidad/medida por lote en solicitud estándar ni en maquinaria sin bultos.
- **No** cambiar la rama maquinaria con bultos (debe seguir mostrando el campo de cantidad).
- Typecheck confiable del proyecto: `npx tsc -p tsconfig.check.json --noEmit` (NO usar `tsconfig.json` a secas — da falso rojo por `.next`).
- Seguir la paleta/estilos existentes (clases `border-borde`, `bg-marfil`, `text-sm`, etc.).

---

### Task 1: Prop `sinCantidad` en `PickerLotesBultos`

**Files:**
- Modify: `src/app/tareas/picker-lotes-bultos.tsx`

**Interfaces:**
- Produces: `PickerLotesBultos` acepta prop opcional `sinCantidad?: boolean` (default `false`). Cuando es `true`, no renderiza el input numérico por lote ni emite hidden inputs de cantidad; sigue emitiendo un `<input type="hidden" name="loteId">` por cada lote marcado.

- [ ] **Step 1: Agregar la prop a la firma del componente**

En la línea de props (actualmente):

```tsx
export function PickerLotesBultos({ lotes, seleccionInicial = {}, campo = 'bultos', placeholder = 'bultos' }: { lotes: Lote[]; seleccionInicial?: Record<string, string>; campo?: string; placeholder?: string }) {
```

Reemplazar por:

```tsx
export function PickerLotesBultos({ lotes, seleccionInicial = {}, campo = 'bultos', placeholder = 'bultos', sinCantidad = false }: { lotes: Lote[]; seleccionInicial?: Record<string, string>; campo?: string; placeholder?: string; sinCantidad?: boolean }) {
```

- [ ] **Step 2: Ocultar el input numérico por lote cuando `sinCantidad`**

En el `.map(filtrados)`, el bloque que renderiza el checkbox y el input numérico. Envolver el input numérico con la condición. Reemplazar:

```tsx
                {checked && (
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder={placeholder}
                    value={sel[l.id]}
                    onChange={(e) => setBultos(l.id, e.target.value)}
                    className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
                  />
                )}
```

por:

```tsx
                {checked && !sinCantidad && (
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder={placeholder}
                    value={sel[l.id]}
                    onChange={(e) => setBultos(l.id, e.target.value)}
                    className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
                  />
                )}
```

- [ ] **Step 3: No emitir hidden inputs de cantidad cuando `sinCantidad`**

En el `.map(seleccionados)` que emite los hidden inputs. Reemplazar:

```tsx
      {seleccionados.map((l) => (
        <span key={l.id}>
          <input type="hidden" name="loteId" value={l.id} />
          {sel[l.id] !== '' && <input type="hidden" name={`${campo}_${l.id}`} value={sel[l.id]} />}
        </span>
      ))}
```

por:

```tsx
      {seleccionados.map((l) => (
        <span key={l.id}>
          <input type="hidden" name="loteId" value={l.id} />
          {!sinCantidad && sel[l.id] !== '' && <input type="hidden" name={`${campo}_${l.id}`} value={sel[l.id]} />}
        </span>
      ))}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/tareas/picker-lotes-bultos.tsx
git commit -m "feat(solicitud): prop sinCantidad en PickerLotesBultos (solo lotes)"
```

---

### Task 2: `FormSolicitar` — multi-lote en estándar y maquinaria sin bultos

**Files:**
- Modify: `src/app/tareas/form-solicitar.tsx`

**Interfaces:**
- Consumes: `PickerLotesBultos` con prop `sinCantidad` (Task 1).

- [ ] **Step 1: Rama maquinaria — usar el picker sin cantidad cuando no hay bultos**

Reemplazar el bloque del label de lotes de la rama maquinaria:

```tsx
          <label className="flex flex-col text-sm">
            {conBultos ? 'Lotes y bultos por lote' : 'Finca y lote'}
            {conBultos ? (
              <PickerLotesBultos lotes={lotes} />
            ) : (
              <SelectFincaLote lotes={lotes} name="loteId" />
            )}
          </label>
```

por:

```tsx
          <label className="flex flex-col text-sm">
            {conBultos ? 'Lotes y bultos por lote' : 'Lotes'}
            <PickerLotesBultos lotes={lotes} sinCantidad={!conBultos} />
          </label>
```

- [ ] **Step 2: Rama estándar — agregar selector de lotes**

En la rama `else` (no maquinaria), justo después del `<label>` de "Actividad" (el que tiene `<input name="descripcion" ...>`) y antes del `<label>` de "Descripción (opcional)", insertar:

```tsx
          <label className="flex flex-col text-sm">
            Lotes (opcional)
            <PickerLotesBultos lotes={lotes} sinCantidad />
          </label>
```

- [ ] **Step 3: Quitar el import de `SelectFincaLote` (ya no se usa)**

Eliminar la línea:

```tsx
import { SelectFincaLote } from '../_componentes/select-finca-lote'
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores (en particular, ningún error de import sin usar).

- [ ] **Step 5: Commit**

```bash
git add src/app/tareas/form-solicitar.tsx
git commit -m "feat(solicitud): varios lotes al solicitar (estándar y maquinaria sin bultos)"
```

---

### Task 3: `FormEditarSolicitud` — multi-lote al editar solicitud estándar

**Files:**
- Modify: `src/app/tareas/form-editar-solicitud.tsx`

**Interfaces:**
- Consumes: `PickerLotesBultos` con prop `sinCantidad` (Task 1). Reutiliza `seleccionBultos` ya calculado en el componente (`Object.fromEntries(lotesActuales.map(...))`); con `sinCantidad` solo importa la presencia de las claves, por lo que sirve como selección inicial marcada.

- [ ] **Step 1: Rama no maquinaria — reemplazar `SelectFincaLote` por el picker**

En el ternario del bloque de lotes, reemplazar:

```tsx
        {esMaquinaria
          ? <PickerLotesBultos lotes={lotes} seleccionInicial={seleccionBultos} />
          : <SelectFincaLote lotes={lotes} name="loteId" valorInicial={lotesActuales[0]?.id ?? ''} />}
```

por:

```tsx
        {esMaquinaria
          ? <PickerLotesBultos lotes={lotes} seleccionInicial={seleccionBultos} />
          : <PickerLotesBultos lotes={lotes} sinCantidad seleccionInicial={seleccionBultos} />}
```

- [ ] **Step 2: Quitar el import de `SelectFincaLote` (ya no se usa)**

Eliminar la línea:

```tsx
import { SelectFincaLote } from '../_componentes/select-finca-lote'
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/tareas/form-editar-solicitud.tsx
git commit -m "feat(solicitud): varios lotes al editar solicitud estándar"
```

---

### Task 4: Verificación end-to-end en navegador

**Files:** ninguno (solo verificación).

Levantar dev (`npm run dev`) o usar la app desplegada, iniciar sesión como usuario de un área con permiso de solicitar, e ir a `/tareas`.

- [ ] **Step 1: Solicitud estándar con varios lotes**

Solicitar a un área **no de maquinaria**. Confirmar que aparece el bloque "Lotes (opcional)"; elegir una finca, marcar 2+ potreros, cambiar de finca y marcar otro (verificar que la selección previa se mantiene en el resumen "Lotes: …"), enviar. Confirmar que la solicitud creada quede con todos esos lotes.

- [ ] **Step 2: Maquinaria sin bultos con varios lotes**

Solicitar a un área de **maquinaria** una actividad **sin bultos** (ej: renovar). Confirmar que el label dice "Lotes", que se pueden marcar 2+ lotes y que **no** aparece campo numérico por lote. Enviar y verificar.

- [ ] **Step 3: Regresión — maquinaria con bultos**

Solicitar a maquinaria una actividad **con bultos**. Confirmar que sigue apareciendo el campo de cantidad por lote y que se guarda como antes.

- [ ] **Step 4: Editar solicitud estándar**

Editar una solicitud estándar que tenga varios lotes. Confirmar que aparecen marcados los lotes actuales y que se puede agregar/quitar y guardar.

- [ ] **Step 5: (opcional) Marcar el plan como completado**

Sin commit de código; registrar resultado de la verificación.

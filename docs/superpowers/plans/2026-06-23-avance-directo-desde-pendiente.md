# Registrar avance directo desde Pendiente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un botón "Registrar avance" en las actividades Pendientes (junto a cumplido/novedad) que anota avances día a día por lote y deja la actividad en Parcial, sin marcarla Cumplida; el cierre sigue siendo manual.

**Architecture:** Se abre el guard de `registrarAvanceLote` para aceptar PENDIENTE (el primer avance la pasa a PARCIAL, acumulando). En los componentes de día Pendiente (`DiaNoMaquinaria`, `DiaMaquinaria`) se renderiza el `FormAvanceLote` existente (que ya gestiona su propio abierto/cerrado) cuando la actividad tiene lotes. `page.tsx` les pasa el día y la acción de avance.

**Tech Stack:** Next.js (App Router, RSC + client components), TypeScript, Prisma, Vitest.

## Global Constraints

- Sin migración de esquema (`avancePorLote` es JSON).
- Comentarios en español; color de marca `#11603a`.
- No tocar el flujo de "novedad", "✓ cumplido", ni "marcar cumplida".
- `registrarAvanceLote` no toca `haRealizada` (la novedad es distinta del avance).
- **TYPECHECK FIABLE (obligatorio):** `npx tsc --noEmit` da falso-verde en este repo (archivo generado `.next/dev/types/validator.ts` corrupto aborta el chequeo). Verificar tipos SIEMPRE así:
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/" ; echo "errores src: $(npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -cE '^src/')"
  rm -f tsconfig.check.json
  ```
  No commitear `tsconfig.check.json`.

---

### Task 1: Repositorio — abrir el guard de `registrarAvanceLote` a PENDIENTE

**Files:**
- Modify: `src/datos/repositorio.ts` (`registrarAvanceLote`, la línea del guard ~482)

**Interfaces:**
- Produces: `registrarAvanceLote` ahora acepta arrancar desde PENDIENTE (lo deja PARCIAL).

- [ ] **Step 1: Cambiar el guard**

En `src/datos/repositorio.ts`, dentro de `registrarAvanceLote`, reemplazar:

```ts
  if (act.estado !== 'PARCIAL') return null // solo se registran avances sobre un parcial
```

por:

```ts
  // Se permite arrancar desde PENDIENTE (el primer avance lo pasa a PARCIAL) o seguir
  // sumando en PARCIAL. No se registran avances sobre cerradas/no cumplidas/reprogramadas.
  if (act.estado !== 'PENDIENTE' && act.estado !== 'PARCIAL') return null
```

(El resto de la función no cambia: `agregarAvances` + `update({ avancePorLote, estado: 'PARCIAL' })`. No toca `haRealizada`.)

- [ ] **Step 2: Verificar tipos y lint**

Run (typecheck fiable, ver Global Constraints):
```
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/" ; echo "errores src: $(npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -cE '^src/')"
rm -f tsconfig.check.json
npm run lint
```
Expected: `errores src: 0` y lint limpio.

- [ ] **Step 3: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(cumplimiento): registrarAvanceLote acepta arrancar desde PENDIENTE"
```

---

### Task 2: `DiaNoMaquinaria` + cableado — botón "Registrar avance"

**Files:**
- Modify: `src/app/cumplimiento/dia-no-maquinaria.tsx`
- Modify: `src/app/cumplimiento/page.tsx` (la llamada a `<DiaNoMaquinaria … />`, ~240-251)

**Interfaces:**
- Consumes: `FormAvanceLote` (`./form-avance-lote`, props `actividadId`, `diaActividad`, `esMaquinaria`, `maquinas`, `unidad`, `lotes`, `accion`); `registrarAvanceLoteAccion` (ya importado en `page.tsx`).
- Produces: `DiaNoMaquinaria` gana props `dia: number` y `accionAvance: (formData: FormData) => void | Promise<void>`.

- [ ] **Step 1: Importar `FormAvanceLote`**

En `src/app/cumplimiento/dia-no-maquinaria.tsx`, junto al import de `FormRegistrar`:

```ts
import { FormAvanceLote } from './form-avance-lote'
```

- [ ] **Step 2: Agregar las props `dia` y `accionAvance`**

En la firma del componente (el objeto de props y su tipo), agregar `dia` y `accionAvance`. La firma desestructurada pasa a:

```tsx
export function DiaNoMaquinaria({
  actividadId,
  motivos,
  motivoCambioId,
  lotes,
  maquinas,
  estipuladas,
  lotesActividad,
  unidad,
  dia,
  marcarCumplido,
  accionRegistrar,
  accionAvance,
}: {
  actividadId: string
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  lotesActividad: { id: string; nombre: string }[]
  unidad: Unidad
  dia: number
  marcarCumplido: (formData: FormData) => void | Promise<void>
  accionRegistrar: (formData: FormData) => void | Promise<void>
  accionAvance: (formData: FormData) => void | Promise<void>
}) {
```

- [ ] **Step 3: Renderizar `FormAvanceLote` en la vista por defecto**

En el `return` final (el `<div className="flex flex-wrap items-center gap-3 text-sm">` con "✓ Cumplido" y "registrar novedad"), agregar, **después** del botón "registrar novedad" y dentro del mismo `<div>`:

```tsx
      {lotesActividad.length > 0 && (
        <FormAvanceLote
          actividadId={actividadId}
          diaActividad={dia}
          esMaquinaria={false}
          maquinas={maquinas}
          unidad={unidad}
          lotes={lotesActividad}
          accion={accionAvance}
        />
      )}
```

(El bloque `if (novedad) { … }` no cambia.)

- [ ] **Step 4: Pasar `dia` y `accionAvance` desde `page.tsx`**

En `src/app/cumplimiento/page.tsx`, en la llamada `<DiaNoMaquinaria … />` (rama PENDIENTE), agregar las dos props (junto a las existentes):

```tsx
                                  dia={a.dia}
                                  accionAvance={registrarAvanceLoteAccion}
```

- [ ] **Step 5: Verificar tipos y lint**

Run (typecheck fiable):
```
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/" ; echo "errores src: $(npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -cE '^src/')"
rm -f tsconfig.check.json
npm run lint
```
Expected: `errores src: 0` y lint limpio.

- [ ] **Step 6: Commit**

```bash
git add src/app/cumplimiento/dia-no-maquinaria.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): Registrar avance en día Pendiente (no maquinaria)"
```

---

### Task 3: `DiaMaquinaria` + cableado — botón "Registrar avance"

**Files:**
- Modify: `src/app/cumplimiento/dia-maquinaria.tsx`
- Modify: `src/app/cumplimiento/page.tsx` (la llamada a `<DiaMaquinaria … />`, ~227-238)

**Interfaces:**
- Consumes: `FormAvanceLote` (`./form-avance-lote`); `registrarAvanceLoteAccion` (ya importado en `page.tsx`).
- Produces: `DiaMaquinaria` gana props `dia: number` y `accionAvance: (formData: FormData) => void | Promise<void>`.

- [ ] **Step 1: Importar `FormAvanceLote`**

En `src/app/cumplimiento/dia-maquinaria.tsx`, junto al import de `FormRegistrar`:

```ts
import { FormAvanceLote } from './form-avance-lote'
```

- [ ] **Step 2: Agregar las props `dia` y `accionAvance`**

En la firma desestructurada y su tipo, agregar `dia` y `accionAvance`:

```tsx
export function DiaMaquinaria({
  actividadId,
  unidad,
  motivos,
  motivoCambioId,
  lotes,
  maquinas,
  estipuladas,
  lotesActividad,
  haProgramada,
  dia,
  accionRegistrar,
  accionAvance,
}: {
  actividadId: string
  unidad: Unidad
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  lotesActividad: { id: string; nombre: string }[]
  haProgramada: number
  dia: number
  accionRegistrar: (formData: FormData) => void | Promise<void>
  accionAvance: (formData: FormData) => void | Promise<void>
}) {
```

- [ ] **Step 3: Envolver el `<form>` por defecto y agregar `FormAvanceLote` como hermano**

La vista por defecto hoy retorna directamente un `<form action={accionRegistrar} …>`. Como `FormAvanceLote` es su propio `<form>` (no se puede anidar), envolver en un `<div>` y agregar el avance como hermano. Reemplazar el `return ( <form …> … </form> )` final por:

```tsx
  return (
    <div className="flex flex-col gap-2">
      <form action={accionRegistrar} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={actividadId} />
        <input type="hidden" name="estado" value="CUMPLIDA" />
        <label className="flex flex-col text-xs">
          {etiquetaMedida(unidad)}
          <input
            name="haRealizada"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={haProgramada}
            className="w-28 rounded border p-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs">
          Centro de costo
          <select
            name="centroCosto"
            value={centro}
            onChange={(e) => setCentro(e.target.value)}
            className="rounded border p-1 text-sm"
          >
            <option value="">— sin centro —</option>
            {CENTROS_COSTO.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="__otra__">Otras…</option>
          </select>
        </label>
        {centro === '__otra__' && (
          <label className="flex flex-col text-xs">
            Otras (texto libre)
            <input name="centroCostoOtra" className="w-40 rounded border p-1 text-sm" />
          </label>
        )}
        <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Guardar avance</button>
        <button type="button" onClick={() => setNovedad(true)} className="text-xs text-gray-500 underline">
          registrar novedad
        </button>
      </form>
      {lotesActividad.length > 0 && (
        <FormAvanceLote
          actividadId={actividadId}
          diaActividad={dia}
          esMaquinaria={true}
          maquinas={maquinas}
          unidad={unidad}
          lotes={lotesActividad}
          accion={accionAvance}
        />
      )}
    </div>
  )
```

(El bloque `if (novedad) { … }` no cambia.)

- [ ] **Step 4: Pasar `dia` y `accionAvance` desde `page.tsx`**

En `src/app/cumplimiento/page.tsx`, en la llamada `<DiaMaquinaria … />` (rama PENDIENTE), agregar las dos props (junto a las existentes):

```tsx
                                  dia={a.dia}
                                  accionAvance={registrarAvanceLoteAccion}
```

- [ ] **Step 5: Verificar tipos y lint**

Run (typecheck fiable):
```
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/" ; echo "errores src: $(npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -cE '^src/')"
rm -f tsconfig.check.json
npm run lint
```
Expected: `errores src: 0` y lint limpio.

- [ ] **Step 6: Commit**

```bash
git add src/app/cumplimiento/dia-maquinaria.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): Registrar avance en día Pendiente (maquinaria)"
```

---

### Task 4: Suite + desplegar + verificación manual

**Files:** (ninguno — verificación)

- [ ] **Step 1: Suite + tipos fiables + lint**

Run:
```
npm test
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -cE '^src/'
rm -f tsconfig.check.json
npm run lint
```
Expected: pruebas PASAN; `0` errores en `src/`; lint limpio.

- [ ] **Step 2: Desplegar a producción**

Run: `timeout 540 npx vercel@latest --prod --yes --scope ayura-llanos`
Expected: `readyState: READY`, aliased a https://cronograma-ayura.vercel.app

- [ ] **Step 3: Verificación manual (producción)**

Sobre una actividad **Pendiente con lotes** (tomar snapshot por id y restaurar al final, es data real):
(a) Aparece el botón "Registrar avance" junto a "✓ Cumplido"/"registrar novedad".
(b) Registrar avance día 1 (cantidad) → la actividad pasa a **🟡 Parcial** y muestra "Avances: …" con esa entrada; NO queda Cumplida.
(c) Registrar avance día 2 → se ve la segunda entrada acumulada (no reemplaza la primera).
(d) "✓ Marcar cumplida" → Cumplida con medida = suma; el Excel lista una fila por avance.
(e) Una actividad **sin lotes** no muestra "Registrar avance".

---

## Self-Review

**Cobertura del spec:**
- Guard a PENDIENTE → Task 1. ✅
- Botón "Registrar avance" en día Pendiente (no maquinaria) → Task 2. ✅
- Botón "Registrar avance" en día Pendiente (maquinaria, como hermano del form) → Task 3. ✅
- Solo con lotes → Tasks 2/3 (`lotesActividad.length > 0`). ✅
- No auto-cumplida / cierre manual → garantizado por `registrarAvanceLote` (deja PARCIAL) + "Marcar cumplida" existente. ✅
- No tocar novedad/cumplido → ambos componentes conservan esos caminos. ✅

**Placeholder scan:** sin TBD/TODO; código completo en cada paso.

**Type consistency:** ambos componentes ganan `dia: number` y `accionAvance: (formData: FormData) => void | Promise<void>`, provistos por `page.tsx` con `dia={a.dia}` y `accionAvance={registrarAvanceLoteAccion}`. `FormAvanceLote` se usa con sus props existentes (`lotes={lotesActividad}`). `registrarAvanceLote` (Task 1) ↔ `registrarAvanceLoteAccion` (acción existente) ↔ prop `accion` de `FormAvanceLote`.

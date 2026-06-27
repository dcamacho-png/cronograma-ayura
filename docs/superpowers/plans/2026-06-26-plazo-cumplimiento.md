# Plazo de cumplimiento — Implementation Plan

> ✅ **COMPLETADO** — implementado y commiteado en `master` (commits `d7030b4` y `f9a25e0`, más el helper `plazoCumplimientoVencido` con sus tests en `semana.ts`).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Que el cumplimiento de una semana solo pueda diligenciarse hasta el fin de su domingo (hora Colombia); pasado ese plazo, solo ADMIN puede registrar/editar.

**Architecture:** El plazo "fin del domingo de la semana N" equivale a que la semana N ya sea pasada respecto a hoy (`esSemanaPasada`), porque la semana ISO termina el domingo 23:59 y `semanaActual()` ya corre en hora de Colombia. Se añade un helper de dominio nombrado, un guard en cada server action (defensa real) y el modo solo-lectura en la página.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma, TypeScript, Vitest.

## Global Constraints

- Hora de referencia: **Colombia (UTC-5)**, ya encapsulada en `semanaActual()` / `aHoraColombia()`. No introducir nuevos cálculos de fecha.
- ADMIN se detecta con `u.rol === 'ADMIN'` (campo `rol` de `Usuario`, default `"AREA"`).
- Tests: Vitest (`npm test`), archivos `*.test.ts` junto al fuente; `import { describe, it, expect } from 'vitest'`.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- Convención del repo: se prueban con unidad las funciones de **dominio**; las server actions y páginas (RSC) no tienen tests automáticos — se verifican con typecheck + ejecución. Seguir esa convención.

---

### Task 1: Helper de dominio `plazoCumplimientoVencido`

**Files:**
- Modify: `src/dominio/semana.ts` (añadir función al final, junto a `esSemanaPasada`)
- Test: `src/dominio/semana.test.ts` (añadir bloque `describe`)

**Interfaces:**
- Consumes: `esSemanaPasada(anio, semana, referencia)` y el tipo `Semana` (ya existen en `semana.ts`).
- Produces: `plazoCumplimientoVencido(anio: number, semana: number, hoy: Semana): boolean`

- [x] **Step 1: Write the failing test**

Añadir al final de `src/dominio/semana.test.ts`. Asegurar que `plazoCumplimientoVencido` esté en el `import` desde `./semana`:

```ts
import { plazoCumplimientoVencido } from './semana'

describe('plazoCumplimientoVencido', () => {
  it('una semana pasada está vencida', () => {
    expect(plazoCumplimientoVencido(2026, 24, { anio: 2026, semana: 25 })).toBe(true)
  })
  it('la semana en curso NO está vencida (se puede hasta el domingo)', () => {
    expect(plazoCumplimientoVencido(2026, 25, { anio: 2026, semana: 25 })).toBe(false)
  })
  it('una semana futura NO está vencida', () => {
    expect(plazoCumplimientoVencido(2026, 26, { anio: 2026, semana: 25 })).toBe(false)
  })
  it('cruza el cambio de año: 2026 s53 está vencida frente a 2027 s1', () => {
    expect(plazoCumplimientoVencido(2026, 53, { anio: 2027, semana: 1 })).toBe(true)
  })
})
```

> Nota: el `import` existente en el archivo trae `{ isoSemanaDeFecha, siguienteSemana, semanaAnterior, esSemanaFutura }`. Agregar `plazoCumplimientoVencido` a esa misma línea en vez de duplicar el `import`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- semana`
Expected: FALLA — `plazoCumplimientoVencido is not a function` (o error de import / "no exported member").

- [x] **Step 3: Write minimal implementation**

Añadir al final de `src/dominio/semana.ts`:

```ts
// El plazo para diligenciar el cumplimiento de una semana vence al terminar su domingo,
// es decir, cuando esa semana ya es pasada respecto a hoy (la semana ISO termina el domingo
// 23:59 y "hoy" se evalúa en hora de Colombia vía semanaActual()).
export function plazoCumplimientoVencido(anio: number, semana: number, hoy: Semana): boolean {
  return esSemanaPasada(anio, semana, hoy)
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- semana`
Expected: PASS (todos los `it` del nuevo `describe` en verde, sin romper los existentes).

- [x] **Step 5: Commit**

```bash
git add src/dominio/semana.ts src/dominio/semana.test.ts
git commit -m "feat(dominio): helper plazoCumplimientoVencido (= semana pasada)"
```

---

### Task 2: Guards de plazo en las server actions de cumplimiento

**Files:**
- Modify: `src/datos/repositorio.ts` (nuevo helper `semanaDeActividad`)
- Modify: `src/app/cumplimiento/acciones.ts` (imports + dos guards + return temprano en cada acción)

**Interfaces:**
- Consumes: `plazoCumplimientoVencido` (Task 1); `usuarioActual()` de `@/auth/sesion` (devuelve `{ rol: string, ... } | null`); `semanaActual()` de `@/dominio/semana`.
- Produces:
  - `semanaDeActividad(id: string): Promise<{ anio: number; semana: number } | null>`
  - (internas en acciones) `bloqueadoPorPlazo(anio, semana): Promise<boolean>` y `bloqueadoPorPlazoActividad(id): Promise<boolean>`

- [x] **Step 1: Añadir el helper de repositorio**

En `src/datos/repositorio.ts`, junto a las demás funciones de actividad (p. ej. tras `actualizarActividad`), añadir:

```ts
// Año/semana ISO a la que pertenece una actividad; null si no existe.
export function semanaDeActividad(id: string) {
  return prisma.actividad.findUnique({ where: { id }, select: { anio: true, semana: true } })
}
```

- [x] **Step 2: Ampliar imports en `acciones.ts`**

En `src/app/cumplimiento/acciones.ts`:

Reemplazar el import de repositorio (línea 4) para incluir `semanaDeActividad`:

```ts
import { marcarEstado, reprogramarActividad, registrarCumplimiento, crearActividadRealizada, reabrirActividad, registrarAvanceLote, devolverAlBanco, marcarCumplidaDesdeParcial, semanaDeActividad } from '@/datos/repositorio'
```

Reemplazar el import de dominio (línea 5):

```ts
import { siguienteSemana, plazoCumplimientoVencido, semanaActual } from '@/dominio/semana'
```

Añadir el import de sesión justo debajo:

```ts
import { usuarioActual } from '@/auth/sesion'
```

- [x] **Step 3: Añadir los dos guards**

En `src/app/cumplimiento/acciones.ts`, tras los helpers `texto/textoOpcional/numeroOpcional` (antes de `marcarEstadoAccion`), añadir:

```ts
// ¿El usuario actual NO puede modificar el cumplimiento de esta semana?
// (plazo vencido y no es ADMIN). El ADMIN nunca queda bloqueado.
async function bloqueadoPorPlazo(anio: number, semana: number): Promise<boolean> {
  const u = await usuarioActual()
  if (u?.rol === 'ADMIN') return false
  return plazoCumplimientoVencido(anio, semana, semanaActual())
}

// Igual, resolviendo la semana a partir del id de actividad. Si la actividad no existe,
// se bloquea (la acción no tendría nada válido que hacer).
async function bloqueadoPorPlazoActividad(id: string): Promise<boolean> {
  const a = await semanaDeActividad(id)
  if (!a) return true
  return bloqueadoPorPlazo(a.anio, a.semana)
}
```

- [x] **Step 4: Insertar el return temprano en cada acción**

Reglas: las acciones que ya tienen `anio`/`semana` usan `bloqueadoPorPlazo`; las que solo tienen `id` usan `bloqueadoPorPlazoActividad`. Insertar el guard **después** de validar el `id`/datos y **antes** de llamar al repositorio.

`marcarEstadoAccion` — tras `if (!id || !ESTADOS_VALIDOS.includes(estado)) return`:
```ts
  if (await bloqueadoPorPlazoActividad(id)) return
```

`desmarcarAccion` — tras `if (!id) return`:
```ts
  if (await bloqueadoPorPlazoActividad(id)) return
```

`reprogramarAccion` — tras la validación de `id/anio/semana`, antes de `const prox = ...`:
```ts
  if (await bloqueadoPorPlazo(anio, semana)) return
```

`agregarActividadRealizadaAccion` — tras la validación grande (`if (!areaId || ... ) return`):
```ts
  if (await bloqueadoPorPlazo(anio, semana)) return
```

`registrarAccion` — tras `if (estado !== 'CUMPLIDA' && !motivoId) return`:
```ts
  if (await bloqueadoPorPlazoActividad(id)) return
```

`registrarAvanceLoteAccion` — tras `if (!id || !(dia >= 1 && dia <= 7)) return`:
```ts
  if (await bloqueadoPorPlazoActividad(id)) return
```

`devolverAlBancoAccion` — tras `if (!id) return`:
```ts
  if (await bloqueadoPorPlazoActividad(id)) return
```

`marcarCumplidaParcialAccion` — tras `if (!id) return`:
```ts
  if (await bloqueadoPorPlazoActividad(id)) return
```

- [x] **Step 5: Typecheck**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida (cero errores en `src/`).

- [x] **Step 6: Tests de dominio siguen verdes**

Run: `npm test`
Expected: PASS (incluido el nuevo test de Task 1; nada roto).

- [x] **Step 7: Commit**

```bash
git add src/datos/repositorio.ts src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): bloquear acciones tras el plazo (solo ADMIN); helper semanaDeActividad"
```

---

### Task 3: Modo solo-lectura en la página de cumplimiento

**Files:**
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `plazoCumplimientoVencido` (Task 1); variables ya presentes `esAdmin`, `anio`, `semana`, `hoy` (= `semanaActual()`).
- Produces: nada para otras tareas (es la capa de presentación).

- [x] **Step 1: Importar el helper**

En `src/app/cumplimiento/page.tsx`, en el import de `@/dominio/semana` (línea 6), añadir `plazoCumplimientoVencido`:

```ts
import { siguienteSemana, semanaAnterior, semanaActual, fechasDeSemana, plazoCumplimientoVencido } from '@/dominio/semana'
```

- [x] **Step 2: Calcular `bloqueado`**

Colocarlo justo después de la línea `const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana` (~línea 67), donde ya existen `esAdmin`, `anio`, `semana` y `hoy`:

```ts
  // Una semana queda en solo lectura para las áreas una vez vencido el plazo (fin del domingo).
  const bloqueado = !esAdmin && plazoCumplimientoVencido(anio, semana, hoy)
```

- [x] **Step 3: Aviso de plazo vencido**

Inmediatamente después del bloque del aviso `{pendientes > 0 && (...)}` (termina ~línea 159), añadir:

```tsx
      {bloqueado && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          ⛔ Plazo vencido: el cumplimiento de esta semana ya no se puede modificar. Solo el administrador puede hacer cambios.
        </div>
      )}
```

- [x] **Step 4: Ocultar el formulario de "agregar actividad realizada"**

Envolver el bloque `{responsables.length > 0 && (<FormActividadRealizada .../>)}` (líneas ~161-173) para que además exija `!bloqueado`:

Reemplazar la apertura de la condición:
```tsx
      {responsables.length > 0 && (
```
por:
```tsx
      {responsables.length > 0 && !bloqueado && (
```

- [x] **Step 5: Filas PENDIENTE en solo lectura**

En la rama `a.estado === 'PENDIENTE'` (línea ~228), que hoy renderiza `DiaMaquinaria`/`DiaNoMaquinaria`, anteponer el caso bloqueado.

Reemplazar:
```tsx
                            {a.estado === 'PENDIENTE' ? (
                              esMaquinaria ? (
```
por:
```tsx
                            {a.estado === 'PENDIENTE' ? (
                              bloqueado ? (
                                <span className="text-sm text-tierra">Pendiente (plazo vencido)</span>
                              ) : esMaquinaria ? (
```

> Esto deja la ternaria anidada: `bloqueado ? <readonly> : esMaquinaria ? <DiaMaquinaria/> : <DiaNoMaquinaria/>`. El `<span>` va envuelto en su propio par de paréntesis `( ... )`, que está balanceado, así que NO hay que tocar ningún otro paréntesis de cierre del bloque: el `)` que ya estaba antes de `: (() => {` sigue cerrando la rama-verdadera del `PENDIENTE ?`.

- [x] **Step 6: Ocultar el "↩ desmarcar" en filas ya registradas**

En la rama no-pendiente, el formulario de desmarcar está en líneas ~281-284. Envolverlo con `!bloqueado`:

Reemplazar:
```tsx
                                <form action={desmarcarAccion} className="ml-auto">
                                  <input type="hidden" name="id" value={a.id} />
                                  <button className="text-xs text-tierra underline hover:text-tinta">↩ desmarcar</button>
                                </form>
```
por:
```tsx
                                {!bloqueado && (
                                  <form action={desmarcarAccion} className="ml-auto">
                                    <input type="hidden" name="id" value={a.id} />
                                    <button className="text-xs text-tierra underline hover:text-tinta">↩ desmarcar</button>
                                  </form>
                                )}
```

- [x] **Step 7: Ocultar las acciones del estado PARCIAL**

El bloque `{a.estado === 'PARCIAL' && (...)}` (líneas ~290-319) contiene `FormAvanceLote`, "✓ Marcar cumplida" y "Devolver al banco". Cambiar la condición de apertura para exigir `!bloqueado`:

Reemplazar:
```tsx
                              {a.estado === 'PARCIAL' && (
```
por:
```tsx
                              {a.estado === 'PARCIAL' && !bloqueado && (
```

> El resumen de avances (solo lectura) y el texto de estado siguen visibles; solo se ocultan los formularios.

- [x] **Step 8: Typecheck**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida. (Si aparece un error de JSX por paréntesis en el Step 5, ajustar el anidamiento del ternario hasta que quede limpio.)

- [x] **Step 9: Verificación manual (build local de la página)**

Run: `npm run dev` y abrir `/cumplimiento`.
Verificar como usuario de ÁREA:
- En una **semana pasada**: aparece el aviso "⛔ Plazo vencido"; no hay formularios (ni agregar actividad, ni registrar/desmarcar/avance), las filas PENDIENTE muestran "Pendiente (plazo vencido)", y las ya registradas se ven sin botones.
- En la **semana en curso** y **futuras**: todo editable como antes.
Verificar como **ADMIN**: todas las semanas editables (sin aviso ni bloqueo).
Expected: comportamiento descrito. (Si no hay forma rápida de alternar rol/semana localmente, dejar constancia y validar en el deploy de preview.)

- [x] **Step 10: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): solo lectura tras el plazo (aviso + ocultar formularios)"
```

---

## Notas de cierre

- **Feature 2 (parrilla)** no está en este plan: ya existe ("Devolver a asignar" en semanas futuras) y el usuario confirmó que el límite se queda en solo semanas futuras. Sin cambios.
- Despliegue: tras revisar, seguir el flujo habitual de Vercel (ver memoria de despliegue). El build de Vercel regenera `.next` limpio y corre el typecheck real.

# Tope de programación: lunes 11 pm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir programar/editar una semana hasta el **lunes de esa semana a las 23:00 (hora Colombia)** en vez de solo mientras la semana es estrictamente futura.

**Architecture:** Se agrega un helper de dominio puro `programacionAbierta(anio, semana, ahora?)` en `src/dominio/semana.ts` y se reemplaza con él la regla de "semana futura/pasada" en los guards de servidor de `programar` y `tareas` y en la UI de `programar`.

**Tech Stack:** Next.js (App Router, Server Actions), TypeScript, Vitest.

## Global Constraints

- 11 pm = **23:00 hora Colombia** (UTC-5, sin DST), fijo. Comparación **estricta** (`<`): a las 23:00 en punto ya está cerrada.
- Regla única: semana abierta mientras `ahora` < lunes de esa semana 23:00 COT ⇒ futuras abiertas; semana actual abierta solo el lunes antes de 23:00; pasadas cerradas.
- `esSemanaFutura`/`esSemanaPasada` NO se borran (las usan `semana.test.ts`, `plazoCumplimientoVencido`, `esSemanaPasada`); solo se cambian los call sites indicados.
- No tocar el plazo de **cumplimiento**. **ADMIN** no gana bypass en programar. Autorización por rol/área (`puedeMutarArea`) sin cambios.
- Verificar con `npm test` (Vitest) y `npx next build` (el `npm run build` local falla por `DIRECT_URL` ausente — usar `npx next build`; no tocar la DB).

---

### Task 1: Helper de dominio `programacionAbierta` + tests

**Files:**
- Modify: `src/dominio/semana.ts` (agregar la función; usa el `lunesDeIsoSemana` interno y `OFFSET_COLOMBIA_MS` ya existentes)
- Modify: `src/dominio/semana.test.ts` (agregar `describe`)

**Interfaces:**
- Produces: `programacionAbierta(anio: number, semana: number, ahora?: Date): boolean`

- [ ] **Step 1: Write the failing test**

Agregar al final de `src/dominio/semana.test.ts` (y añadir `programacionAbierta` y `fechasDeSemana` al import existente de `'./semana'`):

```ts
describe('programacionAbierta', () => {
  const H = 3600_000
  const lunes = fechasDeSemana(2026, 30)[0].getTime() // lunes 00:00 UTC de 2026-W30
  // lunes 23:00 Colombia = lunes 00:00 UTC + 5h (offset) + 23h = lunes + 28h
  const limite = lunes + 28 * H

  it('un día antes del lunes (semana aún futura) → abierta', () => {
    expect(programacionAbierta(2026, 30, new Date(lunes - 24 * H))).toBe(true)
  })
  it('lunes 22:59 Colombia → abierta', () => {
    expect(programacionAbierta(2026, 30, new Date(limite - 60_000))).toBe(true)
  })
  it('lunes 23:00 Colombia exacto → cerrada (borde estricto)', () => {
    expect(programacionAbierta(2026, 30, new Date(limite))).toBe(false)
  })
  it('lunes 23:01 Colombia → cerrada', () => {
    expect(programacionAbierta(2026, 30, new Date(limite + 60_000))).toBe(false)
  })
  it('martes de la semana → cerrada', () => {
    expect(programacionAbierta(2026, 30, new Date(limite + 12 * H))).toBe(false)
  })
  it('semana ya pasada → cerrada', () => {
    expect(programacionAbierta(2026, 30, new Date(lunes + 60 * 24 * H))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dominio/semana.test.ts`
Expected: FAIL — `programacionAbierta is not a function` / no exportada.

- [ ] **Step 3: Write minimal implementation**

Agregar en `src/dominio/semana.ts` (después de `esSemanaFutura`, para tener `lunesDeIsoSemana` y `OFFSET_COLOMBIA_MS` en alcance — ambos ya existen en el archivo):

```ts
// Hora límite (Colombia) para programar/editar una semana: el LUNES de esa semana.
const HORA_LIMITE_PROGRAMACION_COT = 23 // 11 pm

// ¿Está abierta la programación de la semana (anio, semana)? Se puede programar/editar
// hasta el LUNES de esa semana a las 23:00 hora de Colombia. Las semanas futuras están
// abiertas (su lunes aún no llega); pasado el lunes 23:00 (Colombia) queda en solo lectura.
// `ahora` por defecto es el instante real; se puede inyectar para pruebas deterministas.
export function programacionAbierta(anio: number, semana: number, ahora: Date = new Date()): boolean {
  const lunes = lunesDeIsoSemana(anio, semana) // lunes 00:00 UTC de esa semana ISO
  const limite = lunes.getTime() + OFFSET_COLOMBIA_MS + HORA_LIMITE_PROGRAMACION_COT * 60 * 60 * 1000
  return ahora.getTime() < limite
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dominio/semana.test.ts`
Expected: PASS (los existentes + los 6 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/semana.ts src/dominio/semana.test.ts
git commit -m "feat(semana): helper programacionAbierta (tope lunes 23:00 Colombia)"
```

---

### Task 2: Aplicar la regla en guards de servidor y en la UI

Reemplaza la regla de "semana futura/pasada" por `programacionAbierta` en todos los puntos de programación (servidor de `programar` y `tareas`, y la UI de `programar`), y actualiza el texto del candado.

**Files:**
- Modify: `src/app/programar/acciones.ts`
- Modify: `src/app/tareas/acciones.ts`
- Modify: `src/app/programar/page.tsx`
- Modify: `src/app/programar/grilla-tractor.tsx`

**Interfaces:**
- Consumes: `programacionAbierta(anio, semana)` (Task 1).

- [ ] **Step 1: Server guards en `programar/acciones.ts`**

En el import de `@/dominio/semana` (línea 6) agregar `programacionAbierta`:

```ts
import { semanaAnterior, esSemanaPasada, semanaActual, diaActual, esDiaPasado, esSemanaFutura, programacionAbierta } from '@/dominio/semana'
```

Reemplazos (mantener el resto de cada línea igual):

- Línea 57 (`crearActividadAccion`): `if (esSemanaPasada(anio, semana, semanaActual())) return`
  → `if (!programacionAbierta(anio, semana)) return`
- Línea 94 (`duplicarSemanaAccion`): `if (esSemanaPasada(anio, semana, semanaActual())) return`
  → `if (!programacionAbierta(anio, semana)) return`
- Línea 116 (`actualizarActividadAccion`): `!esSemanaFutura(anio, semana, semanaActual())`
  → `!programacionAbierta(anio, semana)` (dentro del mismo `if (!Number.isInteger(anio) || !Number.isInteger(semana) || ...) return`)
- Línea 182 (`devolverAAsignacionAccion`): `if (!esSemanaFutura(anio, semana, semanaActual())) return`
  → `if (!programacionAbierta(anio, semana)) return`
- Línea 193 (`devolverGrillaAlBancoAccion`): igual reemplazo que 182.
- Línea 206 (`devolverActividadAlBancoAccion`): igual reemplazo que 182.
- Línea 218 (`dedicarTractorAccion`): igual reemplazo que 182.
- Línea 242 (`crearNovedadResponsableAccion`): `!esSemanaFutura(anio, semana, semanaActual())`
  → `!programacionAbierta(anio, semana)` (dentro del `if` con los `Number.isInteger`).
- Línea 263 (`eliminarNovedadResponsableAccion`): igual reemplazo que 242.

Para `asignarTareaAccion` agregar el gate de semana (hoy solo filtra días con `esDiaPasado` en la línea 139). Justo después de calcular `anioForm`/`semanaForm` y antes del `.filter((d) => !esDiaPasado(...))`, agregar:

```ts
      if (!programacionAbierta(anioForm, semanaForm)) return
```

(Mantener el `.filter(... esDiaPasado ...)` existente como filtro fino por día.)

Nota: tras estos cambios, `esSemanaPasada` y `esSemanaFutura` pueden quedar sin uso en este archivo. Quitarlos del import SOLO si ya no se usan en ningún otro punto del archivo (verificar con una búsqueda en el archivo antes de quitarlos); si siguen usándose, dejarlos.

- [ ] **Step 2: Server guard en `tareas/acciones.ts`**

En el import de `@/dominio/semana` (línea 17) agregar `programacionAbierta`:

```ts
import { esSemanaPasada, esSemanaFutura, semanaActual, programacionAbierta } from '@/dominio/semana'
```

Línea 242 (`programarTareaAccion`): `if (!esSemanaFutura(anio, semana, semanaActual())) return`
→ `if (!programacionAbierta(anio, semana)) return`

Nota: si `esSemanaFutura` queda sin otro uso en el archivo, quitarlo del import (verificar antes; `esSemanaPasada` y `semanaActual` probablemente siguen usándose).

- [ ] **Step 3: UI en `programar/page.tsx`**

- Import (línea 14): agregar `programacionAbierta` a la lista importada de `@/dominio/semana`.
- Línea 56: `const futura = esSemanaFutura(anio, semana, hoy)`
  → `const programable = programacionAbierta(anio, semana)`
- Renombrar los usos de `futura` a `programable`:
  - Línea 146: `{!futura && (` → `{!programable && (`
  - Línea 152: `{futura && !soloLectura && porAsignar.length > 0 && (` → `{programable && !soloLectura && porAsignar.length > 0 && (`
  - Línea 228: `turnoEditable={futura && !soloLectura}` → `turnoEditable={programable && !soloLectura}`
  - Línea 239: `futura={futura && !soloLectura}` → `programable={programable && !soloLectura}` (el nombre del prop se renombra en el Step 4)
- Texto del candado (bloque de la línea 146), reemplazar el mensaje actual por:

```tsx
        🔒 El plazo para programar esta semana venció (lunes 11 pm). Ahora es solo lectura. La programación se puede hacer hasta el lunes de la semana, 11 pm.
```

(Conservar el mismo `div`/clases que ya tiene ese bloque; solo cambia el texto.)

Si `esSemanaFutura` queda sin otro uso en `page.tsx`, quitarlo del import (verificar antes; `diaActual`/`esDiaPasado`/`fechasDeSemana`/`semanaActual` siguen).

- [ ] **Step 4: Renombrar el prop en `grilla-tractor.tsx`**

En `src/app/programar/grilla-tractor.tsx`, renombrar el prop `futura` → `programable`:
- Línea 19: `  futura,` → `  programable,`
- Línea 29: `  futura: boolean` → `  programable: boolean`
- Línea 76: `{futura && (` → `{programable && (`

(El call site en `page.tsx:239` ya pasa `programable={...}` tras el Step 3.)

- [ ] **Step 5: Verificar compilación y suite**

Run: `npx next build`
Expected: compila sin errores de tipos ni lint (ningún import huérfano; el prop `programable` casa en `page.tsx` y `grilla-tractor.tsx`).

Run: `npm test`
Expected: PASS (incluye los 6 nuevos de Task 1 y toda la regresión).

- [ ] **Step 6: Commit**

```bash
git add src/app/programar/acciones.ts src/app/tareas/acciones.ts src/app/programar/page.tsx src/app/programar/grilla-tractor.tsx
git commit -m "feat(programar): tope de programación hasta el lunes 11pm (UI + guards + /tareas)"
```

---

## Verificación final (post-deploy, con la usuaria)

No es paso de código: tras desplegar, confirmar en el navegador que en la **semana en curso** la grilla de programar está **editable el lunes antes de las 11 pm** y en **solo lectura** después (martes en adelante), y que las semanas futuras siguen editables. Igual para agendar una tarea desde /tareas.

## Notas de riesgo

- **Endurecimiento de crear/duplicar/asignar:** hoy permitían la semana en curso (solo bloqueaban semana pasada); ahora quedan topadas al lunes 23:00. No rompe flujos de UI (esas formas solo aparecían en semanas editables), y cierra un hueco de POST crafteado. Intencional.
- **Zona horaria:** el límite se calcula como `lunes 00:00 UTC + 5h + 23h`; correcto para Colombia UTC-5 sin DST, consistente con `aHoraColombia`.

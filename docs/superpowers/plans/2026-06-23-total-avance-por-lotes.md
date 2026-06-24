# Total de avance acotado a los lotes vigentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la medida total de una actividad con avances (en pantalla y en `haRealizada` al marcar cumplida) sume solo las entradas de los lotes vigentes (`a.lotes`), igual que el Excel y la lista "Avances:".

**Architecture:** Se reemplaza el helper `totalAvance(avance)` (suma todas las claves del JSON) por `totalAvanceLotes(lotes, avance)` (suma solo los lotes dados, mismo recorrido que `textoAvanceConFecha`/`filasCumplimiento`). Se actualizan los dos call sites (pantalla y repositorio) y se elimina `totalAvance`.

**Tech Stack:** Next.js (App Router, RSC), TypeScript, Prisma, Vitest.

## Global Constraints

- Sin migración de esquema (`avancePorLote` es JSON; se normaliza al leer con `normalizarAvancePorLote`).
- Comentarios en español.
- No cambiar el flujo de registro de avance; solo el cálculo del total (pantalla + cierre manual), acotándolo a los lotes vigentes.
- Cambio de comportamiento NULO con los flujos actuales (los lotes solo se agregan, nunca se quitan, así que no hay avances huérfanos hoy); es consistencia defensiva.
- Cada entrada de avance es `{ dia: number; maquinaId: string | null; cantidad: number }`; `AvancePorLote = Record<string, AvanceEntrada[]>`.

---

### Task 1: Dominio — `totalAvanceLotes` reemplaza a `totalAvance`

**Files:**
- Modify: `src/dominio/avance-lote.ts`
- Test: `src/dominio/avance-lote.test.ts`

**Interfaces:**
- Produces: `totalAvanceLotes(lotes: { id: string }[], avance: AvancePorLote | null | undefined): number`
- Removes: `totalAvance` (queda sin uso tras Tasks 2 y 3).

- [ ] **Step 1: Actualizar el test (que falla)**

En `src/dominio/avance-lote.test.ts`:

(a) En el import (líneas 2-5), cambiar `totalAvance` por `totalAvanceLotes`:

```ts
import {
  lotesPendientes, textoAvancePorLote, textoAvanceConFecha,
  normalizarAvancePorLote, totalAvanceLotes, agregarAvances, type AvancePorLote,
} from './avance-lote'
```

(b) Reemplazar **todo** el bloque `describe('totalAvance', () => { … })` por:

```ts
describe('totalAvanceLotes', () => {
  it('suma las cantidades de los lotes dados (todas sus entradas)', () => {
    expect(totalAvanceLotes(lotes, avance)).toBe(7) // a: 3+2, b: 2, c: sin avance
  })
  it('ignora entradas de lotes ausentes de la lista', () => {
    expect(totalAvanceLotes([{ id: 'a' }], avance)).toBe(5) // solo a (3+2); b se ignora
  })
  it('0 si no hay avance', () => {
    expect(totalAvanceLotes(lotes, null)).toBe(0)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- src/dominio/avance-lote.test.ts`
Expected: FALLA — `totalAvanceLotes` no existe (y `totalAvance` ya no se importa).

- [ ] **Step 3: Implementar `totalAvanceLotes` y borrar `totalAvance`**

En `src/dominio/avance-lote.ts`, reemplazar **todo** el bloque de `totalAvance` (la función `export function totalAvance(...) { … }` y su comentario) por:

```ts
// Suma de las cantidades de los avances, ACOTADA a los lotes dados (los
// vigentes de la actividad). Ignora entradas de lotes que ya no pertenecen.
// Mismo recorrido que textoAvanceConFecha/filasCumplimiento.
export function totalAvanceLotes(
  lotes: { id: string }[],
  avance: AvancePorLote | null | undefined,
): number {
  if (!avance) return 0
  let total = 0
  for (const l of lotes) {
    for (const e of avance[l.id] ?? []) total += e.cantidad
  }
  return total
}
```

- [ ] **Step 4: Correr la suite del archivo**

Run: `npm test -- src/dominio/avance-lote.test.ts`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/avance-lote.ts src/dominio/avance-lote.test.ts
git commit -m "feat(dominio): totalAvanceLotes (acota la suma a los lotes vigentes) reemplaza totalAvance"
```

> Nota: tras este commit, `repositorio.ts` y `page.tsx` NO compilan (aún llaman `totalAvance`). Lo arreglan las Tasks 2 y 3. `npx tsc` quedará en rojo hasta la Task 3; las pruebas del archivo sí pasan.

---

### Task 2: Repositorio — `marcarCumplidaDesdeParcial` acota al `act.lotes`

**Files:**
- Modify: `src/datos/repositorio.ts` (import línea 8; `marcarCumplidaDesdeParcial`)

**Interfaces:**
- Consumes: `totalAvanceLotes(lotes, avance)` (`@/dominio/avance-lote`).

- [ ] **Step 1: Cambiar el import**

En `src/datos/repositorio.ts` (línea 8), cambiar `totalAvance` por `totalAvanceLotes`:

```ts
import { normalizarAvancePorLote, agregarAvances, totalAvanceLotes, type AvanceEntrada } from '@/dominio/avance-lote'
```

- [ ] **Step 2: Cargar `lotes` y acotar la suma**

Reemplazar **toda** la función `marcarCumplidaDesdeParcial` por:

```ts
// Cierra manualmente un parcial: estado CUMPLIDA y medida realizada = suma de
// avances de los lotes vigentes. Conserva el historial. null si no está PARCIAL.
export async function marcarCumplidaDesdeParcial(actividadId: string) {
  const act = await prisma.actividad.findUnique({
    where: { id: actividadId },
    include: { lotes: { select: { id: true } } },
  })
  if (!act || act.estado !== 'PARCIAL') return null
  const avance = normalizarAvancePorLote(
    act.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
  )
  return prisma.actividad.update({
    where: { id: actividadId },
    data: { estado: 'CUMPLIDA', haRealizada: totalAvanceLotes(act.lotes, avance) },
  })
}
```

(Si el comentario previo de la función difiere, queda reemplazado por el de arriba.)

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/" ; echo "errores src: $(npx tsc --noEmit 2>&1 | grep -cE '^src/')"`
Expected: el único error restante en `src/` debe ser `src/app/cumplimiento/page.tsx` (aún llama `totalAvance`), que arregla la Task 3. `repositorio.ts` no debe aparecer.

- [ ] **Step 4: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(cumplimiento): marcarCumplidaDesdeParcial acota la medida a los lotes vigentes"
```

---

### Task 3: Pantalla — medida con `totalAvanceLotes`

**Files:**
- Modify: `src/app/cumplimiento/page.tsx` (import línea 10; uso ~266)

**Interfaces:**
- Consumes: `totalAvanceLotes(lotes, avance)` (`@/dominio/avance-lote`).

- [ ] **Step 1: Cambiar el import**

En `src/app/cumplimiento/page.tsx` (línea 10), cambiar `totalAvance` por `totalAvanceLotes`:

```ts
import { lotesPendientes, textoAvanceConFecha, normalizarAvancePorLote, totalAvanceLotes, type AvanceEntrada } from '@/dominio/avance-lote'
```

- [ ] **Step 2: Usar `totalAvanceLotes(a.lotes, avances)` en la medida**

En la línea de la medida (hoy `<span className="text-gray-500">· {tieneAvances ? totalAvance(avances) : a.haRealizada} {unidadAbreviada(unidad)}</span>`), cambiar `totalAvance(avances)` por `totalAvanceLotes(a.lotes, avances)`:

```tsx
                                  <span className="text-gray-500">· {tieneAvances ? totalAvanceLotes(a.lotes, avances) : a.haRealizada} {unidadAbreviada(unidad)}</span>
```

(El resto del branch no cambia. `tieneAvances` sigue calculándose como hoy: `Object.values(avances).some((es) => es.length > 0)`.)

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/" ; echo "errores src: $(npx tsc --noEmit 2>&1 | grep -cE '^src/')" && npm run lint`
Expected: `errores src: 0` y lint sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): medida en pantalla acotada a los lotes vigentes"
```

---

### Task 4: Suite completa + desplegar

**Files:** (ninguno — verificación)

- [ ] **Step 1: Suite + tipos + lint**

Run: `npm test && npx tsc --noEmit 2>&1 | grep -cE '^src/' && npm run lint`
Expected: pruebas PASAN; `0` errores en `src/`; lint limpio.

- [ ] **Step 2: Desplegar a producción**

Run: `timeout 540 npx vercel@latest --prod --yes --scope ayura-llanos`
Expected: `readyState: READY`, aliased a https://cronograma-ayura.vercel.app

- [ ] **Step 3: Smoke check**

Run: `curl -s -o /dev/null -w "HTTP %{http_code} en %{time_total}s\n" https://cronograma-ayura.vercel.app/`
Expected: HTTP 307 (redirección a login).

> No requiere verificación manual en navegador: el cambio es un no-op de comportamiento con los flujos actuales (sin avances huérfanos), y `totalAvanceLotes` queda cubierto por pruebas unitarias en la Task 1. La medida sigue mostrando la misma suma que hoy.

---

## Self-Review

**Cobertura del spec:**
- Helper `totalAvanceLotes` acotado a lotes → Task 1. ✅
- Reemplazo en pantalla → Task 3. ✅
- Reemplazo en `marcarCumplidaDesdeParcial` + cargar `act.lotes` → Task 2. ✅
- Eliminar `totalAvance` + migrar sus pruebas → Task 1. ✅

**Placeholder scan:** sin TBD/TODO; código completo en cada paso.

**Type consistency:** `totalAvanceLotes(lotes: { id: string }[], avance)` — firma idéntica en Task 1 (definición), Task 2 (`act.lotes`) y Task 3 (`a.lotes`). `act.lotes` disponible por el `include: { lotes: { select: { id: true } } }` agregado en Task 2. `tieneAvances` (page.tsx) sin cambios.

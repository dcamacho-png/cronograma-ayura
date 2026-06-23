# Varios avances por parcial + marcar cumplida a mano Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir registrar varios avances (historial por día/lote) en una actividad PARCIAL y cerrarla manualmente con un botón, fijando la medida realizada = suma de los avances.

**Architecture:** El JSON `avancePorLote` pasa de un objeto por lote a una **lista por lote** (historial). Toda la lógica vive en helpers puros de `src/dominio/avance-lote.ts` (normalización tolerante al formato viejo, suma, agregado, formato). El repositorio agrega entradas y expone el cierre manual; la UI muestra el formulario siempre (todos los lotes) y un botón "✓ Marcar cumplida".

**Tech Stack:** Next.js (App Router, RSC, server actions), TypeScript, Prisma, Vitest.

## Global Constraints

- **Acumulación:** cada avance es lo avanzado **ese día** (incremental); se guardan **todos**. Total del lote = suma; total de la actividad = suma de todas las entradas.
- **`avancePorLote` es JSON** (`Actividad.avancePorLote Json?`) → **sin migración de esquema**. Compatibilidad con el formato viejo (`Record<loteId, AvanceEntrada>`) vía normalización al leer.
- **Cierre manual:** botón "✓ Marcar cumplida" → `estado='CUMPLIDA'`, `haRealizada = suma de avances`. No toca `avancePorLote`.
- **Formulario de avance siempre disponible** y ofrece **todos los lotes** de la actividad.
- **El total no se asume mientras está PARCIAL** (solo se muestran avances acumulados).
- No cambiar el modelo de filas-día, la programación, ni el conteo de actividades (cambio aparte).
- Comentarios en español; color de marca `#11603a`.
- `registrarAvanceLote` ya deja la actividad en PARCIAL (no auto-CUMPLIDA); se conserva.

---

### Task 1: Dominio — lista de avances por lote (tipo, normalización, helpers)

**Files:**
- Modify: `src/dominio/avance-lote.ts`
- Test: `src/dominio/avance-lote.test.ts` (reemplazo completo)

**Interfaces:**
- Produces:
  - `type AvanceEntrada = { dia: number; maquinaId: string | null; cantidad: number }`
  - `type AvancePorLote = Record<string, AvanceEntrada[]>`
  - `normalizarAvancePorLote(raw): AvancePorLote`
  - `lotesPendientes<T extends {id:string}>(lotes, avance): T[]`
  - `textoAvancePorLote(lotes, avance): string`
  - `textoAvanceConFecha(lotes, avance, unidadAbrev, etiquetaDia): string`
  - `totalAvance(avance): number`
  - `agregarAvances(avance, dia, maquinaId, entradas): AvancePorLote`

- [ ] **Step 1: Reemplazar el archivo de pruebas (que falla)**

Reemplazar **todo** el contenido de `src/dominio/avance-lote.test.ts` por:

```ts
import { describe, it, expect } from 'vitest'
import {
  lotesPendientes, textoAvancePorLote, textoAvanceConFecha,
  normalizarAvancePorLote, totalAvance, agregarAvances, type AvancePorLote,
} from './avance-lote'

const lotes = [{ id: 'a', nombre: 'L-A' }, { id: 'b', nombre: 'L-B' }, { id: 'c', nombre: 'L-C' }]
// Forma nueva: lista por lote. L-A con dos avances (lun 3, mar 2), L-B con uno (mar 2).
const avance: AvancePorLote = {
  a: [{ dia: 1, maquinaId: null, cantidad: 3 }, { dia: 2, maquinaId: null, cantidad: 2 }],
  b: [{ dia: 2, maquinaId: 'm1', cantidad: 2 }],
}

describe('normalizarAvancePorLote', () => {
  it('envuelve la forma vieja (un objeto por lote) en lista', () => {
    const viejo = { a: { dia: 1, maquinaId: null, cantidad: 3 } }
    expect(normalizarAvancePorLote(viejo)).toEqual({ a: [{ dia: 1, maquinaId: null, cantidad: 3 }] })
  })
  it('deja intacta la forma nueva (lista)', () => {
    expect(normalizarAvancePorLote(avance)).toEqual(avance)
  })
  it('null/undefined -> {}', () => {
    expect(normalizarAvancePorLote(null)).toEqual({})
    expect(normalizarAvancePorLote(undefined)).toEqual({})
  })
})

describe('lotesPendientes', () => {
  it('devuelve los lotes sin ninguna entrada', () => {
    expect(lotesPendientes(lotes, avance).map((l) => l.id)).toEqual(['c'])
  })
  it('sin avance devuelve todos', () => {
    expect(lotesPendientes(lotes, null).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('textoAvancePorLote', () => {
  it('lista la SUMA por lote con avance, en orden', () => {
    expect(textoAvancePorLote(lotes, avance)).toBe('L-A: 5, L-B: 2')
  })
  it('vacío si no hay avance', () => {
    expect(textoAvancePorLote(lotes, null)).toBe('')
  })
})

describe('textoAvanceConFecha', () => {
  it('arma una entrada por cada avance (varias por lote), en orden lote→día', () => {
    expect(textoAvanceConFecha(lotes, avance, 'ha', (d) => `D${d}`))
      .toBe('D1 · L-A — 3 ha; D2 · L-A — 2 ha; D2 · L-B — 2 ha')
  })
  it('vacío si no hay avance', () => {
    expect(textoAvanceConFecha([{ id: 'a', nombre: 'L-A' }], null, 'ha', (d) => `D${d}`)).toBe('')
  })
})

describe('totalAvance', () => {
  it('suma todas las cantidades de todas las entradas', () => {
    expect(totalAvance(avance)).toBe(7)
  })
  it('0 si no hay avance', () => {
    expect(totalAvance(null)).toBe(0)
  })
})

describe('agregarAvances', () => {
  it('agrega una entrada nueva a la lista del lote (sin mutar la entrada original)', () => {
    const base: AvancePorLote = { a: [{ dia: 1, maquinaId: null, cantidad: 3 }] }
    const out = agregarAvances(base, 2, 'm1', [{ loteId: 'a', cantidad: 2 }, { loteId: 'b', cantidad: 4 }])
    expect(out).toEqual({
      a: [{ dia: 1, maquinaId: null, cantidad: 3 }, { dia: 2, maquinaId: 'm1', cantidad: 2 }],
      b: [{ dia: 2, maquinaId: 'm1', cantidad: 4 }],
    })
    expect(base).toEqual({ a: [{ dia: 1, maquinaId: null, cantidad: 3 }] }) // intacto
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- src/dominio/avance-lote.test.ts`
Expected: FALLA — el tipo es objeto-por-lote y faltan `normalizarAvancePorLote`, `totalAvance`, `agregarAvances`.

- [ ] **Step 3: Reescribir `avance-lote.ts`**

Reemplazar **todo** el contenido de `src/dominio/avance-lote.ts` por:

```ts
// Un avance puntual de un lote en un día (cantidad incremental de ese día).
export type AvanceEntrada = { dia: number; maquinaId: string | null; cantidad: number }
// Historial de avances por lote: una lista de entradas por cada loteId.
export type AvancePorLote = Record<string, AvanceEntrada[]>

// Normaliza el JSON guardado: acepta la forma vieja (un objeto por lote) y la
// nueva (lista por lote); devuelve siempre la nueva. Un valor que no es arreglo
// se envuelve en [valor].
export function normalizarAvancePorLote(
  raw: Record<string, AvanceEntrada | AvanceEntrada[]> | null | undefined,
): AvancePorLote {
  if (!raw) return {}
  const out: AvancePorLote = {}
  for (const [loteId, v] of Object.entries(raw)) {
    out[loteId] = Array.isArray(v) ? v : [v]
  }
  return out
}

// Lotes de la actividad que aún no tienen ninguna entrada de avance.
export function lotesPendientes<T extends { id: string }>(
  lotes: T[],
  avance: AvancePorLote | null | undefined,
): T[] {
  if (!avance) return lotes
  return lotes.filter((l) => !(l.id in avance) || avance[l.id].length === 0)
}

// Texto "L-A: 5, L-B: 2" con la SUMA por lote, en el orden dado.
export function textoAvancePorLote(
  lotes: { id: string; nombre: string }[],
  avance: AvancePorLote | null | undefined,
): string {
  if (!avance) return ''
  return lotes
    .filter((l) => l.id in avance && avance[l.id].length > 0)
    .map((l) => `${l.nombre}: ${avance[l.id].reduce((s, e) => s + e.cantidad, 0)}`)
    .join(', ')
}

// Resumen con fecha: una entrada por cada avance "<etiquetaDia> · <lote> — <cantidad> <unidad>",
// recorriendo los lotes en orden y, dentro de cada lote, sus entradas en orden.
// `etiquetaDia` traduce el día (1..7) a su etiqueta; se inyecta para mantener el helper puro.
export function textoAvanceConFecha(
  lotes: { id: string; nombre: string }[],
  avance: AvancePorLote | null | undefined,
  unidadAbrev: string,
  etiquetaDia: (dia: number) => string,
): string {
  if (!avance) return ''
  const partes: string[] = []
  for (const l of lotes) {
    for (const e of avance[l.id] ?? []) {
      partes.push(`${etiquetaDia(e.dia)} · ${l.nombre} — ${e.cantidad} ${unidadAbrev}`)
    }
  }
  return partes.join('; ')
}

// Suma de todas las cantidades de todas las entradas (total de la actividad).
export function totalAvance(avance: AvancePorLote | null | undefined): number {
  if (!avance) return 0
  let total = 0
  for (const entradas of Object.values(avance)) {
    for (const e of entradas) total += e.cantidad
  }
  return total
}

// Devuelve una copia de `avance` con una entrada nueva agregada a cada lote indicado.
// No muta la entrada recibida.
export function agregarAvances(
  avance: AvancePorLote,
  dia: number,
  maquinaId: string | null,
  entradas: { loteId: string; cantidad: number }[],
): AvancePorLote {
  const out: AvancePorLote = { ...avance }
  for (const { loteId, cantidad } of entradas) {
    out[loteId] = [...(out[loteId] ?? []), { dia, maquinaId, cantidad }]
  }
  return out
}
```

- [ ] **Step 4: Correr la suite**

Run: `npm test -- src/dominio/avance-lote.test.ts`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/avance-lote.ts src/dominio/avance-lote.test.ts
git commit -m "feat(dominio): avancePorLote como lista por lote (historial) + helpers"
```

> Nota: tras este commit, `page.tsx`, `exportar/route.ts` y `repositorio.ts` aún usan la forma vieja en runtime, pero **compilan** (castean a `AvancePorLote`). Las siguientes tareas los actualizan. No se despliega hasta terminar el plan.

---

### Task 2: Repositorio — agregar avances + cierre manual

**Files:**
- Modify: `src/datos/repositorio.ts` (`registrarAvanceLote` ~473-495; agregar `marcarCumplidaDesdeParcial`)

**Interfaces:**
- Consumes: `normalizarAvancePorLote`, `agregarAvances`, `totalAvance` (`@/dominio/avance-lote`).
- Produces: `marcarCumplidaDesdeParcial(actividadId: string)`.

- [ ] **Step 1: Importar los helpers**

En `src/datos/repositorio.ts`, agregar (junto a los imports existentes):

```ts
import { normalizarAvancePorLote, agregarAvances, totalAvance, type AvanceEntrada } from '@/dominio/avance-lote'
```

- [ ] **Step 2: Reescribir `registrarAvanceLote` para que agregue (no sobrescriba)**

Reemplazar el cuerpo actual (desde `const actual = ...` hasta el `return prisma.actividad.update(...)`):

```ts
  const actual = agregarAvances(
    normalizarAvancePorLote(act.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
    dia,
    maquinaId,
    avances.map((a) => ({ loteId: a.loteId, cantidad: a.cantidad })),
  )
  // Registrar avance nunca cierra la actividad: queda siempre PARCIAL.
  // CUMPLIDA se marca a mano cuando el trabajo realmente se completó.
  return prisma.actividad.update({
    where: { id: actividadId },
    data: {
      avancePorLote: actual as Prisma.InputJsonValue,
      estado: 'PARCIAL',
    },
  })
```

(Se conserva el guard previo `if (act.estado !== 'PARCIAL') return null` y la firma de la función.)

- [ ] **Step 3: Agregar `marcarCumplidaDesdeParcial`**

Después de `registrarAvanceLote`, agregar:

```ts
// Cierra manualmente un parcial: estado CUMPLIDA y medida realizada = suma de avances.
// Conserva el historial de avances. Devuelve null si la actividad no está PARCIAL.
export async function marcarCumplidaDesdeParcial(actividadId: string) {
  const act = await prisma.actividad.findUnique({ where: { id: actividadId } })
  if (!act || act.estado !== 'PARCIAL') return null
  const avance = normalizarAvancePorLote(
    act.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
  )
  return prisma.actividad.update({
    where: { id: actividadId },
    data: { estado: 'CUMPLIDA', haRealizada: totalAvance(avance) },
  })
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/`.

- [ ] **Step 5: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(cumplimiento): registrarAvanceLote agrega al historial + marcarCumplidaDesdeParcial"
```

---

### Task 3: Acción de servidor para marcar cumplida

**Files:**
- Modify: `src/app/cumplimiento/acciones.ts`

**Interfaces:**
- Consumes: `marcarCumplidaDesdeParcial` (`@/datos/repositorio`).
- Produces: `marcarCumplidaParcialAccion(form: FormData)`.

- [ ] **Step 1: Importar la función del repo**

En `src/app/cumplimiento/acciones.ts`, agregar `marcarCumplidaDesdeParcial` al import desde `@/datos/repositorio` (que ya importa `registrarAvanceLote`, `devolverAlBanco`, etc.).

- [ ] **Step 2: Agregar la acción**

Junto a `devolverAlBancoAccion`:

```ts
export async function marcarCumplidaParcialAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  await marcarCumplidaDesdeParcial(id)
  revalidatePath('/cumplimiento')
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores en `src/`.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): acción marcarCumplidaParcialAccion"
```

---

### Task 4: `FormAvanceLote` ofrece todos los lotes

**Files:**
- Modify: `src/app/cumplimiento/form-avance-lote.tsx`

**Interfaces:**
- Produces: prop `lotes` (renombrada desde `pendientes`).

- [ ] **Step 1: Renombrar la prop `pendientes` → `lotes`**

En `src/app/cumplimiento/form-avance-lote.tsx`:

(a) En el tipo de props, cambiar `pendientes: { id: string; nombre: string }[]` por `lotes: { id: string; nombre: string }[]`.

(b) En la desestructuración de props, cambiar `pendientes,` por `lotes,`.

(c) En el `.map` de los lotes (hoy `{pendientes.map((l) => (`), cambiar a `{lotes.map((l) => (`.

(El resto del componente —día, máquina, checkbox `loteAvance`, input `cantidad_<id>`, botones— no cambia.)

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: error esperado en `page.tsx` (aún pasa `pendientes=`) — se corrige en Task 5. El propio `form-avance-lote.tsx` no debe tener errores. (Si el flujo exige verde aquí, este check pasa a verde tras Task 5.)

- [ ] **Step 3: Commit**

```bash
git add src/app/cumplimiento/form-avance-lote.tsx
git commit -m "feat(cumplimiento): FormAvanceLote recibe todos los lotes (prop lotes)"
```

---

### Task 5: Página del parcial — formulario siempre + marcar cumplida

**Files:**
- Modify: `src/app/cumplimiento/page.tsx` (imports; sección PARCIAL ~273-303)

**Interfaces:**
- Consumes: `normalizarAvancePorLote`, `textoAvanceConFecha`, `lotesPendientes`, `type AvanceEntrada` (`@/dominio/avance-lote`); `marcarCumplidaParcialAccion` (`./acciones`); `FormAvanceLote` (prop `lotes`).

- [ ] **Step 1: Ajustar imports**

En `src/app/cumplimiento/page.tsx`:

(a) En el import de `@/dominio/avance-lote` (hoy `import { lotesPendientes, textoAvanceConFecha, type AvancePorLote } from '@/dominio/avance-lote'`), dejarlo:

```ts
import { lotesPendientes, textoAvanceConFecha, normalizarAvancePorLote, type AvanceEntrada } from '@/dominio/avance-lote'
```

(b) Agregar `marcarCumplidaParcialAccion` al import desde `./acciones` (que ya trae `registrarAvanceLoteAccion`, `devolverAlBancoAccion`, etc.).

- [ ] **Step 2: Reemplazar la sección PARCIAL**

Reemplazar el bloque `{a.estado === 'PARCIAL' && ( … )}` (líneas ~273-303) por:

```tsx
                              {a.estado === 'PARCIAL' && (() => {
                                const avances = normalizarAvancePorLote(
                                  a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
                                )
                                const etiquetaDia = (dia: number) =>
                                  `${DIAS[dia] ?? ''} ${fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}`.trim()
                                const resumenAvances = textoAvanceConFecha(a.lotes, avances, unidadAbreviada(unidad), etiquetaDia)
                                return (
                                <div className="mt-1 flex w-full flex-col gap-1 text-sm">
                                  {a.lotes.length > 0 && (
                                    <span className="text-gray-600">
                                      Progreso: {a.lotes.length - lotesPendientes(a.lotes, avances).length} de {a.lotes.length} lotes
                                    </span>
                                  )}
                                  {resumenAvances && (
                                    <span className="text-gray-600">Avances: {resumenAvances}</span>
                                  )}
                                  <div className="flex flex-wrap items-center gap-2">
                                    {a.lotes.length > 0 && (
                                      <FormAvanceLote
                                        actividadId={a.id}
                                        diaActividad={a.dia}
                                        esMaquinaria={esMaquinaria}
                                        maquinas={maquinas}
                                        unidad={unidad}
                                        lotes={a.lotes}
                                        accion={registrarAvanceLoteAccion}
                                      />
                                    )}
                                    <form action={marcarCumplidaParcialAccion}>
                                      <input type="hidden" name="id" value={a.id} />
                                      <button className="rounded border border-[#11603a] px-2 py-1 text-xs font-semibold text-[#11603a] hover:bg-green-50">✓ Marcar cumplida</button>
                                    </form>
                                    <form action={devolverAlBancoAccion}>
                                      <input type="hidden" name="id" value={a.id} />
                                      <button className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Devolver al banco</button>
                                    </form>
                                  </div>
                                </div>
                                )
                              })()}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores en `src/`. No debe quedar referencia a `AvancePorLote` colgante en `page.tsx` (se quitó del import); si `tsc` la marca, revisá que no haya otro uso.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): formulario de avance siempre visible + botón marcar cumplida"
```

---

### Task 6: Export normaliza el avance + verificación de métricas

**Files:**
- Modify: `src/app/cumplimiento/exportar/route.ts`
- Test: `src/dominio/metricas.test.ts` (agregar caso de `fraccionFila` con lista)

**Interfaces:**
- Consumes: `normalizarAvancePorLote`, `type AvanceEntrada` (`@/dominio/avance-lote`); `fraccionFila` (`@/dominio/metricas`).

- [ ] **Step 1: Normalizar antes de `textoAvanceConFecha` en la ruta**

En `src/app/cumplimiento/exportar/route.ts`:

(a) En el import de `@/dominio/avance-lote` (hoy `import { textoAvanceConFecha, type AvancePorLote } from '@/dominio/avance-lote'`), dejarlo:

```ts
import { textoAvanceConFecha, normalizarAvancePorLote, type AvanceEntrada } from '@/dominio/avance-lote'
```

(b) En la línea que calcula `avanceTexto` (hoy `const avanceTexto = textoAvanceConFecha(a.lotes, a.avancePorLote as AvancePorLote | null, unidadAbrev, etiquetaDia)`), cambiarla por:

```ts
    const avanceTexto = textoAvanceConFecha(
      a.lotes,
      normalizarAvancePorLote(a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
      unidadAbrev,
      etiquetaDia,
    )
```

- [ ] **Step 2: Agregar prueba de `fraccionFila` con avance en forma de lista**

En `src/dominio/metricas.test.ts`, agregar (en el bloque que prueba `fraccionFila`, o uno nuevo):

```ts
describe('fraccionFila con avancePorLote en lista', () => {
  it('cuenta como hecho cada lote que tenga clave (lista de entradas)', () => {
    const fila = {
      estado: 'PARCIAL' as const,
      lotes: [{ id: 'a' }, { id: 'b' }],
      avancePorLote: { a: [{ dia: 1, maquinaId: null, cantidad: 3 }] },
    }
    expect(fraccionFila(fila)).toBe(0.5) // 1 de 2 lotes con avance
  })
})
```

(Asegurar que `fraccionFila` esté importado en el test; si no, agregarlo al import de `./metricas`.)

- [ ] **Step 3: Correr la suite y verificar tipos/lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: PASA (incluye export y métricas) y sin errores en `src/`. El test existente de `cumplimiento-export` (que pasa un texto de avance pre-formateado) sigue verde sin cambios.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/exportar/route.ts src/dominio/metricas.test.ts
git commit -m "feat(excel): normaliza avance en export + prueba de fraccionFila con lista"
```

- [ ] **Step 5: Verificación manual (producción tras desplegar)**

En `/cumplimiento`, un parcial: (a) "Registrar avance" sigue disponible aun cuando todos los lotes tengan avance; (b) registrar dos avances del mismo lote en días distintos muestra ambas entradas en "Avances:"; (c) "✓ Marcar cumplida" pasa la actividad a Cumplida con medida = suma de avances; (d) el Excel lista las entradas en "Avance por lote".

---

## Self-Review

**Spec coverage:**
- Lista por lote + normalización del formato viejo → Task 1. ✅
- `registrarAvanceLote` agrega (no sobrescribe) → Task 2. ✅
- Cierre manual con medida = suma → Task 2 (`marcarCumplidaDesdeParcial`) + Task 3 (acción) + Task 5 (botón). ✅
- Formulario siempre disponible con todos los lotes → Task 4 (prop) + Task 5 (condición). ✅
- "Avances:" lista varias entradas; Excel igual → Task 1 (helper) + Task 5 (tarjeta) + Task 6 (ruta). ✅
- `fraccionFila` sigue válido con la lista → Task 6 (prueba). ✅
- No tocar modelo de filas-día/programación/conteo → ninguna task los toca. ✅

**Placeholder scan:** sin TBD/TODO; código completo en cada paso.

**Type consistency:** `AvancePorLote = Record<string, AvanceEntrada[]>` y `AvanceEntrada` definidos en Task 1 y consumidos con la misma forma en Tasks 2, 5, 6. `normalizarAvancePorLote(raw)` recibe `Record<string, AvanceEntrada | AvanceEntrada[]> | null` en todos los call sites (repo, page, route). `marcarCumplidaDesdeParcial(id)` (Task 2) ↔ `marcarCumplidaParcialAccion` (Task 3) ↔ botón (Task 5). `FormAvanceLote` prop `lotes` (Task 4) ↔ uso `lotes={a.lotes}` (Task 5).

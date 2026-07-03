# Parcial: continuar la próxima semana + editar novedad en Parcial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar la novedad de una actividad ya en PARCIAL y "continuar" su parte pendiente en la semana siguiente con un botón explícito.

**Architecture:** Un helper puro (`lotesPendientes`) detecta los potreros sin avance; una función de repo crea la actividad-continuación en la semana siguiente (PENDIENTE, solo potreros pendientes, idempotente por `origenId`); una server action la expone; la UI de `/cumplimiento` muestra el botón de novedad también en Parcial (precargado) y el nuevo botón "Continuar la próxima semana".

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma/Postgres, React 19, Vitest, TypeScript.

## Global Constraints

- Esta versión de Next.js tiene diferencias con el conocimiento previo; ante dudas de API, leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json` (el `tsc` normal da falso-verde por `.next`).
- Tailwind v4: clases de componente con `@utility`, no `@layer components` (no aplica aquí, no se toca CSS).
- Clases y estilos: reutilizar las existentes (`rounded-lg border border-borde bg-marfil …`, `text-tierra`, etc.).
- Commits frecuentes; mensajes en español, terminados con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Helper `lotesPendientes`

**Files:**
- Modify: `src/dominio/avance-lote.ts`
- Test: `src/dominio/avance-lote.test.ts`

**Interfaces:**
- Consumes: tipos `AvancePorLote`, `normalizarAvancePorLote` (ya en el archivo).
- Produces: `lotesPendientes<T extends { id: string }>(lotes: T[], avance: Record<string, AvanceEntrada | AvanceEntrada[]> | null | undefined): T[]` — devuelve los lotes cuyo `avancePorLote` no tiene ninguna entrada con `cantidad > 0`.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/dominio/avance-lote.test.ts`:

```typescript
import { lotesPendientes } from './avance-lote'

describe('lotesPendientes', () => {
  const lotes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('sin avances: todos pendientes', () => {
    expect(lotesPendientes(lotes, null).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })

  it('un lote con cantidad > 0 deja de ser pendiente', () => {
    const av = { a: [{ dia: 1, maquinaId: null, cantidad: 5 }] }
    expect(lotesPendientes(lotes, av).map((l) => l.id)).toEqual(['b', 'c'])
  })

  it('entrada con cantidad 0 sigue pendiente', () => {
    const av = { a: [{ dia: 1, maquinaId: null, cantidad: 0 }] }
    expect(lotesPendientes(lotes, av).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })

  it('acepta la forma vieja (objeto por lote)', () => {
    const av = { b: { dia: 2, maquinaId: null, cantidad: 3 } }
    expect(lotesPendientes(lotes, av).map((l) => l.id)).toEqual(['a', 'c'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dominio/avance-lote.test.ts`
Expected: FAIL — `lotesPendientes is not a function` / no exportado.

- [ ] **Step 3: Write minimal implementation**

Añadir a `src/dominio/avance-lote.ts` (después de `normalizarAvancePorLote`):

```typescript
// Lotes "pendientes": los que no tienen ninguna entrada de avance con cantidad > 0.
export function lotesPendientes<T extends { id: string }>(
  lotes: T[],
  avance: Record<string, AvanceEntrada | AvanceEntrada[]> | null | undefined,
): T[] {
  const av = normalizarAvancePorLote(avance)
  return lotes.filter((l) => !(av[l.id] ?? []).some((e) => e.cantidad > 0))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dominio/avance-lote.test.ts`
Expected: PASS (todas).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/avance-lote.ts src/dominio/avance-lote.test.ts
git commit -m "feat(dominio): helper lotesPendientes (lotes sin avance)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Repo `continuarParcialSemanaSiguiente`

**Files:**
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Consumes: `lotesPendientes` (Task 1), `normalizarAvancePorLote` (ya importado), `siguienteSemana` (de `@/dominio/semana`), `Prisma`, `prisma`.
- Produces: `continuarParcialSemanaSiguiente(actividadId: string): Promise<Actividad | null>` — crea la continuación en la semana siguiente (PENDIENTE, solo potreros pendientes) y la devuelve; `null` si no existe, no es PARCIAL, o no hay nada pendiente; idempotente por `origenId`.

- [ ] **Step 1: Add the import**

En `src/datos/repositorio.ts`, junto a los imports de dominio existentes, añadir:

```typescript
import { siguienteSemana } from '@/dominio/semana'
import { lotesPendientes } from '@/dominio/avance-lote'
```

Verificar que `normalizarAvancePorLote` ya esté importado (se usa en `marcarCumplidaGrupo`); si no, añadirlo al import de `@/dominio/avance-lote`.

- [ ] **Step 2: Add the function**

Insertar después de `devolverAlBanco` (≈ l.567) en `src/datos/repositorio.ts`:

```typescript
// Continúa una actividad PARCIAL en la semana siguiente: crea una actividad nueva
// (PENDIENTE) con SOLO los potreros pendientes (sin avance). No toca la parcial
// original (queda como histórico). No se enlaza al banco (sin tareaId), como la
// reprogramación. Idempotente: si ya se continuó (origenId), devuelve esa.
export async function continuarParcialSemanaSiguiente(actividadId: string) {
  const base = await prisma.actividad.findUnique({
    where: { id: actividadId },
    include: { lotes: true },
  })
  if (!base || base.estado !== 'PARCIAL') return null

  const ya = await prisma.actividad.findFirst({ where: { origenId: base.id } })
  if (ya) return ya

  const pendientes = lotesPendientes(
    base.lotes,
    base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
  )
  // Si maneja potreros y no queda ninguno pendiente, no hay qué continuar.
  if (base.lotes.length > 0 && pendientes.length === 0) return null

  let fincaId = base.fincaId
  if (pendientes.length > 0) {
    const primer = await prisma.lote.findUnique({ where: { id: pendientes[0].id } })
    fincaId = primer?.fincaId ?? base.fincaId
  }

  const sig = siguienteSemana(base.anio, base.semana)

  const bultos = base.bultosPorLote as Record<string, number> | null
  const bultosPend = bultos
    ? Object.fromEntries(pendientes.filter((l) => l.id in bultos).map((l) => [l.id, bultos[l.id]]))
    : null

  return prisma.actividad.create({
    data: {
      anio: sig.anio,
      semana: sig.semana,
      dia: base.dia,
      descripcion: base.descripcion,
      turno: base.turno,
      estado: 'PENDIENTE',
      areaId: base.areaId,
      fincaId,
      responsableId: base.responsableId,
      maquinaId: base.maquinaId,
      areaTareaId: base.areaTareaId,
      horas: base.horas,
      origenId: base.id,
      vecesReprogramada: base.vecesReprogramada + 1,
      ...(base.unidadRealizada ? { unidadRealizada: base.unidadRealizada } : {}),
      ...(pendientes.length ? { lotes: { connect: pendientes.map((l) => ({ id: l.id })) } } : {}),
      ...(bultosPend && Object.keys(bultosPend).length ? { bultosPorLote: bultosPend as Prisma.InputJsonValue } : {}),
    },
  })
}
```

Nota: `AvanceEntrada` debe estar importado de `@/dominio/avance-lote` en este archivo (se usa ya en `marcarCumplidaGrupo`); si no lo está, añadirlo al import.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(repo): continuarParcialSemanaSiguiente (potreros pendientes a la semana siguiente)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Server action `continuarParcialAccion`

**Files:**
- Modify: `src/app/cumplimiento/acciones.ts`

**Interfaces:**
- Consumes: `continuarParcialSemanaSiguiente` (Task 2), helpers locales `texto`, `bloqueadoPorPlazoActividad`, `revalidatePath`.
- Produces: `continuarParcialAccion(form: FormData): Promise<void>`.

- [ ] **Step 1: Add to the repo import**

En `src/app/cumplimiento/acciones.ts`, añadir `continuarParcialSemanaSiguiente` a la lista importada de `@/datos/repositorio`.

- [ ] **Step 2: Add the action**

Añadir (p. ej. después de `registrarNovedadActividadAccion`):

```typescript
export async function continuarParcialAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await continuarParcialSemanaSiguiente(id)
  revalidatePath('/cumplimiento')
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): accion continuarParcialAccion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `FormRegistrar` acepta valores iniciales (editar novedad)

**Files:**
- Modify: `src/app/cumplimiento/form-registrar.tsx`

**Interfaces:**
- Produces: `FormRegistrar` con props opcionales `estadoInicial?: string`, `motivoInicial?: string`, `notaInicial?: string` (defaults `''`), usados como valores iniciales de estado/motivo/observación.

- [ ] **Step 1: Add props to the type and destructuring**

En el objeto de props de `FormRegistrar`, añadir tras `unidadActual`:

```typescript
  estadoInicial = '',
  motivoInicial = '',
  notaInicial = '',
```

y en el bloque de tipos (donde está `unidadActual?: string | null`):

```typescript
  estadoInicial?: string
  motivoInicial?: string
  notaInicial?: string
```

- [ ] **Step 2: Use them as initial state**

Cambiar:

```typescript
  const [estado, setEstado] = useState('')
  const [motivoId, setMotivoId] = useState('')
```

por:

```typescript
  const [estado, setEstado] = useState(estadoInicial)
  const [motivoId, setMotivoId] = useState(motivoInicial)
```

Y el input de nota (label "Observación / lo que faltó"): añadir `defaultValue={notaInicial}`:

```tsx
        <input name="nota" defaultValue={notaInicial} placeholder="(para parcial o reprogramada)" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores (props opcionales, callers sin cambios siguen compilando).

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/form-registrar.tsx
git commit -m "feat(cumplimiento): FormRegistrar acepta estado/motivo/nota iniciales

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: UI — novedad en Parcial + botón "Continuar la próxima semana"

**Files:**
- Modify: `src/app/cumplimiento/actividad-estandar.tsx`
- Modify: `src/app/cumplimiento/actividad-maquinaria.tsx`
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `continuarParcialAccion` (Task 3); `FormRegistrar` initial-value props (Task 4); `lotesPendientes` (Task 1); `avances` y `cab` (ya en scope en `page.tsx`).
- Produces: `ActividadEstandar`/`ActividadMaquinaria` con nuevos props `motivoActualId: string | null`, `puedeContinuar: boolean`, `continuar: (f: FormData) => void | Promise<void>`.

- [ ] **Step 1: `ActividadEstandar` — props + botones**

En `src/app/cumplimiento/actividad-estandar.tsx`:

1. En el destructuring y su tipo, añadir: `motivoActualId`, `puedeContinuar`, `continuar`.
   - Tipos: `motivoActualId: string | null`, `puedeContinuar: boolean`, `continuar: (f: FormData) => void | Promise<void>`.
2. Pasar los iniciales al `FormRegistrar` (dentro del `if (novedad)`), añadiendo:

```tsx
          estadoInicial={estado}
          motivoInicial={motivoActualId ?? ''}
          notaInicial={nota ?? ''}
```

3. En la barra de botones inferior, reemplazar el bloque:

```tsx
        {!esParcial && (
          <button type="button" onClick={() => setNovedad(true)} className="text-xs text-tierra underline">registrar novedad</button>
        )}
```

por (botón visible siempre + botón continuar en parcial):

```tsx
        <button type="button" onClick={() => setNovedad(true)} className="text-xs text-tierra underline">
          {esParcial ? 'registrar/editar novedad' : 'registrar novedad'}
        </button>
        {esParcial && puedeContinuar && (
          <form action={continuar}>
            <input type="hidden" name="id" value={actividadId} />
            <button className="rounded-lg border border-bosque px-2 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">Continuar la próxima semana</button>
          </form>
        )}
```

- [ ] **Step 2: `ActividadMaquinaria` — props + botones**

En `src/app/cumplimiento/actividad-maquinaria.tsx`, aplicar lo mismo. Nota: este componente **no** tiene aún prop `nota` — hay que añadirlo.
1. Añadir al destructuring y su tipo: `nota: string | null`, `motivoActualId: string | null`, `puedeContinuar: boolean`, `continuar: (f: FormData) => void | Promise<void>`.
2. En el `FormRegistrar` (dentro de `if (novedad)`), añadir:

```tsx
          estadoInicial={estado}
          motivoInicial={motivoActualId ?? ''}
          notaInicial={nota ?? ''}
```

3. Reemplazar el bloque:

```tsx
        {!esParcial && (
          <button type="button" onClick={() => setNovedad(true)} className="text-xs text-tierra underline">registrar novedad</button>
        )}
```

por (igual que en el estándar):

```tsx
        <button type="button" onClick={() => setNovedad(true)} className="text-xs text-tierra underline">
          {esParcial ? 'registrar/editar novedad' : 'registrar novedad'}
        </button>
        {esParcial && puedeContinuar && (
          <form action={continuar}>
            <input type="hidden" name="id" value={actividadId} />
            <button className="rounded-lg border border-bosque px-2 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">Continuar la próxima semana</button>
          </form>
        )}
```

- [ ] **Step 3: `page.tsx` — importar acción, calcular `puedeContinuar`, pasar props**

En `src/app/cumplimiento/page.tsx`:

1. Añadir `continuarParcialAccion` al import de `./acciones` y `lotesPendientes` al import de `@/dominio/avance-lote`.
2. Dentro del IIFE que ya define `avances` (≈ l.219-229), añadir:

```tsx
                  const puedeContinuar =
                    estadoGrupo === 'PARCIAL' &&
                    (cab.lotes.length === 0 || lotesPendientes(cab.lotes, avances).length > 0)
```

3. En `<ActividadMaquinaria …>` y `<ActividadEstandar …>`, añadir estas props:

```tsx
                            motivoActualId={cab.motivo?.id ?? null}
                            puedeContinuar={puedeContinuar}
                            continuar={continuarParcialAccion}
```

En `<ActividadMaquinaria …>` pasar además `nota={cab.nota}` (prop nuevo añadido en Step 2). `ActividadEstandar` ya recibe `nota`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 5: Build**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build`
Expected: `✓ Compiled successfully` y `Finished TypeScript`.

- [ ] **Step 6: Commit**

```bash
git add src/app/cumplimiento/actividad-estandar.tsx src/app/cumplimiento/actividad-maquinaria.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): editar novedad en Parcial + boton Continuar la proxima semana

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras todas las tareas)

Desplegar preview (`npx vercel@latest deploy --yes`, ya con env Preview configurado) y comprobar manualmente:
1. Actividad PARCIAL estándar y de maquinaria: aparece "registrar/editar novedad"; abrirlo muestra estado Parcial + motivo + observación actuales; editar la observación y guardar la conserva sin cerrar la actividad ni perder avances.
2. PARCIAL con parte de potreros avanzados → "Continuar la próxima semana" crea, en la semana siguiente, la actividad PENDIENTE solo con los potreros pendientes; la de esta semana sigue PARCIAL. Pulsar de nuevo no duplica.
3. Medida general (sin potreros) PARCIAL → "Continuar" lleva la actividad completa a la semana siguiente como PENDIENTE.
4. PARCIAL con todos los potreros avanzados → no aparece "Continuar".

Limpiar en Neon las actividades de prueba creadas (por id / por `origenId`).

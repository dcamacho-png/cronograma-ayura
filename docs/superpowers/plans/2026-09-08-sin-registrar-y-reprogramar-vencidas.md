# Vencidas sin registrar: aviso, cierre honesto y reprogramación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una actividad cuya semana venció sin registrarse deje de quedar "PENDIENTE para siempre": se cierra como `SIN_REGISTRAR`, se cuenta aparte en los informes, se avisa antes de que el plazo cierre, y se puede reprogramar para hacerla.

**Architecture:** Un valor de estado nuevo (`SIN_REGISTRAR`) — `Actividad.estado` es `String` en Prisma, así que no hay migración. Un cron semanal cierra lo vencido; la regla de qué es "vencida sin registrar" vive en el dominio como función pura. El porcentaje de cumplimiento **no cambia**: `SIN_REGISTRAR` vale 0, igual que `PENDIENTE` hoy. Reprogramar reusa `reprogramarActividad`, que crea una actividad nueva y deja la vencida intacta, así que el pasado no se edita.

**Tech Stack:** Next.js 16 (App Router, server actions, cron de Vercel), Prisma 6 + Postgres (Neon), Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-08-sin-registrar-y-reprogramar-vencidas-design.md`

## Contradicción del spec, resuelta

El spec dice dos cosas que no pueden ser ciertas a la vez: que las filas se cierran con
`cerrada = true`, y que `SIN_REGISTRAR` **no** debe contar como trabajada. Pero
`trabajoRegistrado` (`src/dominio/trabajo-registrado.ts:21`) devuelve `true` en cuanto ve
`cerrada`, y su espejo en SQL (`ACTIVIDAD_TRABAJADA`, arriba de `src/datos/repositorio.ts`)
incluye `{ cerrada: true }`. Con el spec tal cual, una vencida sin registrar aparecería en
`/consulta` como culminada: trabajo que nunca se hizo, listado como hecho.

**Resolución (Task 1, Step 8):** se mantiene `cerrada = true` —la fila está saldada, y
dejarla marcada como abierta sería peor— y se **excluye `SIN_REGISTRAR` explícitamente**
de las dos definiciones de "trabajada". Así `cerrada` sigue significando "saldada" y
"trabajada" sigue significando "alguien reportó algo".

## Global Constraints

- El código y los comentarios van **en español**, como el resto del repositorio.
- **El porcentaje de cumplimiento no se mueve.** `fraccionFila` devuelve `0` para `SIN_REGISTRAR`, igual que hoy para `PENDIENTE`. La prueba que lo demuestra está en la Task 8: el % de una semana pasada tiene que dar exactamente el mismo número antes y después.
- **Las áreas no pueden registrar retroactivamente.** Ninguna tarea toca `plazoCumplimientoVencido` ni afloja `bloqueadaActividad`. La única acción permitida sobre una semana vencida es reprogramar, y solo si la actividad está en `SIN_REGISTRAR`.
- **No hay migración de Prisma.** `estado` es `String`; `SIN_REGISTRAR` es un valor nuevo, no una columna. Si alguna tarea propone una migración, está mal.
- El cierre no toca medidas, notas, avances ni motivos: solo `estado` y `cerrada`.
- Para chequear tipos usá **`npx tsc -p tsconfig.check.json --noEmit`** (el `tsc` sin proyecto da falso verde por `.next`).
- No hay base de datos local. Para `next build` usá `DATABASE_URL="postgresql://u:p@localhost:5432/none" SESION_SECRET=dev`.
- La `DATABASE_URL` de producción sale de `.claude/settings.local.json`, leída con `readFileSync` desde el script; no interpolarla en la línea de órdenes.

---

### Task 1: El estado nuevo en el dominio

Agrega `SIN_REGISTRAR` al tipo y hace que todas las funciones de dominio que se ramifican por estado lo traten bien, más la regla pura que detecta cuáles quedaron así.

TypeScript es la red acá: `etiquetaEstado` y `ordenEstadoCumplimiento` son `switch` exhaustivos sobre `Estado`, y `conteoEstadoActividades` devuelve `Record<Estado, number>`. Al agregar el valor al tipo, `tsc` va a señalar cada lugar que falta.

**Files:**
- Modify: `src/dominio/tipos.ts:1-7` (el tipo `Estado`)
- Modify: `src/dominio/metricas.ts` (`conteoEstadoActividades:86-88`, `etiquetaEstado:39-48`, `ordenEstadoCumplimiento:252-264`)
- Modify: `src/dominio/trabajo-registrado.ts:21` y `src/dominio/trabajo-registrado.test.ts`
- Modify: `src/datos/repositorio.ts` (la constante `ACTIVIDAD_TRABAJADA`, arriba del archivo)
- Create: `src/dominio/sin-registrar.ts`
- Test: `src/dominio/sin-registrar.test.ts`
- Test: `src/dominio/metricas.test.ts` (agregar casos, no reescribir)

**Interfaces:**
- Consumes: `esSemanaPasada(anio, semana, referencia)` y `type Semana` de `@/dominio/semana`.
- Produces:
  - `Estado` gana el valor `'SIN_REGISTRAR'`.
  - `quedoSinRegistrar(a: { anio: number; semana: number; estado: string; cerrada: boolean }, hoy: Semana): boolean`
  - `etiquetaEstado('SIN_REGISTRAR') === 'Sin registrar'`
  - `ordenEstadoCumplimiento('SIN_REGISTRAR') === 4`
  - `conteoEstadoActividades` devuelve la clave `SIN_REGISTRAR`.
  - `fraccionFila` con `SIN_REGISTRAR` devuelve `0` (sale del `return 0` final, sin cambio de código).
  - `trabajoRegistrado` con `SIN_REGISTRAR` devuelve `false`, y `ACTIVIDAD_TRABAJADA` deja de casar esas filas.

- [ ] **Step 1: Escribir la prueba de la regla nueva**

Crear `src/dominio/sin-registrar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { quedoSinRegistrar } from './sin-registrar'

const HOY = { anio: 2026, semana: 37 }
const act = (p: Partial<Parameters<typeof quedoSinRegistrar>[0]> = {}) =>
  ({ anio: 2026, semana: 33, estado: 'PENDIENTE', cerrada: false, ...p })

describe('quedoSinRegistrar', () => {
  it('semana vencida, PENDIENTE y sin cerrar: quedó sin registrar', () => {
    expect(quedoSinRegistrar(act(), HOY)).toBe(true)
  })
  it('la semana en curso todavía se puede registrar', () => {
    expect(quedoSinRegistrar(act({ semana: 37 }), HOY)).toBe(false)
  })
  it('una semana futura tampoco', () => {
    expect(quedoSinRegistrar(act({ semana: 38 }), HOY)).toBe(false)
  })
  it('si ya está cerrada, no se toca', () => {
    expect(quedoSinRegistrar(act({ cerrada: true }), HOY)).toBe(false)
  })
  it('cualquier otro estado ya fue registrado', () => {
    for (const estado of ['CUMPLIDA', 'PARCIAL', 'NO_CUMPLIDA', 'REPROGRAMADA', 'SIN_REGISTRAR']) {
      expect(quedoSinRegistrar(act({ estado }), HOY)).toBe(false)
    }
  })
  it('es idempotente: una ya marcada no vuelve a entrar', () => {
    expect(quedoSinRegistrar(act({ estado: 'SIN_REGISTRAR', cerrada: true }), HOY)).toBe(false)
  })
  it('cruce de año: la semana 52 del año anterior está vencida', () => {
    expect(quedoSinRegistrar(act({ anio: 2025, semana: 52 }), HOY)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/dominio/sin-registrar.test.ts`
Expected: FAIL — `Cannot find module './sin-registrar'`

- [ ] **Step 3: Escribir el módulo**

Crear `src/dominio/sin-registrar.ts`:

```ts
// Una actividad "vencida sin registrar": su semana ya pasó y nadie reportó nada.
//
// El cumplimiento de una semana pasada es solo lectura para las áreas
// (`plazoCumplimientoVencido`), así que estas no pueden marcarse cumplidas, ni cerrarse
// como parciales, ni recibir una novedad: quedaban PENDIENTE para siempre. El cierre
// semanal las pasa a `SIN_REGISTRAR` + `cerrada`, que dice la verdad —la semana venció y
// nadie reportó— en vez de sostener un "pendiente" que ya no puede resolverse.
//
// Es idempotente a propósito: una actividad ya marcada no vuelve a entrar, así que el
// cron puede correr las veces que sea.
import { esSemanaPasada, type Semana } from './semana'

export function quedoSinRegistrar(
  a: { anio: number; semana: number; estado: string; cerrada: boolean },
  hoy: Semana,
): boolean {
  if (a.cerrada) return false
  if (a.estado !== 'PENDIENTE') return false
  return esSemanaPasada(a.anio, a.semana, hoy)
}
```

- [ ] **Step 4: Agregar el estado al tipo**

En `src/dominio/tipos.ts`, el tipo `Estado`:

```ts
// Estados posibles de una actividad.
export type Estado =
  | 'PENDIENTE'
  | 'CUMPLIDA'
  | 'PARCIAL'
  | 'NO_CUMPLIDA'
  | 'REPROGRAMADA'
  // La semana venció y nadie reportó nada. La cierra el cron semanal; ya no se puede
  // registrar (el plazo venció), pero sí reprogramar.
  | 'SIN_REGISTRAR'
```

- [ ] **Step 5: Ver qué rompe el tipo nuevo**

Run: `npx tsc -p tsconfig.check.json --noEmit`
Expected: errores en `src/dominio/metricas.ts` — el `Record<Estado, number>` de `conteoEstadoActividades` le falta la clave, y los `switch` de `etiquetaEstado` y `ordenEstadoCumplimiento` no cubren el caso nuevo. Anotá la lista: es el mapa de lo que hay que tocar.

- [ ] **Step 6: Completar las funciones de métricas**

En `src/dominio/metricas.ts`:

```ts
// conteoEstadoActividades (~línea 86): agregar la clave
  const r: Record<Estado, number> = {
    PENDIENTE: 0, CUMPLIDA: 0, PARCIAL: 0, NO_CUMPLIDA: 0, REPROGRAMADA: 0, SIN_REGISTRAR: 0,
  }

// etiquetaEstado (~línea 39): rótulo propio, NO "No se hizo" — dice otra cosa
    case 'NO_CUMPLIDA':
    case 'REPROGRAMADA':
      return 'No se hizo'
    case 'SIN_REGISTRAR': return 'Sin registrar'

// ordenEstadoCumplimiento (~línea 252): al final, después de las cumplidas.
// No hay nada que hacer con ellas en /cumplimiento, así que no estorban arriba.
    case 'CUMPLIDA':
      return 3
    case 'SIN_REGISTRAR':
      return 4
```

`fraccionFila` **no se toca**: `SIN_REGISTRAR` cae en su `return 0` final, que es exactamente lo que se busca (el porcentaje no se mueve).

- [ ] **Step 7: Agregar los casos a las pruebas de métricas**

Al final de `src/dominio/metricas.test.ts`:

```ts
describe('SIN_REGISTRAR en las métricas', () => {
  it('no aporta al porcentaje: vale 0 igual que PENDIENTE', () => {
    expect(fraccionFila({ estado: 'SIN_REGISTRAR' })).toBe(0)
  })
  it('tiene su propio rótulo, distinto de "No se hizo"', () => {
    expect(etiquetaEstado('SIN_REGISTRAR')).toBe('Sin registrar')
    expect(etiquetaEstado('NO_CUMPLIDA')).toBe('No se hizo')
  })
  it('se ordena al final, después de las cumplidas', () => {
    expect(ordenEstadoCumplimiento('SIN_REGISTRAR'))
      .toBeGreaterThan(ordenEstadoCumplimiento('CUMPLIDA'))
  })
  it('se cuenta en su propia clave', () => {
    const c = conteoEstadoActividades([
      { id: 'a', tareaId: 'T1', estado: 'SIN_REGISTRAR' },
      { id: 'b', tareaId: 'T2', estado: 'CUMPLIDA' },
    ])
    expect(c.SIN_REGISTRAR).toBe(1)
    expect(c.CUMPLIDA).toBe(1)
  })
})
```

Si `fraccionFila`, `etiquetaEstado`, `ordenEstadoCumplimiento` o `conteoEstadoActividades` no estaban importadas en ese archivo, agregalas al import de `./metricas`.

- [ ] **Step 8: Excluir SIN_REGISTRAR de "trabajada" (las dos definiciones)**

Esto resuelve la contradicción del spec explicada arriba. Sin este paso, una vencida sin
registrar aparecería en `/consulta` como culminada.

En `src/dominio/trabajo-registrado.ts`, la primera línea de la función:

```ts
export function trabajoRegistrado(a: FilaTrabajo): boolean {
  // Una vencida sin registrar está CERRADA pero nadie reportó nada: no es trabajo.
  if (a.estado === 'SIN_REGISTRAR') return false
  if (a.cerrada || a.estado === 'CUMPLIDA') return true
  // …resto igual
```

Y en `src/datos/repositorio.ts`, la constante `ACTIVIDAD_TRABAJADA` (su espejo en SQL):

```ts
const ACTIVIDAD_TRABAJADA: Prisma.ActividadWhereInput = {
  // Las SIN_REGISTRAR están cerradas pero sin reporte: no cuentan como trabajadas.
  NOT: { estado: 'SIN_REGISTRAR' },
  OR: [
    { estado: 'CUMPLIDA' },
    { cerrada: true },
    { estado: 'PARCIAL', NOT: { avancePorLote: { equals: Prisma.DbNull } } },
    { estado: 'PARCIAL', NOT: { avanceGeneral: { equals: Prisma.DbNull } } },
  ],
}
```

Agregar a `src/dominio/trabajo-registrado.test.ts`:

```ts
describe('SIN_REGISTRAR no es trabajo registrado', () => {
  it('aunque esté cerrada, nadie reportó nada', () => {
    expect(trabajoRegistrado({ estado: 'SIN_REGISTRAR', cerrada: true })).toBe(false)
  })
  it('y con avances viejos tampoco: el estado manda', () => {
    expect(trabajoRegistrado({
      estado: 'SIN_REGISTRAR', cerrada: true,
      avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 3 }] },
    })).toBe(false)
  })
})
```

- [ ] **Step 9: Verificar que las dos definiciones siguen coincidiendo**

Las dos formas de "trabajada" —la de dominio y la de SQL— tienen que clasificar igual.
Correr el contraste contra las actividades reales de producción, como se hizo cuando se
creó la regla: para cada actividad, comparar `trabajoRegistrado(a)` con si la fila casa
el `where` de `ACTIVIDAD_TRABAJADA`.

```bash
# script .mts en el repo, corrido con npx tsx, leyendo la DATABASE_URL del archivo de settings
npx tsx contraste-trabajada.mts
```
Expected: **0 discrepancias**. Es la única forma de saber que el espejo sigue en sintonía.

- [ ] **Step 10: Verificar**

```bash
npx vitest run
npx tsc -p tsconfig.check.json --noEmit
npx eslint src
```
Expected: todo en verde, `tsc` sin salida.

- [ ] **Step 11: Commit**

```bash
git add src/dominio/tipos.ts src/dominio/metricas.ts src/dominio/metricas.test.ts src/dominio/sin-registrar.ts src/dominio/sin-registrar.test.ts src/dominio/trabajo-registrado.ts src/dominio/trabajo-registrado.test.ts src/datos/repositorio.ts
git commit -m "feat(cumplimiento): estado SIN_REGISTRAR en el dominio y regla que lo detecta"
```

---

### Task 2: Cómo se ve el estado nuevo

El chip, el rótulo del Excel y el cuadro propio en `/resumen`. Sin lógica: solo presentación.

**Files:**
- Modify: `src/app/globals.css:14-26` (tokens) y `:64-68` (utilidades de chip)
- Modify: `src/dominio/cumplimiento-export.ts:14-20` (`ESTADO_TXT`)
- Modify: `src/app/resumen/resumen-area.tsx:14-19` (`ESTADOS_ORDEN`) y los chips (~línea 222)
- Test: `src/dominio/cumplimiento-export.test.ts` (agregar un caso)

**Interfaces:**
- Consumes: `Estado` con `'SIN_REGISTRAR'` y `conteoEstadoActividades` con su sexta clave (Task 1).
- Produces: la utilidad CSS `chip-sinregistrar`; `ESTADO_TXT['SIN_REGISTRAR'] === 'Sin registrar'`.

- [ ] **Step 1: Tokens y chip en gris**

En `src/app/globals.css`, junto a los otros tokens de estado (después de los de reprogramada):

```css
  /* Sin registrar: gris neutro a propósito. Los otros cinco tienen colores con carga
     (verde cumplida, ámbar parcial, rojo no cumplida); esto es ausencia de dato, no falla. */
  --color-est-sinregistrar: #6b7280;
  --color-est-sinregistrar-bg: #e9e7e2;
```

Y con las otras utilidades de chip:

```css
@utility chip-sinregistrar { background: var(--color-est-sinregistrar-bg); color: var(--color-est-sinregistrar); }
```

Ojo: en Tailwind v4 las clases de componente van con `@utility`, **no** con `@layer components`, que v4 no emite.

- [ ] **Step 2: Rótulo en el Excel**

En `src/dominio/cumplimiento-export.ts`, el mapa `ESTADO_TXT`:

```ts
const ESTADO_TXT: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CUMPLIDA: 'Cumplida',
  PARCIAL: 'Parcial',
  NO_CUMPLIDA: 'No se hizo',
  REPROGRAMADA: 'No se hizo',
  SIN_REGISTRAR: 'Sin registrar',
}
```

`filasCumplimiento` ya emite una fila-resumen para cualquier estado que no sea `PARCIAL` sin avances, así que una `SIN_REGISTRAR` sale con su medida vacía sin más cambios. Eso es deliberado: hoy las PENDIENTE no se exportan y por eso la omisión no queda registrada en ninguna parte.

- [ ] **Step 3: Prueba del Excel**

Agregar al final de `src/dominio/cumplimiento-export.test.ts`:

```ts
describe('filasCumplimiento — sin registrar', () => {
  it('exporta la fila con el rótulo "Sin registrar" y sin medida', () => {
    const fila = filasCumplimiento(
      act({ estado: 'SIN_REGISTRAR', haRealizada: null, avancePorLote: null }),
      '15 jun', mapa, ctx,
    )[0]
    expect(fila[7]).toBe('Sin registrar')   // columna Estado
    expect(fila[8]).toBe('')                // Medida realizada
    expect(fila[9]).toBe('')                // Unidad
  })
})
```

- [ ] **Step 4: El cuadro y el chip en /resumen**

En `src/app/resumen/resumen-area.tsx`, agregar la fila a `ESTADOS_ORDEN` (después de "No se hizo"):

```ts
const ESTADOS_ORDEN = [
  { v: ['CUMPLIDA'], etq: '✅ Cumplidas' },
  { v: ['PARCIAL'], etq: '🟡 Parciales' },
  { v: ['NO_CUMPLIDA', 'REPROGRAMADA'], etq: '🔴 No se hizo' },
  { v: ['SIN_REGISTRAR'], etq: '⚪ Sin registrar' },
  { v: ['PENDIENTE'], etq: '⏳ Pendientes' },
]
```

Y el chip, junto a los otros cuatro (~línea 225):

```tsx
        <span className="chip-estado chip-sinregistrar">⚪ Sin registrar: <b>{conteo.SIN_REGISTRAR}</b></span>
```

Y un cuadro propio en la fila de cuadros grandes, con el mismo tratamiento que los vecinos (mismo borde, mismo padding, mismo tamaño de número), después del de "No se hizo":

```tsx
        <div className="tarjeta p-4">
          <div className="mb-1 text-sm text-tierra">Sin registrar</div>
          <div className="text-4xl font-extrabold" style={{ color: COLOR_HEX[conteo.SIN_REGISTRAR > 0 ? 'gris' : 'verde'] }}>{conteo.SIN_REGISTRAR}</div>
        </div>
```

- [ ] **Step 5: Verificar que el CSS compiló**

```bash
npx vitest run
npx tsc -p tsconfig.check.json --noEmit
DATABASE_URL="postgresql://u:p@localhost:5432/none" SESION_SECRET=dev npx next build
grep -c "chip-sinregistrar" .next/static/css/*.css
```
Expected: pruebas verdes, compila, y el `grep` encuentra la clase **al menos una vez** en el CSS compilado. Si da 0, la utilidad no se emitió (el error clásico de Tailwind v4 con `@layer components`).

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts src/app/resumen/resumen-area.tsx
git commit -m "feat(resumen): chip, rótulo de Excel y cuadro propio para Sin registrar"
```

---

### Task 3: El cierre semanal automático

El endpoint del cron que pasa a `SIN_REGISTRAR` lo que venció, más su entrada en `vercel.json` y el bypass del middleware.

**Files:**
- Create: `src/app/api/cerrar-vencidas/route.ts`
- Modify: `src/middleware.ts:7` (agregar la ruta al bypass)
- Modify: `vercel.json`
- Modify: `src/datos/repositorio.ts` (agregar `cerrarVencidasSinRegistrar`)

**Interfaces:**
- Consumes: `quedoSinRegistrar` (Task 1); `semanaActual()` de `@/dominio/semana`.
- Produces: `cerrarVencidasSinRegistrar(hoy: Semana): Promise<{ cerradas: number }>` en el repositorio, y `GET /api/cerrar-vencidas`.

- [ ] **Step 1: La función del repositorio**

En `src/datos/repositorio.ts`, junto a las otras funciones de actividades:

```ts
// Cierra como SIN_REGISTRAR lo que quedó PENDIENTE en una semana ya vencida: el área ya
// no puede registrarlo (el plazo venció) y así deja de figurar como si faltara hacerlo.
// Solo toca `estado` y `cerrada`: ni medidas, ni notas, ni avances, ni motivos.
// El filtro de semana se arma en SQL para no traer toda la tabla; la condición completa
// (incluida la idempotencia) es la del dominio, `quedoSinRegistrar`.
export async function cerrarVencidasSinRegistrar(hoy: Semana): Promise<{ cerradas: number }> {
  const r = await prisma.actividad.updateMany({
    where: {
      estado: 'PENDIENTE',
      cerrada: false,
      OR: [
        { anio: { lt: hoy.anio } },
        { anio: hoy.anio, semana: { lt: hoy.semana } },
      ],
    },
    data: { estado: 'SIN_REGISTRAR', cerrada: true },
  })
  return { cerradas: r.count }
}
```

Agregar el import del tipo si falta: `import type { Semana } from '@/dominio/semana'`.

- [ ] **Step 2: El endpoint**

Crear `src/app/api/cerrar-vencidas/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { cerrarVencidasSinRegistrar } from '@/datos/repositorio'
import { semanaActual } from '@/dominio/semana'

export const runtime = 'nodejs'
export const maxDuration = 60

// Cron semanal: cierra como SIN_REGISTRAR lo que quedó pendiente en semanas vencidas.
// Idempotente: correrlo de nuevo no cambia nada, porque solo mira las PENDIENTE sin cerrar.
export async function GET(req: NextRequest) {
  // Autorización: Vercel Cron inyecta "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 })
  }
  const hoy = semanaActual()
  const { cerradas } = await cerrarVencidasSinRegistrar(hoy)
  return NextResponse.json({ ok: true, semana: hoy, cerradas })
}
```

- [ ] **Step 3: Bypass del middleware**

En `src/middleware.ts`, el `if` de la línea 7 pasa a cubrir las dos rutas de cron:

```ts
  // Los crons se autentican solo con CRON_SECRET (Bearer), sin cookie de sesión: deben
  // saltarse la redirección a /login del middleware.
  const p = req.nextUrl.pathname
  if (p.startsWith('/api/backup-drive') || p.startsWith('/api/cerrar-vencidas')) {
    return NextResponse.next()
  }
```

Sin esto el cron recibe un 307 a `/login` y no cierra nada — es el error que ya pasó una vez con el respaldo a Drive.

- [ ] **Step 4: El cron en vercel.json**

```json
{
  "crons": [
    { "path": "/api/backup-drive", "schedule": "59 4 * * *" },
    { "path": "/api/cerrar-vencidas", "schedule": "17 6 * * 1" }
  ]
}
```

`17 6 * * 1` es UTC = **lunes 01:17 en Colombia**: la semana ya cerró (domingo a medianoche) y no hay nadie usando la app.

- [ ] **Step 5: Verificar**

```bash
npx vitest run
npx tsc -p tsconfig.check.json --noEmit
npx eslint src
DATABASE_URL="postgresql://u:p@localhost:5432/none" SESION_SECRET=dev npx next build
```
Expected: todo verde, y en la lista de rutas del build aparece `/api/cerrar-vencidas`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cerrar-vencidas src/middleware.ts vercel.json src/datos/repositorio.ts
git commit -m "feat(cumplimiento): cron semanal que cierra lo vencido sin registrar"
```

---

### Task 4: El aviso antes de que cierre el plazo

Sábado y domingo, sobre la semana en curso, avisarle al área cuántas le quedan sin registrar.

**Files:**
- Create: `src/dominio/aviso-plazo.ts`
- Test: `src/dominio/aviso-plazo.test.ts`
- Modify: `src/app/cumplimiento/page.tsx` (el aviso, junto al de "Faltan N actividad(es)")

**Interfaces:**
- Consumes: `diaActual()` y `semanaActual()` de `@/dominio/semana`; el conteo `pendientes` que la página ya calcula con `tieneDiaPendiente`.
- Produces: `avisarPlazoPorVencer(semanaVista: Semana, hoy: Semana, diaIso: number, pendientes: number): boolean`

- [ ] **Step 1: Escribir la prueba**

Crear `src/dominio/aviso-plazo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { avisarPlazoPorVencer } from './aviso-plazo'

const HOY = { anio: 2026, semana: 37 }

describe('avisarPlazoPorVencer', () => {
  it('sábado, semana en curso y con pendientes: avisa', () => {
    expect(avisarPlazoPorVencer(HOY, HOY, 6, 3)).toBe(true)
  })
  it('domingo también', () => {
    expect(avisarPlazoPorVencer(HOY, HOY, 7, 1)).toBe(true)
  })
  it('de lunes a viernes no: falta mucho y sería ruido', () => {
    for (const d of [1, 2, 3, 4, 5]) {
      expect(avisarPlazoPorVencer(HOY, HOY, d, 3)).toBe(false)
    }
  })
  it('sin pendientes no hay nada que avisar', () => {
    expect(avisarPlazoPorVencer(HOY, HOY, 6, 0)).toBe(false)
  })
  it('mirando una semana pasada no avisa: su plazo ya venció', () => {
    expect(avisarPlazoPorVencer({ anio: 2026, semana: 33 }, HOY, 6, 5)).toBe(false)
  })
  it('mirando una semana futura tampoco: su plazo no corre', () => {
    expect(avisarPlazoPorVencer({ anio: 2026, semana: 38 }, HOY, 6, 5)).toBe(false)
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/dominio/aviso-plazo.test.ts`
Expected: FAIL — `Cannot find module './aviso-plazo'`

- [ ] **Step 3: Escribir el módulo**

Crear `src/dominio/aviso-plazo.ts`:

```ts
// ¿Hay que avisarle al área que su plazo está por vencer?
//
// El cumplimiento de una semana se cierra el domingo a medianoche y después no se puede
// registrar nada (`plazoCumplimientoVencido`). El aviso sale el fin de semana, cuando
// todavía hay tiempo de hacer algo, y solo sobre la semana EN CURSO: en una pasada el
// plazo ya venció y en una futura todavía no corre.
import type { Semana } from './semana'

export function avisarPlazoPorVencer(
  semanaVista: Semana,
  hoy: Semana,
  diaIso: number,     // 1 = lunes … 7 = domingo
  pendientes: number,
): boolean {
  if (pendientes <= 0) return false
  if (semanaVista.anio !== hoy.anio || semanaVista.semana !== hoy.semana) return false
  return diaIso >= 6
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/dominio/aviso-plazo.test.ts`
Expected: PASS — 6 pruebas

- [ ] **Step 5: Mostrar el aviso**

En `src/app/cumplimiento/page.tsx`, agregar los imports (`avisarPlazoPorVencer` de `@/dominio/aviso-plazo`, y `diaActual` al import que ya existe de `@/dominio/semana`), y **arriba** del aviso de "Faltan N actividad(es)" que ya está en la página:

```tsx
      {avisarPlazoPorVencer({ anio, semana }, hoy, diaActual(), pendientes) && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
          ⏳ Te quedan <b>{pendientes}</b> actividad(es) sin registrar y el plazo se cierra el
          domingo a medianoche. Después no vas a poder marcarlas ni reportar novedades.
        </div>
      )}
```

Va arriba y con más peso visual que el aviso existente porque es urgente y con fecha límite, no informativo.

- [ ] **Step 6: Verificar**

```bash
npx vitest run
npx tsc -p tsconfig.check.json --noEmit
npx eslint src
DATABASE_URL="postgresql://u:p@localhost:5432/none" SESION_SECRET=dev npx next build
```
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add src/dominio/aviso-plazo.ts src/dominio/aviso-plazo.test.ts src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): avisar el fin de semana que el plazo está por vencer"
```

---

### Task 5: La bandeja de vencidas y el botón de reprogramar

Donde el área ve lo que se le venció sin registrar y lo manda a una semana futura.

**Files:**
- Modify: `src/datos/repositorio.ts` (agregar `listarVencidasSinRegistrar` y `areaYEstadoDeActividad`)
- Modify: `src/app/cumplimiento/acciones.ts` (agregar `reprogramarVencidaAccion`)
- Create: `src/app/cumplimiento/bandeja-vencidas.tsx`
- Modify: `src/app/cumplimiento/page.tsx` (cargar la bandeja y renderizarla)

**Interfaces:**
- Consumes: `reprogramarActividad(id, anioDestino, semanaDestino)` (ya existe, `repositorio.ts:307`) — crea una actividad **nueva** y deja la original intacta, con guarda `origenId @unique` contra duplicados; `programacionAbierta` y `siguienteSemana` de `@/dominio/semana`; `puedeMutarArea` de `@/auth/permisos`.
- Produces:
  - `listarVencidasSinRegistrar(areaId: string)` — las `SIN_REGISTRAR` del área que **no** tienen `derivada` (o sea que nadie reprogramó todavía), con responsable y lotes.
  - `reprogramarVencidaAccion(form: FormData)` — campos `id`, `anioSemana` (`"2026-38"`).

- [ ] **Step 1: La consulta**

En `src/datos/repositorio.ts`:

```ts
// Vencidas sin registrar de un área que todavía nadie reprogramó (`derivada` vacía).
// Alimentan la bandeja de /cumplimiento: no se pueden registrar, pero sí reprogramar.
export function listarVencidasSinRegistrar(areaId: string) {
  return prisma.actividad.findMany({
    where: { areaId, estado: 'SIN_REGISTRAR', derivada: { is: null } },
    include: { responsable: true, lotes: true, finca: true },
    orderBy: [{ anio: 'desc' }, { semana: 'desc' }, { dia: 'asc' }],
  })
}
```

- [ ] **Step 2: La acción**

En `src/app/cumplimiento/acciones.ts`, agregando `reprogramarActividad` y `areaDeActividad` al import de `@/datos/repositorio` si faltan:

```ts
// Reprogramar una vencida sin registrar. NO pasa por `bloqueadaActividad` a propósito:
// se trata justamente de una actividad de semana vencida. El bypass del plazo queda
// acotado por la validación de estado — solo SIN_REGISTRAR — así que esto no abre la
// puerta a editar cualquier semana cerrada. Reprogramar no toca el pasado: crea una
// actividad nueva y deja la vencida como está.
export async function reprogramarVencidaAccion(form: FormData) {
  const id = texto(form, 'id')
  const [anioTxt, semanaTxt] = texto(form, 'anioSemana').split('-')
  const anio = Number(anioTxt)
  const semana = Number(semanaTxt)
  if (!id || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  const u = await usuarioActual()
  if (!u) return
  const a = await areaYEstadoDeActividad(id)
  if (!a || a.estado !== 'SIN_REGISTRAR') return
  if (!puedeMutarArea(u, a.areaId)) return
  await reprogramarActividad(id, anio, semana)
  revalidatePath('/cumplimiento')
}
```

`acciones.ts` **no** importa `prisma` (solo funciones del repositorio), así que la consulta
va en `src/datos/repositorio.ts`, junto a `areaDeActividad`:

```ts
// Área y estado de una actividad, para autorizar la reprogramación de una vencida:
// hay que validar las dos cosas, que sea del área del usuario y que esté SIN_REGISTRAR.
export function areaYEstadoDeActividad(id: string) {
  return prisma.actividad.findUnique({ where: { id }, select: { areaId: true, estado: true } })
}
```

Agregar `reprogramarActividad` y `areaYEstadoDeActividad` al import de `@/datos/repositorio`.

- [ ] **Step 3: El componente de la bandeja**

Crear `src/app/cumplimiento/bandeja-vencidas.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { InfoLotes } from '../_componentes/info-lotes'

type Vencida = {
  id: string
  descripcion: string
  anio: number
  semana: number
  responsable: string
  lotes: { id: string; nombre: string; hectareas: number | null }[]
}

// Lo que se venció sin registrar. No se puede registrar (el plazo venció), pero sí
// reprogramar: eso crea una actividad nueva en la semana elegida y deja la vencida como
// está, así que el pasado no se retoca. Plegada por omisión para no tapar la semana en curso.
export function BandejaVencidas({
  vencidas,
  semanas,
  reprogramar,
}: {
  vencidas: Vencida[]
  semanas: { anio: number; semana: number }[]
  reprogramar: (f: FormData) => void | Promise<void>
}) {
  const [abierta, setAbierta] = useState(false)
  if (vencidas.length === 0) return null

  return (
    <div className="mb-5 rounded-lg border border-borde bg-arena/60 px-4 py-3">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-tinta"
      >
        <span>{abierta ? '▾' : '▸'}</span>
        ⚠️ {vencidas.length} actividad(es) vencidas sin registrar
        <span className="font-normal text-tierra">· de semanas anteriores</span>
      </button>
      {abierta && (
        <>
          <p className="mt-2 text-xs text-tierra">
            El plazo de esas semanas ya venció, así que no se pueden registrar. Sí se pueden
            reprogramar: se crea la actividad en la semana que elijas y la vencida queda como
            constancia de que no se hizo en su momento.
          </p>
          <ul className="mt-2 divide-y divide-borde">
            {vencidas.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <div className="flex-1">
                  <div className="font-medium">
                    {v.descripcion}
                    <span className="ml-2 text-xs text-tierra">
                      semana {v.semana} de {v.anio} · {v.responsable}
                    </span>
                  </div>
                  <InfoLotes lotes={v.lotes} />
                </div>
                <form action={reprogramar} className="flex items-end gap-1">
                  <input type="hidden" name="id" value={v.id} />
                  <label className="flex flex-col text-xs">
                    Reprogramar para
                    <select name="anioSemana" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                      {semanas.map((s) => (
                        <option key={`${s.anio}-${s.semana}`} value={`${s.anio}-${s.semana}`}>
                          Semana {s.semana} · {s.anio}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">
                    Reprogramar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Conectar en la página**

En `src/app/cumplimiento/page.tsx`:

1. Agregar `listarVencidasSinRegistrar` al import de `@/datos/repositorio`, `reprogramarVencidaAccion` al de `./acciones`, `BandejaVencidas` de `./bandeja-vencidas`, y `programacionAbierta` al import de `@/dominio/semana`.
2. Agregar `listarVencidasSinRegistrar(areaId)` al `Promise.all` que ya carga los datos.
3. Armar las semanas ofrecidas, igual que hace `/tareas` (no ofrecer una semana cuya programación ya cerró):

```tsx
  const semanasDestino: { anio: number; semana: number }[] = []
  let wd = programacionAbierta(hoy.anio, hoy.semana) ? hoy : siguienteSemana(hoy.anio, hoy.semana)
  for (let i = 0; i < 8; i++) {
    semanasDestino.push(wd)
    wd = siguienteSemana(wd.anio, wd.semana)
  }
```

4. Renderizar la bandeja arriba de la lista de tarjetas y debajo de los avisos, solo si el usuario puede mutar (no `bloqueado` por rol de solo lectura):

```tsx
      {!soloLectura && (
        <BandejaVencidas
          vencidas={vencidas.map((v) => ({
            id: v.id,
            descripcion: v.descripcion,
            anio: v.anio,
            semana: v.semana,
            responsable: v.responsable.nombre,
            lotes: v.lotes,
          }))}
          semanas={semanasDestino}
          reprogramar={reprogramarVencidaAccion}
        />
      )}
```

- [ ] **Step 5: Verificar**

```bash
npx vitest run
npx tsc -p tsconfig.check.json --noEmit
npx eslint src
DATABASE_URL="postgresql://u:p@localhost:5432/none" SESION_SECRET=dev npx next build
```
Expected: todo verde.

- [ ] **Step 6: Commit**

```bash
git add src/datos/repositorio.ts src/app/cumplimiento/acciones.ts src/app/cumplimiento/bandeja-vencidas.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): bandeja de vencidas sin registrar con reprogramación"
```

---

### Task 6: Verificar en el navegador

El aviso, la bandeja y el reprogramar, contra un schema aislado con fixture mínimo. Es lo único que las pruebas de dominio no pueden cubrir.

**Files:**
- Create: `<workspace>/vencidas/env-prueba.mjs`, `fixture.mts`, `servidor.mjs`, `probar.mjs`

**Interfaces:**
- Consumes: la app tal como quedó tras las Tasks 1-5.
- Produces: nada de código de producción. Todo descartable.

- [ ] **Step 1: Montar el entorno aislado**

Misma técnica que ya funcionó dos veces en este repositorio:

1. `env-prueba.mjs` lee la `DATABASE_URL` de producción de `.claude/settings.local.json` y le agrega `?schema=prueba_vencidas`; `DIRECT_URL` es la misma cadena con el host **sin** `-pooler` (el pooler no sostiene los advisory locks de las migraciones). Pasar el entorno por `spawn` desde un script node, no interpolando en la línea de órdenes.
2. `prisma migrate deploy` con ese entorno.
3. **No corras `prisma/seed.ts`**: tarda ~10 minutos. Fixture mínimo con `npx tsx` (necesitás `hashPassword` de `src/auth/password.ts`): un área, un responsable, **un usuario ADMIN**, una finca, un potrero, y tres actividades:
   - una en la **semana en curso**, `PENDIENTE` (para el aviso y el conteo de pendientes),
   - una en una **semana pasada**, `estado: 'SIN_REGISTRAR'`, `cerrada: true` (para la bandeja),
   - otra igual, para probar que reprogramar una no afecta a la otra.
4. `next dev --port 3100` con ese entorno; esperar la línea "Ready in".
5. Cookie de sesión firmada a mano: `sesion` = `<usuarioId>.<hmacSHA256(usuarioId, 'cronograma-local-secret')>`, inyectada con `addCookies`. Saltea el login.
6. Chromium: `~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, con `LD_LIBRARY_PATH` al directorio de libs (ubicalo con `find /tmp/claude-1000 -name "libnspr4.so*"`). `npm i playwright-core` en tu directorio.

- [ ] **Step 2: Escribir las comprobaciones**

En `probar.mjs`. **Cada aserción de ausencia lleva su control positivo**: una comprobación
que no puede fallar no verifica nada. Y después de disparar una server action se espera
**por condición**, consultando la base en bucle, nunca por temporizador fijo.

```js
const ok = [], fallos = []
const check = (c, m) => (c ? ok.push(m) : fallos.push(m))
const esperarHasta = async (cond, ms = 20000) => {
  const fin = Date.now() + ms
  while (Date.now() < fin) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 400)) }
  return false
}

// ── 1. La bandeja lista las dos vencidas ──
await page.goto(URL_CUMPLIMIENTO, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const cabecera = page.locator('text=/vencidas sin registrar/')
check(await cabecera.count() > 0, 'la bandeja aparece cuando hay vencidas')
check(/2 actividad/.test(await cabecera.first().innerText()), 'el contador dice 2, no solo "hay algunas"')
await cabecera.first().click()                       // está plegada por omisión
await page.waitForTimeout(400)
const texto = await page.locator('main').innerText()
check(texto.includes('VENCIDA A') && texto.includes('VENCIDA B'), 'lista las dos por nombre')
check(/no se pueden registrar/i.test(texto), 'explica por qué no se pueden registrar')

// ── 2. La vencida NO ofrece registrar avance (el plazo venció) ──
const fila = page.locator('li', { hasText: 'VENCIDA A' })
check(await fila.getByRole('button', { name: 'Registrar avance' }).count() === 0,
  'la vencida no ofrece "Registrar avance"')
check(await fila.getByRole('button', { name: 'Reprogramar' }).count() === 1,
  'pero sí ofrece "Reprogramar" (control positivo: la fila SÍ se renderiza)')

// ── 3. Reprogramar crea la actividad nueva y deja la vencida intacta ──
const antes = await prisma.actividad.count()
await fila.locator('select[name="anioSemana"]').selectOption({ index: 0 })
const destino = await fila.locator('select[name="anioSemana"]').inputValue()
await fila.getByRole('button', { name: 'Reprogramar' }).click()
const nacio = await esperarHasta(async () =>
  (await prisma.actividad.findFirst({ where: { origenId: esc.vencidaA } })) !== null)
check(nacio, `nace la actividad reprogramada en ${destino}`)
const nueva = await prisma.actividad.findFirst({ where: { origenId: esc.vencidaA } })
const vieja = await prisma.actividad.findUnique({ where: { id: esc.vencidaA } })
check(nueva?.estado === 'PENDIENTE', 'la nueva nace PENDIENTE, lista para trabajarse')
check(vieja?.estado === 'SIN_REGISTRAR' && vieja?.cerrada === true,
  'la vencida queda intacta: el pasado no se retoca')
check(await prisma.actividad.count() === antes + 1, 'se creó exactamente una')

// ── 4. Reprogramar dos veces no duplica (guarda origenId @unique) ──
await page.goto(URL_CUMPLIMIENTO, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
check(!(await page.locator('main').innerText()).includes('VENCIDA A'),
  'la reprogramada sale de la bandeja')
check(await prisma.actividad.count({ where: { origenId: esc.vencidaA } }) === 1,
  'sigue habiendo una sola derivada')

// ── 5. La otra vencida no se tocó ──
const b = await prisma.actividad.findUnique({ where: { id: esc.vencidaB } })
check(b?.estado === 'SIN_REGISTRAR' && await prisma.actividad.count({ where: { origenId: esc.vencidaB } }) === 0,
  'VENCIDA B quedó como estaba')
```

El aviso del plazo no se puede provocar desde el navegador (depende del día real), así que
esa parte queda cubierta por las pruebas de dominio de la Task 4. Acá solo se comprueba
que la página carga bien y que, **si hoy es sábado o domingo**, el bloque del aviso está:

```js
const esFinDeSemana = new Date().getDay() === 6 || new Date().getDay() === 0
const hayAviso = (await page.locator('main').innerText()).includes('el plazo se cierra')
check(esFinDeSemana === hayAviso, `el aviso coincide con el día real (fin de semana: ${esFinDeSemana})`)
```

Registrar el manejador de `dialog` **antes** de clicar cualquier botón con `confirm()`.

- [ ] **Step 3: Correr y transcribir**

Correr con el `LD_LIBRARY_PATH` puesto. Expected: una línea `OK` por comprobación, 0 fallas. Transcribir la salida literal en el reporte, y que el número del titular **coincida** con las líneas transcritas.

- [ ] **Step 4: Desmontar**

`DROP SCHEMA IF EXISTS "prueba_vencidas" CASCADE`, confirmar que ya no existe, y verificar después que el schema `public` (producción) quedó intacto leyendo sus conteos.

- [ ] **Step 5: Commit**

No hay código de producción para commitear. Anotar el resultado en el mensaje del commit siguiente.

---

### Task 7: Desplegar (antes de tocar datos)

El código tiene que estar en producción **antes** de la pasada retroactiva: si se marcan filas como `SIN_REGISTRAR` con el código viejo desplegado, `etiquetaEstado` no cubre el valor y las pantallas de esas semanas se rompen.

**Files:** ninguno. Solo git y Vercel.

- [ ] **Step 1: Pruebas y push**

```bash
npx vitest run
git push origin master
```
Expected: suite completa en verde antes de empujar.

- [ ] **Step 2: Desplegar**

```bash
npx --yes vercel --prod --yes --scope ayura-llanos
```
Si el CLI dice "Logged out", correr `npx --yes vercel teams ls` primero: revalida el token.

- [ ] **Step 3: Verificar el despliegue**

```bash
npx --yes vercel ls cronograma-ayura --scope ayura-llanos
curl -s -o /dev/null -w "%{http_code}\n" https://cronograma-ayura.vercel.app/login
```
Expected: el más reciente en `Production` / `Ready`, y HTTP 200.

- [ ] **Step 4: Comprobar que el cron quedó registrado**

En el panel de Vercel, sección Cron Jobs del proyecto, tiene que aparecer `/api/cerrar-vencidas` con `17 6 * * 1`. Y que el endpoint rechaza sin autorización:

```bash
curl -s -o /dev/null -w "sin token → %{http_code}\n" https://cronograma-ayura.vercel.app/api/cerrar-vencidas
```
Expected: **401**. Si da 307, falta el bypass del middleware (Task 3, Step 3).

---

### Task 8: Pasada retroactiva sobre las que ya están atascadas

Cerrar las ~257 filas que quedaron congeladas antes de que existiera el cron.

**Files:**
- Create: `<workspace>/vencidas/cerrar-retroactivo.mjs`

**Interfaces:**
- Consumes: el código desplegado (Task 7) y `quedoSinRegistrar` como definición de referencia.
- Produces: nada de código. Deja `respaldo-vencidas.json` con el estado previo.

- [ ] **Step 1: Medir y respaldar**

El script, con **ensayo en seco por omisión** (escribe solo con `--aplicar`):

1. Contar las candidatas: `estado: 'PENDIENTE'`, `cerrada: false`, semana anterior a la actual. Reportar el total y el desglose por área y por semana.
2. Guardar `respaldo-vencidas.json` con `{ id, anio, semana, areaId, estado, cerrada }` de cada una, **antes** de cualquier escritura.
3. **Guardar el porcentaje de cumplimiento de cada (área, semana) afectada ANTES de escribir.** Es la línea base de la comprobación que sigue.

Expected en el ensayo en seco: ~257 filas, con el desglose por área parecido a Ganadería 127 · Maquinaria 58 · Maiz-Riego 53 · Genetica Nelore 16 · Nelore 3. Si el total se aleja mucho, **parar y reportar** antes de escribir.

- [ ] **Step 2: Aplicar**

Con `--aplicar`, un solo `updateMany` con el mismo `where` del repositorio (`cerrarVencidasSinRegistrar`), o llamando a esa función directamente para no tener dos definiciones.

Expected: `cerradas: <el mismo número del ensayo en seco>`.

- [ ] **Step 3: La verificación que importa — que la historia no se movió**

Volver a calcular el porcentaje de cumplimiento de cada (área, semana) afectada y compararlo con la línea base del Step 1.

Expected: **idénticos, todos**. Si alguno cambió, `fraccionFila` no está devolviendo 0 para `SIN_REGISTRAR` y hay que revisar la Task 1 antes de seguir.

- [ ] **Step 4: Verificar el resto**

- Que ya no queden `PENDIENTE` sin cerrar en semanas vencidas (el conteo tiene que dar 0).
- Que las actividades de la **semana en curso** sigan `PENDIENTE` y sin cerrar (el cierre no se pasó de la raya).
- Que ninguna medida, nota, avance ni motivo haya cambiado: comparar contra el respaldo.
- Que `conteoEstadoActividades` de una semana afectada muestre ahora la clave `SIN_REGISTRAR` con el número esperado.

- [ ] **Step 5: Comprobar en la app desplegada**

Entrar a `/resumen` en una semana afectada (por ejemplo la 33 de Maquinaria) y confirmar que el porcentaje es **el mismo de antes** y que el cuadro nuevo dice "Sin registrar: 14". Y en `/cumplimiento`, que la bandeja lista las vencidas con su botón de reprogramar.

- [ ] **Step 6: Anotar el resultado**

Actualizar la memoria del proyecto con el cierre: el estado nuevo, el cron semanal, el aviso, la bandeja, cuántas filas se cerraron retroactivamente y dónde quedó el respaldo.

---

## Notas de ejecución

- **El orden importa dos veces:** la Task 7 (despliegue) va antes de la Task 8 (datos), porque marcar `SIN_REGISTRAR` con el código viejo desplegado rompe las pantallas de esas semanas. Y dentro de la Task 8, la línea base del porcentaje se toma **antes** de escribir.
- **Reversión:** `respaldo-vencidas.json` tiene el estado previo de cada fila; volver atrás es un `updateMany` por lista de identificadores a `estado: 'PENDIENTE'`, `cerrada: false`.
- **La base es real y está en uso.** Nunca `deleteMany` global, nunca `migrate reset`. El cierre es un `updateMany` acotado por semana y estado, y no toca ninguna otra columna.

# Resumen 100% por actividad — Implementation Plan

> ✅ **COMPLETADO** — implementado, revisado (final opus: Ready to merge) y desplegado a producción (commits e8554f5..5b63756, deploy dpl_HKFVJZkvm2SHyR5CvZvAT5TqzxgQ).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Que todas las métricas de `/resumen` se evalúen por actividad (agrupando filas-hermanas por `tareaId`), de modo que una actividad culminada cuente una vez y su medida de maquinaria (ha/kg/horas) se cuente una sola vez.

**Architecture:** Las funciones de dominio que hoy cuentan por fila (`porcentajeReprogramadas`, `motivosFrecuentes`, `extremosFinalizadas`, `actividadesConCambio`) se reescriben para agrupar por `tareaId` internamente, siguiendo recibiendo `Actividad[]` crudas. La medida (ha/kg/horas), que depende de `lotes[].hectareas` ausente en el tipo de dominio, se consolida en el componente `resumen-area.tsx`, que arma **una fila por actividad** y se la pasa a `medidasPorUnidad` (sin cambios). Reutilizamos los helpers existentes `agruparPorActividad` y `estadoActividad`.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Vitest.

## Global Constraints

- Se prueban con unidad las funciones de **dominio**; el componente/RSC se verifica con typecheck + ejecución (convención del repo).
- Vitest: `npm test`; archivos `*.test.ts` junto al fuente; `import { describe, it, expect } from 'vitest'`.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- Agrupador canónico: `agruparPorActividad(items)` (`src/dominio/metricas.ts:40`) → clave `tareaId ?? "solo:${id}"`. Estado agrupado: `estadoActividad(dias)` (`src/dominio/metricas.ts:56`) → estado común o `PARCIAL` si hay mezcla.
- Las filas-hermanas (mismo `tareaId`) comparten `vecesReprogramada`, `motivoId`, lotes y `haRealizada` (idénticos); por eso al consolidar se toma una sola fila representativa.

---

### Task 1: `porcentajeReprogramadas` por actividad

**Files:**
- Modify: `src/dominio/metricas.ts:163-167`
- Test: `src/dominio/metricas.test.ts` (reemplaza el `describe('porcentajeReprogramadas')` existente, ~líneas 119-133)

**Interfaces:**
- Consumes: `agruparPorActividad(actividades)` (ya existe en el mismo archivo).
- Produces: `porcentajeReprogramadas(actividades: Actividad[]): number` (firma sin cambios; ahora cuenta por actividad).

- [x] **Step 1: Reemplazar el test existente por la versión por actividad**

En `src/dominio/metricas.test.ts`, sustituir el bloque `describe('porcentajeReprogramadas', ...)` actual por:

```ts
describe('porcentajeReprogramadas', () => {
  it('calcula el % de ACTIVIDADES con vecesReprogramada > 0 (no por fila)', () => {
    const acts = [
      act({ id: 'a', tareaId: 'T1', vecesReprogramada: 0 }),
      act({ id: 'b', tareaId: 'T2', vecesReprogramada: 1 }),
      act({ id: 'c', tareaId: 'T3', vecesReprogramada: 3 }),
      act({ id: 'd', tareaId: 'T4', vecesReprogramada: 0 }),
    ]
    // 2 de 4 actividades -> 50
    expect(porcentajeReprogramadas(acts)).toBe(50)
  })
  it('una actividad multi-fila reprogramada cuenta UNA vez', () => {
    const acts = [
      act({ id: 'a1', tareaId: 'T1', dia: 1, vecesReprogramada: 2 }),
      act({ id: 'a2', tareaId: 'T1', dia: 2, vecesReprogramada: 2 }),
      act({ id: 'a3', tareaId: 'T1', dia: 3, vecesReprogramada: 2 }),
      act({ id: 'b', tareaId: 'T2', vecesReprogramada: 0 }),
    ]
    // 1 de 2 actividades -> 50  (por fila daría 3/4 = 75)
    expect(porcentajeReprogramadas(acts)).toBe(50)
  })
  it('devuelve 0 con lista vacía', () => {
    expect(porcentajeReprogramadas([])).toBe(0)
  })
})
```

- [x] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- metricas`
Expected: FALLA en "una actividad multi-fila reprogramada cuenta UNA vez" (hoy da 75, no 50).

- [x] **Step 3: Implementar la versión por actividad**

En `src/dominio/metricas.ts`, reemplazar el cuerpo de `porcentajeReprogramadas` (líneas 163-167) por:

```ts
export function porcentajeReprogramadas(actividades: Actividad[]): number {
  const grupos = agruparPorActividad(actividades)
  if (grupos.size === 0) return 0
  let reprog = 0
  for (const filas of grupos.values()) {
    if (filas.some((f) => f.vecesReprogramada > 0)) reprog += 1
  }
  return Math.round((reprog / grupos.size) * 100)
}
```

- [x] **Step 4: Correr el test para verlo pasar**

Run: `npm test -- metricas`
Expected: PASS (los 3 casos del `describe`).

- [x] **Step 5: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts
git commit -m "feat(resumen): porcentajeReprogramadas cuenta por actividad (no por fila)"
```

---

### Task 2: `motivosFrecuentes` por actividad

**Files:**
- Modify: `src/dominio/metricas.ts:220-229`
- Test: `src/dominio/metricas.test.ts` (reemplaza el `describe('motivosFrecuentes')` existente)

**Interfaces:**
- Consumes: `agruparPorActividad(actividades)`.
- Produces: `motivosFrecuentes(actividades: Actividad[]): ConteoMotivo[]` (firma sin cambios).

- [x] **Step 1: Reemplazar el test existente**

En `src/dominio/metricas.test.ts`, sustituir el bloque `describe('motivosFrecuentes', ...)` por:

```ts
describe('motivosFrecuentes', () => {
  it('cuenta por motivoId a nivel de ACTIVIDAD, ignora sin motivo, ordenado desc', () => {
    const acts = [
      act({ id: 'a', tareaId: 'T1', motivoId: 'clima' }),
      act({ id: 'b', tareaId: 'T2', motivoId: 'clima' }),
      act({ id: 'c', tareaId: 'T3', motivoId: 'maquina' }),
      act({ id: 'd', tareaId: 'T4', motivoId: null }),
    ]
    expect(motivosFrecuentes(acts)).toEqual([
      { motivoId: 'clima', conteo: 2 },
      { motivoId: 'maquina', conteo: 1 },
    ])
  })
  it('una actividad multi-fila con el mismo motivo cuenta UNA vez', () => {
    const acts = [
      act({ id: 'a1', tareaId: 'T1', dia: 1, motivoId: 'clima' }),
      act({ id: 'a2', tareaId: 'T1', dia: 2, motivoId: 'clima' }),
      act({ id: 'a3', tareaId: 'T1', dia: 3, motivoId: 'clima' }),
    ]
    // por fila daría 3; por actividad = 1
    expect(motivosFrecuentes(acts)).toEqual([{ motivoId: 'clima', conteo: 1 }])
  })
  it('devuelve lista vacía si no hay motivos', () => {
    expect(motivosFrecuentes([act({ motivoId: null })])).toEqual([])
  })
})
```

- [x] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- metricas`
Expected: FALLA en "una actividad multi-fila con el mismo motivo cuenta UNA vez" (hoy da 3).

- [x] **Step 3: Implementar la versión por actividad**

En `src/dominio/metricas.ts`, reemplazar el cuerpo de `motivosFrecuentes` (líneas 220-229) por:

```ts
export function motivosFrecuentes(actividades: Actividad[]): ConteoMotivo[] {
  const conteo = new Map<string, number>()
  for (const filas of agruparPorActividad(actividades).values()) {
    const motivoId = filas.find((f) => f.motivoId)?.motivoId
    if (!motivoId) continue
    conteo.set(motivoId, (conteo.get(motivoId) ?? 0) + 1)
  }
  return [...conteo.entries()]
    .map(([motivoId, c]) => ({ motivoId, conteo: c }))
    .sort((a, b) => b.conteo - a.conteo)
}
```

- [x] **Step 4: Correr el test para verlo pasar**

Run: `npm test -- metricas`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts
git commit -m "feat(resumen): motivosFrecuentes cuenta por actividad (no por fila)"
```

---

### Task 3: `extremosFinalizadas` por actividad

**Files:**
- Modify: `src/dominio/resumen.ts` (import nuevo + cuerpo de `extremosFinalizadas`, líneas 30-45)
- Test: `src/dominio/resumen.test.ts` (reemplaza el `describe('extremosFinalizadas')` existente)

**Interfaces:**
- Consumes: `agruparPorActividad`, `estadoActividad` (de `./metricas`).
- Produces: `extremosFinalizadas(actividades: Actividad[]): { mas: FilaFinalizadas | null; menos: FilaFinalizadas | null }` (firma sin cambios; cada actividad CUMPLIDA suma 1 a cada responsable asignado).

- [x] **Step 1: Reemplazar el test existente**

En `src/dominio/resumen.test.ts`, sustituir el bloque `describe('extremosFinalizadas', ...)` por:

```ts
describe('extremosFinalizadas', () => {
  it('cuenta ACTIVIDADES finalizadas por responsable (no filas)', () => {
    const acts = [
      act({ id: 'a', tareaId: 'T1', responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ id: 'b', tareaId: 'T2', responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ id: 'c', tareaId: 'T3', responsableId: 'B', estado: 'CUMPLIDA' }),
      act({ id: 'd', tareaId: 'T4', responsableId: 'B', estado: 'PARCIAL' }),
      act({ id: 'e', tareaId: 'T5', responsableId: 'C', estado: 'NO_CUMPLIDA' }),
    ]
    const { mas, menos } = extremosFinalizadas(acts)
    expect(mas).toEqual({ responsableId: 'A', finalizadas: 2 })
    expect(menos).toEqual({ responsableId: 'C', finalizadas: 0 })
  })
  it('una actividad multi-día cumplida cuenta UNA vez para su responsable', () => {
    const acts = [
      act({ id: 'a1', tareaId: 'T1', dia: 1, responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ id: 'a2', tareaId: 'T1', dia: 2, responsableId: 'A', estado: 'CUMPLIDA' }),
      act({ id: 'a3', tareaId: 'T1', dia: 3, responsableId: 'A', estado: 'CUMPLIDA' }),
    ]
    const { mas } = extremosFinalizadas(acts)
    expect(mas).toEqual({ responsableId: 'A', finalizadas: 1 }) // por fila daría 3
  })
  it('una actividad con 2 responsables cumplida suma 1 a cada uno', () => {
    const acts = [
      act({ id: 'p1', tareaId: 'T1', dia: 1, responsableId: 'P', estado: 'CUMPLIDA' }),
      act({ id: 'j1', tareaId: 'T1', dia: 1, responsableId: 'J', estado: 'CUMPLIDA' }),
    ]
    const { mas, menos } = extremosFinalizadas(acts)
    expect(mas?.finalizadas).toBe(1)
    expect(menos?.finalizadas).toBe(1)
  })
  it('devuelve null si no hay actividades', () => {
    expect(extremosFinalizadas([])).toEqual({ mas: null, menos: null })
  })
})
```

- [x] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- resumen`
Expected: FALLA en "una actividad multi-día cumplida cuenta UNA vez" (hoy da 3).

- [x] **Step 3: Añadir el import en `resumen.ts`**

En `src/dominio/resumen.ts`, debajo de los imports existentes (tras la línea 2 `import type { Unidad } from './unidad'`), añadir:

```ts
import { agruparPorActividad, estadoActividad } from './metricas'
```

- [x] **Step 4: Implementar la versión por actividad**

En `src/dominio/resumen.ts`, reemplazar el cuerpo de `extremosFinalizadas` (líneas 30-45) por:

```ts
export function extremosFinalizadas(
  actividades: Actividad[],
): { mas: FilaFinalizadas | null; menos: FilaFinalizadas | null } {
  const conteo = new Map<string, number>()
  // Todo responsable que aparezca arranca en 0 (para que "menos" pueda ser 0).
  for (const a of actividades) {
    if (!conteo.has(a.responsableId)) conteo.set(a.responsableId, 0)
  }
  // Cada actividad CUMPLIDA suma 1 a cada responsable distinto del grupo.
  for (const filas of agruparPorActividad(actividades).values()) {
    if (estadoActividad(filas) !== 'CUMPLIDA') continue
    for (const rid of new Set(filas.map((f) => f.responsableId))) {
      conteo.set(rid, (conteo.get(rid) ?? 0) + 1)
    }
  }
  const filas: FilaFinalizadas[] = [...conteo.entries()].map(([responsableId, finalizadas]) => ({
    responsableId,
    finalizadas,
  }))
  if (filas.length === 0) return { mas: null, menos: null }
  filas.sort((a, b) => b.finalizadas - a.finalizadas)
  return { mas: filas[0], menos: filas[filas.length - 1] }
}
```

- [x] **Step 5: Correr el test para verlo pasar**

Run: `npm test -- resumen`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/dominio/resumen.ts src/dominio/resumen.test.ts
git commit -m "feat(resumen): extremosFinalizadas cuenta actividades por responsable (no filas)"
```

---

### Task 4: `actividadesConCambio` por actividad (sin duplicar)

**Files:**
- Modify: `src/dominio/resumen.ts:18-22`
- Test: `src/dominio/resumen.test.ts` (añadir un `it` al `describe('actividadesConCambio')` existente)

**Interfaces:**
- Consumes: `agruparPorActividad`, `estadoActividad` (importados en Task 3).
- Produces: `actividadesConCambio(actividades: Actividad[]): Actividad[]` (firma sin cambios; devuelve UNA fila representativa por actividad con estado agrupado de cambio).

- [x] **Step 1: Añadir el caso multi-fila al test**

En `src/dominio/resumen.test.ts`, dentro del `describe('actividadesConCambio', ...)`, añadir este `it` (después del caso "no muta"):

```ts
  it('una actividad con varias filas aparece UNA sola vez', () => {
    const acts = [
      act({ id: 'a1', tareaId: 'T1', dia: 1, estado: 'NO_CUMPLIDA' }),
      act({ id: 'a2', tareaId: 'T1', dia: 2, estado: 'NO_CUMPLIDA' }),
      act({ id: 'b1', tareaId: 'T2', dia: 1, estado: 'CUMPLIDA' }),
    ]
    const r = actividadesConCambio(acts)
    expect(r.length).toBe(1)
    expect(r[0].tareaId).toBe('T1')
  })
```

- [x] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- resumen`
Expected: FALLA en "una actividad con varias filas aparece UNA sola vez" (hoy devuelve 2 filas).

- [x] **Step 3: Implementar la versión por actividad**

En `src/dominio/resumen.ts`, reemplazar el cuerpo de `actividadesConCambio` (líneas 18-22) por:

```ts
export function actividadesConCambio(actividades: Actividad[]): Actividad[] {
  const reps: Actividad[] = []
  for (const filas of agruparPorActividad(actividades).values()) {
    if (!ESTADOS_CON_CAMBIO.includes(estadoActividad(filas))) continue
    // Fila representativa: la de menor día (conserva descripción, responsable, motivo, nota).
    const base = [...filas].sort((a, b) => a.dia - b.dia)[0]
    reps.push(base)
  }
  return reps.sort((a, b) => b.vecesReprogramada - a.vecesReprogramada || a.dia - b.dia)
}
```

- [x] **Step 4: Correr el test para verlo pasar**

Run: `npm test -- resumen`
Expected: PASS (incluido el caso nuevo y los 2 existentes: orden ['4','5','3'] y "no muta").

- [x] **Step 5: Commit**

```bash
git add src/dominio/resumen.ts src/dominio/resumen.test.ts
git commit -m "feat(resumen): actividadesConCambio devuelve una fila por actividad"
```

---

### Task 5: Consolidar el componente `resumen-area.tsx` por actividad

**Files:**
- Modify: `src/app/resumen/resumen-area.tsx` (imports, tipo `ActividadResumen`, bloque de cálculo líneas 61-102, detalle por estado líneas 152-163)

**Interfaces:**
- Consumes: `agruparPorActividad`, `estadoActividad`, `medidasPorUnidad`, `unidadDe` (ya disponibles); tipo `Estado` de `@/dominio/tipos`.
- Produces: nada para otras tareas (capa de presentación).

- [x] **Step 1: Ampliar imports**

En `src/app/resumen/resumen-area.tsx`, reemplazar la línea 1:

```ts
import { porcentajeCumplimiento, porcentajeReprogramadas, motivosFrecuentes, colorSemaforo, conteoEstadoActividades, agruparPorActividad } from '@/dominio/metricas'
```

por:

```ts
import { porcentajeCumplimiento, porcentajeReprogramadas, motivosFrecuentes, colorSemaforo, conteoEstadoActividades, agruparPorActividad, estadoActividad } from '@/dominio/metricas'
```

Y en el import de tipos (línea 8) añadir `Estado`:

```ts
import type { Actividad as ActividadDominio, Estado } from '@/dominio/tipos'
```

- [x] **Step 2: Añadir `tareaId` al tipo `ActividadResumen`**

En el tipo `ActividadResumen` (líneas 28-40), añadir el campo `tareaId` (justo después de `id`):

```ts
type ActividadResumen = {
  id: string
  tareaId: string | null
  estado: string
```

- [x] **Step 3: Reemplazar el bloque de cálculo por la versión consolidada**

Reemplazar TODO el bloque de las líneas 61-102 (desde `const dominio = ...` hasta `const medidaActividadLista = ...`) por:

```ts
  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const pctRep = porcentajeReprogramadas(dominio)
  // Conteo por actividad única (agrupada por tareaId)
  const conteo = conteoEstadoActividades(dominio)
  const totalActividades = agruparPorActividad(dominio).size
  const { mas, menos } = extremosFinalizadas(dominio)
  const motivosTop = motivosFrecuentes(dominio)
  const cambios = actividadesConCambio(dominio) as unknown as ActividadResumen[]

  const nombrePorId = new Map(responsables.map((r) => [r.id, r.nombre]))
  const nombreResp = (id: string) => nombrePorId.get(id) ?? 'Responsable'
  const nombreMotivo = new Map(motivos.map((m) => [m.id, m.nombre]))

  const haActividad = (a: ActividadResumen) => a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)

  // Una sola "actividad" por grupo (tareaId): estado agrupado y medida tomada UNA vez.
  // Las filas-hermanas comparten lotes y haRealizada, así que NO se suman entre sí.
  const actividadesUnicas = [...agruparPorActividad(actividades).values()].map((filas) => {
    const base = filas[0]
    return {
      id: base.id,
      estado: estadoActividad(filas.map((f) => ({ estado: f.estado as Estado }))),
      descripcion: base.descripcion,
      unidad: unidadDe(unidadPorNombre, base.descripcion),
      haProgramada: haActividad(base),
      haRealizada: base.haRealizada ?? null,
      lotes: base.lotes,
      maquinas: new Set(filas.map((f) => f.maquina?.nombre).filter((n): n is string => !!n)),
      responsable: base.responsable,
      noProgramada: base.noProgramada,
    }
  })

  const nuevas = actividadesUnicas.filter((a) => a.noProgramada)

  const totales = medidasPorUnidad(
    actividadesUnicas.map((a) => ({
      estado: a.estado,
      haProgramada: a.haProgramada,
      haRealizada: a.haRealizada,
      unidad: a.unidad,
    })),
  )
  const totalUnidades = (['ha', 'hora', 'kg'] as Unidad[])
    .filter((u) => totales[u] > 0)
    .map((u) => `${totales[u]} ${unidadAbreviada(u)}`)
    .join(' · ')

  // Lista "realizado por actividad": suma la medida (única) de cada actividad por descripción.
  const medidaPorActividad = new Map<string, { valor: number; unidad: Unidad }>()
  for (const a of actividadesUnicas) {
    if (a.estado === 'PENDIENTE') continue
    const realizada = a.haRealizada ?? (a.unidad === 'ha' && a.estado === 'CUMPLIDA' ? a.haProgramada : 0)
    const prev = medidaPorActividad.get(a.descripcion)
    medidaPorActividad.set(a.descripcion, {
      valor: (prev?.valor ?? 0) + realizada,
      unidad: a.unidad,
    })
  }
  const medidaActividadLista = [...medidaPorActividad.entries()].sort((a, b) => b[1].valor - a[1].valor)
```

> Nota: `nuevas` ahora se deriva de `actividadesUnicas` (antes era `actividades.filter(...)`). El JSX de la sección "Actividades nuevas" y la tarjeta `{nuevas.length}` no cambian (usan `a.id`, `a.descripcion`, `a.responsable.nombre`, `a.lotes`, todos presentes).

- [x] **Step 4: Adaptar el "Detalle por estado" a actividades únicas**

En el bloque `ESTADOS_ORDEN.map(...)` (líneas 152-163), reemplazar:

```tsx
          const acts = actividades.filter((a) => a.estado === v)
          if (acts.length === 0) return null
          const grupos = new Map<string, { descripcion: string; lotes: string[]; maquinas: Set<string>; conteo: number }>()
          for (const a of acts) {
            const lotesNombres = a.lotes.map((l) => l.nombre).sort()
            const clave = `${a.descripcion}|${lotesNombres.join(',')}`
            const g = grupos.get(clave) ?? { descripcion: a.descripcion, lotes: lotesNombres, maquinas: new Set<string>(), conteo: 0 }
            g.conteo += 1
            if (a.maquina) g.maquinas.add(a.maquina.nombre)
            grupos.set(clave, g)
          }
```

por:

```tsx
          const acts = actividadesUnicas.filter((a) => a.estado === v)
          if (acts.length === 0) return null
          const grupos = new Map<string, { descripcion: string; lotes: string[]; maquinas: Set<string>; conteo: number }>()
          for (const a of acts) {
            const lotesNombres = a.lotes.map((l) => l.nombre).sort()
            const clave = `${a.descripcion}|${lotesNombres.join(',')}`
            const g = grupos.get(clave) ?? { descripcion: a.descripcion, lotes: lotesNombres, maquinas: new Set<string>(), conteo: 0 }
            g.conteo += 1
            for (const m of a.maquinas) g.maquinas.add(m)
            grupos.set(clave, g)
          }
```

Y en el encabezado del estado (línea ~167), cambiar el conteo para que cuadre con los chips (nº de actividades, no de grupos descripción+lotes):

```tsx
              <div className="text-sm font-semibold text-tinta">{etq} ({acts.length})</div>
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
Expected: PASS (todo el suite, incluidos Tasks 1-4).

- [x] **Step 7: Verificación manual**

Run: `npm run dev` y abrir `/resumen` en un área de **maquinaria** con una semana que tenga una labor de **varios días** (o varios responsables).
Verificar:
- "Realizado" (ha/kg/horas) muestra el total **una vez** (p. ej. 10 ha, no 30).
- "Cumplidas/total", chips y Cumplimiento % siguen igual que antes.
- La lista "Actividades cambiadas o reprogramadas" muestra cada actividad **una sola vez** (no una por responsable).
- "Motivos más frecuentes" y "Reprogramadas %" no inflan por multi-fila.
- El encabezado de cada estado en "Detalle por estado" coincide con el número del chip correspondiente.
Si no hay datos multi-día a mano, dejar constancia y validar en el deploy de preview.

- [x] **Step 8: Commit**

```bash
git add src/app/resumen/resumen-area.tsx
git commit -m "feat(resumen): consolidar resumen por actividad (medida única, sin duplicar por fila)"
```

---

## Notas de cierre

- No se toca cómo se captura/guarda el avance (`registrarAvanceLoteGrupo`, `marcarCumplidaGrupo`): el `haRealizada` sigue idéntico en cada fila; el resumen solo lo lee una vez por actividad.
- `medidasPorUnidad` y `hectareasRealizadas` no cambian; el arreglo es alimentarlas con una fila por actividad.
- Semántica de PARCIAL para "Realizado" se mantiene (PARCIAL sin `haRealizada` aporta 0).
- Despliegue: tras revisar, seguir el flujo habitual de Vercel (ver memoria de despliegue). El build de Vercel regenera `.next` limpio y corre el typecheck real.

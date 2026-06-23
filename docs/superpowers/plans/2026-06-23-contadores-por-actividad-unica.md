# Contadores por actividad única Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los contadores de `/cumplimiento` y `/resumen` cuenten **actividades únicas** (agrupadas por tarea) en vez de filas-día, sin tocar el modelo de datos ni el `%` (que ya está agrupado).

**Architecture:** Se agregan helpers puros en `src/dominio/metricas.ts` que derivan el estado de una actividad a partir de sus filas-día y cuentan actividades agrupadas por `tareaId` (reutilizando `agruparPorActividad`). Las páginas `cumplimiento/page.tsx` y `resumen/resumen-area.tsx` reemplazan los conteos crudos (`actividades.length`, `conteoPorEstado`) por estos helpers.

**Tech Stack:** Next.js (App Router, RSC), TypeScript, Vitest.

## Global Constraints

- **Agrupación:** por `tareaId` (filas con el mismo `tareaId` = una actividad; `tareaId = null` → cada fila es su propia actividad, clave `solo:${id}`). Usar el helper existente `agruparPorActividad`. No introducir otra clave de agrupación.
- **Estado de una actividad agrupada:** Cumplida si **todas** las filas-día son `CUMPLIDA`; Pendiente si todas `PENDIENTE`; No cumplida si todas `NO_CUMPLIDA`; Reprogramada si todas `REPROGRAMADA`; **Parcial** en cualquier mezcla.
- **Bloqueo de semana / aviso:** cuenta las actividades con **algún día `PENDIENTE`** (no el estado agrupado), para seguir obligando a registrar todos los días.
- **No cambiar** el modelo de filas-día, `asignarTarea`, el Excel, ni `porcentajeCumplimiento` (ya agrupado).
- Comentarios en español; color de marca `#11603a`.
- `Estado` = `'PENDIENTE' | 'CUMPLIDA' | 'PARCIAL' | 'NO_CUMPLIDA' | 'REPROGRAMADA'` (en `src/dominio/tipos.ts`).

---

### Task 1: Helpers de dominio (`estadoActividad`, `tieneDiaPendiente`, `conteoEstadoActividades`)

**Files:**
- Modify: `src/dominio/metricas.ts`
- Test: `src/dominio/metricas.test.ts`

**Interfaces:**
- Consumes: `agruparPorActividad` (ya en `metricas.ts`); `type Estado` (`./tipos`).
- Produces:
  - `estadoActividad(dias: { estado: Estado }[]): Estado`
  - `tieneDiaPendiente(dias: { estado: Estado }[]): boolean`
  - `conteoEstadoActividades<T extends { id: string; tareaId?: string | null; estado: Estado }>(actividades: T[]): Record<Estado, number>`

- [ ] **Step 1: Escribir las pruebas (que fallan)**

En `src/dominio/metricas.test.ts`, agregar (ajusta el import existente de `./metricas` para incluir los tres nombres nuevos; no dupliques el import):

```ts
import { estadoActividad, tieneDiaPendiente, conteoEstadoActividades } from './metricas'

describe('estadoActividad', () => {
  it('si todas las filas comparten estado, devuelve ese estado', () => {
    expect(estadoActividad([{ estado: 'CUMPLIDA' }, { estado: 'CUMPLIDA' }])).toBe('CUMPLIDA')
    expect(estadoActividad([{ estado: 'PENDIENTE' }])).toBe('PENDIENTE')
    expect(estadoActividad([{ estado: 'NO_CUMPLIDA' }, { estado: 'NO_CUMPLIDA' }])).toBe('NO_CUMPLIDA')
  })
  it('si hay mezcla de estados, devuelve PARCIAL', () => {
    expect(estadoActividad([{ estado: 'CUMPLIDA' }, { estado: 'PENDIENTE' }])).toBe('PARCIAL')
    expect(estadoActividad([{ estado: 'PARCIAL' }, { estado: 'CUMPLIDA' }])).toBe('PARCIAL')
  })
})

describe('tieneDiaPendiente', () => {
  it('true si alguna fila está PENDIENTE', () => {
    expect(tieneDiaPendiente([{ estado: 'CUMPLIDA' }, { estado: 'PENDIENTE' }])).toBe(true)
  })
  it('false si ninguna fila está PENDIENTE', () => {
    expect(tieneDiaPendiente([{ estado: 'CUMPLIDA' }, { estado: 'PARCIAL' }])).toBe(false)
  })
})

describe('conteoEstadoActividades', () => {
  it('cuenta actividades agrupadas por tareaId usando el estado agrupado', () => {
    const acts = [
      // tarea T1: dos días, mezcla -> PARCIAL
      { id: 'a', tareaId: 'T1', estado: 'CUMPLIDA' as const },
      { id: 'b', tareaId: 'T1', estado: 'PENDIENTE' as const },
      // tarea T2: un día cumplido -> CUMPLIDA
      { id: 'c', tareaId: 'T2', estado: 'CUMPLIDA' as const },
      // suelta sin tarea: PENDIENTE
      { id: 'd', tareaId: null, estado: 'PENDIENTE' as const },
    ]
    expect(conteoEstadoActividades(acts)).toEqual({
      PENDIENTE: 1, CUMPLIDA: 1, PARCIAL: 1, NO_CUMPLIDA: 0, REPROGRAMADA: 0,
    })
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- src/dominio/metricas.test.ts`
Expected: FALLA — `estadoActividad`, `tieneDiaPendiente`, `conteoEstadoActividades` no existen.

- [ ] **Step 3: Implementar los helpers**

En `src/dominio/metricas.ts`, agregar (después de `agruparPorActividad`):

```ts
// Estado de UNA actividad a partir de sus filas-día: si todas comparten estado,
// ese estado; si hay mezcla, PARCIAL. (Una actividad con días en distinto estado
// está, por definición, parcialmente cumplida.)
export function estadoActividad(dias: { estado: Estado }[]): Estado {
  const estados = new Set(dias.map((d) => d.estado))
  if (estados.size === 1) return [...estados][0]
  return 'PARCIAL'
}

// ¿La actividad tiene algún día aún sin registrar (PENDIENTE)?
export function tieneDiaPendiente(dias: { estado: Estado }[]): boolean {
  return dias.some((d) => d.estado === 'PENDIENTE')
}

// Cuenta actividades (agrupadas por tareaId) por su estado agrupado.
export function conteoEstadoActividades<
  T extends { id: string; tareaId?: string | null; estado: Estado },
>(actividades: T[]): Record<Estado, number> {
  const r: Record<Estado, number> = {
    PENDIENTE: 0, CUMPLIDA: 0, PARCIAL: 0, NO_CUMPLIDA: 0, REPROGRAMADA: 0,
  }
  for (const dias of agruparPorActividad(actividades).values()) {
    r[estadoActividad(dias)] += 1
  }
  return r
}
```

> `Estado` ya se importa en este archivo (`import type { Actividad, Estado } from './tipos'`, línea 1). Si no estuviera, agrégalo.

- [ ] **Step 4: Correr la suite**

Run: `npm test`
Expected: PASA (incluye las pruebas nuevas).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/`.

- [ ] **Step 6: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts
git commit -m "feat(dominio): estadoActividad/tieneDiaPendiente/conteoEstadoActividades (conteo por actividad)"
```

---

### Task 2: Contadores de `/cumplimiento` por actividad única

**Files:**
- Modify: `src/app/cumplimiento/page.tsx` (líneas ~78, ~86-93, ~150)

**Interfaces:**
- Consumes: `conteoEstadoActividades`, `tieneDiaPendiente`, `agruparPorActividad` (`@/dominio/metricas`); el cast `dominio` ya existente en el archivo.
- Produces: nada para tareas posteriores.

- [ ] **Step 1: Ampliar el import de métricas**

En `src/app/cumplimiento/page.tsx`, agregar `conteoEstadoActividades` y `tieneDiaPendiente` al import de `@/dominio/metricas` (que ya trae `agruparPorActividad` y `porcentajeCumplimiento`). No dupliques el import.

- [ ] **Step 2: Reemplazar los conteos crudos por conteos agrupados**

Hoy (líneas 78 y 86-93):

```ts
  const pendientes = actividades.filter((a) => a.estado === 'PENDIENTE').length
  ...
  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const conteoEstado = {
    CUMPLIDA: actividades.filter((a) => a.estado === 'CUMPLIDA').length,
    PARCIAL: actividades.filter((a) => a.estado === 'PARCIAL').length,
    NO_CUMPLIDA: actividades.filter((a) => a.estado === 'NO_CUMPLIDA').length,
    REPROGRAMADA: actividades.filter((a) => a.estado === 'REPROGRAMADA').length,
  }
```

Dejarlo así (mover `pendientes` a después del cast `dominio`, y derivar todo de los grupos):

```ts
  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  // Contadores por actividad única (agrupada por tarea), no por filas-día.
  const gruposDominio = [...agruparPorActividad(dominio).values()]
  const totalActividades = gruposDominio.length
  const conteoEstado = conteoEstadoActividades(dominio)
  // Actividades que aún tienen algún día sin registrar (para aviso y bloqueo de semana).
  const pendientes = gruposDominio.filter(tieneDiaPendiente).length
```

(Eliminar la antigua línea 78 `const pendientes = ...` y el antiguo objeto `conteoEstado`.)

- [ ] **Step 3: Usar `totalActividades` en la franja de conteo**

En la franja de estado (hoy línea ~150), cambiar `de {actividades.length}` por `de {totalActividades}`:

```tsx
        <span className="rounded bg-gray-100 px-3 py-1 text-sm">
          ✅ <b>{conteoEstado.CUMPLIDA}</b> · 🟡 <b>{conteoEstado.PARCIAL}</b> · 🔴 <b>{conteoEstado.NO_CUMPLIDA}</b> · 🔄 <b>{conteoEstado.REPROGRAMADA}</b>{' '}
          <span className="text-gray-400">de {totalActividades}</span>
        </span>
```

> El bloque `pct` (Cumplido: %) y el aviso/bloqueo de semana (`pendientes > 0`) no cambian de forma; solo ahora `pendientes` y `conteoEstado` son por actividad.

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores en `src/` (ignora errores preexistentes en `.next/`). No debe quedar ningún uso de `actividades.filter((a) => a.estado === ...)` para los contadores ni `actividades.length` en la franja.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): contadores y bloqueo de semana por actividad única"
```

---

### Task 3: Conteo del resumen por actividad única

**Files:**
- Modify: `src/app/resumen/resumen-area.tsx` (líneas ~65, ~121, ~143-147)

**Interfaces:**
- Consumes: `conteoEstadoActividades`, `agruparPorActividad` (`@/dominio/metricas`); el cast `dominio` ya existente en el archivo (el que se pasa a `conteoPorEstado`).
- Produces: nada para tareas posteriores.

- [ ] **Step 1: Ampliar imports y reemplazar el conteo**

En `src/app/resumen/resumen-area.tsx`:

(a) Agregar al import de `@/dominio/metricas` los nombres `conteoEstadoActividades` y `agruparPorActividad` (junto a los que ya importe de ese módulo). Quitar `conteoPorEstado` del import de `@/dominio/resumen` **solo si no se usa en ningún otro lugar del archivo** (verifícalo con búsqueda; hoy su único uso es la línea 65).

(b) Cambiar (línea ~65):

```ts
  const conteo = conteoPorEstado(dominio)
```

por:

```ts
  const conteo = conteoEstadoActividades(dominio)
  const totalActividades = agruparPorActividad(dominio).size
```

- [ ] **Step 2: Usar el total agrupado en la tarjeta "Cumplidas X/Total"**

En la línea ~121, cambiar `/{actividades.length}` por `/{totalActividades}`:

```tsx
            {conteo.CUMPLIDA}<span className="text-2xl font-semibold text-gray-400">/{totalActividades}</span>
```

> Las píldoras ✅🟡🔴🔄⏳ (líneas 143-147) ya leen de `conteo`, que ahora es por actividad; no cambian de forma. La sección "Detalle por estado" (agrupada por descripción+lotes, líneas 154+) y "medidaPorActividad" no se tocan.

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores en `src/`. Si `tsc` marca que `conteoPorEstado` quedó importado sin uso, elimínalo del import.

- [ ] **Step 4: Commit**

```bash
git add src/app/resumen/resumen-area.tsx
git commit -m "feat(resumen): conteo de actividades por actividad única"
```

- [ ] **Step 5: Verificación manual (producción tras desplegar)**

En `/cumplimiento` área ganadería: el contador deja de decir "de 67" y muestra el número de actividades únicas; el bloqueo de "Semana →" sigue activo mientras falte registrar algún día. En `/resumen` el "Cumplidas X/Total" usa el total agrupado.

---

## Self-Review

**Spec coverage:**
- `estadoActividad` (todas iguales / mezcla) → Task 1. ✅
- `tieneDiaPendiente` para aviso/bloqueo → Task 1 + Task 2. ✅
- Contadores de cumplimiento por actividad (`de N`, ✅🟡🔴🔄, pendientes) → Task 2. ✅
- Resumen `N/Total` y píldoras por actividad → Task 3. ✅
- No tocar `%`, modelo de filas-día, Excel → ninguna task los toca. ✅

**Placeholder scan:** sin TBD/TODO; código completo en cada paso.

**Type consistency:** `estadoActividad(dias: {estado: Estado}[]): Estado`, `tieneDiaPendiente(dias: {estado: Estado}[]): boolean`, `conteoEstadoActividades<T extends {id; tareaId?; estado: Estado}>(acts): Record<Estado, number>` — mismas firmas en Task 1 (definición) y Tasks 2-3 (consumo). El cast `dominio` (a `ActividadDominio[]`/`Actividad[]`) ya existe en ambas páginas y satisface el constraint `{id, tareaId?, estado}`.

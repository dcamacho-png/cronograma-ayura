# Resumen PARCIAL-con-motivo + finca en grilla Implementation Plan

> ✅ **COMPLETADO** — implementado, revisado (MERGE) y desplegado a producción (commits dbd800b + c4a715b, deploy cronograma-ayura-da4fkelhm); verificado por la usuaria.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** (#1) Que "Actividades cambiadas o reprogramadas" incluya PARCIAL solo si tiene motivo (novedad), no por avance normal; y (#2) mostrar la finca por actividad en la grilla de maquinaria (pantalla + export).

**Architecture:** #1 ajusta el criterio de `actividadesConCambio` en el dominio (con tests). #2 es presentación: añade la finca al tipo y a la celda de `GrillaSemana`. Ambas tareas son independientes.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Vitest, Tailwind.

## Global Constraints

- Funciones de **dominio** con Vitest; componente/RSC con typecheck + ejecución (convención del repo).
- Vitest: `npm test`; `import { describe, it, expect } from 'vitest'`.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- `agruparPorActividad` y `estadoActividad` ya están importados en `src/dominio/resumen.ts`.

---

### Task 1: PARCIAL entra a "cambiadas/reprogramadas" solo con motivo

**Files:**
- Modify: `src/dominio/resumen.ts` (`actividadesConCambio` + la constante de estados)
- Test: `src/dominio/resumen.test.ts` (actualizar 1 caso + añadir 1 `it`)

**Interfaces:**
- Produces: `actividadesConCambio(actividades: Actividad[]): Actividad[]` (misma firma; nuevo criterio de inclusión para PARCIAL).

- [x] **Step 1: Actualizar y ampliar los tests**

En `src/dominio/resumen.test.ts`, dentro de `describe('actividadesConCambio', …)`:

(a) En el primer `it` ("incluye solo PARCIAL / NO_CUMPLIDA / REPROGRAMADA…"), darle motivo a la actividad PARCIAL para que siga apareciendo. Reemplazar la línea:
```ts
      act({ id: '3', estado: 'PARCIAL', vecesReprogramada: 0, dia: 5 }),
```
por:
```ts
      act({ id: '3', estado: 'PARCIAL', vecesReprogramada: 0, dia: 5, motivoId: 'm1' }),
```

(b) Añadir un `it` nuevo dentro del mismo `describe`:
```ts
  it('PARCIAL sin motivo NO aparece; con motivo sí', () => {
    const acts = [
      act({ id: 'p0', tareaId: 'P0', estado: 'PARCIAL', motivoId: null }),
      act({ id: 'p1', tareaId: 'P1', estado: 'PARCIAL', motivoId: 'm1' }),
    ]
    const r = actividadesConCambio(acts)
    expect(r.map((a) => a.tareaId)).toEqual(['P1'])
  })
```

- [x] **Step 2: Correr los tests para verlos fallar**

Run: `npm test -- resumen`
Expected: FALLA — el caso nuevo devuelve `['P0','P1']` (hoy incluye todas las PARCIAL).

- [x] **Step 3: Implementar el nuevo criterio**

En `src/dominio/resumen.ts`, reemplazar la constante `ESTADOS_CON_CAMBIO` y el cuerpo de `actividadesConCambio` por:

```ts
const ESTADOS_CAMBIO_SIEMPRE = ['NO_CUMPLIDA', 'REPROGRAMADA']

// Actividades que "cambiaron" en la semana. NO_CUMPLIDA/REPROGRAMADA siempre; PARCIAL
// solo si tuvo una novedad (alguna fila con motivo) — no por un avance normal.
// Ordenadas por veces reprogramada (desc) y luego por día (asc). No muta la entrada.
export function actividadesConCambio(actividades: Actividad[]): Actividad[] {
  const reps: Actividad[] = []
  for (const filas of agruparPorActividad(actividades).values()) {
    const estado = estadoActividad(filas)
    const esCambio =
      ESTADOS_CAMBIO_SIEMPRE.includes(estado) ||
      (estado === 'PARCIAL' && filas.some((f) => f.motivoId))
    if (!esCambio) continue
    const base = [...filas].sort((a, b) => a.dia - b.dia)[0]
    reps.push(base)
  }
  return reps.sort((a, b) => b.vecesReprogramada - a.vecesReprogramada || a.dia - b.dia)
}
```

> Asegurarse de que no quede ninguna referencia a `ESTADOS_CON_CAMBIO` en el archivo.

- [x] **Step 4: Correr los tests para verlos pasar**

Run: `npm test -- resumen`
Expected: PASS (el caso nuevo da `['P1']`; el primero sigue `['4','5','3']`; "no muta" y "varias filas" siguen verdes).

- [x] **Step 5: Typecheck fiable**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida.

- [x] **Step 6: Commit**

```bash
git add src/dominio/resumen.ts src/dominio/resumen.test.ts
git commit -m "fix(resumen): PARCIAL entra a cambiadas/reprogramadas solo con motivo"
```

---

### Task 2: Finca por actividad en la grilla de maquinaria

**Files:**
- Modify: `src/app/programar/grilla-semana.tsx` (tipo `ActividadGrilla` + celda)

**Interfaces:**
- Consumes: `esMaquinaria`, `paraExportar` (props ya existentes de `GrillaSemana`); las filas ya traen `finca` (de `listarActividades`).
- Produces: nada para otras tareas (presentación).

- [x] **Step 1: Añadir `finca` al tipo `ActividadGrilla`**

En `src/app/programar/grilla-semana.tsx`, en el tipo `ActividadGrilla`, añadir el campo `finca` (junto a `maquina`):

```ts
  maquina: { nombre: string } | null
  finca: { nombre: string } | null
  lotes: { id: string; nombre: string; hectareas: number | null }[]
```

- [x] **Step 2: Mostrar la finca en la celda (solo maquinaria)**

En `src/app/programar/grilla-semana.tsx`, en la celda de actividad, justo **después** de la línea de la máquina:

```tsx
                              {a.maquina && <div className={`text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>🚜 {a.maquina.nombre}</div>}
```

añadir la línea de la finca:

```tsx
                              {esMaquinaria && a.finca && <div className={`text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>🏠 {a.finca.nombre}</div>}
```

- [x] **Step 3: Typecheck fiable**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida. En particular, `actividadesCronograma` (filas de `listarActividades`, que incluye `finca`) sigue siendo asignable a `ActividadGrilla[]` con el nuevo campo.

- [x] **Step 4: Suite de tests sigue verde**

Run: `npm test`
Expected: PASS (no se añadieron tests en esta tarea).

- [x] **Step 5: Verificación manual**

Run: `npm run dev` y abrir `/programar` en un área de **maquinaria** con actividades.
Verificar:
- Cada actividad muestra 🏠 con su finca, junto a 🚜 máquina y los lotes.
- Al **descargar la imagen** y en el **PDF** exportado, la finca aparece también.
- En un área **no** de maquinaria, la grilla no cambia.
Si no hay datos a mano, dejar constancia y validar en el deploy.

- [x] **Step 6: Commit**

```bash
git add src/app/programar/grilla-semana.tsx
git commit -m "feat(programar): mostrar finca por actividad en la grilla de maquinaria (pantalla + export)"
```

---

## Notas de cierre

- Pedido #3 (editar/anexar potreros al marcar cumplida en la versión estándar): ciclo aparte.
- Despliegue: tras revisar, seguir el flujo habitual de Vercel. El build de Vercel regenera `.next` limpio y corre el typecheck real.

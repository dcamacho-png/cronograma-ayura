# Cumplimiento de maquinaria por actividad Implementation Plan

> ✅ **COMPLETADO** — 6 tareas, revisión final (opus) Ready to merge, desplegado a producción (commits 801d1b6..102518d, deploy cronograma-ayura-r6ihg8wct); verificado por la usuaria.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Unificar el cumplimiento de maquinaria al modelo por actividad (avances con máquina/cantidad/centro de costo/día + botón finalizar), quitar la vista por día; ajustar el Excel al camino agrupado; y mostrar el "Día" en letras en el control estándar.

**Architecture:** El centro de costo pasa a guardarse por avance (`AvanceEntrada`). Un control nuevo `ActividadMaquinaria` (espejo de `ActividadEstandar`, con `FormAvanceLote` de maquinaria + unidad de catálogo) reemplaza la lista por día en `page.tsx`. El Excel deja de ramar por área (ambas usan `filasCumplimientoGrupo`) y lee el centro por avance.

**Tech Stack:** Next.js 16 (RSC, Server Actions, client components), Prisma, ExcelJS, TypeScript, Vitest.

## Global Constraints

- Dominio con Vitest (`npm test`); repo/acciones/RSC/client con typecheck + ejecución.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- Centro de costo por avance (en la entrada JSON; sin migración). Unidad de maquinaria = catálogo (ha/hora/kg), como etiqueta. Todo por grupo (`tareaId`), respeta `bloqueadoPorPlazoActividad`, `revalidatePath('/cumplimiento')`.
- `CENTROS_COSTO = ['Biodigestor', 'Ceba', 'Nelore', 'Maiz', 'Riego']` + "Otras…" (texto libre `centroCostoOtra`).

---

### Task 1: Centro de costo por avance (dominio + repo)

**Files:**
- Modify: `src/dominio/avance-lote.ts` (`AvanceEntrada`, `agregarAvances`)
- Test: `src/dominio/avance-lote.test.ts`
- Modify: `src/datos/repositorio.ts` (`registrarAvanceLoteGrupo`)

**Interfaces:**
- Produces: `AvanceEntrada = { dia; maquinaId; cantidad; centroCosto?: string | null }`; `agregarAvances(avance, dia, maquinaId, entradas, centroCosto?)`; `registrarAvanceLoteGrupo(id, dia, maquinaId, avances, centroCosto?)`.

- [x] **Step 1: Test de `agregarAvances` con centro de costo**

En `src/dominio/avance-lote.test.ts`, añadir:
```ts
import { agregarAvances } from './avance-lote'

describe('agregarAvances — centro de costo', () => {
  it('guarda el centroCosto en cada entrada nueva', () => {
    const out = agregarAvances({}, 2, 'M1', [{ loteId: 'l1', cantidad: 3 }], 'Ceba')
    expect(out.l1).toEqual([{ dia: 2, maquinaId: 'M1', cantidad: 3, centroCosto: 'Ceba' }])
  })
  it('sin centroCosto → entrada sin ese campo (o null)', () => {
    const out = agregarAvances({}, 1, null, [{ loteId: 'l1', cantidad: 2 }])
    expect(out.l1[0]).toMatchObject({ dia: 1, maquinaId: null, cantidad: 2 })
    expect(out.l1[0].centroCosto ?? null).toBeNull()
  })
})
```

- [x] **Step 2: Correr el test (falla)**

Run: `npm test -- avance-lote`
Expected: FALLA (`agregarAvances` no acepta el 5º argumento / no guarda centroCosto).

- [x] **Step 3: Implementar en `avance-lote.ts`**

Reemplazar el tipo y `agregarAvances`:
```ts
export type AvanceEntrada = { dia: number; maquinaId: string | null; cantidad: number; centroCosto?: string | null }
```
```ts
export function agregarAvances(
  avance: AvancePorLote,
  dia: number,
  maquinaId: string | null,
  entradas: { loteId: string; cantidad: number }[],
  centroCosto?: string | null,
): AvancePorLote {
  const out: AvancePorLote = { ...avance }
  for (const { loteId, cantidad } of entradas) {
    out[loteId] = [...(out[loteId] ?? []), { dia, maquinaId, cantidad, ...(centroCosto ? { centroCosto } : {}) }]
  }
  return out
}
```

- [x] **Step 4: Pasar `centroCosto` en `registrarAvanceLoteGrupo`**

En `src/datos/repositorio.ts`, cambiar la firma y la llamada:
```ts
export async function registrarAvanceLoteGrupo(
  id: string,
  dia: number,
  maquinaId: string | null,
  avances: { loteId: string; cantidad: number }[],
  centroCosto?: string | null,
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const actual = agregarAvances(
    normalizarAvancePorLote(g.base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
    dia,
    maquinaId,
    avances,
    centroCosto,
  )
```
(el resto del cuerpo no cambia.)

- [x] **Step 5: Correr el test (pasa) + typecheck**

Run: `npm test -- avance-lote`
Expected: PASS.
Run el typecheck fiable → sin salida.

- [x] **Step 6: Commit**

```bash
git add src/dominio/avance-lote.ts src/dominio/avance-lote.test.ts src/datos/repositorio.ts
git commit -m "feat(cumplimiento): centro de costo por avance (AvanceEntrada.centroCosto)"
```

---

### Task 2: Excel — centro de costo por fila de avance (dominio)

**Files:**
- Modify: `src/dominio/cumplimiento-export.ts` (`filasCumplimiento`, fila de avance)
- Test: `src/dominio/cumplimiento-export.test.ts`

**Interfaces:**
- Consumes: `AvanceEntrada.centroCosto` (Task 1).
- Produces: en las filas de avance, la columna "Centro de costo" = `e.centroCosto ?? a.centroCosto ?? ''`.

- [x] **Step 1: Test**

En `src/dominio/cumplimiento-export.test.ts`, añadir:
```ts
describe('filasCumplimiento — centro de costo por avance', () => {
  it('usa el centroCosto de la entrada; si no, el de la actividad', () => {
    const a = act({
      centroCosto: 'ActNivel',
      avancePorLote: {
        l1: [
          { dia: 1, maquinaId: null, cantidad: 2, centroCosto: 'Ceba' },
          { dia: 2, maquinaId: null, cantidad: 3 },
        ],
      },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    // Columna "Centro de costo" = índice 11
    expect(filas[0][11]).toBe('Ceba')
    expect(filas[1][11]).toBe('ActNivel')
  })
})
```

- [x] **Step 2: Correr (falla)**

Run: `npm test -- cumplimiento-export`
Expected: FALLA (hoy el centro de la fila de avance es siempre `a.centroCosto`).

- [x] **Step 3: Implementar**

En `src/dominio/cumplimiento-export.ts`, en el `push` de la fila de avance, cambiar el valor de la columna Centro de costo de `centro` a `e.centroCosto ?? centro`. Es decir, la línea de esa columna pasa a:
```ts
        e.centroCosto ?? centro,
```
(la fila **resumen** sigue usando `centro`.)

- [x] **Step 4: Correr (pasa) + typecheck**

Run: `npm test -- cumplimiento-export`
Expected: PASS. Typecheck fiable → sin salida.

- [x] **Step 5: Commit**

```bash
git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts
git commit -m "feat(cumplimiento): Excel toma el centro de costo del avance"
```

---

### Task 3: Formulario de avance con centro de costo + acción de maquinaria

**Files:**
- Modify: `src/app/cumplimiento/form-avance-lote.tsx` (centro de costo cuando `esMaquinaria`)
- Modify: `src/app/cumplimiento/acciones.ts` (nueva acción `registrarAvanceMaquinariaAccion`)

**Interfaces:**
- Consumes: `registrarAvanceLoteGrupo(…, centroCosto?)` (Task 1); `CENTROS_COSTO`; guard/helpers ya presentes.
- Produces: `registrarAvanceMaquinariaAccion(form)`.

- [x] **Step 1: Centro de costo en `FormAvanceLote` (solo maquinaria)**

En `src/app/cumplimiento/form-avance-lote.tsx`, importar `import { CENTROS_COSTO } from '@/dominio/centro-costo'`. Dentro del bloque `{esMaquinaria && (…)}` de la fila superior (donde ya está el selector de Máquina), añadir tras el `<label>` de Máquina un selector de centro de costo:
```tsx
        {esMaquinaria && (
          <label className="flex flex-col">
            Centro de costo
            <select name="centroCosto" className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— sin centro —</option>
              {CENTROS_COSTO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
```

- [x] **Step 2: Acción `registrarAvanceMaquinariaAccion`**

En `src/app/cumplimiento/acciones.ts`, tras `registrarAvanceLoteActividadAccion`, añadir:
```ts
export async function registrarAvanceMaquinariaAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  if (!id || !(dia >= 1 && dia <= 7)) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const maquinaId = textoOpcional(form, 'maquinaId')
  const centroCosto = textoOpcional(form, 'centroCosto')
  const loteIds = form.getAll('loteAvance').map((v) => String(v))
  const avances = loteIds
    .map((loteId) => ({ loteId, cantidad: numeroOpcional(form, `cantidad_${loteId}`) ?? 0 }))
    .filter((a) => a.cantidad > 0)
  if (avances.length === 0) return
  await registrarAvanceLoteGrupo(id, dia, maquinaId, avances, centroCosto)
  revalidatePath('/cumplimiento')
}
```

- [x] **Step 3: Typecheck fiable + tests**

Run el typecheck fiable → sin salida. `npm test` → PASS.

- [x] **Step 4: Commit**

```bash
git add src/app/cumplimiento/form-avance-lote.tsx src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): avance de maquinaria con centro de costo"
```

---

### Task 4: Control `ActividadMaquinaria` + integrar en la página

**Files:**
- Create: `src/app/cumplimiento/actividad-maquinaria.tsx`
- Modify: `src/app/cumplimiento/page.tsx` (reemplazar la rama por-día de `esMaquinaria`)

**Interfaces:**
- Consumes: `FormAvanceLote`, `FormRegistrar`; acciones `registrarAvanceMaquinariaAccion` (Task 3), `marcarCumplidaActividadAccion`, `registrarNovedadActividadAccion`, `devolverAlBancoAccion`.

- [x] **Step 1: Crear `actividad-maquinaria.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { Unidad } from '@/dominio/unidad'
import type { Estado } from '@/dominio/tipos'
import { FormAvanceLote } from './form-avance-lote'
import { FormRegistrar } from './form-registrar'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Control de cumplimiento de UNA actividad de maquinaria (grupo tareaId), PENDIENTE o
// PARCIAL: avances por lote (máquina + cantidad + centro de costo + día) que se acumulan,
// y cierre manual (Cumplida). Novedad y devolver al banco como en el estándar.
export function ActividadMaquinaria({
  actividadId,
  estado,
  unidad,
  dia,
  lotesActividad,
  lotesCatalogo,
  maquinas,
  estipuladas,
  motivos,
  motivoCambioId,
  haProgramada,
  registrarAvance,
  marcarCumplida,
  registrarNovedad,
  devolverAlBanco,
}: {
  actividadId: string
  estado: Estado
  unidad: Unidad
  dia: number
  lotesActividad: { id: string; nombre: string }[]
  lotesCatalogo: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  motivos: Motivo[]
  motivoCambioId: string | null
  haProgramada: number
  registrarAvance: (f: FormData) => void | Promise<void>
  marcarCumplida: (f: FormData) => void | Promise<void>
  registrarNovedad: (f: FormData) => void | Promise<void>
  devolverAlBanco: (f: FormData) => void | Promise<void>
}) {
  const [novedad, setNovedad] = useState(false)
  const esParcial = estado === 'PARCIAL'

  if (novedad) {
    return (
      <div>
        <FormRegistrar
          actividadId={actividadId}
          esMaquinaria={true}
          unidad={unidad}
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          lotes={lotesCatalogo}
          maquinas={maquinas}
          estipuladas={estipuladas}
          haProgramada={haProgramada}
          lotesActividad={lotesActividad}
          accion={registrarNovedad}
        />
        <button type="button" onClick={() => setNovedad(false)} className="mt-1 text-xs text-tierra underline">
          cancelar novedad
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3 text-sm">
      {lotesActividad.length > 0 && (
        <FormAvanceLote
          actividadId={actividadId}
          diaActividad={dia}
          esMaquinaria={true}
          maquinas={maquinas}
          unidad={unidad}
          lotes={lotesActividad}
          accion={registrarAvance}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <form action={marcarCumplida}>
          <input type="hidden" name="id" value={actividadId} />
          <button className="rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white">
            ✓ {esParcial ? 'Marcar cumplida' : 'Cumplida'}
          </button>
        </form>
        {esParcial && (
          <form action={devolverAlBanco}>
            <input type="hidden" name="id" value={actividadId} />
            <button className="rounded-lg border border-borde px-2 py-1 text-xs text-tierra hover:bg-arena/40">Devolver al banco</button>
          </form>
        )}
        {!esParcial && (
          <button type="button" onClick={() => setNovedad(true)} className="text-xs text-tierra underline">registrar novedad</button>
        )}
      </div>
    </div>
  )
}
```

- [x] **Step 2: Integrar en `page.tsx`**

En `src/app/cumplimiento/page.tsx`:
- Importar: `import { ActividadMaquinaria } from './actividad-maquinaria'`; añadir `registrarAvanceMaquinariaAccion` al import de `./acciones`.
- La rama estándar `{!esMaquinaria && (() => { … })()}` (≈ líneas 347+) ya renderiza, por grupo: cabecera de estado, "Avances: {resumenAvances}" (solo lectura) y, si `interactivo`, el `<ActividadEstandar/>`. **Reescribir la rama de maquinaria `{esMaquinaria && (…)}` (≈ líneas 228-345) para que use ese MISMO patrón por grupo** (no la lista por día), pero renderizando `<ActividadMaquinaria/>` en el bloque interactivo:
```tsx
                          <ActividadMaquinaria
                            actividadId={cab.id}
                            estado={estadoGrupo}
                            unidad={unidad}
                            dia={cab.dia}
                            lotesActividad={cab.lotes}
                            lotesCatalogo={lotes}
                            maquinas={maquinas}
                            estipuladas={estipuladas}
                            motivos={motivos}
                            motivoCambioId={motivoCambioId}
                            haProgramada={cab.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)}
                            registrarAvance={registrarAvanceMaquinariaAccion}
                            marcarCumplida={marcarCumplidaActividadAccion}
                            registrarNovedad={registrarNovedadActividadAccion}
                            devolverAlBanco={devolverAlBancoAccion}
                          />
```
La forma más limpia: unificar ambas ramas en un solo bloque por grupo (cabecera + resumen de avances + interactivo) y dentro del bloque interactivo elegir `esMaquinaria ? <ActividadMaquinaria/> : <ActividadEstandar/>`. Tomar como plantilla exacta el bloque estándar existente (`estadoGrupo`, `interactivo`, `resumenAvances`, `unidad`, `bloqueado`) — ya calcula todo lo necesario. Eliminar el `.map(diasOrdenados)` con `DiaMaquinaria`/`DiaNoMaquinaria` de esa pantalla.
- Quitar los imports de `DiaMaquinaria` y `DiaNoMaquinaria` si quedan sin uso en `page.tsx`.

- [x] **Step 3: Typecheck fiable + tests**

Run el typecheck fiable → sin salida (si `DiaMaquinaria`/`DiaNoMaquinaria` quedan sin uso, quitar sus imports). `npm test` → PASS.

- [x] **Step 4: Verificación manual**

Run `npm run dev`, `/cumplimiento` en área de **maquinaria**: cada actividad es **un solo control** (no por día); "Registrar avance" pide máquina/cantidad/centro/día y acumula; "✓ Cumplida" finaliza; novedad y devolver funcionan. Diferir a deploy si no hay datos.

- [x] **Step 5: Commit**

```bash
git add src/app/cumplimiento/actividad-maquinaria.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): maquinaria por actividad (avances + finalizar), quita vista por dia"
```

---

### Task 5: Excel — maquinaria por camino agrupado

**Files:**
- Modify: `src/app/cumplimiento/exportar/route.ts`

**Interfaces:**
- Consumes: `filasCumplimientoGrupo` (ya importado).

- [x] **Step 1: Quitar la rama por-fila de maquinaria**

En `src/app/cumplimiento/exportar/route.ts`, en `agregarGrupos`, eliminar el parámetro `esMaq` y la rama `if (esMaq(grupo)) { … por fila … } else { … }`; dejar **solo** el camino agrupado para todos:
```ts
  const agregarGrupos = (
    items: ((typeof actividades)[number] | (typeof solicitadas)[number])[],
    ejecutadaPor: (grupo: typeof items) => string,
  ) => {
    for (const grupo of agruparPorActividad(items).values()) {
      const e = estadoActividad(grupo.map((a) => ({ estado: a.estado as Estado })))
      if (e !== 'CUMPLIDA' && e !== 'PARCIAL') continue // solo lo que se hizo
      for (const fila of filasCumplimientoGrupo(
        grupo.map(aExport),
        fechaDeDia(grupo[0].dia),
        unidadPorNombre,
        { fechaDeDia, nombreMaquina },
        ejecutadaPor(grupo),
      )) {
        ws.addRow(fila)
      }
    }
  }
```
Y las dos llamadas vuelven a dos argumentos:
```ts
  agregarGrupos(actividades, () => '')
  agregarGrupos(solicitadas, (grupo) => (grupo[0] as (typeof solicitadas)[number]).area.nombre)
```
- Quitar el `import { esMaquinaria } from '@/dominio/variante'` y `filasCumplimiento` del import si quedan sin uso.

- [x] **Step 2: Typecheck fiable + tests**

Run el typecheck fiable → sin salida (quitar imports huérfanos si los marca). `npm test` → PASS.

- [x] **Step 3: Commit**

```bash
git add src/app/cumplimiento/exportar/route.ts
git commit -m "refactor(cumplimiento): Excel de maquinaria por camino agrupado (avances de grupo)"
```

---

### Task 6: "Día" en letras en el control estándar

**Files:**
- Modify: `src/app/cumplimiento/actividad-estandar.tsx`

- [x] **Step 1: Mostrar el nombre del día**

En `src/app/cumplimiento/actividad-estandar.tsx`, añadir cerca del tope (tras los imports) un arreglo de días:
```ts
const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
```
y en el `<select name="dia">`, cambiar la opción para mostrar el nombre manteniendo el valor:
```tsx
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>{DIAS[d]}</option>
                ))}
```

- [x] **Step 2: Typecheck fiable + tests**

Run el typecheck fiable → sin salida. `npm test` → PASS.

- [x] **Step 3: Verificación manual**

En `/cumplimiento` (estándar), el selector "Día" muestra Lun–Dom.

- [x] **Step 4: Commit**

```bash
git add src/app/cumplimiento/actividad-estandar.tsx
git commit -m "fix(cumplimiento): selector Dia en letras (Lun-Dom) en el control estandar"
```

---

## Notas de cierre

- No se elimina la columna escalar `Actividad.centroCosto` (se conserva; el avance ahora lo lleva por entrada, con fallback en el Excel).
- Despliegue: flujo habitual de Vercel; el build corre typecheck real.

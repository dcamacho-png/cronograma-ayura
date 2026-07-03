# Avance diario enriquecido Implementation Plan

> ✅ **COMPLETADO** — 5 tareas + 2 fixes (selector unidad estándar; responsable desde todos), revisión final (opus) Ready to merge, desplegado a producción (commits 8ed817d..2d7a9f4, deploy cronograma-ayura-kl8r4etaq); verificado por la usuaria.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Que el avance diario (estándar + maquinaria) capture por avance el responsable (editable), día, potrero (finca→lote) + cantidad y —maquinaria— tractor + centro de costo; y que la unidad se elija una vez por actividad de una lista ampliada. El Excel muestra el responsable/tractor reales del avance y la unidad de la actividad.

**Architecture:** `AvanceEntrada` gana `responsableId` (por avance). Un formulario `FormAvance` compartido (un potrero por envío) reemplaza el picker actual en ambos controles; la unidad es un selector por actividad (lista ampliada) que `ActividadMaquinaria` también gana. El Excel resuelve el responsable del avance (ctx) y la unidad desde `unidadRealizada`.

**Tech Stack:** Next.js 16 (RSC, Server Actions, client), Prisma, ExcelJS, TypeScript, Vitest.

## Global Constraints

- Dominio con Vitest (`npm test`); repo/acciones/RSC/client con typecheck + ejecución.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- Unidad **por actividad** (`unidadRealizada`, texto); lista del selector: `Ha, Hora, Kg, Cantidad, Bultos, Jornales, Otro`(texto). Responsable/tractor/centro **por avance** (en la entrada JSON). Sin migración. No se toca el enum `Unidad`, Configuración, ni el resumen.
- Todo por grupo (`tareaId`), respeta `bloqueadoPorPlazoActividad`, `revalidatePath('/cumplimiento')`.

---

### Task 1: `responsableId` por avance (dominio + repo)

**Files:**
- Modify: `src/dominio/avance-lote.ts`
- Test: `src/dominio/avance-lote.test.ts`
- Modify: `src/datos/repositorio.ts` (`registrarAvanceLoteGrupo`)

**Interfaces:**
- Produces: `AvanceEntrada` con `responsableId?: string | null`; `agregarAvances(avance, dia, maquinaId, entradas, centroCosto?, responsableId?)`; `registrarAvanceLoteGrupo(id, dia, maquinaId, avances, centroCosto?, responsableId?)`.

- [x] **Step 1: Test**

En `src/dominio/avance-lote.test.ts`, añadir:
```ts
describe('agregarAvances — responsable', () => {
  it('guarda responsableId en la entrada', () => {
    const out = agregarAvances({}, 3, 'M1', [{ loteId: 'l1', cantidad: 4 }], 'Ceba', 'R9')
    expect(out.l1).toEqual([{ dia: 3, maquinaId: 'M1', cantidad: 4, centroCosto: 'Ceba', responsableId: 'R9' }])
  })
  it('sin responsableId → entrada sin ese campo', () => {
    const out = agregarAvances({}, 1, null, [{ loteId: 'l1', cantidad: 2 }])
    expect(out.l1[0].responsableId ?? null).toBeNull()
  })
})
```

- [x] **Step 2: Correr (falla)** — `npm test -- avance-lote` → FALLA.

- [x] **Step 3: Implementar en `avance-lote.ts`**

```ts
export type AvanceEntrada = { dia: number; maquinaId: string | null; cantidad: number; centroCosto?: string | null; responsableId?: string | null }
```
```ts
export function agregarAvances(
  avance: AvancePorLote,
  dia: number,
  maquinaId: string | null,
  entradas: { loteId: string; cantidad: number }[],
  centroCosto?: string | null,
  responsableId?: string | null,
): AvancePorLote {
  const out: AvancePorLote = { ...avance }
  for (const { loteId, cantidad } of entradas) {
    out[loteId] = [...(out[loteId] ?? []), { dia, maquinaId, cantidad, ...(centroCosto ? { centroCosto } : {}), ...(responsableId ? { responsableId } : {}) }]
  }
  return out
}
```

- [x] **Step 4: `registrarAvanceLoteGrupo` pasa responsableId**

En `src/datos/repositorio.ts`, firma + llamada a `agregarAvances`:
```ts
export async function registrarAvanceLoteGrupo(
  id: string,
  dia: number,
  maquinaId: string | null,
  avances: { loteId: string; cantidad: number }[],
  centroCosto?: string | null,
  responsableId?: string | null,
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const actual = agregarAvances(
    normalizarAvancePorLote(g.base.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null),
    dia,
    maquinaId,
    avances,
    centroCosto,
    responsableId,
  )
```
(resto sin cambios.)

- [x] **Step 5: Correr (pasa) + typecheck.** `npm test -- avance-lote` PASS; typecheck fiable sin salida.

- [x] **Step 6: Commit** — `git add src/dominio/avance-lote.ts src/dominio/avance-lote.test.ts src/datos/repositorio.ts && git commit -m "feat(cumplimiento): responsableId por avance (AvanceEntrada.responsableId)"`

---

### Task 2: Excel — responsable del avance + unidad de la actividad (dominio)

**Files:**
- Modify: `src/dominio/cumplimiento-export.ts`
- Test: `src/dominio/cumplimiento-export.test.ts`

**Interfaces:**
- Produces: `ActividadExport` con `unidadRealizada?: string | null`; `ctx` con `nombreResponsable?: (id: string | null) => string`; fila de avance usa el responsable de la entrada y la unidad de la actividad.

- [x] **Step 1: Test**

En `src/dominio/cumplimiento-export.test.ts`, añadir al `ctx` de pruebas `nombreResponsable: (id: string | null) => (id ? \`RESP-${id}\` : '')` (añadirlo al objeto `ctx` existente), y un caso:
```ts
describe('filasCumplimiento — responsable del avance + unidad de actividad', () => {
  it('usa el responsable de la entrada (fallback al de la actividad) y la unidad de la actividad', () => {
    const a = act({
      unidadRealizada: 'jornales',
      avancePorLote: { l1: [
        { dia: 1, maquinaId: null, cantidad: 2, responsableId: 'R2' },
        { dia: 2, maquinaId: null, cantidad: 3 },
      ] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    // Responsable = índice 2, Unidad = índice 9
    expect(filas[0][2]).toBe('RESP-R2')
    expect(filas[1][2]).toBe('Ana')       // fallback al responsable de la actividad
    expect(filas[0][9]).toBe('jornales')  // unidad de la actividad (verbatim)
  })
})
```
Y añadir `unidadRealizada: null` a los defaults del helper `act(...)`.

- [x] **Step 2: Correr (falla)** — `npm test -- cumplimiento-export` → FALLA.

- [x] **Step 3: Implementar en `cumplimiento-export.ts`**

(a) `ActividadExport` gana:
```ts
  unidadRealizada?: string | null
```
(b) `ctx` de `filasCumplimiento` y `filasCumplimientoGrupo` gana `nombreResponsable?`:
```ts
  ctx: { fechaDeDia: (dia: number) => string; nombreMaquina: (maquinaId: string | null) => string; nombreResponsable?: (id: string | null) => string },
```
(c) En `filasCumplimiento`, calcular la unidad de display y usar el responsable de la entrada. Tras `const unidadAbrev = unidadAbreviada(unidad)` añadir:
```ts
  const unidadDisplay = a.unidadRealizada ?? unidadAbrev
```
En la fila de **avance**, la columna Responsable (índice 2) pasa de `a.responsable.nombre` a:
```ts
        (ctx.nombreResponsable?.(e.responsableId ?? null)) || a.responsable.nombre,
```
y la columna Unidad (índice 9) de `unidadAbrev` a `unidadDisplay`. La fila **resumen** usa `unidadDisplay` en la Unidad (y deja el responsable de la actividad).

- [x] **Step 4: Correr (pasa) + typecheck.** PASS; typecheck fiable sin salida. (La ruta usa `ctx` sin `nombreResponsable` aún → sigue compilando porque es opcional; `unidadRealizada` llega por `...a`.)

- [x] **Step 5: Commit** — `git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts && git commit -m "feat(cumplimiento): Excel usa responsable del avance y unidad de la actividad"`

---

### Task 3: Formulario de avance unificado `FormAvance` + acción

**Files:**
- Create: `src/app/cumplimiento/form-avance.tsx`
- Modify: `src/app/cumplimiento/acciones.ts` (nueva acción `registrarAvanceAccion`)

**Interfaces:**
- Consumes: `registrarAvanceLoteGrupo(…, centroCosto?, responsableId?)`, `anexarLotesGrupo` (Task 1 + existentes); `CENTROS_COSTO`.
- Produces: `FormAvance` (client); `registrarAvanceAccion(form)`.

- [x] **Step 1: Crear `form-avance.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { CENTROS_COSTO } from '@/dominio/centro-costo'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
type Lote = { id: string; nombre: string; finca: { nombre: string } }

// Un avance = un potrero por envío: día, responsable, finca→lote, cantidad (+ tractor y
// centro de costo en maquinaria). La unidad NO va aquí (es por actividad).
export function FormAvance({
  actividadId,
  diaActividad,
  esMaquinaria,
  responsables,
  responsableDefault,
  maquinas,
  lotesCatalogo,
  fincaDefault,
  accion,
}: {
  actividadId: string
  diaActividad: number
  esMaquinaria: boolean
  responsables: { id: string; nombre: string }[]
  responsableDefault: string
  maquinas: { id: string; nombre: string }[]
  lotesCatalogo: Lote[]
  fincaDefault: string
  accion: (f: FormData) => void | Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [finca, setFinca] = useState(fincaDefault)
  const [centro, setCentro] = useState('')
  const fincas = [...new Set(lotesCatalogo.map((l) => l.finca.nombre))].sort()

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="rounded-lg border border-bosque px-2 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">
        Registrar avance
      </button>
    )
  }
  return (
    <form action={accion} className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-borde bg-arena/40 p-2 text-xs">
      <input type="hidden" name="id" value={actividadId} />
      <label className="flex flex-col">Día
        <select name="dia" defaultValue={diaActividad} className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{DIAS[d]}</option>))}
        </select>
      </label>
      <label className="flex flex-col">Responsable
        <select name="responsableId" defaultValue={responsableDefault} className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
          {responsables.map((r) => (<option key={r.id} value={r.id}>{r.nombre}</option>))}
        </select>
      </label>
      {esMaquinaria && (
        <>
          <label className="flex flex-col">Tractor
            <select name="maquinaId" className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— sin máquina —</option>
              {maquinas.map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
            </select>
          </label>
          <label className="flex flex-col">Centro de costo
            <select name="centroCosto" value={centro} onChange={(e) => setCentro(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="">— sin centro —</option>
              {CENTROS_COSTO.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </label>
        </>
      )}
      <label className="flex flex-col">Finca
        <select value={finca} onChange={(e) => setFinca(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
          <option value="">— finca —</option>
          {fincas.map((f) => (<option key={f} value={f}>{f}</option>))}
        </select>
      </label>
      <label className="flex flex-col">Lote
        <select name="loteId" className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40">
          <option value="">— lote —</option>
          {lotesCatalogo.filter((l) => l.finca.nombre === finca).map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
        </select>
      </label>
      <label className="flex flex-col">Cantidad
        <input name="cantidad" type="number" step="any" min="0" className="w-24 rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
      </label>
      <button className="rounded-lg bg-bosque px-3 py-1 font-semibold text-white">Guardar avance</button>
      <button type="button" onClick={() => setAbierto(false)} className="text-tierra underline">cancelar</button>
    </form>
  )
}
```

- [x] **Step 2: Acción `registrarAvanceAccion` en `acciones.ts`**

Tras `registrarAvanceEstandarAccion`, añadir:
```ts
export async function registrarAvanceAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  const loteId = texto(form, 'loteId')
  const cantidad = numeroOpcional(form, 'cantidad') ?? 0
  if (!id || !loteId || !(dia >= 1 && dia <= 7) || cantidad <= 0) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const responsableId = textoOpcional(form, 'responsableId')
  const maquinaId = textoOpcional(form, 'maquinaId')
  const centroCosto = textoOpcional(form, 'centroCosto')
  await anexarLotesGrupo(id, [loteId])
  await registrarAvanceLoteGrupo(id, dia, maquinaId, [{ loteId, cantidad }], centroCosto, responsableId)
  revalidatePath('/cumplimiento')
}
```

- [x] **Step 3: Typecheck fiable + tests** → sin salida; `npm test` PASS.

- [x] **Step 4: Commit** — `git add src/app/cumplimiento/form-avance.tsx src/app/cumplimiento/acciones.ts && git commit -m "feat(cumplimiento): FormAvance unificado + accion registrarAvance (responsable/finca-lote/tractor)"`

---

### Task 4: Integrar `FormAvance` en los dos controles + unidad ampliada + página

**Files:**
- Modify: `src/app/cumplimiento/actividad-estandar.tsx`
- Modify: `src/app/cumplimiento/actividad-maquinaria.tsx`
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `FormAvance`, `registrarAvanceAccion` (Task 3); `setLotesActividadAccion`/unidad ya existentes.

- [x] **Step 1: Ampliar la lista de unidades (estándar)**

En `src/app/cumplimiento/actividad-estandar.tsx`, cambiar la constante de unidades a la lista ampliada:
```ts
const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro" (texto libre)
```

- [x] **Step 2: `ActividadEstandar` usa `FormAvance`**

En `actividad-estandar.tsx`, reemplazar el formulario de avance con potreros (el bloque `<form action={registrarAvanceEstandar} …Finca→Lote→cantidad…>`) por `FormAvance`:
```tsx
      {tieneLotes ? (
        <FormAvance
          actividadId={actividadId}
          diaActividad={dia}
          esMaquinaria={false}
          responsables={responsables}
          responsableDefault={responsableActividadId}
          maquinas={[]}
          lotesCatalogo={lotesCatalogo}
          fincaDefault={fincaActividad}
          accion={registrarAvance}
        />
      ) : ( /* … el flujo general sin potreros se mantiene igual … */ )}
```
Añadir props nuevas a `ActividadEstandar`: `responsables: { id; nombre }[]`, `responsableActividadId: string`, `fincaActividad: string`, `registrarAvance: (f) => …`; importar `FormAvance`; conservar el selector de unidad (ahora con la lista ampliada) y las acciones de cerrar/novedad/devolver. El selector de unidad y el flujo "general" (sin potreros) no cambian salvo la lista `UNIDADES`.

- [x] **Step 3: `ActividadMaquinaria` usa `FormAvance` + gana selector de unidad**

En `actividad-maquinaria.tsx`, reemplazar `FormAvanceLote` por `FormAvance` (con `esMaquinaria`), y **añadir el mismo selector de unidad** que el estándar (lista ampliada, guardando `unidadRealizada` vía la acción de unidad). Nuevas props: `responsables`, `responsableActividadId`, `fincaActividad`, `unidadRealizada`, `registrarAvance`, y la acción de unidad. Importar `FormAvance`.

- [x] **Step 4: Página — pasar props nuevas**

En `src/app/cumplimiento/page.tsx`, a ambos controles pasar `responsables={responsables}`, `responsableActividadId={cab.responsableId}`, `fincaActividad={cab.finca?.nombre ?? ''}`, y `registrarAvance={registrarAvanceAccion}`; a `ActividadMaquinaria` además `unidadRealizada={cab.unidadRealizada}` y la acción de unidad. Importar `registrarAvanceAccion`. (Ya existe `responsables` = `listarResponsablesPorArea`; si no, cargarlo.)

- [x] **Step 5: Typecheck fiable + tests** → sin salida; `npm test` PASS. (Si `registrarAvanceEstandarAccion`/`registrarAvanceMaquinariaAccion` quedan sin uso, quitarlos de sus imports/exports.)

- [x] **Step 6: Verificación manual** — en estándar y maquinaria: "Registrar avance" pide día, responsable (editable), finca→lote, cantidad (+maq tractor/centro); el selector de unidad ofrece Ha/Hora/Kg/Cantidad/Bultos/Jornales/Otro. Diferir a deploy si no hay datos.

- [x] **Step 7: Commit** — `git add src/app/cumplimiento/actividad-estandar.tsx src/app/cumplimiento/actividad-maquinaria.tsx src/app/cumplimiento/page.tsx && git commit -m "feat(cumplimiento): FormAvance en ambos controles + unidad ampliada"`

---

### Task 5: Excel — resolver el responsable del avance en la ruta

**Files:**
- Modify: `src/app/cumplimiento/exportar/route.ts`

**Interfaces:**
- Consumes: `ctx.nombreResponsable` (Task 2).

- [x] **Step 1: Mapa responsableId → nombre + pasarlo en ctx**

En `src/app/cumplimiento/exportar/route.ts`:
- Cargar los responsables (usar `listarResponsablesPorArea(area.id)` o construir el mapa desde `actividades`/`solicitadas` con su relación `responsable`): `const nombrePorResponsable = new Map<string, string>()` poblado con `a.responsableId → a.responsable.nombre` de `actividades` y `solicitadas`.
- `const nombreResponsable = (id: string | null) => (id ? nombrePorResponsable.get(id) ?? '' : '')`.
- Pasar `nombreResponsable` dentro del objeto `ctx` en la llamada a `filasCumplimientoGrupo` (junto a `fechaDeDia, nombreMaquina`).

- [x] **Step 2: Typecheck fiable + tests** → sin salida; `npm test` PASS.

- [x] **Step 3: Commit** — `git add src/app/cumplimiento/exportar/route.ts && git commit -m "feat(cumplimiento): Excel resuelve el responsable de cada avance"`

---

## Notas de cierre

- La unidad por avance NO se usa (unidad por actividad); responsable/tractor/centro sí por avance.
- No se cambia el resumen, el enum `Unidad` ni Configuración.
- Despliegue: flujo habitual de Vercel; el build corre typecheck real.

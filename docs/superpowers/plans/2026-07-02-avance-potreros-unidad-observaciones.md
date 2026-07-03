# Avance con tabla de potreros, unidad y observaciones — Implementation Plan

> ✅ **COMPLETADO y desplegado a producción (2026-07-02, commit 0c614aa, deploy cronograma-ayura-o2ukco9l4).** Verificado por la usuaria. Revisión final de rama: MERGE (0 Critical/Important; 182 tests, typecheck limpio).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer el registro de avance (`FormAvance`) como tabla por potrero con selector de unidad y observaciones; mover la unidad dentro de los formularios (quitando el cuadro suelto "Guardar unidad"); y volver la novedad Parcial a un checklist simple con selector de unidad.

**Architecture:** Cambios en capas: dominio (`AvanceEntrada.observacion` + `agregarAvances`), Excel (fila de avance usa la observación de la entrada), repositorio (`registrarAvanceLoteGrupo` acepta observación + bultos; `registrarNovedadGrupo` se revierte a solo lotesHechos+connect), y UI/acciones (FormAvance rehecho + acción de avance multi-potrero; FormRegistrar revertido + unidad; controles/página).

**Tech Stack:** Next.js 16 (App Router, Server Actions, client components), Prisma + Neon Postgres, ExcelJS, TypeScript, Vitest, Tailwind v4.

## Global Constraints

- La **medida** del avance por potrero es **siempre ha** (la `cantidad` de la entrada = ha); los **bultos** son dato aparte (solo fertilización) → `bultosPorLote`.
- El **selector de unidad** aparece **en todas** las actividades (avance y novedad); lista fija en la UI: `Ha, Hora, Kg, Cantidad, Bultos, Jornales, Otro`(→texto libre). No se cambia el enum `Unidad` ni Configuración.
- El **cuadro suelto "Guardar unidad"** desaparece de ambos controles.
- Novedad: estados `NO_CUMPLIDA / REPROGRAMADA / PARCIAL`; en Parcial, **checklist simple** (marcar potreros + anexar otros), sin ha/bultos.
- Typecheck fiable: `npx tsc --noEmit -p tsconfig.check.json` (NO usar `npx tsc --noEmit` a secas). Tests: `npx vitest run`.
- No tocar el catálogo (área del lote). Resumen/tablero/programar no cambian.
- Convenciones de código del repo: componentes cliente con `'use client'`, acciones con `'use server'`, español en UI y comentarios, clases Tailwind con la paleta existente (`bosque`, `arena`, `borde`, `marfil`, `tierra`, `tinta`).

---

### Task 1: Dominio — `observacion` por avance

**Files:**
- Modify: `src/dominio/avance-lote.ts:2` (tipo `AvanceEntrada`), `:77-90` (`agregarAvances`)
- Test: `src/dominio/avance-lote.test.ts`

**Interfaces:**
- Produces: `type AvanceEntrada = { dia; maquinaId; cantidad; centroCosto?; responsableId?; observacion?: string | null }`; `agregarAvances(avance, dia, maquinaId, entradas, centroCosto?, responsableId?, observacion?)` guarda `observacion` en cada entrada nueva.

- [x] **Step 1: Escribir el test que falla**

En `src/dominio/avance-lote.test.ts`, después del bloque `describe('agregarAvances — responsable', ...)` (termina en la línea con `})` tras el caso "sin responsableId"), añadir:

```ts
describe('agregarAvances — observación', () => {
  it('guarda la observación en cada entrada nueva', () => {
    const out = agregarAvances({}, 2, 'M1', [{ loteId: 'l1', cantidad: 3 }, { loteId: 'l2', cantidad: 1 }], 'Ceba', 'R9', 'llovió a media mañana')
    expect(out.l1[0]).toMatchObject({ dia: 2, maquinaId: 'M1', cantidad: 3, centroCosto: 'Ceba', responsableId: 'R9', observacion: 'llovió a media mañana' })
    expect(out.l2[0].observacion).toBe('llovió a media mañana')
  })
  it('sin observación → entrada sin ese campo', () => {
    const out = agregarAvances({}, 1, null, [{ loteId: 'l1', cantidad: 2 }])
    expect(out.l1[0].observacion ?? null).toBeNull()
  })
})
```

- [x] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run src/dominio/avance-lote.test.ts`
Expected: FAIL — `agregarAvances` no acepta el 7º argumento / la entrada no tiene `observacion`.

- [x] **Step 3: Implementar el cambio mínimo**

En `src/dominio/avance-lote.ts`, cambiar el tipo (línea 2):

```ts
export type AvanceEntrada = { dia: number; maquinaId: string | null; cantidad: number; centroCosto?: string | null; responsableId?: string | null; observacion?: string | null }
```

Y `agregarAvances` (líneas 77-90) a:

```ts
export function agregarAvances(
  avance: AvancePorLote,
  dia: number,
  maquinaId: string | null,
  entradas: { loteId: string; cantidad: number }[],
  centroCosto?: string | null,
  responsableId?: string | null,
  observacion?: string | null,
): AvancePorLote {
  const out: AvancePorLote = { ...avance }
  for (const { loteId, cantidad } of entradas) {
    out[loteId] = [...(out[loteId] ?? []), { dia, maquinaId, cantidad, ...(centroCosto ? { centroCosto } : {}), ...(responsableId ? { responsableId } : {}), ...(observacion ? { observacion } : {}) }]
  }
  return out
}
```

- [x] **Step 4: Correr el test para verlo pasar**

Run: `npx vitest run src/dominio/avance-lote.test.ts`
Expected: PASS.

- [x] **Step 5: Typecheck y commit**

```bash
npx tsc --noEmit -p tsconfig.check.json
git add src/dominio/avance-lote.ts src/dominio/avance-lote.test.ts
git commit -m "feat(avance): observacion por entrada de avance"
```

---

### Task 2: Excel — la fila de avance usa la observación de la entrada

**Files:**
- Modify: `src/dominio/cumplimiento-export.ts` (fila de avance dentro de `filasCumplimiento`, la que hoy pone `a.nota ?? ''` en el bucle `for (const e of avances[l.id] ?? [])`)
- Test: `src/dominio/cumplimiento-export.test.ts`

**Interfaces:**
- Consumes: `AvanceEntrada.observacion` (Task 1).
- Produces: en la fila **por avance**, la columna `Observación` = `e.observacion ?? a.nota ?? ''`. La fila **sin avances** sigue con `a.nota ?? ''`.

- [x] **Step 1: Escribir el test que falla**

En `src/dominio/cumplimiento-export.test.ts`, dentro del `describe('filasCumplimiento — con avances (una fila por avance)', ...)`, añadir al final (antes del `})` que cierra el describe):

```ts
  it('la observación de la entrada va a la última columna; sin ella cae a la nota de la actividad', () => {
    const a = act({
      nota: 'nota actividad',
      lotes: [{ id: 'l1', nombre: 'L1' }],
      avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 2, observacion: 'obs avance' }, { dia: 2, maquinaId: null, cantidad: 3 }] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    expect(filas[0][14]).toBe('obs avance')
    expect(filas[1][14]).toBe('nota actividad')
  })
```

- [x] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: FAIL — `filas[0][14]` es `'nota actividad'` (usa `a.nota`), no `'obs avance'`.

- [x] **Step 3: Implementar el cambio mínimo**

En `src/dominio/cumplimiento-export.ts`, en el bucle de avances de `filasCumplimiento` (el `filas.push([ ... ])` dentro de `for (const e of avances[l.id] ?? [])`), cambiar el **último** elemento del arreglo de:

```ts
        a.nota ?? '',
```

a:

```ts
        e.observacion ?? a.nota ?? '',
```

(Solo en la fila **por avance**. La fila "sin avances" del `return [[ ... a.nota ?? '' ]]` queda igual.)

- [x] **Step 4: Correr los tests para verlos pasar**

Run: `npx vitest run src/dominio/cumplimiento-export.test.ts`
Expected: PASS (todos, incluido el nuevo).

- [x] **Step 5: Typecheck y commit**

```bash
npx tsc --noEmit -p tsconfig.check.json
git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts
git commit -m "feat(export): la fila de avance usa la observacion de la entrada"
```

---

### Task 3: Repositorio — `registrarAvanceLoteGrupo` acepta observación + bultos

**Files:**
- Modify: `src/datos/repositorio.ts:581-610` (`registrarAvanceLoteGrupo`)

**Interfaces:**
- Consumes: `agregarAvances(..., observacion?)` (Task 1).
- Produces: `registrarAvanceLoteGrupo(id, dia, maquinaId, avances, centroCosto?, responsableId?, observacion?, bultosPorLote?)` — propaga `observacion` a las entradas y, si `bultosPorLote` viene, lo **mezcla** (spread del actual + claves nuevas) en el `bultosPorLote` de las filas.

Este task solo **agrega parámetros opcionales**; los llamadores actuales siguen compilando.

- [x] **Step 1: Implementar el cambio**

En `src/datos/repositorio.ts`, reemplazar la función `registrarAvanceLoteGrupo` (líneas 581-610) por:

```ts
export async function registrarAvanceLoteGrupo(
  id: string,
  dia: number,
  maquinaId: string | null,
  avances: { loteId: string; cantidad: number }[],
  centroCosto?: string | null,
  responsableId?: string | null,
  observacion?: string | null,
  bultosPorLote?: Record<string, number> | null,
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
    observacion,
  )
  const bultosMerge = bultosPorLote
    ? { ...((g.base.bultosPorLote ?? {}) as Record<string, number>), ...bultosPorLote }
    : null
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) =>
        prisma.actividad.update({
          where: { id: f.id },
          data: {
            avancePorLote: actual as Prisma.InputJsonValue,
            estado: 'PARCIAL',
            ...(bultosMerge ? { bultosPorLote: bultosMerge as Prisma.InputJsonValue } : {}),
          },
        }),
      ),
  )
  return true
}
```

- [x] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: 0 errores en `src/` (los llamadores existentes no pasan los nuevos params → siguen válidos).

- [x] **Step 3: Correr los tests (no deben romperse)**

Run: `npx vitest run`
Expected: PASS (sin cambios de comportamiento para los llamadores actuales).

- [x] **Step 4: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(repo): registrarAvanceLoteGrupo acepta observacion y merge de bultos"
```

---

### Task 4: `FormAvance` (tabla de potreros + unidad + observaciones), acción y controles/página

**Files:**
- Modify (reescritura): `src/app/cumplimiento/form-avance.tsx`
- Modify: `src/app/cumplimiento/acciones.ts:122-135` (`registrarAvanceAccion`) y `:178-186` (eliminar `setUnidadRealizadaAccion`)
- Modify: `src/app/cumplimiento/actividad-estandar.tsx` (quitar cuadro "Guardar unidad" en la rama con lotes; nuevas props a `FormAvance`; quitar prop `setUnidadRealizada`)
- Modify: `src/app/cumplimiento/actividad-maquinaria.tsx` (quitar cuadro "Guardar unidad" y su andamiaje; nuevas props a `FormAvance`; quitar prop `setUnidadRealizada`)
- Modify: `src/app/cumplimiento/page.tsx:13` (quitar import `setUnidadRealizadaAccion`) y `:279,:303` (quitar prop) + `:265-277,:290-301` (añadir `unidadActual`)

**Interfaces:**
- Consumes: `registrarAvanceLoteGrupo(..., observacion?, bultosPorLote?)` (Task 3); `setUnidadRealizadaGrupo`, `anexarLotesGrupo` (existentes); `usaBultos` (`@/dominio/bultos`).
- Produces: `FormAvance` recibe además `lotesActividad: {id;nombre;hectareas?}[]`, `bultosAsignados?`, `descripcion?`, `unidadActual?`. `registrarAvanceAccion` lee `loteHecho[]`, `ha_<id>`, `bultos_<id>`, `unidad`/`unidadOtra`, `observacion`, día, responsable, (maquinaria) `maquinaId`+`centroCosto`(+`centroCostoOtra`).

- [x] **Step 1: Reescribir `FormAvance`**

Reemplazar **todo** el contenido de `src/app/cumplimiento/form-avance.tsx` por:

```tsx
'use client'

import { useState } from 'react'
import { CENTROS_COSTO } from '@/dominio/centro-costo'
import { usaBultos } from '@/dominio/bultos'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro" (texto libre)
type Lote = { id: string; nombre: string; finca: { nombre: string } }

// Un avance puede registrar varios potreros a la vez: día, responsable, unidad (por actividad),
// observación, tabla por potrero (casilla + ha = medida + bultos en fertilización), anexar
// potreros no asignados, y —en maquinaria— tractor + centro de costo. La medida es siempre ha.
export function FormAvance({
  actividadId,
  diaActividad,
  esMaquinaria,
  responsables,
  responsableDefault,
  maquinas,
  lotesActividad,
  lotesCatalogo,
  fincaDefault,
  bultosAsignados,
  descripcion,
  unidadActual,
  accion,
}: {
  actividadId: string
  diaActividad: number
  esMaquinaria: boolean
  responsables: { id: string; nombre: string }[]
  responsableDefault: string
  maquinas: { id: string; nombre: string }[]
  lotesActividad: { id: string; nombre: string; hectareas?: number | null }[]
  lotesCatalogo: Lote[]
  fincaDefault: string
  bultosAsignados?: Record<string, number> | null
  descripcion?: string
  unidadActual?: string | null
  accion: (f: FormData) => void | Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [centro, setCentro] = useState('')
  const [anexados, setAnexados] = useState<{ id: string; nombre: string; hectareas?: number | null }[]>([])
  const [fincaAnexar, setFincaAnexar] = useState(fincaDefault)
  const [loteAnexar, setLoteAnexar] = useState('')
  const conocida = UNIDADES.find((u) => u.toLowerCase() === (unidadActual ?? '').toLowerCase())
  const [unidadSel, setUnidadSel] = useState(conocida ?? (unidadActual ? 'Otro' : (esMaquinaria ? 'Ha' : 'Cantidad')))
  const conBultos = descripcion ? usaBultos(descripcion) : false
  const filasPotreros = [...lotesActividad, ...anexados]
  const fincasAnexar = [...new Set(lotesCatalogo.map((l) => l.finca.nombre))].sort()

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
              <option value="__otra__">Otras…</option>
            </select>
          </label>
          {centro === '__otra__' && (
            <label className="flex flex-col">Otras (texto)
              <input name="centroCostoOtra" className="w-40 rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
          )}
        </>
      )}
      <label className="flex flex-col">Unidad
        <select
          name="unidad"
          value={unidadSel === 'Otro' ? 'otro' : unidadSel.toLowerCase()}
          onChange={(e) => setUnidadSel(e.target.value === 'otro' ? 'Otro' : e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
          className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40"
        >
          {UNIDADES.map((u) => (<option key={u} value={u.toLowerCase()}>{u}</option>))}
          <option value="otro">Otro…</option>
        </select>
      </label>
      {unidadSel === 'Otro' && (
        <label className="flex flex-col">Unidad (texto)
          <input name="unidadOtra" defaultValue={conocida ? '' : unidadActual ?? ''} placeholder="ej. bultos" className="w-28 rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
      <div className="flex w-full flex-col gap-2 rounded-lg border border-borde bg-arena p-2">
        <span className="font-semibold text-tinta">Potreros realizados</span>
        <div className="flex flex-col gap-1">
          {filasPotreros.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1">
                <input type="checkbox" name="loteHecho" value={l.id} defaultChecked className="accent-bosque" />
                {l.nombre}
              </label>
              <label className="flex items-center gap-1">ha
                <input name={`ha_${l.id}`} type="number" step="any" min="0" defaultValue={l.hectareas ?? ''} className="w-20 rounded-lg border border-borde bg-marfil p-0.5" />
              </label>
              {conBultos && (
                <label className="flex items-center gap-1">bultos
                  <input name={`bultos_${l.id}`} type="number" step="any" min="0" defaultValue={bultosAsignados?.[l.id] ?? ''} className="w-20 rounded-lg border border-borde bg-marfil p-0.5" />
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-borde pt-2">
          <span className="w-full text-tierra">Anexar potrero(s):</span>
          <select value={fincaAnexar} onChange={(e) => { setFincaAnexar(e.target.value); setLoteAnexar('') }} className="rounded-lg border border-borde bg-marfil p-1">
            <option value="">— finca —</option>
            {fincasAnexar.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
          <select value={loteAnexar} onChange={(e) => setLoteAnexar(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1">
            <option value="">— lote —</option>
            {lotesCatalogo.filter((l) => l.finca.nombre === fincaAnexar && !filasPotreros.some((x) => x.id === l.id)).map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
          </select>
          <button
            type="button"
            onClick={() => {
              const l = lotesCatalogo.find((x) => x.id === loteAnexar)
              if (l) { setAnexados((prev) => [...prev, { id: l.id, nombre: l.nombre }]); setLoteAnexar('') }
            }}
            className="rounded-lg border border-bosque px-2 py-1 font-semibold text-bosque hover:bg-arena/40"
          >
            + agregar
          </button>
        </div>
      </div>
      <label className="flex flex-1 flex-col">Observaciones
        <input name="observacion" placeholder="¿qué se avanzó?" className="rounded-lg border border-borde bg-marfil p-1 focus:outline-none focus:ring-2 focus:ring-bosque/40" />
      </label>
      <button className="rounded-lg bg-bosque px-3 py-1 font-semibold text-white">Guardar avance</button>
      <button type="button" onClick={() => setAbierto(false)} className="text-tierra underline">cancelar</button>
    </form>
  )
}
```

- [x] **Step 2: Reescribir `registrarAvanceAccion`**

En `src/app/cumplimiento/acciones.ts`, reemplazar la función `registrarAvanceAccion` (líneas 122-135) por:

```ts
export async function registrarAvanceAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  if (!id || !(dia >= 1 && dia <= 7)) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const lotesHechos = form.getAll('loteHecho').map((v) => String(v))
  if (lotesHechos.length === 0) return
  const responsableId = textoOpcional(form, 'responsableId')
  const maquinaId = textoOpcional(form, 'maquinaId')
  const centroSelect = texto(form, 'centroCosto')
  const centroCosto = centroSelect === '__otra__' ? textoOpcional(form, 'centroCostoOtra') : (centroSelect || null)
  const observacion = textoOpcional(form, 'observacion')
  const avances = lotesHechos.map((loteId) => ({ loteId, cantidad: numeroOpcional(form, `ha_${loteId}`) ?? 0 }))
  const bultosMap: Record<string, number> = {}
  for (const loteId of lotesHechos) {
    const b = numeroOpcional(form, `bultos_${loteId}`)
    if (b != null) bultosMap[loteId] = b
  }
  await anexarLotesGrupo(id, lotesHechos)
  await setUnidadRealizadaGrupo(id, unidadElegida(form))
  await registrarAvanceLoteGrupo(id, dia, maquinaId, avances, centroCosto, responsableId, observacion, Object.keys(bultosMap).length ? bultosMap : null)
  revalidatePath('/cumplimiento')
}
```

- [x] **Step 3: Eliminar la acción `setUnidadRealizadaAccion` (queda sin uso)**

En `src/app/cumplimiento/acciones.ts`, borrar por completo la función `setUnidadRealizadaAccion` (líneas 178-186, el bloque `export async function setUnidadRealizadaAccion(form: FormData) { ... }`). `setUnidadRealizadaGrupo` sigue importado y usado por `registrarAvanceAccion`.

- [x] **Step 4: `ActividadEstandar` — quitar el cuadro "Guardar unidad" y pasar props a `FormAvance`**

En `src/app/cumplimiento/actividad-estandar.tsx`:

(a) En el tipo de props y la desestructuración, **quitar** `setUnidadRealizada`. Borrar la línea `setUnidadRealizada,` de la desestructuración (línea 36) y la línea `setUnidadRealizada: (f: FormData) => void | Promise<void>` del tipo (línea 60).

(b) Reemplazar el bloque del `<FormAvance ... />` seguido del `<form action={setUnidadRealizada}>` (líneas 141-157) por:

```tsx
          <FormAvance
            actividadId={actividadId}
            diaActividad={dia}
            esMaquinaria={false}
            responsables={responsables}
            responsableDefault={responsableActividadId}
            maquinas={[]}
            lotesActividad={lotesActividad}
            lotesCatalogo={lotesCatalogo}
            fincaDefault={fincaActividad}
            bultosAsignados={bultosAsignados}
            descripcion={descripcion}
            unidadActual={unidadRealizada}
            accion={registrarAvance}
          />
```

(`selectorUnidad`/`inputUnidadOtra` **se conservan**: la rama `!tieneLotes` los sigue usando en el `<form action={registrarMedidaGeneral}>`.)

- [x] **Step 5: `ActividadMaquinaria` — quitar el cuadro "Guardar unidad" + andamiaje y pasar props a `FormAvance`**

En `src/app/cumplimiento/actividad-maquinaria.tsx`:

(a) Quitar `setUnidadRealizada` de la desestructuración (línea 37) y del tipo (línea 60).

(b) Borrar el andamiaje de unidad que queda sin uso: la constante `const UNIDADES = ...` (línea 13), y dentro del componente `const conocida = ...` + `const [unidadSel, setUnidadSel] = ...` (líneas 67-68), y los bloques `const selectorUnidad = (...)` y `const inputUnidadOtra = ...` (líneas 95-117).

(c) Reemplazar el bloque `<form action={setUnidadRealizada}>...</form>` + `<FormAvance .../>` (líneas 121-137) por:

```tsx
      <FormAvance
        actividadId={actividadId}
        diaActividad={dia}
        esMaquinaria={true}
        responsables={responsables}
        responsableDefault={responsableActividadId}
        maquinas={maquinas}
        lotesActividad={lotesActividad}
        lotesCatalogo={lotesCatalogo}
        fincaDefault={fincaActividad}
        bultosAsignados={bultosAsignados}
        descripcion={descripcion}
        unidadActual={unidadRealizada}
        accion={registrarAvance}
      />
```

- [x] **Step 6: `page.tsx` — quitar `setUnidadRealizada` y pasar `unidadActual`**

En `src/app/cumplimiento/page.tsx`:

(a) En el import de acciones (línea 13), quitar `setUnidadRealizadaAccion` de la lista.

(b) En `<ActividadMaquinaria .../>`: borrar la línea `setUnidadRealizada={setUnidadRealizadaAccion}` (línea 279) y añadir, junto a las demás props, `unidadActual={cab.unidadRealizada}`.

(c) En `<ActividadEstandar .../>`: borrar la línea `setUnidadRealizada={setUnidadRealizadaAccion}` (línea 303) y añadir `unidadActual={cab.unidadRealizada}`.

(Ambos controles ya reciben `unidadRealizada={cab.unidadRealizada}`, que se mantiene; `unidadActual` es la que se propaga a `FormAvance`.)

- [x] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: 0 errores en `src/`.

- [x] **Step 8: Tests**

Run: `npx vitest run`
Expected: PASS (sin regresiones; no hay tests nuevos en este task).

- [x] **Step 9: Commit**

```bash
git add src/app/cumplimiento/form-avance.tsx src/app/cumplimiento/acciones.ts src/app/cumplimiento/actividad-estandar.tsx src/app/cumplimiento/actividad-maquinaria.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(avance): tabla de potreros + unidad + observaciones en FormAvance; quita cuadro suelto de unidad"
```

---

### Task 5: Novedad — Parcial = checklist simple + unidad; revertir el repo

**Files:**
- Modify: `src/app/cumplimiento/form-registrar.tsx` (revertir tabla a checklist; quitar `usaBultos`/`bultosAsignados`/`descripcion`; añadir selector de unidad + prop `unidadActual`)
- Modify: `src/app/cumplimiento/acciones.ts` (`registrarNovedadActividadAccion`: quitar `medidas`, fijar unidad)
- Modify: `src/datos/repositorio.ts:718-789` (`registrarNovedadGrupo`: quitar `medidas`/bultos/haRealizada; conectar `lotesHechos`)
- Modify: `src/app/cumplimiento/actividad-estandar.tsx` y `actividad-maquinaria.tsx` (a `FormRegistrar`: añadir `unidadActual`, quitar `bultosAsignados`/`descripcion`)

**Interfaces:**
- Consumes: `setUnidadRealizadaGrupo`, `unidadElegida` (existentes).
- Produces: `FormRegistrar` recibe `unidadActual?: string | null` y **ya no** `bultosAsignados`/`descripcion`; emite `loteHecho[]` (sin `ha_`/`bultos_`) + `unidad`/`unidadOtra`. `registrarNovedadGrupo(id, estado, motivoId, nota, reemplazo?, lotesHechos?)` (sin `medidas`).

- [x] **Step 1: `registrarNovedadGrupo` — revertir a solo lotesHechos + connect**

En `src/datos/repositorio.ts`, reemplazar la firma y el cuerpo relevante de `registrarNovedadGrupo` (líneas 718-758) por (mantener intacto lo de reprogramación y reemplazo, líneas 759-789):

```ts
export async function registrarNovedadGrupo(
  id: string,
  estado: string,
  motivoId: string | null,
  nota: string | null,
  reemplazo?: { descripcion: string; loteId: string | null } | null,
  lotesHechos: string[] = [],
) {
  const g = await filasHermanas(id)
  if (!g) return null
  const notaFinal = reemplazo ? `Cambiada por: ${reemplazo.descripcion}` : nota
  let fincaId: string | null = null
  if (reemplazo?.loteId) {
    const lote = await prisma.lote.findUnique({ where: { id: reemplazo.loteId } })
    fincaId = lote?.fincaId ?? null
  }
  await prisma.$transaction(async (tx) => {
    for (const f of g.filas) {
      if (f.estado === 'CUMPLIDA') continue
      await tx.actividad.update({
        where: { id: f.id },
        data: {
          estado,
          motivoId,
          nota: notaFinal,
          ...(lotesHechos.length
            ? {
                lotesHechos: lotesHechos as Prisma.InputJsonValue,
                lotes: { connect: lotesHechos.map((lid) => ({ id: lid })) },
              }
            : {}),
        },
      })
    }
```

(El resto del cuerpo — el `if ((estado === 'NO_CUMPLIDA' || ...))` y el `if (reemplazo?.descripcion)` dentro de la misma `$transaction`, y el `})` de cierre + `return true` — queda **sin cambios**.)

- [x] **Step 2: `registrarNovedadActividadAccion` — quitar medidas, fijar unidad**

En `src/app/cumplimiento/acciones.ts`, reemplazar el cuerpo de `registrarNovedadActividadAccion` (líneas 147-168) por:

```ts
export async function registrarNovedadActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  const estado = texto(form, 'estado')
  if (!id || !ESTADOS_VALIDOS.includes(estado) || estado === 'PENDIENTE' || estado === 'CUMPLIDA') return
  const motivoId = textoOpcional(form, 'motivoId')
  if (!motivoId) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const nota = textoOpcional(form, 'nota')
  const lotesHechos = form.getAll('loteHecho').map((v) => String(v))
  // Cambio de actividad (estándar): descripción + lote, sin máquina/medida.
  const reemplazoDesc = texto(form, 'reemplazoDescripcion')
  const reemplazo = reemplazoDesc
    ? { descripcion: reemplazoDesc, loteId: textoOpcional(form, 'reemplazoLoteId') }
    : null
  await setUnidadRealizadaGrupo(id, unidadElegida(form))
  await registrarNovedadGrupo(id, estado, motivoId, nota, reemplazo, lotesHechos)
  revalidatePath('/cumplimiento')
}
```

- [x] **Step 3: `FormRegistrar` — checklist simple + unidad**

En `src/app/cumplimiento/form-registrar.tsx`:

(a) Quitar el import `import { usaBultos } from '@/dominio/bultos'` (línea 7).

(b) En el tipo/props, quitar `bultosAsignados` y `descripcion` (líneas 24-25 y 38-39) y **añadir** `unidadActual?: string | null`. La lista de props queda: `actividadId, esMaquinaria, unidad, motivos, motivoCambioId, lotes, maquinas, estipuladas, haProgramada, lotesActividad, unidadActual, accion` (con sus tipos correspondientes).

(c) Quitar `const conBultos = descripcion ? usaBultos(descripcion) : false` (línea 52). Añadir, junto a los demás estados/const del cuerpo, la constante y el estado de unidad:

```tsx
  const UNIDADES = ['Ha', 'Hora', 'Kg', 'Cantidad', 'Bultos', 'Jornales'] // + "Otro"
  const conocidaU = UNIDADES.find((u) => u.toLowerCase() === (unidadActual ?? '').toLowerCase())
  const [unidadSel, setUnidadSel] = useState(conocidaU ?? (unidadActual ? 'Otro' : (esMaquinaria ? 'Ha' : 'Cantidad')))
```

(d) Reemplazar el bloque `{requierePotreros && ( ... )}` (líneas 134-177) por el checklist simple + anexar (sin `ha_`/`bultos_`):

```tsx
      {requierePotreros && (
        <div className="flex w-full flex-col gap-2 rounded-lg border border-borde bg-arena p-2 text-xs">
          <span className="font-semibold text-tinta">Potreros realizados</span>
          <div className="flex flex-wrap gap-2">
            {filasPotreros.map((l) => (
              <label key={l.id} className="flex items-center gap-1">
                <input type="checkbox" name="loteHecho" value={l.id} defaultChecked={anexados.some((a) => a.id === l.id)} className="accent-bosque" />
                {l.nombre}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-borde pt-2">
            <span className="w-full text-tierra">Anexar potrero(s):</span>
            <select value={fincaAnexar} onChange={(e) => { setFincaAnexar(e.target.value); setLoteAnexar('') }} className="rounded-lg border border-borde bg-marfil p-1">
              <option value="">— finca —</option>
              {fincasAnexar.map((f) => (<option key={f} value={f}>{f}</option>))}
            </select>
            <select value={loteAnexar} onChange={(e) => setLoteAnexar(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1">
              <option value="">— lote —</option>
              {lotes.filter((l) => l.finca.nombre === fincaAnexar && !filasPotreros.some((x) => x.id === l.id)).map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
            </select>
            <button
              type="button"
              onClick={() => {
                const l = lotes.find((x) => x.id === loteAnexar)
                if (l) { setAnexados((prev) => [...prev, { id: l.id, nombre: l.nombre }]); setLoteAnexar('') }
              }}
              className="rounded-lg border border-bosque px-2 py-1 font-semibold text-bosque hover:bg-arena/40"
            >
              + agregar
            </button>
          </div>
        </div>
      )}
```

(e) Añadir el selector de unidad. Justo **después** del `</label>` del campo "Observación / lo que faltó" (el que termina en la línea 97, tras el `<input name="nota" .../>`), insertar:

```tsx
      <label className="flex flex-col text-xs">
        Unidad
        <select
          name="unidad"
          value={unidadSel === 'Otro' ? 'otro' : unidadSel.toLowerCase()}
          onChange={(e) => setUnidadSel(e.target.value === 'otro' ? 'Otro' : e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
          className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
        >
          {UNIDADES.map((u) => (<option key={u} value={u.toLowerCase()}>{u}</option>))}
          <option value="otro">Otro…</option>
        </select>
      </label>
      {unidadSel === 'Otro' && (
        <label className="flex flex-col text-xs">
          Unidad (texto)
          <input name="unidadOtra" defaultValue={conocidaU ? '' : unidadActual ?? ''} placeholder="ej. bultos" className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
        </label>
      )}
```

- [x] **Step 4: Controles — props de `FormRegistrar`**

En `src/app/cumplimiento/actividad-estandar.tsx` y `src/app/cumplimiento/actividad-maquinaria.tsx`, en el `<FormRegistrar ... />` (dentro del `if (novedad)`), **quitar** las props `bultosAsignados={bultosAsignados}` y `descripcion={descripcion}` y **añadir** `unidadActual={unidadRealizada}`.

(En `ActividadEstandar` la actividad no expone `unidad`; `unidadRealizada` es la prop correcta. En `ActividadMaquinaria` también se usa `unidadRealizada`. Las props `bultosAsignados`/`descripcion` de los controles se conservan porque `FormAvance` las sigue usando.)

- [x] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: 0 errores en `src/`.

- [x] **Step 6: Tests**

Run: `npx vitest run`
Expected: PASS (sin regresiones).

- [x] **Step 7: Commit**

```bash
git add src/app/cumplimiento/form-registrar.tsx src/app/cumplimiento/acciones.ts src/datos/repositorio.ts src/app/cumplimiento/actividad-estandar.tsx src/app/cumplimiento/actividad-maquinaria.tsx
git commit -m "feat(novedad): Parcial con checklist simple + selector de unidad; revierte tabla de medidas del repo"
```

---

## Verificación manual (post-implementación, en vivo)

1. Fertilización con varios potreros → **Registrar avance**: la tabla precarga ha (área) y bultos asignados; marcar/editar/anexar, elegir unidad, escribir observación → se guardan avances (cantidad=ha), `bultosPorLote`, `unidadRealizada`; el Excel día a día muestra responsable/tractor reales, la unidad de la actividad y la **observación del avance**.
2. Actividad **no** de fertilización con varios potreros → igual, **sin** columna de bultos.
3. **Novedad Parcial** → checklist simple (marcar + anexar) + selector de unidad; se guardan `lotesHechos` (anexados conectados) y `unidadRealizada`; no se tocan bultos/haRealizada.
4. El cuadro suelto **"Guardar unidad"** ya no aparece en ninguna versión.

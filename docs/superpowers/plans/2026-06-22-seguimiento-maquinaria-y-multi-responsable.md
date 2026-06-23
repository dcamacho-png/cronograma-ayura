# Seguimiento maquinaria por avance + actividad única multi-responsable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que maquinaria registre el avance por día en su unidad (ha/hora/kg) dentro de una tarjeta por actividad, y que una actividad con varios responsables se vea y cuente como **una sola** (un día se muestra una vez, con sus responsables dentro), con "↩ desmarcar" en ambas áreas.

**Architecture:** Cambios en 3 capas. Dominio: helpers puros `diasDistintos`/`responsablesDistintos` + pruebas que confirman el conteo por actividad con varios responsables. Datos: `reabrirActividad` + acción `desmarcarAccion` para revertir un día limpiando medida/centro/motivo/nota. UI: nuevo `DiaMaquinaria` (campo de avance) y reestructura de la tarjeta en `/cumplimiento` para agrupar por día y listar responsables dentro.

**Tech Stack:** Next.js (App Router, RSC + server actions), TypeScript, Prisma/Postgres, Vitest. Dominio se prueba con Vitest; la UI se verifica con typecheck + lint + revisión en navegador.

## Global Constraints

- **NO cambiar el modelo de datos:** sigue una fila `Actividad` por (responsable × día). Sin migraciones.
- **NO cambiar la exportación a Excel** (`cumplimiento-export.ts`, `exportar/route.ts`).
- **Unidades:** solo **ha / hora / kg** (catálogo). No agregar bultos.
- **Agrupamiento de actividad:** por `tareaId` (helper `agruparPorActividad`, ya existe). La actividad pesa 1; sus filas (responsable-día) cuentan adentro; `% = filas cumplidas ÷ filas totales`.
- **Maquinaria por día:** input de avance con etiqueta `etiquetaMedida(unidad)` + centro de costo opcional + **Guardar** → `registrarAccion` con `estado=CUMPLIDA`, `haRealizada`, `centroCosto`. Más **"registrar novedad"** (FormRegistrar, no cumplida con motivo).
- **Desmarcar (ambas áreas):** `reabrirActividad(id)` deja `estado='PENDIENTE'` y limpia `haRealizada`, `centroCosto`, `motivoId`, `nota`, `lotesHechos`.
- **Mostrar el responsable por fila solo si la actividad tiene más de un responsable distinto.** El contador de la cabecera cuenta **días distintos**, no filas.
- **Patrones del repo:** comentarios en español, color de marca `#11603a`, `'use client'` en componentes interactivos, server actions con `revalidatePath('/cumplimiento')`.

---

### Task 1: Helpers de dominio + conteo multi-responsable

Funciones puras para la cabecera de la tarjeta (días distintos, responsables distintos) y pruebas que confirman que `porcentajeCumplimiento` cuenta una actividad multi-responsable como una.

**Files:**
- Modify: `src/dominio/metricas.ts` (agregar `diasDistintos`, `responsablesDistintos`)
- Test: `src/dominio/metricas.test.ts`

**Interfaces:**
- Produces:
  - `diasDistintos<T extends { dia: number }>(filas: T[]): number`
  - `responsablesDistintos<T extends { responsableId: string }>(filas: T[]): number`

- [ ] **Step 1: Escribir las pruebas (que fallan)**

Añadir a `src/dominio/metricas.test.ts`. Asegúrate de importar los helpers nuevos junto a los existentes en la parte superior del archivo:

```ts
import { pesoEstado, porcentajeCumplimiento, agruparPorActividad, diasDistintos, responsablesDistintos } from './metricas'
```

Y agrega estos `describe` (usan `act`, que ya fija `tareaId: null` y `responsableId: 'r'` por defecto):

```ts
describe('diasDistintos / responsablesDistintos', () => {
  it('cuenta días distintos ignorando filas repetidas del mismo día', () => {
    const filas = [act({ id: 'a', dia: 1 }), act({ id: 'b', dia: 1 }), act({ id: 'c', dia: 2 })]
    expect(diasDistintos(filas)).toBe(2)
  })
  it('cuenta responsables distintos', () => {
    const filas = [
      act({ id: 'a', responsableId: 'P' }),
      act({ id: 'b', responsableId: 'J' }),
      act({ id: 'c', responsableId: 'P' }),
    ]
    expect(responsablesDistintos(filas)).toBe(2)
  })
})

describe('porcentajeCumplimiento con varios responsables', () => {
  it('una actividad con 2 responsables × 2 días cuenta como UNA', () => {
    const acts: Actividad[] = []
    for (const rid of ['P', 'J']) for (const dia of [1, 2]) {
      acts.push(act({ id: `${rid}${dia}`, tareaId: 'T1', responsableId: rid, dia, estado: 'CUMPLIDA' }))
    }
    // 4 filas (responsable-día) todas cumplidas → 100
    expect(porcentajeCumplimiento(acts)).toBe(100)
  })
  it('la mitad de las filas cumplidas → 50%', () => {
    const acts: Actividad[] = [
      act({ id: 'P1', tareaId: 'T1', responsableId: 'P', dia: 1, estado: 'CUMPLIDA' }),
      act({ id: 'P2', tareaId: 'T1', responsableId: 'P', dia: 2, estado: 'CUMPLIDA' }),
      act({ id: 'J1', tareaId: 'T1', responsableId: 'J', dia: 1, estado: 'NO_CUMPLIDA' }),
      act({ id: 'J2', tareaId: 'T1', responsableId: 'J', dia: 2, estado: 'NO_CUMPLIDA' }),
    ]
    expect(porcentajeCumplimiento(acts)).toBe(50)
  })
})
```

- [ ] **Step 2: Correr las pruebas y verlas fallar**

Run: `npm test -- src/dominio/metricas.test.ts`
Expected: FALLA — `diasDistintos`/`responsablesDistintos` no existen (import roto).

- [ ] **Step 3: Implementar los helpers**

En `src/dominio/metricas.ts`, cerca de `agruparPorActividad`, agregar:

```ts
// Nº de días distintos entre las filas (varias filas pueden compartir día si hay
// varios responsables). Para el contador "N días" de la tarjeta.
export function diasDistintos<T extends { dia: number }>(filas: T[]): number {
  return new Set(filas.map((f) => f.dia)).size
}

// Nº de responsables distintos entre las filas. Si es > 1, la tarjeta muestra el
// nombre del responsable en cada fila.
export function responsablesDistintos<T extends { responsableId: string }>(filas: T[]): number {
  return new Set(filas.map((f) => f.responsableId)).size
}
```

- [ ] **Step 4: Correr toda la suite**

Run: `npm test`
Expected: PASA (incluye las pruebas nuevas y las existentes).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/dominio/metricas.ts src/dominio/metricas.test.ts
git commit -m "feat(dominio): helpers diasDistintos/responsablesDistintos + tests multi-responsable"
```

---

### Task 2: Desmarcar unificado (`reabrirActividad` + `desmarcarAccion`)

Revertir un día registrado a Pendiente limpiando medida/centro/motivo/nota, para usarlo en ambas áreas.

**Files:**
- Modify: `src/datos/repositorio.ts` (agregar `reabrirActividad`)
- Modify: `src/app/cumplimiento/acciones.ts` (agregar `desmarcarAccion`)

**Interfaces:**
- Produces:
  - `reabrirActividad(id: string)` — `update` a PENDIENTE limpiando campos.
  - `desmarcarAccion(form: FormData): Promise<void>` — lee `id`, llama `reabrirActividad`, revalida.

- [ ] **Step 1: Agregar `reabrirActividad` al repositorio**

En `src/datos/repositorio.ts`, junto a `marcarEstado` (cerca de la línea 69), agregar:

```ts
// Devuelve un día a PENDIENTE y limpia lo capturado al registrar (medida, centro de
// costo, motivo, nota, potreros). Para el "↩ desmarcar" sin dejar datos huérfanos.
export function reabrirActividad(id: string) {
  return prisma.actividad.update({
    where: { id },
    data: {
      estado: 'PENDIENTE',
      haRealizada: null,
      centroCosto: null,
      motivoId: null,
      nota: null,
      lotesHechos: Prisma.DbNull,
    },
  })
}
```

> Nota: `lotesHechos` es columna `Json?`; para anularla en Prisma se usa `Prisma.DbNull`. Verifica que `Prisma` ya esté importado en el archivo (se usa en `asignarTarea`); si no, agrega `import { Prisma } from '@prisma/client'`.

- [ ] **Step 2: Agregar `desmarcarAccion`**

En `src/app/cumplimiento/acciones.ts`: importar `reabrirActividad` y crear la acción.

Cambiar el import existente de repositorio para incluir `reabrirActividad`:

```ts
import { marcarEstado, reprogramarActividad, registrarCumplimiento, crearActividadRealizada, reabrirActividad } from '@/datos/repositorio'
```

Agregar la acción (después de `marcarEstadoAccion`):

```ts
export async function desmarcarAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  await reabrirActividad(id)
  revalidatePath('/cumplimiento')
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/datos/repositorio.ts src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): reabrirActividad + desmarcarAccion (revertir día a pendiente)"
```

---

### Task 3: Componente `DiaMaquinaria` (avance por día)

Control por día para maquinaria: campo de avance en la unidad de la actividad + centro de costo + Guardar; y "registrar novedad" (FormRegistrar).

**Files:**
- Create: `src/app/cumplimiento/dia-maquinaria.tsx`

**Interfaces:**
- Consumes: `FormRegistrar` (`./form-registrar`), `etiquetaMedida`/`Unidad` (`@/dominio/unidad`), `CENTROS_COSTO` (`@/dominio/centro-costo`).
- Produces: componente `DiaMaquinaria` con props:
  ```ts
  {
    actividadId: string
    unidad: Unidad
    motivos: { id: string; nombre: string }[]
    motivoCambioId: string | null
    lotes: { id: string; nombre: string; finca: { nombre: string } }[]
    maquinas: { id: string; nombre: string }[]
    estipuladas: { id: string; nombre: string; unidad: string }[]
    lotesActividad: { id: string; nombre: string }[]
    haProgramada: number
    accionRegistrar: (formData: FormData) => void | Promise<void>
  }
  ```

- [ ] **Step 1: Crear el componente**

Crear `src/app/cumplimiento/dia-maquinaria.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { etiquetaMedida, type Unidad } from '@/dominio/unidad'
import { CENTROS_COSTO } from '@/dominio/centro-costo'
import { FormRegistrar } from './form-registrar'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

// Registro de un día de MAQUINARIA por avance: se ingresa la medida lograda ese día
// (ha/hora/kg) y al Guardar el día queda CUMPLIDA con esa medida. "registrar novedad"
// revela el formulario completo (no cumplida / parcial / reprogramada con motivo).
export function DiaMaquinaria({
  actividadId,
  unidad,
  motivos,
  motivoCambioId,
  lotes,
  maquinas,
  estipuladas,
  lotesActividad,
  haProgramada,
  accionRegistrar,
}: {
  actividadId: string
  unidad: Unidad
  motivos: Motivo[]
  motivoCambioId: string | null
  lotes: Lote[]
  maquinas: { id: string; nombre: string }[]
  estipuladas: Estipulada[]
  lotesActividad: { id: string; nombre: string }[]
  haProgramada: number
  accionRegistrar: (formData: FormData) => void | Promise<void>
}) {
  const [novedad, setNovedad] = useState(false)
  const [centro, setCentro] = useState('')

  if (novedad) {
    return (
      <div>
        <FormRegistrar
          actividadId={actividadId}
          esMaquinaria={true}
          unidad={unidad}
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          lotes={lotes}
          maquinas={maquinas}
          estipuladas={estipuladas}
          haProgramada={haProgramada}
          lotesActividad={lotesActividad}
          accion={accionRegistrar}
        />
        <button
          type="button"
          onClick={() => setNovedad(false)}
          className="mt-1 text-xs text-gray-500 underline"
        >
          cancelar novedad
        </button>
      </div>
    )
  }

  return (
    <form action={accionRegistrar} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={actividadId} />
      <input type="hidden" name="estado" value="CUMPLIDA" />
      <label className="flex flex-col text-xs">
        {etiquetaMedida(unidad)}
        <input
          name="haRealizada"
          type="number"
          step="any"
          min="0"
          defaultValue={haProgramada}
          className="w-28 rounded border p-1 text-sm"
        />
      </label>
      <label className="flex flex-col text-xs">
        Centro de costo
        <select
          name="centroCosto"
          value={centro}
          onChange={(e) => setCentro(e.target.value)}
          className="rounded border p-1 text-sm"
        >
          <option value="">— sin centro —</option>
          {CENTROS_COSTO.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          <option value="__otra__">Otras…</option>
        </select>
      </label>
      {centro === '__otra__' && (
        <label className="flex flex-col text-xs">
          Otras (texto libre)
          <input name="centroCostoOtra" className="w-40 rounded border p-1 text-sm" />
        </label>
      )}
      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Guardar avance</button>
      <button type="button" onClick={() => setNovedad(true)} className="text-xs text-gray-500 underline">
        registrar novedad
      </button>
    </form>
  )
}
```

> `defaultValue={haProgramada}` replica el formulario de maquinaria actual (pre-llena la medida con las hectáreas programadas); es un valor editable.

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/cumplimiento/dia-maquinaria.tsx
git commit -m "feat(cumplimiento): componente DiaMaquinaria (avance por día)"
```

---

### Task 4: Reestructurar la tarjeta de cumplimiento

Agrupar las filas del grupo por día (día una vez), listar responsables dentro de cada día, cabecera con responsables + días distintos, usar `DiaMaquinaria` en maquinaria, y "↩ desmarcar" en ambas áreas.

**Files:**
- Modify: `src/app/cumplimiento/page.tsx` (imports y el bloque de `gruposActividad`)

**Interfaces:**
- Consumes: `diasDistintos`, `responsablesDistintos` (Task 1); `desmarcarAccion` (Task 2); `DiaMaquinaria` (Task 3); `DiaNoMaquinaria`, `FormRegistrar`, `marcarEstadoAccion`, `registrarAccion` (existentes); `unidadAbreviada`, `unidadDe` (`@/dominio/unidad`).

- [ ] **Step 1: Actualizar imports en `page.tsx`**

```ts
import { porcentajeCumplimiento, colorSemaforo, agruparPorActividad, diasDistintos, responsablesDistintos } from '@/dominio/metricas'
import { unidadDe, unidadAbreviada } from '@/dominio/unidad'
import { registrarAccion, agregarActividadRealizadaAccion, marcarEstadoAccion, desmarcarAccion } from './acciones'
import { DiaNoMaquinaria } from './dia-no-maquinaria'
import { DiaMaquinaria } from './dia-maquinaria'
```

> Mantén el resto de imports existentes (`FormActividadRealizada`, `FormRegistrar`, `InfoLotes`, `textoLotesHechos`, etc.). `marcarEstadoAccion` sigue usándose para el "✓ Cumplido" de `DiaNoMaquinaria`.

- [ ] **Step 2: Reemplazar el bloque de tarjetas agrupadas**

Sustituir todo el bloque `{actividades.length === 0 ? (…) : (<ul className="space-y-4">…</ul>)}` por el siguiente. Mantiene la cabecera/lotes y reestructura el cuerpo en día → responsables:

```tsx
      {actividades.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay actividades en esta semana. Prográmalas en la pestaña <b>Programar</b>.
        </p>
      ) : (
        <ul className="space-y-4">
          {gruposActividad.map((dias) => {
            const cab = dias[0]
            const pctAct = porcentajeCumplimiento(dias as unknown as ActividadDominio[])
            const nDias = diasDistintos(dias)
            const multiResp = responsablesDistintos(dias) > 1
            // nombres de responsables distintos, en orden de aparición
            const nombresResp = [...new Map(dias.map((a) => [a.responsableId, a.responsable.nombre])).values()]
            // agrupar las filas del grupo por día (cada día una vez)
            const porDia = new Map<number, typeof dias>()
            for (const a of dias) {
              const lista = porDia.get(a.dia) ?? []
              lista.push(a)
              porDia.set(a.dia, lista)
            }
            const diasOrdenados = [...porDia.entries()].sort((x, y) => x[0] - y[0])
            const unidad = unidadDe(unidadPorNombre, cab.descripcion)
            return (
              <li key={cab.tareaId ?? cab.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="font-medium">{cab.descripcion}</span>
                  <span>·</span>
                  <span>{nombresResp.join(', ')}</span>
                  {cab.maquina && <span className="text-gray-600">· 🚜 {cab.maquina.nombre}</span>}
                  {cab.vecesReprogramada > 0 && (
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: COLOR_HEX[colorSemaforo(cab.vecesReprogramada)] }}
                    >
                      reprogramada {cab.vecesReprogramada}×
                    </span>
                  )}
                  <span className="ml-auto rounded bg-gray-100 px-2 py-0.5 text-xs">
                    {nDias > 1 ? `${nDias} días · ` : ''}Cumplido: <b>{pctAct === null ? '—' : `${pctAct}%`}</b>
                  </span>
                </div>
                <InfoLotes lotes={cab.lotes} bultosPorLote={cab.bultosPorLote as Record<string, number> | null} className="mb-2" />

                <ul className="space-y-2">
                  {diasOrdenados.map(([dia, filas]) => (
                    <li key={dia} className="rounded border border-gray-100 bg-gray-50/50 p-2">
                      <div className="mb-1 text-xs font-semibold text-gray-600">
                        {DIAS[dia] ?? ''} {fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}
                      </div>
                      <ul className="space-y-2">
                        {filas.map((a) => (
                          <li key={a.id} className="flex flex-col gap-1">
                            {multiResp && <span className="text-xs text-gray-500">{a.responsable.nombre}</span>}
                            {a.estado === 'PENDIENTE' ? (
                              esMaquinaria ? (
                                <DiaMaquinaria
                                  actividadId={a.id}
                                  unidad={unidad}
                                  motivos={motivos}
                                  motivoCambioId={motivoCambioId}
                                  lotes={lotes}
                                  maquinas={maquinas}
                                  estipuladas={estipuladas}
                                  lotesActividad={a.lotes}
                                  haProgramada={a.lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0)}
                                  accionRegistrar={registrarAccion}
                                />
                              ) : (
                                <DiaNoMaquinaria
                                  actividadId={a.id}
                                  motivos={motivos}
                                  motivoCambioId={motivoCambioId}
                                  lotes={lotes}
                                  maquinas={maquinas}
                                  estipuladas={estipuladas}
                                  lotesActividad={a.lotes}
                                  unidad={unidad}
                                  marcarCumplido={marcarEstadoAccion}
                                  accionRegistrar={registrarAccion}
                                />
                              )
                            ) : (
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-semibold">{ESTADOS.find((e) => e.valor === a.estado)?.etiqueta ?? a.estado}</span>
                                {a.haRealizada != null && (
                                  <span className="text-gray-500">· {a.haRealizada} {unidadAbreviada(unidad)}</span>
                                )}
                                {a.motivo && <span className="text-gray-500">· {a.motivo.nombre}</span>}
                                {a.nota && <span className="text-gray-500">· {a.nota}</span>}
                                {a.centroCosto && <span className="text-gray-500">· 🏷️ {a.centroCosto}</span>}
                                {textoLotesHechos(a.lotes, a.lotesHechos as string[] | null) && (
                                  <span className="text-gray-500">· ✅ Realizados: {textoLotesHechos(a.lotes, a.lotesHechos as string[] | null)}</span>
                                )}
                                <form action={desmarcarAccion} className="ml-auto">
                                  <input type="hidden" name="id" value={a.id} />
                                  <button className="text-xs text-gray-500 underline hover:text-gray-700">↩ desmarcar</button>
                                </form>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
```

> Cambios respecto a hoy: (1) la cabecera muestra **todos** los responsables y "{nDias} días" cuenta días distintos; (2) el cuerpo agrupa por día y dentro lista responsables (nombre solo si hay más de uno); (3) maquinaria usa `DiaMaquinaria`; (4) "↩ desmarcar" usa `desmarcarAccion` en **ambas** áreas (antes solo no-maquinaria con `marcarEstadoAccion`); (5) el estado registrado muestra la medida (`haRealizada` + unidad).

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

Run: `npm run dev` (requiere `DATABASE_URL` en `.env`). En `/cumplimiento`:
- **Maquinaria:** un día pendiente muestra el campo de avance ("Hectáreas/Kg/Horas realizadas") + centro de costo + **Guardar avance** y "registrar novedad". Al guardar, el día queda registrado con la medida y el % de la tarjeta sube.
- **Multi-responsable:** una actividad con varios responsables se ve como **una tarjeta**; cada día aparece **una sola vez** y dentro están los responsables (con su nombre); el contador dice los **días distintos**.
- **Desmarcar:** en ambas áreas, "↩ desmarcar" devuelve el día a pendiente (en maquinaria, vuelve a aparecer el campo de avance) y el % baja.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): tarjeta por día con responsables dentro, avance de maquinaria y desmarcar unificado"
```

---

## Self-Review

**Spec coverage:**
- A. Tarjeta agrupada por día + responsables dentro + cabecera (responsables, días distintos) → Task 4 (usa helpers de Task 1). ✅
- B. Control de avance por día en maquinaria + novedad → Task 3 + Task 4 (rama `esMaquinaria`). ✅
- C. Desmarcar unificado (`reabrirActividad` limpia medida/centro/motivo/nota; ambas áreas) → Task 2 + Task 4. ✅
- D. Cálculo sin cambios; verificado con tests multi-responsable → Task 1. ✅
- Unidades solo ha/hora/kg (sin bultos) → Task 3 usa `etiquetaMedida`/`Unidad` existentes. ✅
- Mostrar responsable solo si > 1; contador de días distintos → Task 4 con `responsablesDistintos`/`diasDistintos`. ✅
- Excel y modelo de datos sin cambios → Global Constraints (ninguna task los toca). ✅

**Placeholder scan:** sin TBD/TODO; todo el código está completo en cada paso.

**Type consistency:** `diasDistintos`/`responsablesDistintos` devuelven `number` y se usan así en Task 4. `DiaMaquinaria` recibe exactamente las props que `FormRegistrar` necesita más `accionRegistrar`. `desmarcarAccion(form)` consumida vía `<form action>`. `reabrirActividad(id)` usada por `desmarcarAccion`. `registrarAccion` acepta `estado=CUMPLIDA` + `haRealizada` + `centroCosto` (verificado en `acciones.ts`).

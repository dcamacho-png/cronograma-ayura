# Avances visibles en CUMPLIDA + medida=suma + Excel una fila por avance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar el listado de avances también cuando la actividad está CUMPLIDA con la medida = suma de los avances, y exportar el Excel con una fila por cada avance (en vez de una celda concatenada).

**Architecture:** La lógica de filas del Excel pasa a una función pura `filasCumplimiento` que devuelve un arreglo de filas (una por avance, o una sola si no hay avances). La pantalla reusa los helpers de `avance-lote` para calcular la medida (suma) y el resumen, mostrando el resumen en cualquier estado no-pendiente y el formulario/botones solo en PARCIAL.

**Tech Stack:** Next.js (App Router, RSC), TypeScript, ExcelJS, Vitest.

## Global Constraints

- **Sin migración de esquema:** `avancePorLote` sigue siendo JSON (`Actividad.avancePorLote Json?`); normalizar al leer con `normalizarAvancePorLote`.
- Comentarios en español; color de marca `#11603a`.
- No tocar el modelo de filas-día, la programación, ni el conteo de actividades.
- No cambiar el flujo de registro de avance ni el de "marcar cumplida"; solo visualización (pantalla) y formato de exportación (Excel).
- Cada entrada de avance es `{ dia: number; maquinaId: string | null; cantidad: number }`; `AvancePorLote = Record<string, AvanceEntrada[]>`.

---

### Task 1: Excel — `filasCumplimiento` (una fila por avance) + quitar columna "Avance por lote"

**Files:**
- Modify: `src/dominio/cumplimiento-export.ts`
- Test: `src/dominio/cumplimiento-export.test.ts` (reemplazo completo)

**Interfaces:**
- Consumes: `normalizarAvancePorLote`, `type AvanceEntrada` (`./avance-lote`); `normalizarUnidad`, `unidadAbreviada`, `type Unidad` (`./unidad`); `textoBultosPorLote`, `type BultosPorLote` (`./bultos`); `textoLotesHechos` (`./lotes-hechos`).
- Produces:
  - `COLUMNAS_CUMPLIMIENTO` (12 columnas, sin "Avance por lote").
  - `type ActividadExport` (extendido con `avancePorLote`).
  - `filasCumplimiento(a: ActividadExport, fecha: string, unidadPorNombre: Record<string,string>, ctx: { fechaDeDia: (dia: number) => string; nombreMaquina: (maquinaId: string | null) => string }): (string | number)[][]`

- [ ] **Step 1: Reemplazar el archivo de pruebas (que falla)**

Reemplazar **todo** el contenido de `src/dominio/cumplimiento-export.test.ts` por:

```ts
import { describe, it, expect } from 'vitest'
import { filasCumplimiento, COLUMNAS_CUMPLIMIENTO, type ActividadExport } from './cumplimiento-export'

const mapa: Record<string, string> = { ESTERCOLERO: 'hora', GRANEL: 'kg', ENCALADORA: 'ha' }
const ctx = {
  fechaDeDia: (d: number) => `D${d}`,
  nombreMaquina: (id: string | null) => (id ? `MAQ-${id}` : ''),
}

function act(p: Partial<ActividadExport>): ActividadExport {
  return {
    dia: 1,
    descripcion: 'ENCALADORA',
    estado: 'CUMPLIDA',
    haRealizada: 3,
    responsable: { nombre: 'Ana' },
    maquina: { nombre: '6603' },
    lotes: [{ id: 'l1', nombre: 'L1' }],
    bultosPorLote: null,
    centroCosto: null,
    lotesHechos: null,
    avancePorLote: null,
    ...p,
  }
}

describe('COLUMNAS_CUMPLIMIENTO', () => {
  it('tiene las 12 columnas en el orden acordado (sin "Avance por lote")', () => {
    expect([...COLUMNAS_CUMPLIMIENTO]).toEqual([
      'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados',
    ])
  })
})

describe('filasCumplimiento — sin avances (una fila, como antes)', () => {
  it('actividad de ha con medida', () => {
    expect(filasCumplimiento(act({}), '15 jun', mapa, ctx)).toEqual([
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 3, 'ha', '', '', ''],
    ])
  })
  it('sin medida deja medida y unidad vacías; traduce el estado', () => {
    expect(filasCumplimiento(act({ haRealizada: null, estado: 'NO_CUMPLIDA' }), '', mapa, ctx)).toEqual([
      ['Lun', '', 'Ana', 'ENCALADORA', '6603', 'L1', 'No cumplida', '', '', '', '', ''],
    ])
  })
  it('descripción fuera del catálogo → ha; máquina y lotes vacíos; día 3 = Mié', () => {
    expect(filasCumplimiento(act({ descripcion: 'Algo libre', haRealizada: 2, maquina: null, lotes: [], dia: 3 }), '', mapa, ctx)).toEqual([
      ['Mié', '', 'Ana', 'Algo libre', '', '', 'Cumplida', 2, 'ha', '', '', ''],
    ])
  })
})

describe('filasCumplimiento — con avances (una fila por avance)', () => {
  it('dos avances del mismo lote en días distintos → dos filas con la cantidad de cada avance', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }],
      avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 2 }, { dia: 2, maquinaId: 'm9', cantidad: 3 }] },
    })
    expect(filasCumplimiento(a, '15 jun', mapa, ctx)).toEqual([
      // máquina null → cae a la máquina de la actividad (6603)
      ['Lun', 'D1', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 2, 'ha', '', '', ''],
      // máquina del avance → MAQ-m9
      ['Mar', 'D2', 'Ana', 'ENCALADORA', 'MAQ-m9', 'L1', 'Cumplida', 3, 'ha', '', '', ''],
    ])
  })
  it('avances en dos lotes → filas en orden lote→día (según a.lotes), no según las claves del JSON', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }, { id: 'l2', nombre: 'L2' }],
      avancePorLote: { l2: [{ dia: 3, maquinaId: null, cantidad: 1 }], l1: [{ dia: 1, maquinaId: null, cantidad: 2 }] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    expect(filas.map((f) => [f[5], f[7]])).toEqual([['L1', 2], ['L2', 1]])
  })
  it('repite los datos de actividad (bultos, centro de costo, potreros) en cada fila de avance', () => {
    const a = act({
      lotes: [{ id: 'l1', nombre: 'L1' }, { id: 'l2', nombre: 'L2' }],
      bultosPorLote: { l1: 3, l2: 2 },
      centroCosto: 'Ceba',
      lotesHechos: ['l1'],
      avancePorLote: { l1: [{ dia: 1, maquinaId: null, cantidad: 2 }, { dia: 2, maquinaId: null, cantidad: 4 }] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    expect(filas.length).toBe(2)
    for (const f of filas) {
      expect(f[9]).toBe('L1: 3, L2: 2') // bultos por lote
      expect(f[10]).toBe('Ceba')         // centro de costo
      expect(f[11]).toBe('L1')           // potreros realizados
    }
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- src/dominio/cumplimiento-export.test.ts`
Expected: FALLA — `filasCumplimiento` no existe, `COLUMNAS_CUMPLIMIENTO` aún tiene 13, `ActividadExport` no tiene `avancePorLote`.

- [ ] **Step 3: Reescribir `cumplimiento-export.ts`**

Reemplazar **todo** el contenido de `src/dominio/cumplimiento-export.ts` por:

```ts
import { normalizarUnidad, unidadAbreviada, type Unidad } from './unidad'
import { textoBultosPorLote, type BultosPorLote } from './bultos'
import { textoLotesHechos } from './lotes-hechos'
import { normalizarAvancePorLote, type AvanceEntrada } from './avance-lote'

export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados',
] as const

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADO_TXT: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CUMPLIDA: 'Cumplida',
  PARCIAL: 'Parcial',
  NO_CUMPLIDA: 'No cumplida',
  REPROGRAMADA: 'Reprogramada',
}

export type ActividadExport = {
  dia: number
  descripcion: string
  estado: string
  haRealizada: number | null
  responsable: { nombre: string }
  maquina: { nombre: string } | null
  lotes: { id: string; nombre: string }[]
  bultosPorLote: BultosPorLote | null
  centroCosto: string | null
  lotesHechos: string[] | null
  avancePorLote: Record<string, AvanceEntrada | AvanceEntrada[]> | null
}

// Filas del Excel para una actividad, en el orden de COLUMNAS_CUMPLIMIENTO.
// Si la actividad tiene avances, devuelve UNA FILA POR AVANCE (recorriendo los
// lotes en orden y dentro de cada lote sus entradas en orden): día/fecha/lote/
// máquina/medida son los del avance, y los datos de actividad se repiten. Si no
// tiene avances, devuelve una sola fila con la medida total (`haRealizada`).
// `fecha` (día de la actividad) y los resolvers de `ctx` los provee el llamador
// para mantener la función pura.
export function filasCumplimiento(
  a: ActividadExport,
  fecha: string,
  unidadPorNombre: Record<string, string>,
  ctx: { fechaDeDia: (dia: number) => string; nombreMaquina: (maquinaId: string | null) => string },
): (string | number)[][] {
  const unidad: Unidad = normalizarUnidad(unidadPorNombre[a.descripcion])
  const unidadAbrev = unidadAbreviada(unidad)
  const estado = ESTADO_TXT[a.estado] ?? a.estado
  const bultos = textoBultosPorLote(a.lotes, a.bultosPorLote)
  const centro = a.centroCosto ?? ''
  const potreros = textoLotesHechos(a.lotes, a.lotesHechos)
  const avances = normalizarAvancePorLote(a.avancePorLote)

  const filas: (string | number)[][] = []
  for (const l of a.lotes) {
    for (const e of avances[l.id] ?? []) {
      filas.push([
        DIAS[e.dia] ?? '',
        ctx.fechaDeDia(e.dia),
        a.responsable.nombre,
        a.descripcion,
        ctx.nombreMaquina(e.maquinaId) || (a.maquina?.nombre ?? ''),
        l.nombre,
        estado,
        e.cantidad,
        unidadAbrev,
        bultos,
        centro,
        potreros,
      ])
    }
  }
  if (filas.length > 0) return filas

  // Sin avances: una sola fila con la medida total (como antes).
  return [[
    DIAS[a.dia] ?? '',
    fecha,
    a.responsable.nombre,
    a.descripcion,
    a.maquina?.nombre ?? '',
    a.lotes.map((l) => l.nombre).join(', '),
    estado,
    a.haRealizada ?? '',
    a.haRealizada == null ? '' : unidadAbrev,
    bultos,
    centro,
    potreros,
  ]]
}
```

- [ ] **Step 4: Correr la suite del archivo**

Run: `npm test -- src/dominio/cumplimiento-export.test.ts`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts
git commit -m "feat(excel): filasCumplimiento (una fila por avance) + quita columna Avance por lote"
```

> Nota: tras este commit, `exportar/route.ts` no compila (aún llama `filaCumplimiento`). Lo arregla la Task 2.

---

### Task 2: Excel — cablear la ruta a `filasCumplimiento`

**Files:**
- Modify: `src/app/cumplimiento/exportar/route.ts`

**Interfaces:**
- Consumes: `filasCumplimiento`, `COLUMNAS_CUMPLIMIENTO` (`@/dominio/cumplimiento-export`); `listarMaquinas` (`@/datos/repositorio`).

- [ ] **Step 1: Ajustar imports**

En `src/app/cumplimiento/exportar/route.ts`:

(a) Cambiar el import de catálogo/repositorio para incluir `listarMaquinas`:

```ts
import { listarAreas, listarActividades, listarActividadesEstipuladas, listarMaquinas } from '@/datos/repositorio'
```

(b) Cambiar el import de export a `filasCumplimiento`:

```ts
import { COLUMNAS_CUMPLIMIENTO, filasCumplimiento } from '@/dominio/cumplimiento-export'
```

(c) Quitar el import de `@/dominio/avance-lote` (queda sin uso):

Borrar la línea `import { textoAvanceConFecha, normalizarAvancePorLote, type AvanceEntrada } from '@/dominio/avance-lote'`.

- [ ] **Step 2: Cargar máquinas y construir el resolver**

En el `Promise.all` (hoy `[actividades, estipuladas]`), agregar `listarMaquinas()`:

```ts
  const [actividades, estipuladas, maquinas] = await Promise.all([
    listarActividades(area.id, anio, semana),
    listarActividadesEstipuladas(),
    listarMaquinas(),
  ])
  const nombrePorMaquina = new Map(maquinas.map((m) => [m.id, m.nombre]))
  const nombreMaquina = (id: string | null) => (id ? nombrePorMaquina.get(id) ?? '' : '')
```

- [ ] **Step 3: Reemplazar el armado de filas**

Reemplazar el bloque que construye `etiquetaDia` + el `for (const a of filas) { … }` (cálculo de `avanceTexto` y `ws.addRow(filaCumplimiento(...))`) por:

```ts
  const fechaDeDia = (dia: number) => (fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : '')

  // Solo actividades cumplidas o parciales.
  const filas = actividades.filter((a) => a.estado === 'CUMPLIDA' || a.estado === 'PARCIAL')
  for (const a of filas) {
    const fecha = fechaDeDia(a.dia)
    for (const fila of filasCumplimiento(
      {
        ...a,
        bultosPorLote: a.bultosPorLote as BultosPorLote | null,
        lotesHechos: a.lotesHechos as string[] | null,
        avancePorLote: a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
      },
      fecha,
      unidadPorNombre,
      { fechaDeDia, nombreMaquina },
    )) {
      ws.addRow(fila)
    }
  }
```

> El tipo `AvanceEntrada` ya no está importado (Step 1c lo quitó). Para el cast de `avancePorLote`, importar el tipo de nuevo SOLO como type:

(d) Agregar el import de tipo:

```ts
import type { AvanceEntrada } from '@/dominio/avance-lote'
```

(`NOMBRES_DIA` y `etiquetaDia` previos quedan sin uso: borrarlos. `unidadAbreviada` y `textoAvanceConFecha` ya no se usan en la ruta — quitar `unidadAbreviada` del import de `@/dominio/unidad` si queda sin uso, dejando `unidadDe`.)

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/" ; echo "errores src: $(npx tsc --noEmit 2>&1 | grep -cE '^src/')" && npm run lint`
Expected: `errores src: 0` y lint sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/exportar/route.ts
git commit -m "feat(excel): ruta exporta una fila por avance (resuelve máquina y fecha por día)"
```

---

### Task 3: Pantalla — listado de avances en CUMPLIDA + medida = suma

**Files:**
- Modify: `src/app/cumplimiento/page.tsx` (import de `avance-lote`; bloque no-pendiente ~253-313)

**Interfaces:**
- Consumes: `normalizarAvancePorLote`, `textoAvanceConFecha`, `lotesPendientes`, `totalAvance`, `type AvanceEntrada` (`@/dominio/avance-lote`).

- [ ] **Step 1: Importar `totalAvance`**

En `src/app/cumplimiento/page.tsx`, cambiar el import de `@/dominio/avance-lote` (hoy `import { lotesPendientes, textoAvanceConFecha, normalizarAvancePorLote, type AvanceEntrada } from '@/dominio/avance-lote'`) por:

```ts
import { lotesPendientes, textoAvanceConFecha, normalizarAvancePorLote, totalAvance, type AvanceEntrada } from '@/dominio/avance-lote'
```

- [ ] **Step 2: Reemplazar el branch no-pendiente**

Reemplazar todo el bloque `) : (` … `)}` del ternario de estado (desde la línea `) : (` que abre el `<>` en ~253 hasta el `)}` que cierra antes de `</li>` en ~313) por:

```tsx
                            ) : (() => {
                              const avances = normalizarAvancePorLote(
                                a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
                              )
                              const tieneAvances = Object.values(avances).some((es) => es.length > 0)
                              const etiquetaDia = (dia: number) =>
                                `${DIAS[dia] ?? ''} ${fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}`.trim()
                              const resumenAvances = textoAvanceConFecha(a.lotes, avances, unidadAbreviada(unidad), etiquetaDia)
                              return (
                              <>
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-semibold">{ESTADOS.find((e) => e.valor === a.estado)?.etiqueta ?? a.estado}</span>
                                {(tieneAvances || a.haRealizada != null) && (
                                  <span className="text-gray-500">· {tieneAvances ? totalAvance(avances) : a.haRealizada} {unidadAbreviada(unidad)}</span>
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
                              {/* Resumen de avances (solo lectura): visible en cualquier estado no-pendiente con avances. */}
                              {resumenAvances && (
                                <span className="mt-1 text-sm text-gray-600">Avances: {resumenAvances}</span>
                              )}
                              {a.estado === 'PARCIAL' && (
                                <div className="mt-1 flex w-full flex-col gap-1 text-sm">
                                  {a.lotes.length > 0 && (
                                    <span className="text-gray-600">
                                      Progreso: {a.lotes.length - lotesPendientes(a.lotes, avances).length} de {a.lotes.length} lotes
                                    </span>
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
                              )}
                              </>
                              )
                            })()}
```

(Cambios respecto al original: el cálculo de `avances`/`resumenAvances` sube al inicio del branch; la medida usa `totalAvance(avances)` cuando hay avances; el `Avances: …` se muestra para cualquier estado no-pendiente con avances; el `Progreso` y los controles quedan solo en PARCIAL.)

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/" ; echo "errores src: $(npx tsc --noEmit 2>&1 | grep -cE '^src/')" && npm run lint`
Expected: `errores src: 0` y lint sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): avances visibles en cumplida + medida = suma de avances"
```

---

### Task 4: Suite completa + verificación

**Files:** (ninguno — verificación)

- [ ] **Step 1: Suite + tipos + lint**

Run: `npm test && npx tsc --noEmit 2>&1 | grep -cE '^src/' && npm run lint`
Expected: pruebas PASAN; `0` errores en `src/`; lint limpio.

- [ ] **Step 2: Desplegar a producción**

Run: `timeout 540 npx vercel@latest --prod --yes --scope ayura-llanos`
Expected: `readyState: READY`, aliased a https://cronograma-ayura.vercel.app

- [ ] **Step 3: Verificación manual (producción)**

En `/cumplimiento`, sobre una actividad con avances (tomar snapshot por id y restaurar al final, es data real):
(a) Estando PARCIAL: la medida mostrada es la **suma** de los avances; el listado "Avances: …", el "Progreso", el formulario y los botones siguen como hoy.
(b) Marcar cumplida → la tarjeta **sigue mostrando** "Avances: …" (solo lectura, sin formulario ni botones) y la medida = suma.
(c) Descargar Excel → cada avance es **una fila** (Día/Fecha/Lote/Máquina del avance, Medida = cantidad de ese avance); una actividad sin avances queda en una sola fila; no existe la columna "Avance por lote".

---

## Self-Review

**Cobertura del spec:**
- Listado de avances en CUMPLIDA (solo lectura) → Task 3 (`resumenAvances` fuera del branch PARCIAL). ✅
- Medida = suma de avances → Task 3 (`totalAvance(avances)` cuando `tieneAvances`). ✅
- Excel una fila por avance, sin columna "Avance por lote" → Task 1 (`filasCumplimiento` + columnas) + Task 2 (ruta). ✅
- Datos de actividad repetidos en cada fila; máquina/fecha del avance → Task 1 (test que lo cubre). ✅
- Actividad sin avances = una sola fila como hoy → Task 1 (test). ✅

**Placeholder scan:** sin TBD/TODO; código completo en cada paso.

**Type consistency:** `filasCumplimiento(a, fecha, unidadPorNombre, ctx)` con `ctx={fechaDeDia, nombreMaquina}` y retorno `(string|number)[][]` — idéntico en Task 1 (definición), Task 2 (uso). `ActividadExport.avancePorLote: Record<string, AvanceEntrada | AvanceEntrada[]> | null` — mismo cast en ruta (Task 2). `totalAvance`/`textoAvanceConFecha`/`lotesPendientes`/`normalizarAvancePorLote` consumidos en Task 3 con las firmas existentes en `@/dominio/avance-lote`. `COLUMNAS_CUMPLIMIENTO` = 12 columnas en Task 1, usado por la ruta (header) en Task 2.

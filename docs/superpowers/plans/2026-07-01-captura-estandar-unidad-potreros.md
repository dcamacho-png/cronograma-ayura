# Captura estándar (unidad + potreros por finca + cantidad) Implementation Plan

> ✅ **COMPLETADO** — 4 tareas implementadas y desplegadas a producción (commits 61b30cd..2bf29da, deploy cronograma-ayura-2hh8bo0l8, build Vercel aplicó la migración); verificado por la usuaria. Revisión por subagente omitida en tasks 3-4 a pedido de la usuaria; cubierto por typecheck + 171 tests + build real.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Rediseñar la captura de cumplimiento estándar: unidad elegible al registrar (Cantidad/Ha/Jornales/Otro), potreros por Finca→Lote con cantidad por lote (anexa lotes nuevos), y general = unidad+cantidad+observación. Maquinaria no cambia.

**Architecture:** Nueva columna `Actividad.unidadRealizada` (texto, migración aditiva). Funciones de grupo en el repositorio + acciones que las exponen (respetando el plazo). El control `ActividadEstandar` se reescribe para el nuevo flujo; la página pasa las acciones y muestra la medida estándar con `unidadRealizada` verbatim.

**Tech Stack:** Next.js 16 (App Router, RSC, Server Actions), Prisma, TypeScript.

## Global Constraints

- Repositorio/acciones/RSC/Client: se verifican con **typecheck fiable** + ejecución; sin tests unitarios (no hay dominio puro nuevo).
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- Migración aditiva a la base Neon compartida (formato del repo: carpeta `prisma/migrations/<timestamp>_<nombre>/migration.sql` con `ALTER TABLE ... ADD COLUMN`). El build de Vercel corre `prisma migrate deploy`.
- Para estándar la etiqueta de medida es `unidadRealizada` **verbatim** (string libre); maquinaria sigue con `Unidad`/catálogo intacto.
- Todo aplica al **grupo** (filas-hermanas por `tareaId`), respeta el guard `bloqueadoPorPlazoActividad`, y `revalidatePath('/cumplimiento')`.

---

### Task 1: Migración + campo `unidadRealizada`

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Actividad`)
- Create: `prisma/migrations/20260701120000_actividad_unidad_realizada/migration.sql`

**Interfaces:**
- Produces: columna/campo `Actividad.unidadRealizada String?`.

- [x] **Step 1: Añadir el campo al esquema**

En `prisma/schema.prisma`, en el modelo `Actividad`, junto a `haRealizada  Float?`, añadir:
```prisma
  unidadRealizada String?
```

- [x] **Step 2: Crear la migración**

Crear `prisma/migrations/20260701120000_actividad_unidad_realizada/migration.sql` con:
```sql
ALTER TABLE "Actividad" ADD COLUMN "unidadRealizada" TEXT;
```

- [x] **Step 3: Regenerar el cliente Prisma y typecheck**

Run:
```bash
npx prisma generate
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: `prisma generate` OK; typecheck sin salida (el nuevo campo existe en el cliente, aún sin uso).

- [x] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260701120000_actividad_unidad_realizada/migration.sql
git commit -m "feat(cumplimiento): columna Actividad.unidadRealizada (migracion aditiva)"
```

---

### Task 2: Funciones de repositorio

**Files:**
- Modify: `src/datos/repositorio.ts` (junto a las funciones de grupo, tras `setLotesGrupo`)

**Interfaces:**
- Consumes: `filasHermanas` (privada), `prisma`.
- Produces:
  - `setUnidadRealizadaGrupo(id: string, unidad: string): Promise<true | null>`
  - `anexarLotesGrupo(id: string, loteIds: string[]): Promise<true | null>`
  - `registrarMedidaGeneralGrupo(id: string, unidad: string, cantidad: number, nota: string | null): Promise<true | null>`

- [x] **Step 1: Añadir las tres funciones**

En `src/datos/repositorio.ts`, tras `setLotesGrupo`, añadir:

```ts
// Fija la unidad de medida (texto libre) en todas las filas del grupo.
export async function setUnidadRealizadaGrupo(id: string, unidad: string) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas.map((f) =>
      prisma.actividad.update({ where: { id: f.id }, data: { unidadRealizada: unidad } }),
    ),
  )
  return true
}

// Conecta (sin quitar) esos lotes a todas las filas del grupo. Para "anexar" al registrar
// un avance de un potrero que aún no estaba asignado.
export async function anexarLotesGrupo(id: string, loteIds: string[]) {
  const g = await filasHermanas(id)
  if (!g || loteIds.length === 0) return null
  await prisma.$transaction(
    g.filas.map((f) =>
      prisma.actividad.update({
        where: { id: f.id },
        data: { lotes: { connect: loteIds.map((lid) => ({ id: lid })) } },
      }),
    ),
  )
  return true
}

// Actividad general (sin lotes): fija unidad + medida (haRealizada) + nota, y deja las
// filas abiertas en PARCIAL (igual que la observación actual).
export async function registrarMedidaGeneralGrupo(id: string, unidad: string, cantidad: number, nota: string | null) {
  const g = await filasHermanas(id)
  if (!g) return null
  await prisma.$transaction(
    g.filas
      .filter((f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL')
      .map((f) =>
        prisma.actividad.update({
          where: { id: f.id },
          data: { unidadRealizada: unidad, haRealizada: cantidad, nota, estado: 'PARCIAL' },
        }),
      ),
  )
  return true
}
```

- [x] **Step 2: Typecheck fiable**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida.

- [x] **Step 3: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(cumplimiento): repo setUnidadRealizadaGrupo/anexarLotesGrupo/registrarMedidaGeneralGrupo"
```

---

### Task 3: Acciones

**Files:**
- Modify: `src/app/cumplimiento/acciones.ts` (imports + dos acciones)

**Interfaces:**
- Consumes: `setUnidadRealizadaGrupo`, `anexarLotesGrupo`, `registrarMedidaGeneralGrupo`, `registrarAvanceLoteGrupo` (repo); `bloqueadoPorPlazoActividad`, `texto`, `textoOpcional`, `numeroOpcional`, `revalidatePath` (ya en el archivo).
- Produces:
  - `registrarAvanceEstandarAccion(form: FormData): Promise<void>`
  - `registrarMedidaGeneralAccion(form: FormData): Promise<void>`

- [x] **Step 1: Ampliar imports**

En `src/app/cumplimiento/acciones.ts`, añadir al import desde `@/datos/repositorio` (donde ya se importan `registrarAvanceLoteGrupo, …, setLotesGrupo`): `setUnidadRealizadaGrupo, anexarLotesGrupo, registrarMedidaGeneralGrupo`.

- [x] **Step 2: Añadir las dos acciones**

En `src/app/cumplimiento/acciones.ts`, tras `setLotesActividadAccion`, añadir:

```ts
// Resuelve la unidad elegida: si es "otro", usa el texto libre; si no, el valor del select.
function unidadElegida(form: FormData): string {
  const u = texto(form, 'unidad')
  if (u === 'otro') return texto(form, 'unidadOtra') || 'otro'
  return u || 'cantidad'
}

export async function registrarAvanceEstandarAccion(form: FormData) {
  const id = texto(form, 'id')
  const dia = Number(texto(form, 'dia'))
  const loteId = texto(form, 'loteId')
  const cantidad = numeroOpcional(form, 'cantidad') ?? 0
  if (!id || !loteId || !(dia >= 1 && dia <= 7) || cantidad <= 0) return
  if (await bloqueadoPorPlazoActividad(id)) return
  await anexarLotesGrupo(id, [loteId])
  await setUnidadRealizadaGrupo(id, unidadElegida(form))
  await registrarAvanceLoteGrupo(id, dia, null, [{ loteId, cantidad }])
  revalidatePath('/cumplimiento')
}

export async function registrarMedidaGeneralAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const cantidad = numeroOpcional(form, 'cantidad') ?? 0
  const nota = textoOpcional(form, 'nota')
  await registrarMedidaGeneralGrupo(id, unidadElegida(form), cantidad, nota)
  revalidatePath('/cumplimiento')
}
```

> Si `numeroOpcional`/`textoOpcional` no estuvieran ya definidos en el archivo, usar los helpers equivalentes que ya usa (p. ej. `registrarAvanceLoteActividadAccion` usa `numeroOpcional`; `marcarEstadoAccion` usa `textoOpcional`). Ambos ya existen en `acciones.ts`.

- [x] **Step 3: Typecheck fiable**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida.

- [x] **Step 4: Commit**

```bash
git add src/app/cumplimiento/acciones.ts
git commit -m "feat(cumplimiento): acciones registrarAvanceEstandar y registrarMedidaGeneral"
```

---

### Task 4: UI (`ActividadEstandar`) + página

**Files:**
- Rewrite: `src/app/cumplimiento/actividad-estandar.tsx`
- Modify: `src/app/cumplimiento/page.tsx` (props nuevas + unidad de display estándar)

**Interfaces:**
- Consumes: `registrarAvanceEstandarAccion`, `registrarMedidaGeneralAccion`, `setLotesActividadAccion`, `marcarCumplidaActividadAccion`, `registrarNovedadActividadAccion`, `devolverAlBancoAccion` (page); `cab.unidadRealizada` (nuevo campo).
- Produces: `ActividadEstandar` con nuevas props (`registrarAvanceEstandar`, `registrarMedidaGeneral`, `unidadRealizada`).

- [x] **Step 1: Reescribir `actividad-estandar.tsx`**

Reemplazar TODO el contenido de `src/app/cumplimiento/actividad-estandar.tsx` por:

```tsx
'use client'

import { useState } from 'react'
import type { Estado } from '@/dominio/tipos'
import { FormRegistrar } from './form-registrar'

type Motivo = { id: string; nombre: string }
type Lote = { id: string; nombre: string; finca: { nombre: string } }
type Estipulada = { id: string; nombre: string; unidad: string }

const UNIDADES = ['Cantidad', 'Ha', 'Jornales'] // + "Otro" (texto libre)

// Control de cumplimiento de UNA actividad estándar (no maquinaria), PENDIENTE o PARCIAL.
// Unidad elegible (una por actividad); con potreros: Finca→Lote→cantidad (anexa lote nuevo);
// sin potreros: unidad + cantidad + observación. Cierre manual (Cumplida); novedad aparte.
export function ActividadEstandar({
  actividadId,
  estado,
  dia,
  tieneLotes,
  lotesActividad,
  lotesCatalogo,
  unidadRealizada,
  estipuladas,
  motivos,
  motivoCambioId,
  nota,
  registrarAvanceEstandar,
  registrarMedidaGeneral,
  marcarCumplida,
  registrarNovedad,
  devolverAlBanco,
  editarPotreros,
}: {
  actividadId: string
  estado: Estado
  dia: number
  tieneLotes: boolean
  lotesActividad: { id: string; nombre: string }[]
  lotesCatalogo: Lote[]
  unidadRealizada: string | null
  estipuladas: Estipulada[]
  motivos: Motivo[]
  motivoCambioId: string | null
  nota: string | null
  registrarAvanceEstandar: (f: FormData) => void | Promise<void>
  registrarMedidaGeneral: (f: FormData) => void | Promise<void>
  marcarCumplida: (f: FormData) => void | Promise<void>
  registrarNovedad: (f: FormData) => void | Promise<void>
  devolverAlBanco: (f: FormData) => void | Promise<void>
  editarPotreros: (f: FormData) => void | Promise<void>
}) {
  const esParcial = estado === 'PARCIAL'
  const conocida = UNIDADES.find((u) => u.toLowerCase() === (unidadRealizada ?? '').toLowerCase())
  const [novedad, setNovedad] = useState(false)
  const [unidadSel, setUnidadSel] = useState(conocida ?? (unidadRealizada ? 'Otro' : 'Cantidad'))
  const fincas = [...new Set(lotesCatalogo.map((l) => l.finca.nombre))].sort()
  const [finca, setFinca] = useState('')

  if (novedad) {
    return (
      <div>
        <FormRegistrar
          actividadId={actividadId}
          esMaquinaria={false}
          unidad="ha"
          motivos={motivos}
          motivoCambioId={motivoCambioId}
          lotes={lotesCatalogo}
          maquinas={[]}
          estipuladas={estipuladas}
          haProgramada={0}
          lotesActividad={lotesActividad}
          accion={registrarNovedad}
        />
        <button type="button" onClick={() => setNovedad(false)} className="mt-1 text-xs text-tierra underline">
          cancelar novedad
        </button>
      </div>
    )
  }

  // Selector de unidad reutilizable (se envía con cada registro).
  const selectorUnidad = (
    <label className="flex flex-col text-xs">
      Unidad
      <select
        name="unidad"
        value={unidadSel === 'Otro' ? 'otro' : unidadSel.toLowerCase()}
        onChange={(e) => setUnidadSel(e.target.value === 'otro' ? 'Otro' : e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
        className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
      >
        {UNIDADES.map((u) => (
          <option key={u} value={u.toLowerCase()}>{u}</option>
        ))}
        <option value="otro">Otro…</option>
      </select>
    </label>
  )
  const inputUnidadOtra = unidadSel === 'Otro' && (
    <label className="flex flex-col text-xs">
      Unidad (texto)
      <input name="unidadOtra" defaultValue={conocida ? '' : unidadRealizada ?? ''} placeholder="ej. bultos" className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
    </label>
  )

  return (
    <div className="flex w-full flex-col gap-3 text-sm">
      {tieneLotes ? (
        <>
          {lotesActividad.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {lotesActividad.map((l) => (
                <span key={l.id} className="flex items-center gap-1 rounded-lg border border-borde bg-arena px-2 py-0.5">
                  {l.nombre}
                  <form action={editarPotreros} className="inline">
                    <input type="hidden" name="id" value={actividadId} />
                    {lotesActividad.filter((x) => x.id !== l.id).map((x) => (
                      <input key={x.id} type="hidden" name="loteId" value={x.id} />
                    ))}
                    <button className="text-tierra hover:text-rose-700" title="quitar potrero">×</button>
                  </form>
                </span>
              ))}
            </div>
          )}
          <form action={registrarAvanceEstandar} className="flex flex-wrap items-end gap-2 rounded-lg border border-borde bg-arena/40 p-2">
            <input type="hidden" name="id" value={actividadId} />
            {selectorUnidad}
            {inputUnidadOtra}
            <label className="flex flex-col text-xs">
              Finca
              <select value={finca} onChange={(e) => setFinca(e.target.value)} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                <option value="">— finca —</option>
                {fincas.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs">
              Lote
              <select name="loteId" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                <option value="">— lote —</option>
                {lotesCatalogo.filter((l) => l.finca.nombre === finca).map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs">
              Cantidad
              <input name="cantidad" type="number" step="any" min="0" className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
            <label className="flex flex-col text-xs">
              Día
              <select name="dia" defaultValue={dia} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
            <button className="rounded-lg border border-bosque px-3 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">Guardar avance</button>
          </form>
        </>
      ) : (
        <form action={registrarMedidaGeneral} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={actividadId} />
          {selectorUnidad}
          {inputUnidadOtra}
          <label className="flex flex-col text-xs">
            Cantidad
            <input name="cantidad" type="number" step="any" min="0" className="w-24 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
          <label className="flex flex-1 flex-col text-xs">
            Observación
            <input name="nota" defaultValue={nota ?? ''} placeholder="¿qué se avanzó?" className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
          </label>
          <button className="rounded-lg border border-bosque px-3 py-1 text-xs font-semibold text-bosque hover:bg-arena/40">Guardar</button>
        </form>
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

- [x] **Step 2: Página — pasar props nuevas y unidad de display**

En `src/app/cumplimiento/page.tsx`:

(a) Añadir al import desde `./acciones`: `registrarAvanceEstandarAccion, registrarMedidaGeneralAccion`.

(b) En el `<ActividadEstandar … />` (rama estándar), reemplazar las props `registrarAvanceLote`/`registrarObservacion` (ya no existen en el componente) y añadir `unidadRealizada` y las nuevas acciones. El bloque de props debe quedar:
```tsx
                          <ActividadEstandar
                            actividadId={cab.id}
                            estado={estadoGrupo}
                            dia={cab.dia}
                            tieneLotes={tieneLotes}
                            lotesActividad={cab.lotes}
                            lotesCatalogo={lotes}
                            unidadRealizada={cab.unidadRealizada}
                            estipuladas={estipuladas}
                            motivos={motivos}
                            motivoCambioId={motivoCambioId}
                            nota={cab.nota}
                            registrarAvanceEstandar={registrarAvanceEstandarAccion}
                            registrarMedidaGeneral={registrarMedidaGeneralAccion}
                            marcarCumplida={marcarCumplidaActividadAccion}
                            registrarNovedad={registrarNovedadActividadAccion}
                            devolverAlBanco={devolverAlBancoAccion}
                            editarPotreros={setLotesActividadAccion}
                          />
```

(c) Para el **display** de la medida en la rama estándar, usar la unidad guardada. Donde la página calcula la unidad para mostrar en la rama estándar (la variable `unidad` usada en `resumenAvances` y en la línea de estado de ESA rama), definir una unidad de display estándar:
```tsx
                      const unidadStd = cab.unidadRealizada ?? unidadAbreviada(unidad)
```
y usar `unidadStd` en lugar de `unidadAbreviada(unidad)` en el `textoAvanceConFecha(...)` y en la línea `· {…} {unidadAbreviada(unidad)}` **de la rama estándar** (no tocar la rama de maquinaria).

> Nota: `cab.unidadRealizada` viene de `listarActividades` (Prisma devuelve todos los escalares); si el tipo local de `cab` lo exige, añadir `unidadRealizada: string | null` a ese tipo.

- [x] **Step 3: Typecheck fiable**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida. Si `registrarAvanceLoteActividadAccion` o `registrarAvanceObservacionAccion` quedan **sin uso** en `page.tsx` tras quitar esas props del `<ActividadEstandar>`, eliminarlas del import de `./acciones` (esas acciones ya no se usan en la rama estándar; verificar antes que no las use otra rama).

- [x] **Step 4: Suite de tests sigue verde**

Run: `npm test`
Expected: PASS (no se añadieron tests).

- [x] **Step 5: Verificación manual**

Run: `npm run dev` y abrir `/cumplimiento` en un área **estándar**.
Verificar:
- Actividad **con potreros**: elegir Unidad (probar "Otro"→texto), Finca→Lote→Cantidad→Día→"Guardar avance"; si el lote no estaba asignado, se **anexa** (aparece en la lista de potreros); la etiqueta de la medida usa la unidad elegida; "×" quita un potrero (queda ≥1); "Marcar cumplida" cierra.
- Actividad **sin potreros**: Unidad + Cantidad + Observación → "Guardar"; queda con esa medida; "Cumplida" cierra.
- Respeta el **plazo vencido**; **maquinaria** (DiaMaquinaria) no cambió.
Si no hay datos a mano, dejar constancia y validar en el deploy.

- [x] **Step 6: Commit**

```bash
git add src/app/cumplimiento/actividad-estandar.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): captura estandar con unidad elegible y potreros por finca"
```

---

## Notas de cierre

- El "Realizado" del resumen sigue solo-maquinaria; Excel/PDF de cumplimiento sin cambios (posibles follow-ups).
- Despliegue: tras revisar, seguir el flujo habitual de Vercel; el build corre `prisma migrate deploy` (aplica la nueva columna) + typecheck real.

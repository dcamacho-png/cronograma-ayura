# Cronograma — Plan 3: Registrar Cumplimiento + Reprogramación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el coordinador marque el cumplimiento de cada actividad de la semana (Pendiente / Cumplida / Parcial / No cumplida / Reprogramada) con motivo y nota, y que pueda **arrastrar** una actividad a la semana siguiente como Reprogramada (sumando el contador de "veces reprogramada"). Se agrega una barra de navegación entre pantallas.

**Architecture:** Igual que el Plan 2: Server Components (lectura) + Server Actions (escritura) sobre el repositorio Prisma. La lógica de reprogramación (qué datos lleva la copia) es una función pura testeada. Las métricas del Plan 1 (`porcentajeCumplimiento`, `porcentajeReprogramadas`, `colorSemaforo`) se reutilizan para mostrar indicadores en vivo.

**Tech Stack:** Next.js 16 · TypeScript · Tailwind v4 · Prisma 6 · Vitest.

**Estrategia de pruebas:** Vitest cubre la función pura `datosReprogramacion`. El repositorio y la pantalla se verifican con build + corriendo la app (igual que el Plan 2).

**Nota de diseño (flujo de reprogramación):** El spec describe que al marcar "No cumplida" la app *pregunta* si reprogramar. En esta primera versión, sin JavaScript de cliente, eso se realiza como un **botón explícito** "🔄 Reprogramar a la semana siguiente" en cada actividad: el coordinador marca el estado + motivo (Guardar) y luego, si quiere, pulsa el botón para crear la copia en la semana siguiente. Mismo resultado, sin modal.

---

## Estructura de archivos (Plan 3)

- Modify: `src/dominio/programacion.ts` — agregar `DatosReprogramacion` + `datosReprogramacion`.
- Modify: `src/dominio/programacion.test.ts` — tests de `datosReprogramacion`.
- Modify: `src/datos/repositorio.ts` — agregar `marcarEstado` y `reprogramarActividad`.
- Create: `src/app/_componentes/nav-principal.tsx` — barra de navegación superior.
- Modify: `src/app/layout.tsx` — renderizar la barra.
- Create: `src/app/cumplimiento/acciones.ts` — Server Actions (marcar estado, reprogramar).
- Create: `src/app/cumplimiento/page.tsx` — pantalla "Registrar cumplimiento".

---

## Task 1: `datosReprogramacion` (puro, TDD)

**Files:**
- Modify: `src/dominio/programacion.ts`
- Modify: `src/dominio/programacion.test.ts`

Regla: una reprogramación conserva la planeación (día, turno, descripción, área, finca, responsable, campos de maquinaria), apunta a la semana destino, queda en estado `REPROGRAMADA`, **incrementa** `vecesReprogramada` en 1, y guarda `origenId` = id de la actividad origen. No arrastra motivo ni nota.

- [ ] **Step 1: Agregar los tests que fallan**

Agregar al final de `src/dominio/programacion.test.ts`:
```typescript
import { datosReprogramacion } from './programacion'

describe('datosReprogramacion', () => {
  it('crea la copia para la semana destino, en estado REPROGRAMADA y subiendo el contador', () => {
    const origen = act({ id: 'a1', vecesReprogramada: 0, dia: 3, descripcion: 'Fumigación' })
    const d = datosReprogramacion(origen, 2026, 26)
    expect(d.anio).toBe(2026)
    expect(d.semana).toBe(26)
    expect(d.dia).toBe(3)
    expect(d.descripcion).toBe('Fumigación')
    expect(d.estado).toBe('REPROGRAMADA')
    expect(d.vecesReprogramada).toBe(1)
    expect(d.origenId).toBe('a1')
  })

  it('si ya venía reprogramada, sigue subiendo el contador', () => {
    const origen = act({ id: 'a2', vecesReprogramada: 2 })
    const d = datosReprogramacion(origen, 2026, 27)
    expect(d.vecesReprogramada).toBe(3)
    expect(d.origenId).toBe('a2')
  })

  it('conserva los campos de maquinaria y no arrastra motivo/nota', () => {
    const origen = act({
      id: 'a3', maquinaId: 'm1', areaTareaId: 'maiz', horas: 5, hectareas: 7, planB: 'Rastra',
      motivoId: 'clima', nota: 'llovió',
    })
    const d = datosReprogramacion(origen, 2027, 1)
    expect(d.maquinaId).toBe('m1')
    expect(d.areaTareaId).toBe('maiz')
    expect(d.horas).toBe(5)
    expect(d.hectareas).toBe(7)
    expect(d.planB).toBe('Rastra')
    // motivo/nota no forman parte de la copia (se reinician al crear)
    expect('motivoId' in d).toBe(false)
    expect('nota' in d).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL (no se exporta `datosReprogramacion`).

- [ ] **Step 3: Implementar**

Agregar al final de `src/dominio/programacion.ts`:
```typescript
// Datos para crear la copia reprogramada de una actividad en otra semana.
export interface DatosReprogramacion {
  anio: number
  semana: number
  dia: number
  areaId: string
  fincaId: string
  responsableId: string
  descripcion: string
  turno: string
  maquinaId: string | null
  areaTareaId: string | null
  horas: number | null
  hectareas: number | null
  planB: string | null
  estado: 'REPROGRAMADA'
  vecesReprogramada: number
  origenId: string
}

// Copia una actividad hacia la semana destino como REPROGRAMADA, subiendo el
// contador de veces reprogramada y guardando de qué actividad proviene.
export function datosReprogramacion(
  actividad: Actividad,
  anioDestino: number,
  semanaDestino: number,
): DatosReprogramacion {
  return {
    anio: anioDestino,
    semana: semanaDestino,
    dia: actividad.dia,
    areaId: actividad.areaId,
    fincaId: actividad.fincaId,
    responsableId: actividad.responsableId,
    descripcion: actividad.descripcion,
    turno: actividad.turno,
    maquinaId: actividad.maquinaId ?? null,
    areaTareaId: actividad.areaTareaId ?? null,
    horas: actividad.horas ?? null,
    hectareas: actividad.hectareas ?? null,
    planB: actividad.planB ?? null,
    estado: 'REPROGRAMADA',
    vecesReprogramada: actividad.vecesReprogramada + 1,
    origenId: actividad.id,
  }
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `npm test`
Expected: PASS (todos: métricas + semana + programacion, incluidos los 3 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/programacion.ts src/dominio/programacion.test.ts
git commit -m "feat: datosReprogramacion (TDD)"
```

---

## Task 2: Repositorio — marcar estado y reprogramar

**Files:**
- Modify: `src/datos/repositorio.ts`

- [ ] **Step 1: Agregar las funciones**

Agregar al final de `src/datos/repositorio.ts` (y asegurar el import de `datosReprogramacion`):

Primero, en la línea de import del dominio de programación, incluir `datosReprogramacion`. El archivo ya tiene:
```typescript
import { duplicarActividades } from '@/dominio/programacion'
```
Cámbiala por:
```typescript
import { duplicarActividades, datosReprogramacion } from '@/dominio/programacion'
```

Luego agregar al final del archivo:
```typescript
// Marca el estado de una actividad (y su motivo/nota).
export function marcarEstado(
  id: string,
  estado: string,
  motivoId: string | null,
  nota: string | null,
) {
  return prisma.actividad.update({
    where: { id },
    data: { estado, motivoId, nota },
  })
}

// Crea la copia reprogramada de una actividad en la semana destino.
export async function reprogramarActividad(
  id: string,
  anioDestino: number,
  semanaDestino: number,
) {
  const origen = await prisma.actividad.findUnique({ where: { id } })
  if (!origen) return null
  const datos = datosReprogramacion(origen as unknown as ActividadDominio, anioDestino, semanaDestino)
  return prisma.actividad.create({ data: datos })
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores. Si `data: datos` no encaja con el tipo de Prisma, ajusta MÍNIMAMENTE manteniendo nombres y comportamiento, y reporta el cambio.

- [ ] **Step 3: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat: repositorio marcarEstado y reprogramarActividad"
```

---

## Task 3: Barra de navegación superior

**Files:**
- Create: `src/app/_componentes/nav-principal.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Crear el componente**

Create `src/app/_componentes/nav-principal.tsx`:
```tsx
import Link from 'next/link'

export function NavPrincipal() {
  return (
    <header className="bg-[#11603a] text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <span className="font-bold">🌱 Cronograma Ayurá</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/programar" className="hover:underline">Programar</Link>
          <Link href="/cumplimiento" className="hover:underline">Cumplimiento</Link>
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Renderizar la barra en el layout**

Read `src/app/layout.tsx`. Add an import at the top:
```tsx
import { NavPrincipal } from './_componentes/nav-principal'
```
Then render `<NavPrincipal />` as the FIRST element inside `<body ...>`, immediately before `{children}`. Keep everything else (html, body, fonts, metadata) exactly as it is. For example, if the body looks like `<body className={...}>{children}</body>`, change it to `<body className={...}><NavPrincipal />{children}</body>`.

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
git add src/app/_componentes/nav-principal.tsx src/app/layout.tsx
git commit -m "feat: barra de navegación superior (Programar / Cumplimiento)"
```

---

## Task 4: Pantalla "Registrar cumplimiento"

**Files:**
- Create: `src/app/cumplimiento/acciones.ts`
- Create: `src/app/cumplimiento/page.tsx`

- [ ] **Step 1: Crear las Server Actions**

Create `src/app/cumplimiento/acciones.ts`:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { marcarEstado, reprogramarActividad } from '@/datos/repositorio'
import { siguienteSemana } from '@/dominio/semana'

const ESTADOS_VALIDOS = ['PENDIENTE', 'CUMPLIDA', 'PARCIAL', 'NO_CUMPLIDA', 'REPROGRAMADA']

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}
function textoOpcional(form: FormData, clave: string): string | null {
  const v = texto(form, clave)
  return v === '' ? null : v
}

export async function marcarEstadoAccion(form: FormData) {
  const id = texto(form, 'id')
  const estado = texto(form, 'estado')
  if (!id || !ESTADOS_VALIDOS.includes(estado)) return
  await marcarEstado(id, estado, textoOpcional(form, 'motivoId'), textoOpcional(form, 'nota'))
  revalidatePath('/cumplimiento')
}

export async function reprogramarAccion(form: FormData) {
  const id = texto(form, 'id')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (!id || !Number.isInteger(anio) || !Number.isInteger(semana)) return
  const prox = siguienteSemana(anio, semana)
  await reprogramarActividad(id, prox.anio, prox.semana)
  revalidatePath('/cumplimiento')
}
```

- [ ] **Step 2: Crear la página**

Create `src/app/cumplimiento/page.tsx`:
```tsx
import Link from 'next/link'
import { listarAreas, listarMotivos, listarActividades } from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual } from '@/dominio/semana'
import { porcentajeCumplimiento, porcentajeReprogramadas, colorSemaforo } from '@/dominio/metricas'
import type { Actividad as ActividadDominio } from '@/dominio/tipos'
import { marcarEstadoAccion, reprogramarAccion } from './acciones'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADOS = [
  { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
  { valor: 'CUMPLIDA', etiqueta: '✅ Cumplida' },
  { valor: 'PARCIAL', etiqueta: '🟡 Parcial' },
  { valor: 'NO_CUMPLIDA', etiqueta: '🔴 No cumplida' },
  { valor: 'REPROGRAMADA', etiqueta: '🔄 Reprogramada' },
]

const COLOR_HEX: Record<string, string> = {
  ninguno: 'transparent',
  verde: '#2e9e5b',
  amarillo: '#e8b400',
  naranja: '#e8771a',
  rojo: '#d63b3b',
}

export default async function CumplimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; anio?: string; semana?: string }>
}) {
  const sp = await searchParams
  const areas = await listarAreas()
  if (areas.length === 0) {
    return (
      <main className="p-8">
        <p className="text-gray-600">No hay áreas. Corre <code>npm run db:seed</code>.</p>
      </main>
    )
  }

  const areaId = sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id
  const hoy = semanaActual()
  const anioRaw = Number(sp.anio)
  const semanaRaw = Number(sp.semana)
  const anio = sp.anio && Number.isInteger(anioRaw) ? anioRaw : hoy.anio
  const semana = sp.semana && Number.isInteger(semanaRaw) ? semanaRaw : hoy.semana

  const [motivos, actividades] = await Promise.all([
    listarMotivos(),
    listarActividades(areaId, anio, semana),
  ])

  const dominio = actividades as unknown as ActividadDominio[]
  const pct = porcentajeCumplimiento(dominio)
  const pctRep = porcentajeReprogramadas(dominio)

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/cumplimiento?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">Registrar cumplimiento</h1>

      <div className="mb-3 flex flex-wrap gap-2">
        {areas.map((a) => (
          <Link
            key={a.id}
            href={url(a.id, anio, semana)}
            className={`rounded-full px-3 py-1 text-sm ${
              a.id === areaId ? 'bg-[#11603a] text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {a.nombre}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1 text-sm">
          ← Semana {previa.semana}
        </Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1 text-sm">
          Semana {proxima.semana} →
        </Link>
        <span className="ml-auto rounded bg-gray-100 px-3 py-1 text-sm">
          Cumplido: <b>{pct === null ? '—' : `${pct}%`}</b>
        </span>
        <span className="rounded bg-gray-100 px-3 py-1 text-sm">
          Reprogramadas: <b>{pctRep}%</b>
        </span>
      </div>

      {actividades.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay actividades en esta semana. Prográmalas en la pestaña <b>Programar</b>.
        </p>
      ) : (
        <ul className="space-y-3">
          {actividades.map((a) => (
            <li key={a.id} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="font-semibold">{DIAS[a.dia] ?? ''}</span>
                <span>·</span>
                <span>{a.responsable.nombre}</span>
                {a.vecesReprogramada > 0 && (
                  <span
                    className="ml-auto rounded px-2 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: COLOR_HEX[colorSemaforo(a.vecesReprogramada)] }}
                  >
                    reprogramada {a.vecesReprogramada}×
                  </span>
                )}
              </div>
              <div className="mb-2 font-medium">{a.descripcion}</div>

              <form action={marcarEstadoAccion} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={a.id} />
                <label className="flex flex-col text-xs">
                  Estado
                  <select name="estado" defaultValue={a.estado} className="rounded border p-1 text-sm">
                    {ESTADOS.map((e) => (
                      <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-xs">
                  Motivo
                  <select name="motivoId" defaultValue={a.motivoId ?? ''} className="rounded border p-1 text-sm">
                    <option value="">—</option>
                    {motivos.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 flex-col text-xs">
                  Nota
                  <input name="nota" defaultValue={a.nota ?? ''} className="rounded border p-1 text-sm" />
                </label>
                <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">
                  Guardar
                </button>
              </form>

              <form action={reprogramarAccion} className="mt-2">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="anio" value={anio} />
                <input type="hidden" name="semana" value={semana} />
                <button className="text-sm text-blue-700 hover:underline">
                  🔄 Reprogramar a la semana {proxima.semana}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/acciones.ts src/app/cumplimiento/page.tsx
git commit -m "feat: pantalla Registrar cumplimiento (estado, motivo, nota, reprogramar)"
```

---

## Task 5: Verificación funcional

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: PASS (métricas + semana + programacion, con los nuevos de `datosReprogramacion`).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 3: Datos y servidor**

Run: `npm run db:seed` (asegura catálogos).
Levantar `npm run dev` en segundo plano y verificar:
```bash
curl -s "http://localhost:3000/cumplimiento" | grep -i "Registrar cumplimiento"
```
Expected: contiene "Registrar cumplimiento". Detener el servidor al terminar.

- [ ] **Step 4: Prueba de extremo a extremo (manual, recomendada con la skill `verify`)**

En el navegador: en **Programar**, agregar una actividad a la semana actual; ir a **Cumplimiento**, marcarla como "No cumplida" con un motivo y Guardar; pulsar "Reprogramar a la semana siguiente"; navegar a la semana siguiente y confirmar que aparece la copia 🔄 con el badge "reprogramada 1×".

---

## Verificación final del Plan 3

- [ ] `npm test` → PASS (incluye `datosReprogramacion`).
- [ ] `npm run build` → "Compiled successfully".
- [ ] `/cumplimiento` responde, muestra selector de área, navegación, % cumplido y % reprogramadas, y la lista de actividades con controles de estado/motivo/nota + botón de reprogramar.
- [ ] La barra superior permite ir entre **Programar** y **Cumplimiento**.

Al terminar este plan, el ciclo semanal está completo: programar → registrar cumplimiento → reprogramar lo que no se cumplió. El Plan 4 construye el **Resumen semanal** (números grandes, ranking ⭐) sobre estos datos.

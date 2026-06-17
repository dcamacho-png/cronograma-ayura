# Banco de Tareas — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un banco de tareas por área: una pantalla `/tareas` donde se anotan actividades pendientes y se seleccionan para una semana, y una sección "por asignar" en `/programar` donde cada tarea seleccionada se asigna a responsable + día (creando la actividad y marcando la tarea como Programada).

**Architecture:** Igual que el resto: Server Components (lectura) + Server Actions (escritura) sobre el repositorio Prisma. Nueva tabla `Tarea`; `Actividad` gana un `tareaId` opcional. La asignación (crear actividad + marcar tarea) se hace en una transacción Prisma.

**Tech Stack:** Next.js 16 · TypeScript · Tailwind v4 · Prisma 6 · Vitest.

**Estrategia de pruebas:** No hay lógica pura nueva (los tests de dominio no cambian). El repositorio y las pantallas se verifican con `npm run build` + una prueba end-to-end contra la base + `curl`.

---

## Estructura de archivos

- Modify: `prisma/schema.prisma` — modelo `Tarea` + `Actividad.tareaId`.
- Modify: `src/datos/repositorio.ts` — funciones de tareas.
- Create: `src/app/tareas/acciones.ts` — Server Actions del banco.
- Create: `src/app/tareas/page.tsx` — pantalla del banco.
- Modify: `src/app/_componentes/nav-principal.tsx` — enlace "Tareas".
- Modify: `src/app/programar/acciones.ts` — acción `asignarTareaAccion`.
- Modify: `src/app/programar/page.tsx` — sección "Tareas por asignar".

---

## Task 1: Esquema — modelo Tarea + Actividad.tareaId

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Agregar el modelo Tarea**

Agregar al final de `prisma/schema.prisma`:
```prisma
model Tarea {
  id          String      @id @default(cuid())
  descripcion String
  estado      String      @default("PENDIENTE")
  anioSel     Int?
  semanaSel   Int?

  areaId      String
  area        Area        @relation(fields: [areaId], references: [id])
  fincaId     String?
  finca       Finca?      @relation(fields: [fincaId], references: [id])

  actividades Actividad[]

  @@index([areaId, estado])
}
```

- [ ] **Step 2: Agregar relaciones inversas y el campo en Actividad**

En el modelo `Area`, agregar esta línea (junto a las otras relaciones):
```prisma
  tareas        Tarea[]
```
En el modelo `Finca`, agregar:
```prisma
  tareas      Tarea[]
```
En el modelo `Actividad`, agregar (junto a los otros campos opcionales de relación):
```prisma
  tareaId    String?
  tarea      Tarea?   @relation(fields: [tareaId], references: [id])
```

- [ ] **Step 3: Crear y aplicar la migración**

Run:
```bash
npx prisma migrate dev --name banco_tareas
```
Expected: crea `prisma/migrations/<ts>_banco_tareas/migration.sql` y "Generated Prisma Client". Es un cambio **aditivo** (tabla nueva + columna nullable), no destructivo, no debe pedir confirmación. Si pidiera confirmación interactiva o reportara pérdida de datos, DETENERSE y reportar BLOCKED (no usar `migrate reset`).

- [ ] **Step 4: Validar**

Run: `npx prisma validate`
Expected: "The schema is valid".

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: esquema Tarea + Actividad.tareaId"
```

---

## Task 2: Repositorio — funciones de tareas

**Files:**
- Modify: `src/datos/repositorio.ts`

- [ ] **Step 1: Agregar las funciones**

Agregar al final de `src/datos/repositorio.ts`:
```typescript
// ---- Banco de tareas ----

export function listarTareasPendientes(areaId: string) {
  return prisma.tarea.findMany({
    where: { areaId, estado: 'PENDIENTE' },
    include: { finca: true },
    orderBy: { descripcion: 'asc' },
  })
}

export function crearTarea(areaId: string, descripcion: string, fincaId: string | null) {
  return prisma.tarea.create({ data: { areaId, descripcion, fincaId } })
}

export function eliminarTarea(id: string) {
  return prisma.tarea.delete({ where: { id } })
}

export function seleccionarTarea(id: string, anio: number, semana: number) {
  return prisma.tarea.update({ where: { id }, data: { anioSel: anio, semanaSel: semana } })
}

export function quitarSeleccionTarea(id: string) {
  return prisma.tarea.update({ where: { id }, data: { anioSel: null, semanaSel: null } })
}

export function tareasPorAsignar(areaId: string, anio: number, semana: number) {
  return prisma.tarea.findMany({
    where: { areaId, estado: 'PENDIENTE', anioSel: anio, semanaSel: semana },
    include: { finca: true },
    orderBy: { descripcion: 'asc' },
  })
}

// Asigna una tarea: crea la actividad (vinculada) y marca la tarea como PROGRAMADA.
export async function asignarTarea(
  tareaId: string,
  responsableId: string,
  dia: number,
  fincaId: string,
) {
  const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } })
  if (!tarea || tarea.anioSel === null || tarea.semanaSel === null) return null
  const anio = tarea.anioSel
  const semana = tarea.semanaSel
  return prisma.$transaction(async (tx) => {
    const actividad = await tx.actividad.create({
      data: {
        anio,
        semana,
        dia,
        descripcion: tarea.descripcion,
        turno: '',
        areaId: tarea.areaId,
        fincaId,
        responsableId,
        tareaId: tarea.id,
      },
    })
    await tx.tarea.update({ where: { id: tarea.id }, data: { estado: 'PROGRAMADA' } })
    return actividad
  })
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores. (Si el cliente Prisma no reconoce `prisma.tarea`, corre `npx prisma generate` y reintenta.)

- [ ] **Step 3: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat: repositorio de tareas (banco + asignar)"
```

---

## Task 3: Pantalla `/tareas` + navegación

**Files:**
- Create: `src/app/tareas/acciones.ts`
- Create: `src/app/tareas/page.tsx`
- Modify: `src/app/_componentes/nav-principal.tsx`

- [ ] **Step 1: Crear las Server Actions**

Create `src/app/tareas/acciones.ts`:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import {
  crearTarea,
  eliminarTarea,
  seleccionarTarea,
  quitarSeleccionTarea,
} from '@/datos/repositorio'

function texto(form: FormData, clave: string): string {
  const v = form.get(clave)
  return typeof v === 'string' ? v.trim() : ''
}
function textoOpcional(form: FormData, clave: string): string | null {
  const v = texto(form, clave)
  return v === '' ? null : v
}

export async function crearTareaAccion(form: FormData) {
  const areaId = texto(form, 'areaId')
  const descripcion = texto(form, 'descripcion')
  if (!areaId || !descripcion) return
  await crearTarea(areaId, descripcion, textoOpcional(form, 'fincaId'))
  revalidatePath('/tareas')
}

export async function eliminarTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await eliminarTarea(id)
  revalidatePath('/tareas')
}

export async function seleccionarTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  const anio = Number(texto(form, 'anio'))
  const semana = Number(texto(form, 'semana'))
  if (id && Number.isInteger(anio) && Number.isInteger(semana)) {
    await seleccionarTarea(id, anio, semana)
  }
  revalidatePath('/tareas')
}

export async function quitarSeleccionTareaAccion(form: FormData) {
  const id = texto(form, 'id')
  if (id) await quitarSeleccionTarea(id)
  revalidatePath('/tareas')
}
```

- [ ] **Step 2: Crear la página**

Create `src/app/tareas/page.tsx`:
```tsx
import Link from 'next/link'
import { listarAreas, listarFincas, listarTareasPendientes } from '@/datos/repositorio'
import { siguienteSemana, semanaAnterior, semanaActual } from '@/dominio/semana'
import {
  crearTareaAccion,
  eliminarTareaAccion,
  seleccionarTareaAccion,
  quitarSeleccionTareaAccion,
} from './acciones'

export default async function TareasPage({
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

  const [fincas, tareas] = await Promise.all([
    listarFincas(),
    listarTareasPendientes(areaId),
  ])

  const previa = semanaAnterior(anio, semana)
  const proxima = siguienteSemana(anio, semana)
  const url = (a: string, an: number, se: number) => `/tareas?area=${a}&anio=${an}&semana=${se}`

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#11603a]">🗂️ Banco de tareas</h1>

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

      <div className="mb-5 flex items-center gap-3 text-sm">
        <Link href={url(areaId, previa.anio, previa.semana)} className="rounded border px-3 py-1">← Semana {previa.semana}</Link>
        <span className="font-semibold">Semana {semana} · {anio}</span>
        <Link href={url(areaId, proxima.anio, proxima.semana)} className="rounded border px-3 py-1">Semana {proxima.semana} →</Link>
        <span className="text-gray-500">(eliges para qué semana seleccionar)</span>
      </div>

      <div className="mb-4 rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">Tareas pendientes</h2>
        {tareas.length === 0 ? (
          <p className="text-sm text-gray-500">No hay tareas en el banco de esta área. Agrega una abajo.</p>
        ) : (
          <ul className="divide-y">
            {tareas.map((t) => {
              const seleccionada = t.anioSel === anio && t.semanaSel === semana
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex-1">
                    <div className="font-medium">{t.descripcion}</div>
                    <div className="text-xs text-gray-500">{t.finca ? `Finca: ${t.finca.nombre}` : 'Sin finca'}</div>
                  </div>
                  {seleccionada ? (
                    <>
                      <span className="rounded-full bg-[#1d8a55] px-3 py-1 text-xs font-bold text-white">➡️ Semana {semana}</span>
                      <form action={quitarSeleccionTareaAccion}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="rounded bg-gray-100 px-3 py-1 text-sm">Quitar</button>
                      </form>
                    </>
                  ) : (
                    <form action={seleccionarTareaAccion}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="anio" value={anio} />
                      <input type="hidden" name="semana" value={semana} />
                      <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Seleccionar para semana {semana}</button>
                    </form>
                  )}
                  <form action={eliminarTareaAccion}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-sm text-red-600 hover:underline">eliminar</button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <form action={crearTareaAccion} className="flex flex-wrap items-end gap-2 rounded-xl border p-4">
        <input type="hidden" name="areaId" value={areaId} />
        <label className="flex flex-1 flex-col text-sm">
          Nueva tarea
          <input name="descripcion" required placeholder="Ej: Arreglo de saladero" className="rounded border p-2" />
        </label>
        <label className="flex flex-col text-sm">
          Finca (opcional)
          <select name="fincaId" className="rounded border p-2">
            <option value="">—</option>
            {fincas.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </select>
        </label>
        <button className="rounded bg-[#11603a] px-4 py-2 text-sm font-semibold text-white">+ Agregar al banco</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Agregar el enlace en la navegación**

En `src/app/_componentes/nav-principal.tsx`, en el arreglo `ENLACES`, agregar como PRIMER elemento (antes de Programar):
```tsx
  { href: '/tareas', texto: 'Tareas' },
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 5: Commit**

```bash
git add src/app/tareas/acciones.ts src/app/tareas/page.tsx src/app/_componentes/nav-principal.tsx
git commit -m "feat: pantalla del banco de tareas + enlace en navegación"
```

---

## Task 4: Sección "Tareas por asignar" en Programar

**Files:**
- Modify: `src/app/programar/acciones.ts`
- Modify: `src/app/programar/page.tsx`

- [ ] **Step 1: Agregar la acción de asignar**

En `src/app/programar/acciones.ts`:
1. Agregar `asignarTarea` al import existente desde `@/datos/repositorio`.
2. Agregar esta acción (reutiliza el helper `texto` ya existente en el archivo):
```typescript
export async function asignarTareaAccion(form: FormData) {
  const tareaId = texto(form, 'tareaId')
  const responsableId = texto(form, 'responsableId')
  const dia = Number(texto(form, 'dia'))
  const fincaId = texto(form, 'fincaId')
  if (!tareaId || !responsableId || !fincaId || !Number.isInteger(dia)) return
  await asignarTarea(tareaId, responsableId, dia, fincaId)
  revalidatePath('/programar')
}
```

- [ ] **Step 2: Mostrar la sección en la página**

En `src/app/programar/page.tsx`:
1. Agregar `tareasPorAsignar` al import existente desde `@/datos/repositorio`.
2. Agregar `asignarTareaAccion` al import existente desde `'./acciones'`.
3. Donde se cargan los datos con `Promise.all([...])` (que ya trae `responsables`, `fincas`, `maquinas`, `actividades`), agregar una llamada más: `tareasPorAsignar(areaId, anio, semana)`. Por ejemplo, si hoy es:
```tsx
  const [responsables, fincas, maquinas, actividades] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarFincas(),
    listarMaquinas(),
    listarActividades(areaId, anio, semana),
  ])
```
cámbialo a:
```tsx
  const [responsables, fincas, maquinas, actividades, porAsignar] = await Promise.all([
    listarResponsablesPorArea(areaId),
    listarFincas(),
    listarMaquinas(),
    listarActividades(areaId, anio, semana),
    tareasPorAsignar(areaId, anio, semana),
  ])
```
4. Insertar este bloque JUSTO ANTES de la grilla (antes del `{responsables.length === 0 ? ...}` que renderiza la tabla), usando `responsables`, `fincas`, `DIAS`, `areaId`, `anio`, `semana` que ya están en alcance:
```tsx
      {porAsignar.length > 0 && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-3 font-semibold text-blue-900">📌 Tareas por asignar — semana {semana}</h2>
          {responsables.length === 0 ? (
            <p className="text-sm text-blue-900">Primero agrega responsables a esta área para poder asignar.</p>
          ) : (
            <ul className="space-y-2">
              {porAsignar.map((t) => (
                <li key={t.id}>
                  <form action={asignarTareaAccion} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="tareaId" value={t.id} />
                    <span className="flex-1 min-w-[160px] font-medium">{t.descripcion}</span>
                    <select name="responsableId" required className="rounded border p-1 text-sm">
                      {responsables.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                    <select name="dia" required className="rounded border p-1 text-sm">
                      {DIAS.map((d, i) => (
                        <option key={d} value={i + 1}>{d}</option>
                      ))}
                    </select>
                    <select name="fincaId" required defaultValue={t.fincaId ?? ''} className="rounded border p-1 text-sm">
                      {fincas.map((f) => (
                        <option key={f.id} value={f.id}>{f.nombre}</option>
                      ))}
                    </select>
                    <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Asignar →</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
```
Nota: `DIAS` en programar es `['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']` (índice 0→día 1). El `value={i + 1}` ya lo maneja. `defaultValue={t.fincaId ?? ''}` preselecciona la finca de la tarea; si la tarea no tenía finca, el select queda en la primera opción válida (todas las fincas son válidas, así que el `required` se cumple).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: "Compiled successfully", sin errores de tipos. Si falla, leer el error y corregir mínimamente; reportar.

- [ ] **Step 4: Commit**

```bash
git add src/app/programar/acciones.ts src/app/programar/page.tsx
git commit -m "feat: sección Tareas por asignar en Programar"
```

---

## Task 5: Verificación funcional

- [ ] **Step 1: Tests y build**

Run: `npm test` → PASS (sin cambios de dominio; 36).
Run: `npm run build` → "Compiled successfully".

- [ ] **Step 2: Prueba end-to-end contra la base**

Crear `e2e-tareas.ts` en la raíz con este contenido, ejecutarlo con `npx tsx e2e-tareas.ts`, y luego borrarlo:
```typescript
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const area = await prisma.area.findFirstOrThrow({ where: { nombre: 'Ganadería ceba' } })
  const finca = await prisma.finca.findFirstOrThrow()
  const resp = await prisma.responsable.findFirstOrThrow({ where: { areaId: area.id } })

  // 1) crear tarea en el banco
  const tarea = await prisma.tarea.create({ data: { areaId: area.id, descripcion: 'E2E tarea banco', fincaId: finca.id } })
  // 2) seleccionar para una semana de prueba
  await prisma.tarea.update({ where: { id: tarea.id }, data: { anioSel: 2097, semanaSel: 30 } })
  // 3) asignar (replica de asignarTarea): crear actividad + marcar PROGRAMADA
  const t = await prisma.tarea.findUniqueOrThrow({ where: { id: tarea.id } })
  const act = await prisma.$transaction(async (tx) => {
    const a = await tx.actividad.create({ data: {
      anio: t.anioSel!, semana: t.semanaSel!, dia: 2, descripcion: t.descripcion, turno: '',
      areaId: t.areaId, fincaId: finca.id, responsableId: resp.id, tareaId: t.id,
    }})
    await tx.tarea.update({ where: { id: t.id }, data: { estado: 'PROGRAMADA' } })
    return a
  })
  const tFinal = await prisma.tarea.findUniqueOrThrow({ where: { id: tarea.id } })
  const enBanco = await prisma.tarea.findMany({ where: { areaId: area.id, estado: 'PENDIENTE' } })
  const ok = act.tareaId === tarea.id && tFinal.estado === 'PROGRAMADA' && !enBanco.some(x => x.id === tarea.id)
  console.log('actividad.tareaId:', act.tareaId === tarea.id, '| tarea PROGRAMADA:', tFinal.estado === 'PROGRAMADA', '| fuera del banco:', !enBanco.some(x => x.id === tarea.id))
  // limpiar
  await prisma.actividad.deleteMany({ where: { anio: 2097 } })
  await prisma.tarea.delete({ where: { id: tarea.id } })
  console.log(ok ? 'E2E_TAREAS_OK' : 'E2E_TAREAS_FALLO')
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1) }).finally(() => prisma.$disconnect())
```
Expected: imprime los tres `true` y `E2E_TAREAS_OK`. Borrar el archivo al terminar.

- [ ] **Step 3: Servidor**

Run `npm run db:seed`, levantar `npm run dev` en segundo plano y verificar:
```bash
curl -s "http://localhost:3000/tareas" | grep -i "Banco de tareas"
```
Expected: contiene "Banco de tareas". Detener el servidor al terminar.

---

## Verificación final

- [ ] `npm test` → PASS (36).
- [ ] `npm run build` → "Compiled successfully".
- [ ] E2E imprime `E2E_TAREAS_OK`.
- [ ] `/tareas` responde con el banco; la barra superior incluye **Tareas**.
- [ ] En `/programar`, las tareas seleccionadas para la semana aparecen en "📌 Tareas por asignar" y al asignarlas entran a la grilla y salen del banco.

Al terminar: el banco de tareas alimenta la programación de extremo a extremo.

# Programación por responsable (días + turno de cada uno) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al asignar una tarea con varios responsables, cada responsable tenga su propia barra de días (y, en maquinaria, su turno y su máquina por día), creando una fila por (responsable × su día) en un solo envío.

**Architecture:** El formulario recolecta un bloque por responsable (`dia_<rid>`, `turno_<rid>`, `maquina_<rid>_<dia>`, `respNombre_<rid>`). La acción arma `Asignacion[]` y el repo crea las filas con el turno/máquina de cada responsable. Los conflictos se detectan contra la BD (por responsable) y entre responsables del mismo envío (misma máquina, mismo día+turno). No hay cambios de esquema (cada `Actividad` ya guarda `turno` y `maquinaId`).

**Tech Stack:** Next.js 16, React 19, Prisma/Postgres, TypeScript, Tailwind v4, Vitest.

## Global Constraints

- Ante dudas de API de Next, leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
- Tests unitarios: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run <archivo>` (dominio es puro; no toca DB).
- SIN cambios de esquema Prisma.
- Alcance: días por responsable en TODAS las áreas; turno por responsable SOLO en maquinaria (estándar `turno=''`).
- Un turno por responsable (aplica a todos sus días); máquina por (responsable × día).
- Contrato de `name`s: `responsableId` (múltiple), `dia_<rid>` (múltiple), `turno_<rid>`, `maquina_<rid>_<dia>`, `respNombre_<rid>`.
- Reutilizar estilos Tailwind existentes.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Dominio — `Asignacion`, `Conflicto.responsableId`, `conflictosMaquinaEntreResponsables`

**Files:**
- Modify: `src/dominio/programacion.ts`
- Test: `src/dominio/programacion.test.ts`

**Interfaces:**
- Produces:
  - `interface Asignacion { responsableId: string; dias: number[]; turno: string; maquinaPorDia: Record<number, string | null> }`
  - `interface Conflicto { dia: number; tipo: TipoConflicto; responsableId?: string }`
  - `conflictosMaquinaEntreResponsables(asignaciones: Asignacion[]): Conflicto[]`
  - `detectarConflictosAsignacion(...)` ahora rellena `responsableId` en cada conflicto (firma sin cambios).

- [ ] **Step 1: Escribir los tests (fallan)**

En `src/dominio/programacion.test.ts`, añadir al final:

```ts
import { conflictosMaquinaEntreResponsables } from './programacion'
import type { Asignacion } from './programacion'

describe('detectarConflictosAsignacion — responsableId', () => {
  it('rellena responsableId en los conflictos', () => {
    const exist: CasillaOcupada[] = [{ dia: 1, turno: '7am-4pm', maquinaId: 'm1', responsableId: 'r1' }]
    const c = detectarConflictosAsignacion(exist, [1], 'r1', {}, '7am-4pm')
    expect(c).toEqual([{ dia: 1, tipo: 'responsable', responsableId: 'r1' }])
  })
})

describe('conflictosMaquinaEntreResponsables', () => {
  const base = (over: Partial<Asignacion>): Asignacion => ({ responsableId: 'r', dias: [], turno: '7am-4pm', maquinaPorDia: {}, ...over })

  it('sin conflicto si usan máquinas distintas el mismo día+turno', () => {
    const a = [base({ responsableId: 'r1', dias: [1], maquinaPorDia: { 1: 'm1' } }), base({ responsableId: 'r2', dias: [1], maquinaPorDia: { 1: 'm2' } })]
    expect(conflictosMaquinaEntreResponsables(a)).toEqual([])
  })

  it('conflicto si dos responsables usan la misma máquina el mismo día+turno', () => {
    const a = [base({ responsableId: 'r1', dias: [1], maquinaPorDia: { 1: 'm1' } }), base({ responsableId: 'r2', dias: [1], maquinaPorDia: { 1: 'm1' } })]
    expect(conflictosMaquinaEntreResponsables(a)).toEqual([{ dia: 1, tipo: 'maquina', responsableId: 'r2' }])
  })

  it('sin conflicto si es la misma máquina pero en días distintos', () => {
    const a = [base({ responsableId: 'r1', dias: [1], maquinaPorDia: { 1: 'm1' } }), base({ responsableId: 'r2', dias: [2], maquinaPorDia: { 2: 'm1' } })]
    expect(conflictosMaquinaEntreResponsables(a)).toEqual([])
  })

  it('ignora máquina nula', () => {
    const a = [base({ responsableId: 'r1', dias: [1], maquinaPorDia: { 1: null } }), base({ responsableId: 'r2', dias: [1], maquinaPorDia: { 1: null } })]
    expect(conflictosMaquinaEntreResponsables(a)).toEqual([])
  })
})
```

- [ ] **Step 2: Correr los tests → fallan**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run src/dominio/programacion.test.ts`
Expected: FAIL (no existe `conflictosMaquinaEntreResponsables`; `detectarConflictosAsignacion` no incluye `responsableId`).

- [ ] **Step 3: Implementar en `programacion.ts`**

1. Añadir `responsableId?` a `Conflicto`:
```ts
export interface Conflicto {
  dia: number
  tipo: TipoConflicto
  responsableId?: string
}
```

2. En `detectarConflictosAsignacion`, incluir `responsableId` en los dos `push`:
```ts
    if (enCasilla.some((e) => e.responsableId === responsableId)) {
      conflictos.push({ dia, tipo: 'responsable', responsableId })
    }
    const maqId = maquinaPorDia[dia] ?? null
    if (maqId && enCasilla.some((e) => e.maquinaId === maqId)) {
      conflictos.push({ dia, tipo: 'maquina', responsableId })
    }
```

3. Añadir el tipo `Asignacion` y la función nueva (después de `detectarConflictosAsignacion`):
```ts
// Una asignación por responsable: sus días, su turno y su máquina por día.
export interface Asignacion {
  responsableId: string
  dias: number[]
  turno: string
  maquinaPorDia: Record<number, string | null>
}

// Conflicto de máquina ENTRE responsables del mismo envío: si dos asignaciones
// usan la misma máquina (no nula) en el mismo día + turno efectivo.
export function conflictosMaquinaEntreResponsables(asignaciones: Asignacion[]): Conflicto[] {
  const conflictos: Conflicto[] = []
  const vistas = new Set<string>()
  for (const a of asignaciones) {
    for (const dia of a.dias) {
      const maqId = a.maquinaPorDia[dia] ?? null
      if (!maqId) continue
      const key = `${dia}-${turnoEfectivo(a.turno, dia)}-${maqId}`
      if (vistas.has(key)) {
        conflictos.push({ dia, tipo: 'maquina', responsableId: a.responsableId })
      } else {
        vistas.add(key)
      }
    }
  }
  return conflictos
}
```

- [ ] **Step 4: Correr los tests → pasan**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run src/dominio/programacion.test.ts`
Expected: PASS (todos, incluyendo los previos).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores (los cambios son aditivos y no rompen a `asignarTarea` actual, que sigue compilando).

- [ ] **Step 6: Commit**

```bash
git add src/dominio/programacion.ts src/dominio/programacion.test.ts
git commit -m "feat(dominio): Asignacion + conflictosMaquinaEntreResponsables + responsableId en Conflicto

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Repo — `asignarTarea` recibe `Asignacion[]`

**Files:**
- Modify: `src/datos/repositorio.ts`

**Interfaces:**
- Consumes: `Asignacion`, `detectarConflictosAsignacion`, `conflictosMaquinaEntreResponsables`, `turnoPorDia` (Task 1 / existentes).
- Produces: `asignarTarea(tareaId: string, asignaciones: Asignacion[], loteIdFallback: string | null, esMaquinaria?: boolean)` con el mismo tipo de retorno unión (`{ok:false,motivo:'tarea'} | {ok:false,motivo:'conflicto',conflictos:Conflicto[]} | {ok:true,creadas:number}`).

> Nota: cambia la firma de `asignarTarea`; su único llamador (`asignarTareaAccion`) se actualiza en la Task 3. Hasta entonces el typecheck reportará error en `src/app/programar/acciones.ts` — es esperado; la verificación completa se corre al final de la Task 3.

- [ ] **Step 1: Ampliar los imports de dominio en `repositorio.ts`**

Reemplazar la línea (4):
```ts
import { duplicarActividades, datosReprogramacion, detectarConflictosAsignacion } from '@/dominio/programacion'
```
por:
```ts
import { duplicarActividades, datosReprogramacion, detectarConflictosAsignacion, conflictosMaquinaEntreResponsables } from '@/dominio/programacion'
```
Y la línea (6):
```ts
import type { BorradorActividad, Conflicto } from '@/dominio/programacion'
```
por:
```ts
import type { BorradorActividad, Conflicto, Asignacion } from '@/dominio/programacion'
```

- [ ] **Step 2: Reescribir `asignarTarea`**

Reemplazar toda la función `asignarTarea` por:

```ts
export async function asignarTarea(
  tareaId: string,
  asignaciones: Asignacion[],
  loteIdFallback: string | null,
  esMaquinaria = true,
): Promise<
  | { ok: false; motivo: 'tarea' }
  | { ok: false; motivo: 'conflicto'; conflictos: Conflicto[] }
  | { ok: true; creadas: number }
> {
  const tarea = await prisma.tarea.findUnique({ where: { id: tareaId }, include: { lotes: true } })
  if (!tarea || tarea.anioSel === null || tarea.semanaSel === null) return { ok: false, motivo: 'tarea' }
  // Normaliza días de cada asignación (enteros 1-7, únicos) y descarta responsables sin días.
  const asigs = asignaciones
    .map((a) => ({ ...a, dias: [...new Set(a.dias)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7) }))
    .filter((a) => a.responsableId && a.dias.length > 0)
  const diasTodos = [...new Set(asigs.flatMap((a) => a.dias))]
  if (asigs.length === 0 || diasTodos.length === 0) return { ok: false, motivo: 'tarea' }
  const anio = tarea.anioSel
  const semana = tarea.semanaSel
  const loteIds =
    tarea.lotes.length > 0 ? tarea.lotes.map((l) => l.id) : loteIdFallback ? [loteIdFallback] : []
  let fincaId: string | null = null
  if (loteIds.length > 0) {
    const primer = await prisma.lote.findUnique({ where: { id: loteIds[0] } })
    if (!primer) return { ok: false, motivo: 'tarea' }
    fincaId = primer.fincaId
  }
  return prisma.$transaction(async (tx) => {
    const existentes = await tx.actividad.findMany({
      where: { anio, semana, dia: { in: diasTodos } },
      select: { dia: true, turno: true, maquinaId: true, responsableId: true },
    })
    const conflictosRaw = [
      ...asigs.flatMap((a) => detectarConflictosAsignacion(existentes, a.dias, a.responsableId, a.maquinaPorDia, a.turno)),
      ...conflictosMaquinaEntreResponsables(asigs),
    ]
    const vistos = new Set<string>()
    const conflictos = conflictosRaw.filter((c) => {
      const k = `${c.dia}-${c.tipo}-${c.responsableId ?? ''}`
      if (vistos.has(k)) return false
      vistos.add(k)
      return true
    })
    if (conflictos.length > 0) {
      return { ok: false as const, motivo: 'conflicto' as const, conflictos }
    }
    let creadas = 0
    for (const a of asigs) {
      for (const dia of a.dias) {
        await tx.actividad.create({
          data: {
            anio,
            semana,
            dia,
            descripcion: tarea.descripcion,
            turno: esMaquinaria ? (a.turno.trim() || turnoPorDia(dia)) : '',
            vecesReprogramada: tarea.vecesReprogramada,
            areaId: tarea.areaId,
            fincaId,
            responsableId: a.responsableId,
            maquinaId: a.maquinaPorDia[dia] ?? null,
            tareaId: tarea.id,
            lotes: { connect: loteIds.map((id) => ({ id })) },
            ...(tarea.bultosPorLote != null ? { bultosPorLote: tarea.bultosPorLote as Prisma.InputJsonValue } : {}),
            ...(tarea.unidad ? { unidadRealizada: tarea.unidad } : {}),
          },
        })
        creadas += 1
      }
    }
    await tx.tarea.update({ where: { id: tarea.id }, data: { estado: 'PROGRAMADA' } })
    return { ok: true as const, creadas }
  })
}
```

(Verificar que `turnoPorDia` ya está importado en `repositorio.ts`; hoy `asignarTarea` lo usa, así que sí.)

- [ ] **Step 3: Typecheck (parcial, esperado)**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: SOLO errores en `src/app/programar/acciones.ts` (llama a `asignarTarea` con la firma vieja). `repositorio.ts` sin errores propios.

- [ ] **Step 4: Commit**

```bash
git add src/datos/repositorio.ts
git commit -m "feat(repo): asignarTarea recibe Asignacion[] (días/turno/máquina por responsable)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Acción — `asignarTareaAccion` arma `Asignacion[]` y nombra conflictos

**Files:**
- Modify: `src/app/programar/acciones.ts`

**Interfaces:**
- Consumes: `asignarTarea(tareaId, asignaciones, loteId, esMaquinaria)` (Task 2), `Asignacion` (Task 1).

- [ ] **Step 1: Importar el tipo `Asignacion`**

Añadir cerca de los imports de `acciones.ts`:
```ts
import type { Asignacion } from '@/dominio/programacion'
```

- [ ] **Step 2: Reescribir `asignarTareaAccion`**

Reemplazar toda la función `asignarTareaAccion` por:

```ts
export async function asignarTareaAccion(form: FormData) {
  const tareaId = texto(form, 'tareaId')
  const responsableIds = form.getAll('responsableId').map((v) => String(v)).filter(Boolean)
  const anioForm = Number(texto(form, 'anio'))
  const semanaForm = Number(texto(form, 'semana'))
  const hoy = { ...semanaActual(), dia: diaActual() }
  const loteId = textoOpcional(form, 'loteId')
  const esMaquinaria = texto(form, 'esMaquinaria') === '1'

  const nombres: Record<string, string> = {}
  const asignaciones: Asignacion[] = []
  for (const rid of responsableIds) {
    nombres[rid] = texto(form, `respNombre_${rid}`)
    const dias = form
      .getAll(`dia_${rid}`)
      .map((v) => Number(String(v)))
      .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
      .filter((d) => !esDiaPasado(anioForm, semanaForm, d, hoy))
    if (dias.length === 0) continue
    const turno = texto(form, `turno_${rid}`)
    const maquinaPorDia: Record<number, string | null> = {}
    for (const dia of dias) {
      maquinaPorDia[dia] = textoOpcional(form, `maquina_${rid}_${dia}`) || null
    }
    asignaciones.push({ responsableId: rid, dias, turno, maquinaPorDia })
  }

  if (!tareaId || asignaciones.length === 0) return
  const res = await asignarTarea(tareaId, asignaciones, loteId, esMaquinaria)
  if (res.ok === false && res.motivo === 'conflicto') {
    const partes = res.conflictos.map((c) => {
      const nombre = (c.responsableId && nombres[c.responsableId]) || 'Responsable'
      const detalle =
        c.tipo === 'responsable'
          ? 'ya tiene una tarea en ese turno'
          : 'la máquina ya está ocupada en ese turno'
      return `${nombre} — ${DIAS_CORTOS[c.dia]}: ${detalle}`
    })
    const msg = `No se asignó. ${partes.join(' · ')}`
    const areaId = texto(form, 'areaId')
    const anio = texto(form, 'anio')
    const semana = texto(form, 'semana')
    redirect(`/programar?area=${areaId}&anio=${anio}&semana=${semana}&error=${encodeURIComponent(msg)}`)
  }
  revalidatePath('/programar')
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/app/programar/acciones.ts
git commit -m "feat(programar): asignarTareaAccion arma Asignacion[] por responsable y nombra conflictos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: UI — `AsignarTareaForm` con un bloque por responsable

**Files:**
- Modify: `src/app/programar/asignar-tarea-form.tsx`

**Interfaces:**
- Consumes: los `name`s que lee `asignarTareaAccion` (Task 3): `responsableId`, `dia_<rid>`, `turno_<rid>`, `maquina_<rid>_<dia>`, `respNombre_<rid>`.
- Props del componente SIN cambios (misma firma que hoy); `page.tsx` no se toca.

- [ ] **Step 1: Reemplazar el contenido del componente**

Reemplazar TODO el cuerpo de `export function AsignarTareaForm(...)` (mantener la firma/props idénticas) por esta implementación:

```tsx
  const [responsableIds, setResponsableIds] = useState<string[]>(responsables[0] ? [responsables[0].id] : [])
  const [respAbierto, setRespAbierto] = useState(false)
  const [porResp, setPorResp] = useState<Record<string, { dias: number[]; turno: string }>>(
    responsables[0] ? { [responsables[0].id]: { dias: [], turno: esMaquinaria ? turnoPorDia(1) : '' } } : {},
  )

  const toggleResp = (id: string) => {
    setResponsableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setPorResp((prev) => {
      if (prev[id]) {
        const { [id]: _quitado, ...resto } = prev
        return resto
      }
      return { ...prev, [id]: { dias: [], turno: esMaquinaria ? turnoPorDia(1) : '' } }
    })
  }
  const setDiasResp = (id: string, dias: number[]) =>
    setPorResp((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { dias: [], turno: '' }), dias } }))
  const setTurnoResp = (id: string, turno: string) =>
    setPorResp((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { dias: [], turno: '' }), turno } }))
  const toggleDiaResp = (id: string, d: number) => {
    if (diasPasados.includes(d)) return
    const cur = porResp[id]?.dias ?? []
    setDiasResp(id, cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d])
  }

  const nombresSel = responsables.filter((r) => responsableIds.includes(r.id)).map((r) => r.nombre)
  const totalDias = responsableIds.reduce((s, rid) => s + (porResp[rid]?.dias.length ?? 0), 0)

  // Conflicto en vivo por responsable: responsable ya ocupado en día+turno (contra la BD).
  const conflictosResp = responsableIds.flatMap((rid) => {
    const info = porResp[rid]
    if (!info) return [] as { rid: string; dia: number }[]
    return [...info.dias]
      .sort((a, b) => a - b)
      .filter((d) => ocupacion.some((o) => o.dia === d && o.turno === turnoEfectivo(info.turno, d) && o.responsableId === rid))
      .map((d) => ({ rid, dia: d }))
  })

  const seleccionados = responsables.filter((r) => responsableIds.includes(r.id))

  return (
    <form action={accion} className="flex w-full flex-col gap-2">
      <input type="hidden" name="tareaId" value={tareaId} />
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="semana" value={semana} />
      <input type="hidden" name="esMaquinaria" value={esMaquinaria ? '1' : ''} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[160px] flex-1 font-medium">{descripcion}</span>
        <div className="relative flex flex-col text-xs">
          Responsables
          <button
            type="button"
            onClick={() => setRespAbierto((v) => !v)}
            className="flex w-48 items-center justify-between rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
          >
            <span className="truncate">{nombresSel.length > 0 ? nombresSel.join(', ') : '— elegir —'}</span>
            <span className="ml-1 text-tierra">▾</span>
          </button>
          <div
            className={`absolute top-full left-0 z-10 mt-1 max-h-52 w-56 flex-col gap-1 overflow-auto rounded-lg border border-borde bg-white p-2 shadow-lg ${respAbierto ? 'flex' : 'hidden'}`}
          >
            {responsables.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:bg-arena/40">
                <input
                  type="checkbox"
                  name="responsableId"
                  value={r.id}
                  checked={responsableIds.includes(r.id)}
                  onChange={() => toggleResp(r.id)}
                  className="accent-bosque"
                />
                {r.nombre}
              </label>
            ))}
          </div>
        </div>
        <span className="text-xs text-tierra">
          {lotesTarea.length > 0
            ? `Lote(s): ${lotesTarea
                .map((l) => {
                  const bb = bultosPorLote?.[l.id]
                  return typeof bb === 'number' ? `${l.nombre} (${bb} bultos)` : l.nombre
                })
                .join(', ')}`
            : 'Sin lote'}
        </span>
        <button
          disabled={totalDias === 0 || conflictosResp.length > 0}
          className="ml-auto rounded-lg bg-bosque px-3 py-1 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-arena disabled:text-tierra"
        >
          Asignar →
        </button>
      </div>

      {seleccionados.map((r) => {
        const info = porResp[r.id] ?? { dias: [], turno: '' }
        return (
          <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-borde bg-arena/30 p-2">
            <input type="hidden" name={`respNombre_${r.id}`} value={r.nombre} />
            <span className="text-xs font-semibold text-tinta">{r.nombre}</span>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col text-xs">
                Días
                <div className="flex gap-1">
                  {DIAS.map((d, i) => {
                    const dia = i + 1
                    const pasado = diasPasados.includes(dia)
                    return (
                      <label
                        key={d}
                        title={pasado ? 'Día ya pasado de esta semana' : undefined}
                        className={`flex flex-col items-center rounded-lg border border-borde px-1.5 py-0.5 has-[:checked]:border-bosque has-[:checked]:bg-green-50 ${
                          pasado ? 'cursor-not-allowed bg-arena text-tierra/50' : 'cursor-pointer'
                        }`}
                      >
                        <span>{d}</span>
                        <input
                          type="checkbox"
                          name={`dia_${r.id}`}
                          value={dia}
                          checked={info.dias.includes(dia)}
                          disabled={pasado}
                          onChange={() => toggleDiaResp(r.id, dia)}
                          className="accent-bosque"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
              {esMaquinaria && (
                <label className="flex flex-col text-xs">
                  Turno
                  <input
                    name={`turno_${r.id}`}
                    value={info.turno}
                    onChange={(e) => setTurnoResp(r.id, e.target.value)}
                    className="w-28 rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40"
                  />
                </label>
              )}
            </div>
            {esMaquinaria && info.dias.length > 0 && (
              <div className="flex w-full flex-col gap-1 text-xs">
                <span className="text-tierra">Máquina por día (solo disponibles · opcional)</span>
                {[...info.dias].sort((a, b) => a - b).map((dia) => {
                  const turnoEf = turnoEfectivo(info.turno, dia)
                  const ocupadas = new Set(
                    ocupacion.filter((o) => o.dia === dia && o.turno === turnoEf).map((o) => o.maquinaId),
                  )
                  const disponibles = maquinas.filter((m) => !ocupadas.has(m.id))
                  return (
                    <label key={dia} className="flex items-center gap-1">
                      <span className="w-8">{DIAS[dia - 1]}</span>
                      <select name={`maquina_${r.id}_${dia}`} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                        <option value="">— sin máquina —</option>
                        {disponibles.map((m) => (
                          <option key={m.id} value={m.id}>{m.nombre}</option>
                        ))}
                      </select>
                      {disponibles.length === 0 && <span className="text-amber-600">sin máquinas libres este turno</span>}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {conflictosResp.length > 0 && (
        <p className="w-full text-xs font-medium text-red-700">
          ⚠️ Conflicto de turno: {conflictosResp.map((c) => `${responsables.find((r) => r.id === c.rid)?.nombre ?? ''} (${DIAS[c.dia - 1]})`).join(', ')}
        </p>
      )}
    </form>
  )
```

(Los imports del archivo — `useState`, `turnoPorDia`, `turnoEfectivo`, la constante `DIAS` — ya existen y se conservan.)

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 3: Tests (regresión) + commit**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run` → todo verde.

```bash
git add src/app/programar/asignar-tarea-form.tsx
git commit -m "feat(programar): un bloque por responsable (días + turno + máquina por día)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras todas las tareas)

Server local (`next dev`) apuntando a la DB real + cookie de sesión firmada (ver memoria `verificacion-navegador`), escrituras reversibles (snapshot/restore por id, borrar las filas creadas). Navegador real (las selects/checkboxes de este form son estado local de React; interacción con esperas):

1. **Estándar, 2 responsables, días distintos:** asignar con A=Lun,Mar y B=Vie → se crean filas A/Lun, A/Mar, B/Vie (turno `''`), y la tarea pasa a PROGRAMADA.
2. **Maquinaria, turnos/máquinas distintas:** A con turno X y máquina m1 el Lun; B con turno Y y máquina m2 el Mar → filas con el turno/máquina correspondiente por responsable/día.
3. **Conflicto intra-envío:** A y B con la misma máquina el mismo día+turno → NO asigna, mensaje nombrando al responsable/día.
4. **Conflicto contra BD:** un responsable en un día+turno ya ocupado → bloqueado en vivo (botón deshabilitado) y en servidor.
5. Verificar en Neon las filas creadas y **borrarlas** al terminar (por id), y devolver la tarea al banco si se dejó PROGRAMADA.

## Nota

Sin cambios de esquema. El resto de la app (grilla, export, cumplimiento) opera igual porque las filas resultantes tienen la misma forma que hoy (una por responsable/día, con su `turno`/`maquinaId`).

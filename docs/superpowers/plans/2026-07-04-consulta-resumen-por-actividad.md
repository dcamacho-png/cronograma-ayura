# /consulta como resumen por actividad (estilo Excel) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `/consulta` muestre un resumen por actividad (agrupando filas-hermanas por `tareaId`, uniendo responsables, potreros separados con su medida) idéntico al Excel de cumplimiento, solo para CUMPLIDA, con filtros a nivel de actividad.

**Architecture:** Reutiliza el dominio ya probado del Excel (`agruparPorActividad`, `estadoActividad`, `filasCumplimientoGrupo`, `COLUMNAS_CUMPLIMIENTO`). `consultarCulminadas(areaId)` trae todas las CUMPLIDA del área (propias + solicitadas) con `tarea.detalle`; la página agrupa por (semana, actividad), separa propias/solicitadas para "Ejecutada por", filtra por actividad y arma las filas del Excel + columna "Semana" (sin "Estado"). Sin cambios de esquema.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma/Postgres, TypeScript, Tailwind v4.

## Global Constraints

- Ante dudas de API de Next, leer `node_modules/next/dist/docs/`.
- El repo tiene suite vitest; verificación = typecheck + build + vitest (todo verde).
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
- Vitest: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run`.
- SIN cambios de esquema. NO tocar `src/dominio/cumplimiento-export.ts` ni el Excel (`src/app/cumplimiento/exportar/route.ts`) — se reutilizan tal cual.
- Solo CUMPLIDA (no Parcial). Columnas = `COLUMNAS_CUMPLIMIENTO` sin "Estado", con "Semana" al inicio. Filtros (responsable/finca/centro/potrero) a nivel de actividad.
- Reutilizar estilos Tailwind existentes.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `/consulta` resumen por actividad (repo + página)

**Files:**
- Modify: `src/datos/repositorio.ts` (función `consultarCulminadas`)
- Modify: `src/app/consulta/page.tsx` (reescritura completa)

**Interfaces:**
- Produces: `consultarCulminadas(areaId: string)` (sin parámetro `filtros`) con includes `responsable, finca, maquina, lotes, area, tarea{ solicitadaPorAreaId, detalle }`.
- Consumes: `agruparPorActividad`, `estadoActividad` (`@/dominio/metricas`); `COLUMNAS_CUMPLIMIENTO`, `filasCumplimientoGrupo`, `ActividadExport` (`@/dominio/cumplimiento-export`); `fechasDeSemana` (`@/dominio/semana`); `listarActividadesEstipuladas`, `listarMaquinas`, `listarResponsablesTodos`.

- [ ] **Step 1: Repo — `consultarCulminadas` sin `filtros`, con `tarea.detalle`**

Reemplazar la función `consultarCulminadas` en `src/datos/repositorio.ts` por:

```ts
// Actividades CUMPLIDA del área para la pantalla de Consulta (solo lectura): propias
// (areaId) o solicitadas por el área a otras (tarea.solicitadaPorAreaId). El filtrado y
// el agrupado por actividad se hacen en la página (datos acotados).
export function consultarCulminadas(areaId: string) {
  return prisma.actividad.findMany({
    where: {
      estado: 'CUMPLIDA',
      OR: [{ areaId }, { tarea: { solicitadaPorAreaId: areaId } }],
    },
    include: {
      responsable: true,
      finca: true,
      maquina: true,
      lotes: true,
      area: true,
      tarea: { select: { solicitadaPorAreaId: true, detalle: true } },
    },
    orderBy: [{ anio: 'desc' }, { semana: 'desc' }, { dia: 'asc' }],
  })
}
```

- [ ] **Step 2: Página — reescribir `src/app/consulta/page.tsx`**

Reemplazar TODO el contenido de `src/app/consulta/page.tsx` por:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioActual } from '@/auth/sesion'
import { puedeVer } from '@/auth/permisos'
import { listarAreas, listarActividadesEstipuladas, listarMaquinas, listarResponsablesTodos, consultarCulminadas } from '@/datos/repositorio'
import { fechasDeSemana } from '@/dominio/semana'
import { agruparPorActividad, estadoActividad } from '@/dominio/metricas'
import { COLUMNAS_CUMPLIMIENTO, filasCumplimientoGrupo, type ActividadExport } from '@/dominio/cumplimiento-export'
import type { Estado } from '@/dominio/tipos'
import type { AvanceEntrada } from '@/dominio/avance-lote'
import type { BultosPorLote } from '@/dominio/bultos'
import { FiltrosConsulta } from './filtros-consulta'

const ESTADO_IDX = COLUMNAS_CUMPLIMIENTO.indexOf('Estado')

export default async function ConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; responsable?: string; finca?: string; centro?: string; lote?: string }>
}) {
  const sp = await searchParams
  const areas = await listarAreas()
  if (areas.length === 0) {
    return (<main className="p-8"><p className="text-tierra">No hay áreas.</p></main>)
  }
  const u = await usuarioActual()
  if (!u) redirect('/login')
  if (!puedeVer(u, 'consulta')) redirect('/')
  const esAdmin = u.rol === 'ADMIN'
  const areaId = esAdmin
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
  const areaActual = areas.find((a) => a.id === areaId)!

  const [resultados, estipuladas, maquinas, responsablesTodos] = await Promise.all([
    consultarCulminadas(areaId),
    listarActividadesEstipuladas(),
    listarMaquinas(),
    listarResponsablesTodos(),
  ])

  const nombrePorMaquina = new Map(maquinas.map((m) => [m.id, m.nombre]))
  const nombreMaquina = (id: string | null) => (id ? nombrePorMaquina.get(id) ?? '' : '')
  const nombrePorResponsable = new Map(responsablesTodos.map((r) => [r.id, r.nombre]))
  const nombreResponsable = (id: string | null) => (id ? nombrePorResponsable.get(id) ?? '' : '')
  const unidadPorNombre = Object.fromEntries(estipuladas.map((e) => [e.nombre, e.unidad]))
  const fmtFecha = (f: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)

  const fResp = sp.responsable || ''
  const fFinca = sp.finca || ''
  const fCentro = sp.centro || ''
  const fLote = sp.lote || ''

  type Fila = (typeof resultados)[number]
  const aExport = (a: Fila): ActividadExport => ({
    ...a,
    bultosPorLote: a.bultosPorLote as BultosPorLote | null,
    lotesHechos: a.lotesHechos as string[] | null,
    avancePorLote: a.avancePorLote as Record<string, AvanceEntrada | AvanceEntrada[]> | null,
    detalle: a.tarea?.detalle ?? null,
  })

  const pasaFiltros = (grupo: Fila[]) =>
    (!fResp || grupo.some((a) => a.responsableId === fResp)) &&
    (!fFinca || grupo[0].fincaId === fFinca) &&
    (!fCentro || grupo.some((a) => a.centroCosto === fCentro)) &&
    (!fLote || grupo[0].lotes.some((l) => l.id === fLote))

  const filas: (string | number)[][] = []
  const agregar = (items: Fila[], ejecutadaPor: (grupo: Fila[]) => string) => {
    // Agrupar por (semana, actividad): primero se separa por semana para no mezclar
    // filas-hermanas de un mismo tareaId entre semanas distintas.
    const porSemana = new Map<string, Fila[]>()
    for (const a of items) {
      const k = `${a.anio}-${a.semana}`
      const arr = porSemana.get(k)
      if (arr) arr.push(a)
      else porSemana.set(k, [a])
    }
    for (const semItems of porSemana.values()) {
      for (const grupo of agruparPorActividad(semItems).values()) {
        if (estadoActividad(grupo.map((a) => ({ estado: a.estado as Estado }))) !== 'CUMPLIDA') continue
        if (!pasaFiltros(grupo)) continue
        const base = grupo[0]
        const fechas = fechasDeSemana(base.anio, base.semana)
        const fechaDeDia = (dia: number) => { const f = fechas[dia - 1]; return f ? fmtFecha(f) : '' }
        const grupoFilas = filasCumplimientoGrupo(
          grupo.map(aExport),
          fechaDeDia(base.dia),
          unidadPorNombre,
          { fechaDeDia, nombreMaquina, nombreResponsable },
          ejecutadaPor(grupo),
        )
        for (const fila of grupoFilas) {
          filas.push([`${base.anio}-S${base.semana}`, ...fila.filter((_, i) => i !== ESTADO_IDX)])
        }
      }
    }
  }
  agregar(resultados.filter((a) => a.areaId === areaId), () => '')
  agregar(resultados.filter((a) => a.areaId !== areaId), (grupo) => grupo[0].area?.nombre ?? '')

  const headers = ['Semana', ...COLUMNAS_CUMPLIMIENTO.filter((_, i) => i !== ESTADO_IDX)]

  // Opciones de filtros derivadas de los datos (solo valores presentes).
  const dedupe = <T extends { id: string; nombre: string }>(xs: T[]) =>
    [...new Map(xs.map((x) => [x.id, { id: x.id, nombre: x.nombre }])).values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  const responsables = dedupe(resultados.map((a) => a.responsable))
  const fincas = dedupe(resultados.map((a) => a.finca).filter((f): f is NonNullable<typeof f> => !!f))
  const lotes = dedupe(resultados.flatMap((a) => a.lotes))
  const centros = [...new Set(resultados.map((a) => a.centroCosto).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b))

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-bosque">🔎 Consulta de culminadas</h1>

      {esAdmin ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {areas.map((a) => (
            <Link key={a.id} href={`/consulta?area=${a.id}`} className={`rounded-full px-3 py-1 text-sm ${a.id === areaId ? 'bg-bosque text-white' : 'bg-arena text-tierra'}`}>
              {a.nombre}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-3 text-sm text-tierra">Área: <b className="text-tinta">{areaActual.nombre}</b></div>
      )}

      <FiltrosConsulta
        areaId={areaId}
        responsables={responsables}
        fincas={fincas}
        lotes={lotes}
        centros={centros}
        sel={{ responsable: fResp, finca: fFinca, centro: fCentro, lote: fLote }}
      />

      {filas.length === 0 ? (
        <p className="mt-4 text-sm text-tierra">No hay actividades culminadas con esos filtros.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-tierra">
                {headers.map((h) => (<th key={h} scope="col" className="p-2 whitespace-nowrap">{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i} className="border-b border-borde/60 align-top">
                  {fila.map((c, j) => (<td key={j} className="p-2">{c === '' ? '—' : c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 4: Vitest (regresión)**

Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx vitest run` → todo verde (no se tocó dominio; confirma que nada se rompió).

- [ ] **Step 5: Commit**

```bash
git add src/datos/repositorio.ts src/app/consulta/page.tsx
git commit -m "feat(consulta): resumen por actividad (estilo Excel) — agrupa por tareaId, une responsables

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras la tarea)

Server local (`next dev`) apuntando a la DB real + cookie de sesión firmada (ADMIN; ver memoria `verificacion-navegador`). SOLO LECTURA (no muta datos):

1. En un área con actividades cumplidas por **2+ responsables**, confirmar que aparece **una fila por actividad/avance** (no una por responsable), con los responsables **unidos** en la columna Responsable.
2. Columnas = Semana + las del Excel (sin Estado): Día, Fecha, Responsable, Actividad, Máquina, Lote(s), Finca, Medida realizada, Unidad, Bultos por lote, Centro de costo, Potreros realizados, Ejecutada por, Observación, Detalle.
3. **Potreros separados:** una actividad con avances en varios potreros muestra **una fila por potrero** con su medida.
4. **Solicitadas:** las que el área pidió a otra muestran la otra área en "Ejecutada por".
5. Cada filtro (responsable/finca/centro/potrero) acota a nivel de actividad (la actividad se muestra completa si matchea).

## Nota

Reutiliza dominio probado (`cumplimiento-export`, `metricas`); no se añade lógica pura nueva significativa, por eso no hay test unitario nuevo (el agrupado por semana es composición en la página). Sin cambios de esquema.

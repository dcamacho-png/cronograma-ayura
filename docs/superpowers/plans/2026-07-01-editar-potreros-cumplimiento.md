# Editar potreros de una actividad estándar Implementation Plan

> ✅ **COMPLETADO** — implementado, revisado (MERGE) y desplegado a producción (commit f497c7d, deploy cronograma-ayura-djzgsadfd); verificado por la usuaria.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Permitir editar la lista de potreros (agregar/cambiar/quitar) de una actividad estándar con potreros, en el cumplimiento, mediante un botón "Editar potreros".

**Architecture:** Una función de repositorio `setLotesGrupo` reemplaza el conjunto de potreros en todas las filas-hermanas (grupo `tareaId`) y ajusta la finca; una server action `setLotesActividadAccion` la expone respetando el guard de plazo; el control `ActividadEstandar` gana un botón + checklist para editarlos. Sin lógica de dominio nueva → sin tests unitarios; se verifica con typecheck + ejecución.

**Tech Stack:** Next.js 16 (App Router, RSC, Server Actions), Prisma, TypeScript.

## Global Constraints

- Repositorio/acciones/RSC/Client Components: se verifican con **typecheck fiable** + ejecución (convención del repo); sin tests unitarios.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- Solo estándar (`ActividadEstandar`); solo actividades con potreros (`tieneLotes`). Debe quedar ≥1 potrero. Respeta el bloqueo por plazo (`bloqueadoPorPlazoActividad`). Aplica a todas las filas-hermanas del grupo.
- Sin migración: `Actividad.lotes` (relación) y `fincaId` ya existen.

---

### Task 1: Editar potreros (repositorio + acción + página + UI)

**Files:**
- Modify: `src/datos/repositorio.ts` (nueva función `setLotesGrupo`, junto a las funciones de grupo)
- Modify: `src/app/cumplimiento/acciones.ts` (import + nueva acción `setLotesActividadAccion`)
- Modify: `src/app/cumplimiento/page.tsx` (import + pasar `editarPotreros` a `ActividadEstandar`)
- Modify: `src/app/cumplimiento/actividad-estandar.tsx` (prop + botón/checklist)

**Interfaces:**
- Consumes: `filasHermanas` (privada en repositorio), `bloqueadoPorPlazoActividad` (en acciones), `revalidatePath` (ya importado en acciones).
- Produces:
  - `setLotesGrupo(id: string, loteIds: string[]): Promise<true | null>`
  - `setLotesActividadAccion(form: FormData): Promise<void>`
  - `ActividadEstandar` gana la prop `editarPotreros: (f: FormData) => void | Promise<void>`.

- [x] **Step 1: Añadir `setLotesGrupo` al repositorio**

En `src/datos/repositorio.ts`, después de `marcarCumplidaGrupo` (la función que cierra el grupo), añadir:

```ts
// Fija los potreros (lotes) de TODA la actividad (grupo tareaId): reemplaza el conjunto
// en cada fila-hermana y ajusta la finca a la del primer potrero. Debe quedar ≥1 potrero.
export async function setLotesGrupo(id: string, loteIds: string[]) {
  const g = await filasHermanas(id)
  if (!g || loteIds.length === 0) return null
  const primer = await prisma.lote.findUnique({ where: { id: loteIds[0] } })
  if (!primer) return null
  await prisma.$transaction(
    g.filas.map((f) =>
      prisma.actividad.update({
        where: { id: f.id },
        data: { fincaId: primer.fincaId, lotes: { set: loteIds.map((lid) => ({ id: lid })) } },
      }),
    ),
  )
  return true
}
```

- [x] **Step 2: Añadir la acción `setLotesActividadAccion`**

En `src/app/cumplimiento/acciones.ts`:

(a) Añadir `setLotesGrupo` al import desde `@/datos/repositorio` (la línea que ya importa `registrarAvanceLoteGrupo, …, marcarCumplidaGrupo, registrarNovedadGrupo, reabrirGrupo`).

(b) Añadir la acción (después de `marcarCumplidaActividadAccion`):

```ts
export async function setLotesActividadAccion(form: FormData) {
  const id = texto(form, 'id')
  if (!id) return
  if (await bloqueadoPorPlazoActividad(id)) return
  const loteIds = form.getAll('loteId').map((v) => String(v))
  if (loteIds.length === 0) return
  await setLotesGrupo(id, loteIds)
  revalidatePath('/cumplimiento')
}
```

- [x] **Step 3: Pasar la acción en `page.tsx`**

En `src/app/cumplimiento/page.tsx`:

(a) Añadir `setLotesActividadAccion` al import desde `./acciones` (donde ya se importan `registrarAvanceLoteActividadAccion, …, devolverAlBancoAccion`).

(b) En el `<ActividadEstandar … />`, añadir la prop (p. ej. tras `devolverAlBanco={devolverAlBancoAccion}`):

```tsx
                            editarPotreros={setLotesActividadAccion}
```

- [x] **Step 4: Prop + control "Editar potreros" en `actividad-estandar.tsx`**

En `src/app/cumplimiento/actividad-estandar.tsx`:

(a) Añadir la prop a la firma del componente (junto a `devolverAlBanco`), en el destructuring y en el tipo:

En el destructuring, tras `devolverAlBanco,`:
```tsx
  editarPotreros,
```
En el tipo de props, tras `devolverAlBanco: (f: FormData) => void | Promise<void>`:
```tsx
  editarPotreros: (f: FormData) => void | Promise<void>
```

(b) Añadir estado, junto a `const [novedad, setNovedad] = useState(false)`:
```tsx
  const [editandoPotreros, setEditandoPotreros] = useState(false)
```

(c) En el `return` principal (el `<div className="flex flex-wrap items-end gap-3 text-sm">`), **inmediatamente después** del bloque `{tieneLotes ? (<FormAvanceLote …/>) : (<form …observación…>)}` y **antes** de `{mostrarCumplida && (…)}`, insertar:

```tsx
      {tieneLotes && (
        editandoPotreros ? (
          <form action={editarPotreros} className="flex w-full flex-col gap-2 rounded-lg border border-borde bg-arena p-2 text-xs">
            <input type="hidden" name="id" value={actividadId} />
            <span className="font-semibold text-tinta">Potreros de la actividad</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {lotesCatalogo.map((l) => (
                <label key={l.id} className="flex items-center gap-1">
                  <input type="checkbox" name="loteId" value={l.id} defaultChecked={lotesActividad.some((x) => x.id === l.id)} />
                  {l.nombre} <span className="text-tierra">({l.finca.nombre})</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg bg-bosque px-2 py-1 font-semibold text-white">Guardar potreros</button>
              <button type="button" onClick={() => setEditandoPotreros(false)} className="text-tierra underline">cancelar</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setEditandoPotreros(true)} className="text-xs text-tierra underline">
            Editar potreros
          </button>
        )
      )}
```

- [x] **Step 5: Typecheck fiable**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida (cero errores en `src/`).

- [x] **Step 6: Suite de tests sigue verde**

Run: `npm test`
Expected: PASS (no se añadieron tests; nada roto).

- [x] **Step 7: Verificación manual**

Run: `npm run dev` y abrir `/cumplimiento` en un área **estándar** (no maquinaria) con una actividad **con potreros**.
Verificar:
- Aparece "Editar potreros"; abre un checklist con los potreros del catálogo y los actuales marcados.
- Agregar / quitar / cambiar y "Guardar potreros" deja la actividad con esos potreros (recargar confirma); el avance por lote y "marcar cumplida" operan sobre la lista nueva.
- Desmarcar todos y guardar NO deja la actividad sin potreros (la acción exige ≥1).
- En una semana con **plazo vencido** (usuario de área), la edición no aplica (guard).
- En un área de **maquinaria**, no aparece "Editar potreros" (usa `DiaMaquinaria`, no `ActividadEstandar`).
Si no hay datos a mano, dejar constancia y validar en el deploy.

- [x] **Step 8: Commit**

```bash
git add src/datos/repositorio.ts src/app/cumplimiento/acciones.ts src/app/cumplimiento/page.tsx src/app/cumplimiento/actividad-estandar.tsx
git commit -m "feat(cumplimiento): editar potreros de una actividad estandar (agregar/cambiar/quitar)"
```

---

## Notas de cierre

- Los avances por lote se recalculan solos sobre los potreros vigentes; no hay limpieza de `avancePorLote`.
- Despliegue: tras revisar, seguir el flujo habitual de Vercel. El build de Vercel regenera `.next` limpio y corre el typecheck real.

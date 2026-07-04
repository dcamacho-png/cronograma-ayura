# UI de cierre + novedad unificada/editable — Implementation Plan (Entrega B, tanda 2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cablear la UI del cierre: un único "Cerrar actividad" (Cumplida con confirmación / Parcial / No se hizo + ¿reprogramar? con cambio/reemplazo), la novedad como registro único **editable**, y quitar el viejo botón "registrar novedad" que cambiaba el estado.

**Architecture:** Reusa las funciones de repo/acciones de la tanda 2a (que fijan `cerrada` y solo devuelven al banco en Reprogramada). Un componente nuevo `FormCerrar` presenta los tres cierres; para "No se hizo → cambio" reusa `PickerReemplazoPotreros` y postea a `registrarNovedadActividadAccion` (que ya arma el reemplazo). `NovedadesLista` gana edición en línea. Los componentes `ActividadEstandar`/`ActividadMaquinaria` reemplazan sus botones de cierre y quitan el viejo `FormRegistrar` de novedad.

**Tech Stack:** Next.js 16, React 19, Prisma/Postgres, TypeScript, Tailwind v4.

**Contexto de acciones (tanda 2a, ya en `master`):**
- `marcarCumplidaActividadAccion(form{id})` → CUMPLIDA + cerrada.
- `cerrarParcialAccion(form{id})` → PARCIAL + cerrada.
- `registrarNovedadActividadAccion(form{id, estado, motivoId, nota, reemplazo*})` → fija estado (NO_CUMPLIDA/REPROGRAMADA) + cerrada; solo REPROGRAMADA vuelve al banco; crea el reemplazo si hay `reemplazoDescripcion`. Lee: `estado`, `motivoId`, `nota`, y los campos de reemplazo (`reemplazoDescripcion`, `reemplazoUnidad`, `reemplazoDia`, `reemplazoLoteId[]`, `reemplazoMedida_<id>`, `reemplazoBultos_<id>`, `reemplazoMaquinaId`).
- `reabrirCierreAccion(form{id})` → cerrada=false (conserva todo).
- `agregarNovedadAccion` / `eliminarNovedadAccion` / `editarNovedadAccion(form{id,index,dia,motivoId,observacion})`.

## Global Constraints

- Ante dudas de API de Next, leer `node_modules/next/dist/docs/`.
- Typecheck fiable SOLO con: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.
- Reutilizar estilos Tailwind existentes.
- Commits en español, terminados con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `NovedadesLista` — editar novedad (✏️) + wiring

**Files:**
- Modify: `src/app/cumplimiento/novedades-lista.tsx`
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `editarNovedadAccion` (2a). Produces: `NovedadesLista` con prop `editar`.

- [ ] **Step 1: Componente — prop + edición en línea**

En `src/app/cumplimiento/novedades-lista.tsx`:
1. Añadir `editar` al destructuring y al tipo de props: `editar: (f: FormData) => void | Promise<void>`.
2. Estado para saber qué fila se edita: `const [editando, setEditando] = useState<number | null>(null)`.
3. En el `.map((e) => ...)`, cuando `editable && editando === e.index`, renderizar un mini-form de edición (prefill) en vez de la línea de texto:
```tsx
        {editable && editando === e.index ? (
          <form action={editar} onSubmit={() => setEditando(null)} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={actividadId} />
            <input type="hidden" name="index" value={e.index} />
            <label className="flex flex-col">Día
              <select name="dia" defaultValue={e.dia} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (<option key={d} value={d}>{diaLabels[d]}</option>))}
              </select>
            </label>
            <label className="flex flex-col">Motivo
              <select name="motivoId" defaultValue={e.motivoId} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
                <option value="">—</option>
                {motivos.map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
              </select>
            </label>
            <label className="flex flex-1 flex-col">Observación
              <input name="observacion" defaultValue={e.observacion} className="rounded-lg border border-borde bg-marfil p-1 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40" />
            </label>
            <button className="rounded-lg border border-bosque px-2 py-1 font-semibold text-bosque hover:bg-arena/40">Guardar</button>
            <button type="button" onClick={() => setEditando(null)} className="text-tierra underline">cancelar</button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span>{[diaLabels[e.dia] ?? '', e.motivo].filter(Boolean).join(' · ')}{e.observacion ? ` — ${e.observacion}` : ''}</span>
            {editable && (
              <>
                <button type="button" onClick={() => setEditando(e.index)} className="text-tierra hover:text-tinta" title="editar novedad">✏️</button>
                <form action={eliminar} className="inline">
                  <input type="hidden" name="id" value={actividadId} />
                  <input type="hidden" name="index" value={e.index} />
                  <button className="text-tierra hover:text-rose-700" title="borrar novedad">×</button>
                </form>
              </>
            )}
          </div>
        )}
```
   Para que el prefill de `motivoId` funcione, `Entrada` necesita `motivoId`: cambiar el tipo `Entrada` a `{ index: number; dia: number; motivoId: string; motivo: string; observacion: string }` y usar `e.motivoId` en el `defaultValue` del select. (El `motivo` sigue siendo el nombre para el texto.)
   El `key` del `.map` sigue siendo `e.index`; envolver ambos ramos en un `<div key={e.index}>`.

- [ ] **Step 2: `page.tsx` — pasar `editar` y `motivoId` en las entradas**

En `page.tsx`, donde se arma `entradasNovedad`, incluir `motivoId`:
```tsx
                  const entradasNovedad = normalizarNovedades(cab.novedades).map((n, index) => ({
                    index, dia: n.dia, motivoId: n.motivoId ?? '',
                    motivo: n.motivoId ? (mapaMotivos.get(n.motivoId) ?? '') : '',
                    observacion: n.observacion ?? '',
                  }))
```
Añadir `editarNovedadAccion` al import de `./acciones` y pasar `editar={editarNovedadAccion}` al `<NovedadesLista>`.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/novedades-lista.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): editar una novedad del log en línea (✏️)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Componente `FormCerrar` — la acción "Cerrar actividad"

**Files:**
- Create: `src/app/cumplimiento/form-cerrar.tsx`

**Interfaces:**
- Consumes: `PickerReemplazoPotreros`, `usaBultos`, `etiquetaMedida`/`normalizarUnidad` (como `FormRegistrar`).
- Produces: `FormCerrar` (client) con props:
  `{ actividadId: string; diaActividad: number; hayPotrerosPendientes: boolean; esMaquinaria: boolean; motivos: {id;nombre}[]; motivoCambioId: string | null; estipuladas: {id;nombre;unidad}[]; lotes: Lote[]; maquinas: {id;nombre}[]; cumplida: (f)=>…; cerrarParcial: (f)=>…; noSeHizo: (f)=>… }`

- [ ] **Step 1: Crear el componente**

Crear `src/app/cumplimiento/form-cerrar.tsx` (client). Estructura:
- Estado `modo: '' | 'noSeHizo'` (para desplegar el sub-form de No se hizo) y `reprogramar: boolean`, `motivoSel: string`, `reprogItems…` como en FormRegistrar para el bloque de cambio (reusar la misma lógica de `reemplazoDesc`/`reemplazoUnidadSel`/`PickerReemplazoPotreros`).
- Fila de botones:
  - **Cumplida**: `<form action={cumplida} onSubmit={(e)=>{ if (hayPotrerosPendientes && !confirm('Quedan potreros sin avance. ¿Marcar como Cumplida de todos modos?')) e.preventDefault() }}><input hidden name=id/><button>✓ Cumplida</button></form>`.
  - **Parcial**: `<form action={cerrarParcial}><input hidden name=id/><button>Cerrar como parcial</button></form>`.
  - **No se hizo**: `<button type=button onClick={()=>setModo('noSeHizo')}>No se hizo…</button>`.
- Cuando `modo==='noSeHizo'`, un `<form action={noSeHizo}>` con:
  - `<input type="hidden" name="id" value={actividadId} />`
  - `<input type="hidden" name="estado" value={reprogramar ? 'REPROGRAMADA' : 'NO_CUMPLIDA'} />`
  - casilla `¿reprogramar la próxima semana?` (state `reprogramar`).
  - `<select name="motivoId" required>` con `motivos` (incluye el motivo "cambio").
  - `<input name="nota">` (observación).
  - **Si `motivoId === motivoCambioId`** (cambio): mostrar el bloque de reemplazo idéntico al de `FormRegistrar` — selector de actividad de reemplazo (maquinaria: `estipuladas` + "Otra…"; estándar: input libre) → `reemplazoDescripcion`; unidad (maquinaria automática con hidden `reemplazoUnidad`; estándar selector); `reemplazoDia` (selector, default `diaActividad`); y `<PickerReemplazoPotreros lotes={lotes} conBultos={usaBultos(reemplazoDesc)} unidadLabel={…} />`. Reusar EXACTAMENTE los names y la lógica del bloque `{esCambio && …}` de `form-registrar.tsx` (copiarlo; es el mismo contrato que ya lee la acción).
  - botón **Cerrar (no se hizo)** + **cancelar** (`setModo('')`).

Nota de implementación: para no duplicar el bloque de cambio, se PUEDE extraer el JSX del bloque `esCambio` de `FormRegistrar` a un pequeño componente compartido `BloqueReemplazo` y usarlo aquí y (si aún existiera) allá; si resulta más simple, copiar el bloque. El implementador elige, priorizando no romper el contrato de names que lee `registrarNovedadActividadAccion`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores (el componente compila aunque aún no se use).

- [ ] **Step 3: Commit**

```bash
git add src/app/cumplimiento/form-cerrar.tsx
git commit -m "feat(cumplimiento): componente FormCerrar (Cumplida/Parcial/No se hizo + cambio)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Rewire de `ActividadEstandar` y `ActividadMaquinaria` — usar FormCerrar, quitar botón viejo, reabrir

**Files:**
- Modify: `src/app/cumplimiento/actividad-estandar.tsx`
- Modify: `src/app/cumplimiento/actividad-maquinaria.tsx`

**Interfaces:**
- Consumes: `FormCerrar` (Task 2); acciones `cerrarParcial`, `reabrirCierre` (pasadas por props desde page).
- Produces: ambos componentes con props nuevos `cerrarParcial`, `reabrirCierre`, `hayPotrerosPendientes`, `cerrada`; y sin el prop/uso `registrarNovedad`+`FormRegistrar`.

- [ ] **Step 1: `ActividadEstandar` — reemplazar botonera de cierre**

En `src/app/cumplimiento/actividad-estandar.tsx`:
1. Quitar el estado `novedad` y todo el bloque `if (novedad) { return <FormRegistrar … /> }` y el import de `FormRegistrar`.
2. En los props: quitar `registrarNovedad`; añadir `cerrarParcial: (f)=>…`, `reabrirCierre: (f)=>…`, `hayPotrerosPendientes: boolean`, `cerrada: boolean`.
3. Reemplazar la botonera inferior (el `<div className="flex flex-wrap items-center gap-3">` con "Marcar cumplida" + "registrar novedad") por `<FormCerrar … />` con las acciones y datos (para maquinaria/estándar según corresponda). Mantener "Continuar la próxima semana" (si `puedeContinuar`) y "Devolver al banco" si aplica.
4. El botón **"registrar novedad"** se elimina (el log ya se maneja en `NovedadesLista`, que se renderiza en `page.tsx`).

- [ ] **Step 2: `ActividadMaquinaria` — lo mismo**

Aplicar los mismos cambios a `src/app/cumplimiento/actividad-maquinaria.tsx` (quitar estado `novedad` + bloque FormRegistrar + import; props; botonera → `<FormCerrar esMaquinaria />`).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/actividad-estandar.tsx src/app/cumplimiento/actividad-maquinaria.tsx
git commit -m "feat(cumplimiento): Cerrar actividad (FormCerrar) reemplaza marcar-cumplida/novedad viejos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `page.tsx` — cablear acciones nuevas + flag de pendientes + reabrir

**Files:**
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `cerrarParcialAccion`, `reabrirCierreAccion` (2a); `lotesPendientes` (ya importado).

- [ ] **Step 1: Wiring**

En `src/app/cumplimiento/page.tsx`:
1. Añadir `cerrarParcialAccion, reabrirCierreAccion` al import de `./acciones`.
2. En el IIFE de la tarjeta, calcular `hayPotrerosPendientes`:
```tsx
                  const hayPotrerosPendientes = cab.lotes.length > 0 && lotesPendientes(cab.lotes, avances, cab.lotesHechos as string[] | null).length > 0
```
3. Pasar a `<ActividadEstandar>`/`<ActividadMaquinaria>` los props nuevos: `cerrarParcial={cerrarParcialAccion}`, `reabrirCierre={reabrirCierreAccion}`, `hayPotrerosPendientes={hayPotrerosPendientes}`, `cerrada={cab.cerrada}`; y quitar el prop `registrarNovedad={registrarNovedadActividadAccion}` (que ya no reciben).
4. Para una actividad **cerrada** (`cab.cerrada`), mostrar en la tarjeta un botón **"Reabrir"** (`<form action={reabrirCierreAccion}><input hidden name=id value={cab.id}/><button>Reabrir</button></form>`) junto al resumen de estado, y "Continuar la próxima semana" si es Parcial y `puedeContinuar`. (Estos van fuera del bloque `interactivo`, que ahora es false cuando `cerrada`.)

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json` → sin errores.
Run: `DB=$(grep -oE "postgresql://[^'\"]+" .claude/settings.local.json | head -1); DATABASE_URL="$DB" npx next build` → `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): cablear Cerrar/Reabrir y flag de potreros pendientes en page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación en vivo (tras todas las tareas — se despliega TODA la Entrega B junta)

Preview (`npx vercel@latest deploy --yes`) y comprobar:
1. **Novedad:** "+ Novedad" (varias, por día) se agrega, edita (✏️) y borra (×); no cambia el estado. Ya no existe el botón viejo "registrar novedad".
2. **Cerrar:** "Cerrar actividad" ofrece Cumplida (confirma si hay potreros sin avance) / Parcial / No se hizo (+¿reprogramar?). Al cerrar, la tarjeta queda **bloqueada** (solo lectura).
3. **No se hizo → reprogramar sí** vuelve al banco; **no** queda cerrada sin volver. **Cambio**: elegir motivo "cambio" muestra el reemplazo multipotrero y crea la actividad "En reemplazo de…".
4. **Reabrir** una actividad cerrada la vuelve editable conservando avances/novedades.
5. **Continuar la próxima semana** aparece en la Parcial cerrada.
6. Reportes muestran un solo "No se hizo" (ya de 2a).

Verificar en Neon la persistencia (estado, cerrada, novedades, reemplazo) y limpiar datos de prueba.

## Nota

Este plan completa la Entrega B. Al terminar y verificar, se despliega a producción TODA la Entrega B junta (tandas 1 + 2a + 2b).

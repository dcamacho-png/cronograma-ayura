# Editar/borrar avances · quitar % por actividad · día en el reemplazo — Design Spec

**Fecha:** 2026-07-03

## Objetivo

Tres ajustes en la hoja de cumplimiento (`/cumplimiento`):

- **A.** Poder **corregir o borrar** un avance ya registrado (hoy solo se pueden agregar; se acumulan y no hay forma de editarlos).
- **B.** **Quitar el `Cumplido: X%` por actividad** (el cálculo se considera erróneo; el % "bueno" se hará una sola vez en /resumen más adelante — fuera de alcance). Se mantiene el % total de la semana y los conteos.
- **C.** En la novedad de **cambio**, pedir el **día** en que se hizo la "actividad que se hizo en su lugar", para que el Excel día a día lo refleje (hoy hereda siempre el día original).

## Decisiones confirmadas (brainstorming)

- A: editar permite cambiar **cantidad + día + observación** de un avance puntual; también borrar. Borrar todos deja la actividad en Parcial (no se cierra ni se reabre). Se ubica cada avance por **potrero + posición** (las entradas no tienen id).
- B: quitar solo el % **por actividad**; mantener el % **total de la semana** (arriba) y los conteos ✅🟡🔴🔄.
- C: día solo en el bloque de reemplazo (única novedad que genera fila en el Excel).
- Fuera de alcance: rehacer el cálculo de % (irá a /resumen); editar máquina/centro/responsable de un avance (para eso, borrar y re-registrar).

## Contexto (verificado en código)

- **Modelo de avances** (`dominio/avance-lote.ts`): `AvanceEntrada = { dia; maquinaId; cantidad; centroCosto?; responsableId?; observacion? }`; `AvancePorLote = Record<loteId, AvanceEntrada[]>`. Helpers: `normalizarAvancePorLote`, `agregarAvances`, `textoAvanceConFecha`, `totalAvanceLotes`, `lotesPendientes`. No hay editar/borrar entradas.
- **Repo** (`repositorio.ts`): `registrarAvanceLoteGrupo` (l.645) lee `g.base.avancePorLote`, aplica `agregarAvances`, y escribe el JSON en **todas las filas abiertas** (`estado PENDIENTE|PARCIAL`) del grupo (`filasHermanas`, l.573). No existe edición de entradas.
- **UI avances** (`cumplimiento/page.tsx`): dentro del IIFE (≈l.219) se calcula `avances = normalizarAvancePorLote(cab.avancePorLote)` y `resumenAvances = textoAvanceConFecha(cab.lotes, avances, unidadStd, etiquetaDia)`, y se muestra como texto plano: `{resumenAvances && (<span>Avances: {resumenAvances}</span>)}` (l.256-257). `interactivo = estadoGrupo === 'PENDIENTE' || 'PARCIAL'`; `bloqueado` = plazo vencido. `DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']` (l.19). `etiquetaDia(d)` compone `"Lun 30/06"`.
- **% por actividad** (`page.tsx`): l.193 `const pctAct = porcentajeCumplimiento(dias as unknown as ActividadDominio[])`; l.213-215 span `{nDias > 1 ? `${nDias} días · ` : ''}Cumplido: <b>{pctAct === null ? '—' : `${pctAct}%`}</b>`. El **% total** de la semana usa `pct = porcentajeCumplimiento(dominio)` (l.91) mostrado en l.150 — **se mantiene** (no tocar el import de `porcentajeCumplimiento`).
- **Novedad de cambio** (`FormRegistrar`, `form-registrar.tsx`): bloque `{esCambio && (…)}`. El `FormRegistrar` **no** recibe el día de la actividad. `registrarNovedadActividadAccion` (`acciones.ts`) arma `reemplazo = { descripcion, unidad, loteIds, medida, bultos }`. `registrarNovedadGrupo` (`repositorio.ts` ≈l.800) crea la actividad "En reemplazo de…" con `dia: g.base.dia` (l.842), estado CUMPLIDA. Los componentes `ActividadEstandar`/`ActividadMaquinaria` reciben `dia` y lo pasan a otros formularios, pero **no** a `FormRegistrar`.

## Diseño

### A. Editar/borrar avances

**A.1 — Helpers puros** (`dominio/avance-lote.ts`, con tests):
- `editarAvanceEntrada(avance: AvancePorLote, loteId: string, index: number, cambios: { cantidad?: number; dia?: number; observacion?: string | null }): AvancePorLote` — copia inmutable con esa entrada modificada (solo los campos presentes en `cambios`; `observacion` vacía ⇒ se quita del objeto). Si `loteId`/`index` fuera de rango, devuelve el avance sin cambios.
- `eliminarAvanceEntrada(avance: AvancePorLote, loteId: string, index: number): AvancePorLote` — copia sin esa entrada; si el arreglo del lote queda vacío, se elimina la clave. Fuera de rango ⇒ sin cambios.

**A.2 — Repo** (`repositorio.ts`, mismo patrón que `registrarAvanceLoteGrupo`):
- `editarAvanceEntradaGrupo(id, loteId, index, cambios)`: `filasHermanas` → normaliza `g.base.avancePorLote` → `editarAvanceEntrada` → escribe el JSON en todas las filas abiertas (PENDIENTE/PARCIAL). No cambia `estado` ni `haRealizada`.
- `eliminarAvanceEntradaGrupo(id, loteId, index)`: igual con `eliminarAvanceEntrada`.

**A.3 — Acciones** (`cumplimiento/acciones.ts`):
- `editarAvanceAccion(form)`: `id`, `loteId`, `index = Number`, `cantidad = numeroOpcional ?? 0`, `dia = Number` (1..7), `observacion = textoOpcional`. Guardia `bloqueadoPorPlazoActividad`. Llama a `editarAvanceEntradaGrupo(id, loteId, index, { cantidad, dia, observacion })`. `revalidatePath('/cumplimiento')`.
- `eliminarAvanceAccion(form)`: `id`, `loteId`, `index = Number`. Guardia. `eliminarAvanceEntradaGrupo`. Revalidate.

**A.4 — UI** (nuevo componente cliente `cumplimiento/avances-editables.tsx` + `page.tsx`):
- `page.tsx`: construir, dentro del IIFE, la lista de entradas recorriendo `cab.lotes` y, por lote, sus entradas de `avances[l.id]` en orden, con su `index`:
  `entradas = cab.lotes.flatMap((l) => (avances[l.id] ?? []).map((e, index) => ({ loteId: l.id, loteNombre: l.nombre, index, dia: e.dia, cantidad: e.cantidad, observacion: e.observacion ?? '' })))`.
- Cuando `interactivo && !bloqueado`, renderizar `<AvancesEditables entradas={entradas} unidad={unidadStd} etiquetaDia=... editar={editarAvanceAccion} eliminar={eliminarAvanceAccion} />` en lugar del `<span>Avances: …</span>`. Si NO es interactivo o está bloqueado, mantener el texto plano `resumenAvances` (solo lectura).
- `AvancesEditables` (client) recibe props serializables: `entradas`, `unidad: string`, `etiquetaPorDia: string[]` (índice 1..7 → `"Lun 30/06"`, calculado en el server con las fechas de la semana) y `diaLabels: string[]` (= `DIAS`, para el `<select>`), más las dos acciones `editar`/`eliminar`.
  - Por cada entrada muestra `"{etiquetaPorDia[dia]} · {loteNombre} — {cantidad} {unidad}"` con **✏️** (abre mini-form en línea) y **×** (form que postea `eliminar` con hidden `id`,`loteId`,`index`).
  - El mini-form de editar tiene: cantidad (number), día (`<select>` con opciones 1..7 usando `diaLabels[d]`), observación (text); postea `editar` con hidden `id`,`loteId`,`index`.

### B. Quitar el % por actividad

- `page.tsx`: eliminar la línea `const pctAct = porcentajeCumplimiento(...)` (l.193). Reemplazar el span l.213-215 por, solo cuando `nDias > 1`, un badge con el conteo de días:
  `{nDias > 1 && (<span className="ml-auto rounded-lg bg-arena px-2 py-0.5 text-xs">{nDias} días</span>)}`.
- No tocar el import de `porcentajeCumplimiento` (sigue usándose en l.91 para el % total de la semana). No tocar l.150.

### C. Día en la actividad de reemplazo

- **`FormRegistrar`** (`form-registrar.tsx`): nuevo prop `diaActividad: number`. Estado `const [reemplazoDia, setReemplazoDia] = useState(String(diaActividad))`. En el bloque `{esCambio && …}` (dentro, junto al picker de potreros) añadir:
  `<label>Día <select name="reemplazoDia" value={reemplazoDia} onChange={...}>{[1,2,3,4,5,6,7].map((d) => <option key={d} value={d}>{DIAS[d]}</option>)}</select></label>`, con `const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']` local al componente.
- **`ActividadEstandar` / `ActividadMaquinaria`**: pasar `diaActividad={dia}` al `FormRegistrar` (ambos ya reciben `dia`).
- **`registrarNovedadActividadAccion`** (`acciones.ts`): leer `reemplazoDia = Number(texto(form,'reemplazoDia'))`; validar 1..7 (si no, usar `undefined`). Añadir `dia: reemplazoDia` al objeto `reemplazo`.
- **`registrarNovedadGrupo`** (`repositorio.ts`): en el tipo de `reemplazo`, añadir `dia?: number | null`. En el `create` de la actividad de reemplazo (l.842), usar `dia: reemplazo.dia ?? g.base.dia`.

## Testing

- **Dominio (Vitest):** tests para `editarAvanceEntrada` y `eliminarAvanceEntrada`:
  - editar cambia solo los campos dados (cantidad/día/observación) de la entrada (loteId,index); no muta el original; observación vacía se elimina; índice fuera de rango ⇒ sin cambios.
  - eliminar quita la entrada correcta; si el lote queda vacío se borra la clave; fuera de rango ⇒ sin cambios.
- **Repo/acciones/UI:** typecheck fiable (`npx tsc --noEmit -p tsconfig.check.json`) + `next build` + verificación en vivo (preview).
- **Manual (preview):**
  1. Registrar 2 avances de un potrero → aparecen en lista con ✏️/×; editar el primero (cantidad+día+obs) → cambia y el total se recalcula; borrar el segundo → desaparece; borrar todos → queda Parcial.
  2. Actividad cerrada / plazo vencido → la lista de avances vuelve a ser solo lectura (sin ✏️/×).
  3. Una tarjeta de actividad ya no muestra `Cumplido: X%`; el % total de la semana y los conteos siguen; "N días" aparece cuando son varios días.
  4. Novedad de cambio → el bloque de reemplazo pide **Día** (default = día de la actividad) → al guardar, la actividad "En reemplazo de…" queda en ese día (verificable en el Excel día a día).

## Fuera de alcance

- Rehacer el cálculo de % (se centralizará en /resumen en otro trabajo).
- Editar máquina / centro de costo / responsable de un avance.
- Editar avances de actividades ya CUMPLIDA/cerradas (la lista editable solo aparece en PENDIENTE/PARCIAL abiertas).

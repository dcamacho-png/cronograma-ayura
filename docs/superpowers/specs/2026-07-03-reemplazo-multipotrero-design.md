# Cambio de actividad: reemplazo con multiselección de potreros (medida + bultos) — Design Spec

**Fecha:** 2026-07-03

## Objetivo

En la novedad de **cambio** (motivo = cambio), el bloque "Actividad que se hizo en su lugar" hoy solo toma **un** potrero y no captura cantidades. Se cambia por una **multiselección de potreros por finca**, cada uno con su **valor de medida** y —en fertilización— sus **bultos**, para que el reemplazo (que puede ser fertilización o una actividad de varios potreros) quede registrado como lo hacemos en el avance.

## Decisiones confirmadas (brainstorming)

- Solo dentro del flujo de **cambio** (bloque `esCambio`); el resto de la novedad no cambia.
- **Se conserva la finca**: desplegable de finca → **lista de potreros de esa finca en multiselección**; por potrero marcado, un valor de medida (+ bultos en fertilización).
- **Fertilización** (`usaBultos`): además de la medida, **bultos** por potrero.
- **Unidad de la medida**: en **maquinaria** es automática (la del catálogo de la actividad de reemplazo elegida); en **estándar** el usuario **selecciona** la unidad (lista ampliada).
- Aplica a **maquinaria y estándar**. Fuera de alcance: máquina del reemplazo y resumen.

## Contexto (verificado en código)

- `FormRegistrar` (`src/app/cumplimiento/form-registrar.tsx`): el bloque `{esCambio && (…)}` (≈l.185-238) muestra `reemplazoDescripcion` (select de `estipuladas` + "Otra…" en maquinaria; input libre en estándar), un `SelectFincaLote name="reemplazoLoteId"` (un solo lote), y en maquinaria `reemplazoMaquinaId` + un `reemplazoMedida` único. Ya calcula `reemplazoUnidad: Unidad` a partir del catálogo (`unidadPorNombre.get(reemplazoDesc) ?? 'ha'`) y `etiquetaMedida()`. `estado`, `motivoId`, `reemplazoDesc` son estados; `esCambio = estado!=='' && motivoId===motivoCambioId`. Recibe `lotes` (catálogo) y `estipuladas` (ya filtradas a **solo maquinaria** desde `cumplimiento/page.tsx`).
- `registrarNovedadActividadAccion` (`acciones.ts`): hoy `const reemplazo = reemplazoDesc ? { descripcion: reemplazoDesc, loteId: textoOpcional(form,'reemplazoLoteId') } : null`. **No** resuelve el "Otra…" de maquinaria (guarda `'__otra__'` literal — bug), ni lee `reemplazoMaquinaId`/`reemplazoMedida`. Existe `numeroOpcional(form, clave)` y `unidadElegida(form)` (para `unidad`/`unidadOtra`).
- `registrarNovedadGrupo` (`repositorio.ts`): calcula `fincaId` desde `reemplazo?.loteId` y, si `reemplazo?.descripcion`, crea una Actividad **CUMPLIDA** ("En reemplazo de: …") con `lotes: reemplazo.loteId ? { connect: [{id}] } : undefined`. No fija medida/bultos/unidad en el reemplazo.
- `usaBultos(descripcion)` (`@/dominio/bultos`): fertilización con bultos. `PickerLotesBultos` (`tareas/picker-lotes-bultos.tsx`) es el patrón finca→checkboxes→valor (un valor por lote); no sirve tal cual porque fertilización necesita **dos** valores (medida + bultos).

## Diseño

### A. Nuevo componente `PickerReemplazoPotreros` (client)

`src/app/cumplimiento/picker-reemplazo-potreros.tsx`. Props: `lotes: {id;nombre;finca:{nombre}}[]`, `conBultos: boolean`, `unidadLabel: string`.
- Estado: `finca` (dropdown) y `sel: Record<loteId, { medida: string; bultos: string }>` (la selección persiste al cambiar de finca, por id).
- Desplegable de **finca** (fincas del catálogo) → **casillas** de los potreros de esa finca; marcar agrega/quita de `sel`.
- Por cada potrero marcado: input **medida** (etiqueta = `unidadLabel`) y —si `conBultos`— input **bultos**.
- Emite, por lote marcado: `<input type="hidden" name="reemplazoLoteId" value={id}>`, y cuando tienen valor `reemplazoMedida_<id>` y `reemplazoBultos_<id>`.

### B. `FormRegistrar` — bloque de cambio

- Reimportar `usaBultos`. Añadir estado `reemplazoUnidadSel` (para estándar; default p. ej. `'Jornales'`).
- **Maquinaria**: conservar el select `reemplazoDescripcion` + "Otra…". La unidad es **automática**: mostrar etiqueta `Medida: {etiquetaMedida(reemplazoUnidad)}` + `<input type="hidden" name="reemplazoUnidad" value={reemplazoUnidad}>`. (Se conserva `reemplazoMaquinaId` como está —sin uso—; se **quita** el `reemplazoMedida` único.)
- **Estándar**: input libre `reemplazoDescripcion` + un **selector de unidad** `<select name="reemplazoUnidad">` (lista ampliada Ha/Hora/Kg/Cantidad/Bultos/Jornales/Otro→`reemplazoUnidadOtra`), atado a `reemplazoUnidadSel`.
- En ambos, sustituir `SelectFincaLote name="reemplazoLoteId"` por `<PickerReemplazoPotreros lotes={lotes} conBultos={usaBultos(reemplazoDesc)} unidadLabel={<unidad efectiva>} />` (maquinaria: `reemplazoUnidad`; estándar: el valor de `reemplazoUnidadSel`).

### C. `registrarNovedadActividadAccion`

- Resolver descripción: `const d = texto(form,'reemplazoDescripcion'); const reemplazoDescripcion = d === '__otra__' ? texto(form,'reemplazoDescripcionOtra') : d` (arregla el bug `__otra__`).
- Resolver unidad: `reemplazoUnidad` = `texto(form,'reemplazoUnidad')`; si es `'otro'` → `texto(form,'reemplazoUnidadOtra')`; default `'ha'`.
- `reemplazoLoteIds = form.getAll('reemplazoLoteId').map(String).filter(Boolean)`; por cada uno leer `reemplazoMedida_<id>` → `medida` map y `reemplazoBultos_<id>` → `bultos` map (no nulos).
- `const reemplazo = reemplazoDescripcion ? { descripcion: reemplazoDescripcion, unidad: reemplazoUnidad, loteIds: reemplazoLoteIds, medida, bultos } : null`.
- Pasar a `registrarNovedadGrupo(id, estado, motivoId, nota, reemplazo, lotesHechos)`.

### D. `registrarNovedadGrupo` — crear el reemplazo multi-potrero

- Cambiar el tipo de `reemplazo` a `{ descripcion: string; unidad?: string | null; loteIds?: string[]; medida?: Record<string, number>; bultos?: Record<string, number> } | null`.
- `fincaId` desde `reemplazo?.loteIds?.[0]` (antes `reemplazo?.loteId`).
- En el `tx.actividad.create` del reemplazo (CUMPLIDA, "En reemplazo de…"): 
  - `lotes: reemplazo.loteIds?.length ? { connect: reemplazo.loteIds.map((id) => ({ id })) } : undefined`,
  - `...(reemplazo.medida && Object.keys(reemplazo.medida).length ? { haRealizada: Object.values(reemplazo.medida).reduce((s, n) => s + n, 0) } : {})`,
  - `...(reemplazo.unidad ? { unidadRealizada: reemplazo.unidad } : {})`,
  - `...(reemplazo.bultos && Object.keys(reemplazo.bultos).length ? { bultosPorLote: reemplazo.bultos as Prisma.InputJsonValue } : {})`.
- El resto (estado del original, reprogramación) sin cambios.

## Testing

- **Dominio (Vitest):** no hay lógica pura nueva relevante (suma de medidas es trivial en el repo). Sin tests unitarios nuevos.
- **Repo/acciones/UI:** typecheck fiable (`npx tsc --noEmit -p tsconfig.check.json`) + verificación en vivo.
- **Manual:** en una novedad con motivo **cambio**, elegir la actividad de reemplazo; el picker muestra la finca y sus potreros en multiselección; marcar varios, poner su medida (unidad automática en maquinaria / seleccionable en estándar) y, en fertilización, sus bultos → se crea la actividad "En reemplazo de…" (CUMPLIDA) con esos lotes, `haRealizada` = suma de medidas, `unidadRealizada` = la unidad, y `bultosPorLote`. El "Otra…" de maquinaria guarda el texto real (no `__otra__`).

## Fuera de alcance

- Máquina del reemplazo (`reemplazoMaquinaId` sigue sin usarse, como hoy).
- Resumen/tablero/programar y el resto de la novedad (Parcial/No cumplida/Reprogramada) no cambian.
- No se toca el catálogo ni el área del lote.

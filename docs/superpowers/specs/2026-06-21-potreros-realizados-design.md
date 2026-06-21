# Potreros realizados + centro de costo en "actividad realizada" — Design

**Fecha:** 2026-06-21
**Estado:** aprobado por la usuaria (pendiente de plan de implementación)

Dos mejoras a la pantalla de Cumplimiento, acordadas en la misma conversación:

- **Parte A (bug):** el formulario "➕ Agregar actividad realizada (no programada)" de Maquinaria no ofrece el campo **Centro de costo**; debe ofrecerlo igual que el formulario de registro.
- **Parte B (feature):** al marcar **Parcial** o **Reprogramada** en una actividad con **varios lotes**, poder marcar con checkboxes en **cuáles potreros** se realizó la actividad.

---

## Parte A — Centro de costo en "agregar actividad realizada"

### Decisión
El select "Centro de costo" (catálogo `CENTROS_COSTO` + "Otras…", opcional) ya existe en `FormRegistrar`. Falta en `FormActividadRealizada`. Se agrega ahí con el mismo patrón, **solo Maquinaria**. La actividad que crea ese formulario nace `CUMPLIDA`, así que el centro de costo se guarda en ella.

### Cambios
- `src/app/cumplimiento/form-actividad-realizada.tsx`: en la rama `esMaquinaria`, agregar el `<select name="centroCosto">` (— sin centro —, `CENTROS_COSTO`, `Otras…`) y, si `__otra__`, `<input name="centroCostoOtra">`. Importa `CENTROS_COSTO` de `@/dominio/centro-costo`. Estado local `useState` para alternar "Otras". Opcional.
- `src/app/cumplimiento/acciones.ts` (`agregarActividadRealizadaAccion`): resolver `centroCosto` igual que en `registrarAccion`:
  ```ts
  const centroSelect = texto(form, 'centroCosto')
  const centroCosto = centroSelect === '__otra__' ? textoOpcional(form, 'centroCostoOtra') : (centroSelect || null)
  ```
  y pasarlo en el objeto a `crearActividadRealizada`.
- `src/datos/repositorio.ts` (`crearActividadRealizada`): agregar `centroCosto: string | null` al tipo del parámetro `datos` y al `data` del `create` (`centroCosto: datos.centroCosto`).

---

## Parte B — Potreros realizados en Parcial/Reprogramada

### Decisiones (acordadas con la usuaria)
- **Disparador:** estado `PARCIAL` o `REPROGRAMADA` **y** la actividad tiene **más de un lote** (`a.lotes.length > 1`). No restringido a Maquinaria (aplica a cualquier actividad multi-lote; en la práctica son las de fertilización/encalada).
- **Obligatoriedad:** **opcional** (se pueden dejar todos sin marcar; no bloquea el registro).
- **Los lotes NO marcados NO vuelven al banco** — la tarea conserva su comportamiento actual (lógica de "vuelve al banco" sin cambios).
- **Visible en:** línea registrada de Cumplimiento ("· ✅ Realizados: L1, L3") y como **nueva columna "Potreros realizados"** (12ª) en el Excel.

### Dato (Prisma)
- Nueva columna en `Actividad`:
  ```prisma
  lotesHechos Json?
  ```
  Guarda un arreglo de **ids de lote** (`string[]`), subconjunto de `a.lotes`.
- Migración aditiva `prisma/migrations/20260621140000_lotes_hechos/migration.sql`:
  ```sql
  -- Potreros donde realmente se realizó la actividad (parcial/reprogramada), ids de lote
  ALTER TABLE "Actividad" ADD COLUMN "lotesHechos" JSONB;
  ```
- `Json?`: igual que `bultosPorLote`, NO acepta `null` directo de JS — para "sin dato" se **omite** el campo en el update; para guardar se castea a `Prisma.InputJsonValue`.

### Helper de dominio
- Nuevo `src/dominio/lotes-hechos.ts`:
  ```ts
  // Nombres de los lotes (en el orden de `lotes`) cuyo id está en `ids`. '' si no hay.
  export function textoLotesHechos(
    lotes: { id: string; nombre: string }[],
    ids: string[] | null | undefined,
  ): string {
    if (!ids || ids.length === 0) return ''
    return lotes.filter((l) => ids.includes(l.id)).map((l) => l.nombre).join(', ')
  }
  ```
- Test `src/dominio/lotes-hechos.test.ts` (TDD): lista en orden de `lotes`, ignora ids ajenos, `''` con null/undefined/[].

### UI — `FormRegistrar`
- Nueva prop `lotesActividad: { id: string; nombre: string }[]` (los lotes de ESA actividad; la página la pasa desde `a.lotes`).
- Cuando `(estado === 'PARCIAL' || estado === 'REPROGRAMADA') && lotesActividad.length > 1`, renderizar un bloque con un checkbox por lote:
  ```tsx
  <input type="checkbox" name="loteHecho" value={l.id} /> {l.nombre}
  ```
  Etiqueta del bloque: "¿En cuáles potreros se realizó?". Opcional (sin `required`).

### Guardado — acción + repositorio
- `registrarAccion`: `const lotesHechos = form.getAll('loteHecho').map((v) => String(v))` y pasarlo a `registrarCumplimiento` como nuevo argumento final.
- `registrarCumplimiento`: nuevo parámetro `lotesHechos: string[] = []`. En el `update`, agregar (sin romper el guardado de `centroCosto`):
  ```ts
  ...(lotesHechos.length ? { lotesHechos: lotesHechos as Prisma.InputJsonValue } : {}),
  ```
  (`Prisma` ya está importado en repositorio.ts.)

### Visualización
- `src/app/cumplimiento/page.tsx`, línea registrada: tras centro de costo,
  `{textoLotesHechos(a.lotes, a.lotesHechos as string[] | null) && <span className="text-gray-500">· ✅ Realizados: {textoLotesHechos(a.lotes, a.lotesHechos as string[] | null)}</span>}`.
- Excel — `src/dominio/cumplimiento-export.ts` (+ test) y `exportar/route.ts`:
  - `COLUMNAS_CUMPLIMIENTO`: agregar **"Potreros realizados"** como 12ª (última) columna.
  - `ActividadExport`: agregar `lotesHechos: string[] | null` (ya tiene `lotes` con id+nombre).
  - `filaCumplimiento`: agregar al final `textoLotesHechos(a.lotes, a.lotesHechos)`.
  - test: `act()` agrega `lotesHechos: null`; aserción de columnas → 12; cada fila existente suma un `''` más al final; caso nuevo con `lotesHechos` verifica `[11]`.
  - route: el spread `...a` ya trae `lotesHechos` (columna escalar Json); castear a `string[] | null` igual que `bultosPorLote`.

## Flujo de datos (Parte B)

Registrar Parcial/Reprogramada (actividad con >1 lote) → checkboxes `loteHecho` → `registrarAccion` arma `string[]` → `registrarCumplimiento` guarda `lotesHechos` → se ve "✅ Realizados: …" en pantalla y en la columna del Excel.

## Retrocompatibilidad y constraints

- Migración aditiva (columna JSONB nullable); actividades previas quedan `NULL` → en UI/Excel se ven vacías.
- `registrarCumplimiento` y `crearActividadRealizada` ganan parámetros con default → llamadas existentes siguen válidas.
- No se toca el flujo banco/reprogramación, ni Programar/grilla/Resumen.
- Despliegue: el build de Vercel corre `prisma migrate deploy` → aplica ambas migraciones aditivas.
- AGENTS.md: `FormRegistrar` y `FormActividadRealizada` son `'use client'`; seguir patrones existentes.

## Archivos

- `prisma/schema.prisma` — `lotesHechos Json?` en `Actividad`.
- `prisma/migrations/20260621140000_lotes_hechos/migration.sql` — NUEVO.
- `src/dominio/lotes-hechos.ts` (+ `.test.ts`) — NUEVO: `textoLotesHechos`.
- `src/app/cumplimiento/form-actividad-realizada.tsx` — centro de costo (Parte A).
- `src/app/cumplimiento/form-registrar.tsx` — checkboxes de potreros (Parte B).
- `src/app/cumplimiento/acciones.ts` — `agregarActividadRealizadaAccion` (centroCosto) y `registrarAccion` (lotesHechos).
- `src/datos/repositorio.ts` — `crearActividadRealizada` (centroCosto) y `registrarCumplimiento` (lotesHechos).
- `src/app/cumplimiento/page.tsx` — pasar `lotesActividad` a `FormRegistrar`; mostrar "✅ Realizados".
- `src/dominio/cumplimiento-export.ts` (+ `.test.ts`) — columna "Potreros realizados" (12ª).
- `src/app/cumplimiento/exportar/route.ts` — pasar `lotesHechos` al helper.

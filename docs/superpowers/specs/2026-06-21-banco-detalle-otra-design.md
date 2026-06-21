# Banco/solicitudes: detalle, "Otra…" en el desplegable, y lotes en mis solicitudes — Design

**Fecha:** 2026-06-21
**Estado:** aprobado por la usuaria (pendiente de plan)

Tres mejoras al flujo de banco de tareas / solicitudes en `/tareas`:

- **#1:** En "📨 Mis solicitudes a otras áreas" (vista del que solicita), mostrar los **lotes** de cada solicitud.
- **#2:** En los formularios de maquinaria, "Otra" deja de ser un campo aparte siempre visible: pasa a ser una **opción "Otra…" dentro del desplegable de actividad**; al elegirla se abre un cuadro para escribir la actividad libre (exclusión mutua catálogo vs libre).
- **#3:** Nuevo cuadro **multilínea "Detalle / instrucciones"** (campo `Tarea.detalle`) en los formularios de maquinaria (tanto al solicitar a maquinaria como en el banco propio), visible para maquinaria cuando le llega la tarea.

## Decisiones (acordadas con la usuaria)

- #2 y #3 aplican a **ambos** formularios de maquinaria: `FormNuevaTareaMaquinaria` (banco propio) y `FormSolicitar` (solicitar a maquinaria). Otras áreas (texto libre simple) no cambian.
- El detalle es un **textarea multilínea**, **opcional**.
- "Otra…" como opción del desplegable; al elegirla aparece el input de texto libre y se quita el "Otra (opcional)" siempre visible.
- El detalle NO se copia a la Actividad al asignar (queda en la `Tarea`); se ve en el banco y en "Mis solicitudes". NO se toca bultos, Programar/grilla, Resumen ni otras áreas.

## Arquitectura

### #3 — Dato: `Tarea.detalle`

- Campo nuevo en `Tarea`:
  ```prisma
  detalle String?
  ```
- Migración aditiva `prisma/migrations/20260621160000_tarea_detalle/migration.sql`:
  ```sql
  -- Detalle / instrucciones libres de la tarea (visible para el área ejecutora)
  ALTER TABLE "Tarea" ADD COLUMN "detalle" TEXT;
  ```
- `String?` acepta `null` directo → se pasa tal cual (sin omit/cast).

### #2 — "Otra…" en el desplegable (ambos formularios)

En `FormNuevaTareaMaquinaria` y `FormSolicitar` (rama maquinaria):
- El `<select name="estipulada">` gana, tras las opciones del catálogo, `<option value="__otra__">Otra…</option>`.
- Se ELIMINA el `<label>Otra (opcional)<input name="otra" …></label>` siempre visible.
- Se agrega condicional: cuando `estipulada === '__otra__'`, mostrar `<input name="otra">` ("Otra (escribe la actividad)").
- `conBultos = usaBultos(estipulada)` sigue igual: con `'__otra__'`, `usaBultos` es false → no se muestra el picker de bultos (las actividades libres no tienen bultos), se usa `SelectFincaLote`. Correcto.

### #2 — Resolución de la descripción en las acciones

`crearTareaAccion` y `crearSolicitudAccion` (en `src/app/tareas/acciones.ts`): reemplazar
```ts
const descripcion = textoOpcional(form, 'otra') ?? textoOpcional(form, 'estipulada') ?? texto(form, 'descripcion')
```
por:
```ts
const est = textoOpcional(form, 'estipulada')
const descripcion = est === '__otra__'
  ? textoOpcional(form, 'otra')
  : (est ?? textoOpcional(form, 'descripcion'))
```
- Maquinaria + catálogo → `est` es el nombre del catálogo.
- Maquinaria + "Otra…" → usa el texto de `otra` (null si vacío ⇒ no se crea, por el `if (!descripcion) return`).
- Otras áreas (sin `estipulada`) → usa el campo `descripcion`.

### #3 — Captura del detalle

- En ambos formularios de maquinaria, agregar (dentro de la rama maquinaria, p. ej. tras el bloque de lotes):
  ```tsx
  <label className="flex w-full flex-col text-sm">
    Detalle / instrucciones (opcional)
    <textarea name="detalle" rows={2} placeholder="Ej: aplicar urea, 2 bultos/ha" className="rounded border p-2 text-sm" />
  </label>
  ```
- `crearTareaAccion` / `crearSolicitudAccion`: `const detalle = textoOpcional(form, 'detalle')` y pasarlo a `crearTarea` / `crearSolicitud`.
- `crearTarea(areaId, descripcion, loteIds, bultosPorLote?, detalle?: string | null)` — nuevo parámetro final default `null`, guardado en el `data` (`detalle`).
- `crearSolicitud(areaEjecutoraId, descripcion, solicitadaPorAreaId, loteIds, bultosPorLote?, detalle?: string | null)` — ídem.

### #1 + #3 — Visualización

- `listarSolicitudesDeArea`: agregar `lotes: true` al `include` (para #1). `detalle` es escalar (Prisma lo devuelve).
- `src/app/tareas/page.tsx`:
  - **Banco "Tareas pendientes"** (cada `<li>`): bajo `<InfoLotes lotes={t.lotes} />`, si `t.detalle`, mostrar una línea: `📝 {t.detalle}` (texto pequeño, gris, respetando saltos con `whitespace-pre-line`).
  - **"Mis solicitudes a otras áreas"** (cada `<li>`): además de `descripcion · para área · estado`, mostrar los lotes (`<InfoLotes lotes={s.lotes} />`) y, si `s.detalle`, `📝 {s.detalle}`.

## Flujo de datos

Crear/solicitar (maquinaria) → desplegable (catálogo o "Otra…") + detalle (textarea) → acción resuelve descripción y lee detalle → `crearTarea`/`crearSolicitud` guardan `detalle` en la `Tarea` → maquinaria ve descripción + 📍 lotes + 📝 detalle en su banco; el solicitante ve lotes + detalle en "Mis solicitudes".

## Retrocompatibilidad y constraints

- Migración aditiva (`detalle TEXT` nullable); tareas previas quedan `NULL` → no se muestra la línea de detalle.
- `crearTarea`/`crearSolicitud` ganan parámetro con default `null` → llamadas existentes válidas.
- El cambio de "Otra" a opción del desplegable no rompe las acciones: la nueva resolución cubre catálogo, "Otra…" y texto libre de otras áreas.
- Despliegue: el build de Vercel corre `prisma migrate deploy`.
- AGENTS.md: los formularios son `'use client'`; seguir el patrón `__otra__` ya usado en `FormRegistrar`.

## Archivos

- `prisma/schema.prisma` — `detalle String?` en `Tarea`.
- `prisma/migrations/20260621160000_tarea_detalle/migration.sql` — NUEVO.
- `src/datos/repositorio.ts` — `crearTarea` (+detalle), `crearSolicitud` (+detalle), `listarSolicitudesDeArea` (+lotes).
- `src/app/tareas/acciones.ts` — `crearTareaAccion` y `crearSolicitudAccion` (resolución __otra__ + detalle).
- `src/app/tareas/form-nueva-tarea-maquinaria.tsx` — "Otra…" en el desplegable + textarea detalle.
- `src/app/tareas/form-solicitar.tsx` — "Otra…" en el desplegable + textarea detalle.
- `src/app/tareas/page.tsx` — detalle en el banco; lotes + detalle en "Mis solicitudes".

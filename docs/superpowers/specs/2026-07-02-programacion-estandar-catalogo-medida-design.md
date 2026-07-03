# Programación estándar con catálogo + lotes + medida por lote — Design Spec

**Fecha:** 2026-07-02

## Objetivo

Que la programación de un área **estándar** (no maquinaria) capture las tareas como ya lo hace maquinaria: con una **lista desplegable** de actividades (catálogo), selección de **uno o varios lotes** y, por cada lote, un **valor de medida**, más una **unidad** (Ha/Hora/Kg/Cantidad/Bultos/Jornales/Otro). Hoy el área estándar solo tiene un texto libre "Nueva tarea" + un lote opcional.

## Decisiones confirmadas (brainstorming)

- Catálogo **separado** estándar vs maquinaria (bandera en `ActividadEstipulada`).
- Medida **por cada lote** (análogo a bultos por lote de maquinaria).
- Unidad de la **lista ampliada** (Ha/Hora/Kg/Cantidad/Bultos/Jornales/Otro→texto), una por tarea.
- Lista estándar a sembrar (16): Apoyo fertilizacion; Fumigacion malezas; Fumigacion espartillo; Decepada de espartillo; Limpieza de cerca; Arreglo de cerca; Acarreo sal y concentrados; Acarreo sal; Orden y aseo; Arreglo fuga de agua; Mantenimiento bebederos; Limpieza bebederos; Limpieza arborizacion; Fumigacion arborizacion; Guadaña; Mantenimiento jardin.

## Contexto (verificado en código)

- `ActividadEstipulada` (`prisma/schema.prisma:142`): `{ id, nombre @unique, unidad @default("ha") }`. `listarActividadesEstipuladas` (`repositorio.ts:371`) devuelve todas. Se consume en: `tareas/page.tsx` (desplegable maquinaria + `FormSolicitar`), `cumplimiento` (reemplazo + mapa de unidad), `resumen`, `configuracion` (gestión), `exportar` (mapa nombre→unidad). Los mapas de unidad usan **todas**; solo los **desplegables** deben filtrar por categoría.
- `Tarea` (`schema.prisma:113`): tiene `descripcion`, `lotes` (multi `TareaLotesMulti`), `loteId`/`finca` (único), `bultosPorLote Json?`, `detalle`. No tiene medida/unidad planeada.
- **Maquinaria** (`tareas/page.tsx:93`): `FormNuevaTareaMaquinaria` = desplegable `estipuladas` + `PickerLotesBultos` (lotes + `bultos_<id>`) + detalle. **Estándar** (else): `<input name="descripcion">` libre + `SelectFincaLote` (un lote). Ambos envían a `crearTareaAccion`.
- `crearTareaAccion` (`tareas/acciones.ts:31`): resuelve descripción (`estipulada`/`otra`/`descripcion`), `loteId[]`, `bultos_<id>` → `bultos`, `detalle`; llama `crearTarea(areaId, descripcion, loteIds, bultos|null, detalle)`.
- `crearTarea` (`repositorio.ts:248`): crea la Tarea con fincaId (del primer lote), lotes connect, bultosPorLote, detalle.
- `asignarTarea` (`repositorio.ts:295`): al asignar, crea una Actividad por responsable×día copiando `descripcion`, `lotes`, `bultosPorLote`. **No** copia unidad.
- `PickerLotesBultos` (`tareas/picker-lotes-bultos.tsx`): selector multi-lote con cantidad por lote; emite `<input name="loteId">` por lote y `<input name="bultos_<id>">` si tiene valor.
- `FormSolicitar` (`tareas/form-solicitar.tsx`): al solicitar a otra área, decide `esMaquinaria` por `area.maqTareas` del ejecutor y muestra el desplegable de `estipuladas` (hoy **todas**).
- Configuración (`configuracion/page.tsx:177`, `configuracion/acciones.ts:117`): sección "Actividades de maquinaria" lista/crea/edita estipuladas; `crearActividadEstipuladaAccion` crea con `nombre`+`unidad` (normalizada).
- Despliegue: `build = prisma migrate deploy && next build` → las migraciones (SQL en `prisma/migrations/<ts>/migration.sql`) corren en cada deploy. Hay `prisma/seed.ts` (`db:seed`).

## Diseño

### A. Modelo y migración

- `ActividadEstipulada` gana **`maquinaria Boolean @default(true)`**. La migración añade la columna (los registros actuales quedan `true` = catálogo de maquinaria) e **inserta las 16 estándar** con `maquinaria=false` (unidad por defecto `'jornales'`), `ON CONFLICT (nombre) DO NOTHING`, id vía `gen_random_uuid()`.
- `Tarea` gana **`medidaPorLote Json?`** (loteId→valor) y **`unidad String?`** (unidad planeada de la tarea).
- Migración escrita a mano (mismo patrón que el repo, sin `prisma migrate dev`): `ALTER TABLE "ActividadEstipulada" ADD COLUMN "maquinaria" BOOLEAN NOT NULL DEFAULT true;` + `ALTER TABLE "Tarea" ADD COLUMN "medidaPorLote" JSONB;` + `ADD COLUMN "unidad" TEXT;` + los 16 `INSERT`.
- `prisma/seed.ts`: añadir upsert de las 16 estándar (paridad dev), sin tocar las de maquinaria.

### B. Repositorio

- `listarActividadesEstipuladas` ya devuelve el nuevo campo `maquinaria` (sin cambio de código; el tipo se propaga).
- `crearActividadEstipulada(nombre, unidad = 'ha', maquinaria = true)` — nuevo parámetro.
- `crearTarea(areaId, descripcion, loteIds, bultosPorLote = null, detalle = null, medidaPorLote = null, unidad = null)` — nuevos parámetros opcionales; guarda `medidaPorLote`/`unidad` cuando vienen.
- `asignarTarea`: al crear cada Actividad, añadir `...(tarea.unidad ? { unidadRealizada: tarea.unidad } : {})` para que la unidad planeada sea la unidad por defecto en cumplimiento.

### C. Picker reutilizable

Generalizar `PickerLotesBultos` con props opcionales **`campo = 'bultos'`** y **`placeholder = 'bultos'`**: emite `<input name={`${campo}_<id>`}>` y usa el placeholder. Maquinaria queda igual (defaults). El formulario estándar lo usa con `campo="medida"` `placeholder="medida"` → emite `medida_<id>`.

### D. Formulario estándar (nuevo `FormNuevaTareaEstandar`)

Reemplaza el bloque de texto libre del área estándar en `tareas/page.tsx`. Campos:
- **Actividad**: `<select name="estipulada">` con las estándar + `"Otra…"` → `<input name="otra">` (mismo patrón que maquinaria).
- **Unidad**: `<select name="unidad">` ampliado (Ha/Hora/Kg/Cantidad/Bultos/Jornales/Otro) + `<input name="unidadOtra">` cuando "Otro".
- **Lotes con medida**: `<PickerLotesBultos campo="medida" placeholder="medida" />`.
- **Detalle**: `<textarea name="detalle">` (opcional).
- Envía a `crearTareaAccion`.

### E. Acción compartida `crearTareaAccion`

Además de lo actual, leer:
- `medida_<id>` por cada `loteId` → `medidaPorLote` (map, valores no nulos).
- `unidad` (resuelta con la misma lógica "otro"→`unidadOtra`; helper local `unidadElegida`).

Pasar a `crearTarea(..., bultos|null, detalle, medidaPorLote|null, unidad|null)`. Maquinaria no envía `medida_*`/`unidad` (queda null); estándar no envía `bultos_*` (queda null). Sin ramas por área en la acción.

### F. Desplegables filtrados por categoría

- `tareas/page.tsx`: al `FormNuevaTareaMaquinaria` pasarle `estipuladas.filter((e) => e.maquinaria)`; al nuevo `FormNuevaTareaEstandar`, `estipuladas.filter((e) => !e.maquinaria)`.
- `FormSolicitar`: recibe `estipuladas` (todas, con la bandera) y, según `esMaquinaria` del área ejecutora, muestra `estipuladas.filter((e) => e.maquinaria === esMaquinaria)` en su desplegable.

### G. Configuración

- Formulario de crear actividad: añadir un `<select name="maquinaria">` (Estándar / Maquinaria); `crearActividadEstipuladaAccion` lee la categoría (`texto(form,'maquinaria') === 'maquinaria'`) y la pasa a `crearActividadEstipulada`.
- Listado: mostrar la categoría por fila (etiqueta "Estándar"/"Maquinaria"); renombrar el encabezado a "Actividades (catálogo)". Editar/eliminar/renombrar/unidad sin cambios.

### H. Banco de tareas (display)

En la lista de tareas pendientes (`tareas/page.tsx`), mostrar la medida planeada por lote cuando exista (texto tipo "L1: 3, L2: 2 jornales"), análogo a cómo se muestran los bultos, para referencia de planeación.

## Testing

- **Dominio (Vitest):** no hay lógica pura nueva significativa (los datos se guardan tal cual). Si se extrae un helper de texto de medida por lote para el banco, se prueba con un caso simple.
- **Repo/acciones/UI/migración:** typecheck fiable (`npx tsc --noEmit -p tsconfig.check.json`) + verificación en vivo tras desplegar.
- **Manual:** en un área **estándar**, "Agregar al banco": elegir actividad del desplegable (y "Otra…"), elegir varios lotes con su valor, unidad (probar Jornales/Otro), detalle → la tarea queda en el banco con su medida por lote y unidad; asignarla en /programar → la actividad hereda la unidad por defecto en cumplimiento. En **maquinaria**: el desplegable sigue mostrando solo las de maquinaria y los bultos siguen funcionando. En **Configuración**: crear una actividad estándar y una de maquinaria; cada desplegable de área muestra la suya. En **Solicitar** a un área de maquinaria vs estándar: el desplegable muestra la categoría correcta.

## Fuera de alcance

- El **resumen** no cambia (no totaliza la medida planeada).
- `FormSolicitar` solo corrige el **filtrado** del desplegable por categoría; no captura medida por lote (eso vive en el formulario propio del área estándar).
- No se toca maquinaria (su formulario, bultos, cumplimiento) salvo el filtrado del desplegable.
- No se migran datos existentes de `Tarea` (los nuevos campos quedan null en tareas viejas).

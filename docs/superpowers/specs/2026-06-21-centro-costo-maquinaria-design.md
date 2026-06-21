# Centro de costo en Maquinaria (Cumplimiento) — Design

**Fecha:** 2026-06-21
**Estado:** aprobado por la usuaria (pendiente de plan de implementación)

## Objetivo

Permitir asignar un **centro de costo** a cada actividad de **Maquinaria** desde la pantalla
de Cumplimiento, al registrar el cumplimiento. El centro de costo se elige de un catálogo fijo
(**Biodigestor, Ceba, Nelore, Maiz, Riego**) o se escribe libre con la opción **"Otras"**.
El dato debe quedar guardado en la actividad y aparecer en el **Excel exportado** de Cumplimiento.

## Decisiones (acordadas con la usuaria)

- **Cuándo se captura:** al registrar el cumplimiento (campo dentro de `FormRegistrar`), **solo Maquinaria**.
- **Obligatoriedad:** **opcional**, disponible en **todos los estados** (Cumplida, Parcial, No cumplida, Reprogramada).
- **Catálogo:** Biodigestor, Ceba, Nelore, Maiz, Riego, + **"Otras…"** (texto libre).
- **Valor guardado:** el texto de la opción elegida; si es "Otras", el texto escrito por la usuaria.
- **Visible en:** línea "🔒 registrada" de Cumplimiento (confirmación) y como **columna nueva en el Excel** de Cumplimiento.
- **Fuera de alcance:** Programar/grilla, Resumen, PDF, y otras áreas distintas de Maquinaria.

## Arquitectura

### 1. Dato (Prisma)

- Nueva columna en `Actividad`:
  ```prisma
  centroCosto String?
  ```
- Migración **aditiva** `prisma/migrations/20260621120000_centro_costo/migration.sql`:
  ```sql
  -- Centro de costo (texto libre o del catálogo) en actividades de maquinaria
  ALTER TABLE "Actividad" ADD COLUMN "centroCosto" TEXT;
  ```
- Es nullable y opcional; las actividades existentes quedan con `NULL`. Sin backfill.

### 2. Catálogo de dominio

- Nuevo `src/dominio/centro-costo.ts`:
  ```ts
  export const CENTROS_COSTO = ['Biodigestor', 'Ceba', 'Nelore', 'Maiz', 'Riego'] as const
  ```
- No requiere helpers con lógica (la resolución select/"Otras" se hace en la acción). Sin test propio
  (es una constante); la cobertura nueva está en el test del export (ver §5).

### 3. Captura (UI) — `src/app/cumplimiento/form-registrar.tsx`

- Solo cuando `esMaquinaria`, agregar (junto al campo de medida/ha, antes del botón Registrar):
  - `<select name="centroCosto">` con `<option value="">— sin centro —</option>`, las 5 opciones de
    `CENTROS_COSTO`, y `<option value="__otra__">Otras…</option>`.
  - Cuando el select vale `__otra__`, mostrar `<input name="centroCostoOtra">` (texto libre, no required).
- Estado local `const [centroCosto, setCentroCosto] = useState('')` para alternar el input de "Otras".
- Aparece en **todos los estados** (no depende de `estado`), y es **opcional** (sin `required`).
- Patrón idéntico al de `reemplazoDescripcion`/`__otra__` ya presente en el archivo (consistencia).

### 4. Guardado — acción + repositorio

- `src/app/cumplimiento/acciones.ts` (`registrarAccion`): resolver el valor igual que el reemplazo:
  ```ts
  const centroSelect = texto(form, 'centroCosto')
  const centroCosto = centroSelect === '__otra__' ? textoOpcional(form, 'centroCostoOtra') : (centroSelect || null)
  ```
  y pasarlo como nuevo argumento final a `registrarCumplimiento(...)`.
- `src/datos/repositorio.ts` (`registrarCumplimiento`): nuevo parámetro `centroCosto: string | null = null`
  (default null, retrocompatible con cualquier llamada existente). Incluirlo en el `update`:
  ```ts
  data: { estado, motivoId, nota: notaFinal, haRealizada: reemplazo ? null : haRealizada, centroCosto },
  ```
  (Guardar `centroCosto` tal cual; `null` cuando no se eligió. La actividad de "cambio de actividad"
  que se crea aparte NO recibe centro de costo en esta versión.)

### 5. Excel — `src/dominio/cumplimiento-export.ts` (+ test) y `exportar/route.ts`

- Agregar **"Centro de costo"** como **última columna (11ª)** de `COLUMNAS_CUMPLIMIENTO`.
- `ActividadExport` gana `centroCosto: string | null`.
- `filaCumplimiento` agrega al final del array `a.centroCosto ?? ''`.
- `cumplimiento-export.test.ts`: el helper `act(...)` agrega `centroCosto: null`; la aserción de
  `COLUMNAS_CUMPLIMIENTO` suma la 11ª columna; cada fila esperada existente suma `''` al final; y un
  caso nuevo verifica que `filaCumplimiento(act({ centroCosto: 'Biodigestor' }), ...)[10] === 'Biodigestor'`.
- `src/app/cumplimiento/exportar/route.ts`: la actividad pasada a `filaCumplimiento` ya incluye
  `centroCosto` (columna escalar que Prisma devuelve por defecto); castear si TypeScript lo pide.

### 6. Visualización en Cumplimiento — `page.tsx`

- En la línea de actividad ya registrada (bloque "🔒 registrada"), si `a.centroCosto` existe, mostrar
  `· 🏷️ {a.centroCosto}` junto al motivo/nota.

## Flujo de datos

Registrar (maquinaria, opcional) → `FormRegistrar` envía `centroCosto` (o `centroCostoOtra`) →
`registrarAccion` resuelve el texto → `registrarCumplimiento` lo guarda en `Actividad.centroCosto` →
se ve en la línea registrada y en la columna "Centro de costo" del Excel.

## Retrocompatibilidad y constraints

- Migración aditiva (columna nullable); actividades previas quedan con `NULL` → en UI/Excel se ven vacías.
- `registrarCumplimiento` mantiene compatibilidad: el nuevo parámetro tiene default `null`.
- Solo Maquinaria ve el campo; otras áreas no cambian.
- Despliegue: el build de Vercel corre `prisma migrate deploy` → aplica la migración aditiva sin pérdida.
- AGENTS.md: `FormRegistrar` es componente cliente (`'use client'`); seguir patrones existentes.

## Archivos

- `prisma/schema.prisma` — `centroCosto String?` en `Actividad`.
- `prisma/migrations/20260621120000_centro_costo/migration.sql` — NUEVO.
- `src/dominio/centro-costo.ts` — NUEVO (constante `CENTROS_COSTO`).
- `src/app/cumplimiento/form-registrar.tsx` — select + "Otras" (solo maquinaria).
- `src/app/cumplimiento/acciones.ts` — `registrarAccion` resuelve y pasa `centroCosto`.
- `src/datos/repositorio.ts` — `registrarCumplimiento` nuevo param + guarda en el update.
- `src/dominio/cumplimiento-export.ts` (+ `.test.ts`) — columna "Centro de costo" (11ª).
- `src/app/cumplimiento/exportar/route.ts` — pasar `centroCosto` al helper.
- `src/app/cumplimiento/page.tsx` — mostrar 🏷️ en la línea registrada.

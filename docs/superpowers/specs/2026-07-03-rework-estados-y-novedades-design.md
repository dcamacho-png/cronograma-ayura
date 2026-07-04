# Rework de estados de cumplimiento + historial de novedades — Design Spec (Entrega B)

**Fecha:** 2026-07-03

## Objetivo

Rediseñar el ciclo de vida de una actividad en `/cumplimiento` para que sea coherente:

- **Intermedios:** Pendiente, avances (→ Parcial) y **novedades** (razones). Se pueden ir acumulando; no son finales.
- **Cierre con elección:** una sola acción "Cerrar actividad" donde se elige el resultado final: **Cumplida** (solo si no quedan potreros pendientes), **Parcial** (se hizo algo y así queda) o **No se hizo** (con casilla "¿reprogramar la próxima semana?").
- **Historial de novedades:** una actividad puede registrar **varias** novedades (motivo + observación + día), que se acumulan y se ven en la tarjeta.

Reemplaza el modelo actual donde "Parcial" es una opción manual de novedad, "No cumplida"/"Reprogramada" son estados separados, y "Marcar cumplida" convierte una Parcial en Cumplida (lo que el usuario considera ilógico).

## Decisiones confirmadas (brainstorming)

- **Parcial solo desde avances.** Se quita "Parcial" como opción del formulario de novedad.
- **No cumplida + Reprogramada se unifican en "No se hizo"** con casilla "¿reprogramar?": sí → vuelve al banco (neutra en %); no → cerrada (0%, ya NO vuelve al banco). Internamente se conservan los estados `REPROGRAMADA` (reprogramar) y `NO_CUMPLIDA` (cerrada) para no migrar datos ni romper el %; en **pantalla y reportes** ambos se muestran como un solo bucket **"No se hizo"**.
- **Novedades = razones**, independientes del estado: "+ Novedad" (motivo + observación + día) se agrega en actividades abiertas y **no** cambia el estado. Se acumulan (log). La acción "No se hizo" y el "Cambio" también registran su razón en el log.
- **Cerrar con elección:** Cumplida / Parcial / No se hizo; **Cumplida no se ofrece si hay potreros pendientes** (lotes sin avance).
- **Sin migración de datos ni cambio de estados existentes.** Los 5 valores de `Estado` se conservan; no se reescribe data vieja. El único cambio de esquema es el campo **aditivo y nullable** `novedades Json?` en `Actividad` (Prisma genera una migración aditiva, sin backfill). El cierre-como-Parcial mantiene la actividad en `PARCIAL` (sigue siendo continuable la próxima semana). Solo `CUMPLIDA`/`NO_CUMPLIDA`/`REPROGRAMADA` son terminales-bloqueados (como hoy).

## Contexto (verificado en código)

- `Estado` (`dominio/tipos.ts`) = `PENDIENTE | CUMPLIDA | PARCIAL | NO_CUMPLIDA | REPROGRAMADA`. Se conservan los 5 valores.
- `pesoEstado` (`metricas.ts`): CUMPLIDA=1, PARCIAL=0.5, NO_CUMPLIDA=0, PENDIENTE/REPROGRAMADA=null (excluidos del %). **Ya distingue** cerrada (0%) vs reprogramada (neutra) — se conserva tal cual.
- `conteoEstadoActividades` (`metricas.ts`): devuelve `Record<Estado, number>` con los 5. El contador superior de `page.tsx` (≈l.152-154) lee `CUMPLIDA/PARCIAL/NO_CUMPLIDA/REPROGRAMADA`.
- `registrarNovedadGrupo` (`repositorio.ts` ≈l.795): hoy fija `estado` + `motivoId` + `nota`; para `NO_CUMPLIDA`/`REPROGRAMADA` devuelve la tarea al banco (`PENDIENTE`, `anioSel/semanaSel=null`, `vecesReprogramada+1`); crea la actividad de reemplazo si hay `reemplazo`.
- `marcarCumplidaGrupo` (`repositorio.ts` ≈l.700): pasa filas PENDIENTE/PARCIAL a `CUMPLIDA` con `haRealizada`=suma.
- `FormRegistrar` (`form-registrar.tsx`): select de estado con opciones No cumplida/Parcial/Reprogramada + motivo + nota + bloque de cambio (reemplazo). `ActividadEstandar`/`ActividadMaquinaria` muestran los botones "registrar/editar novedad", "✓ Marcar cumplida", "Continuar la próxima semana", "Devolver al banco".
- `avancePorLote: Record<loteId, AvanceEntrada[]>`; `lotesHechos: Json` (potreros marcados). `lotesPendientes(lotes, avancePorLote, lotesHechos)` (`avance-lote.ts`) ya calcula los potreros sin avance ni marcados.
- Reportes que muestran estado: `page.tsx` (contador + etiqueta de tarjeta vía `ESTADOS`), `resumen/resumen-area.tsx` + `dominio/resumen.ts` (`conteoPorEstado`, `ESTADOS_CAMBIO_SIEMPRE = ['NO_CUMPLIDA','REPROGRAMADA']`), `tablero/page.tsx`, `cumplimiento-export.ts` (`ESTADO_TXT`; el Excel solo emite filas CUMPLIDA/PARCIAL, así que No se hizo casi no aparece ahí).

## Diseño

### A. Historial de novedades (log)

- Nuevo campo JSON `novedades` en `Actividad`: lista de `{ dia: number; motivo: string | null; observacion: string | null }` (motivo como **nombre** snapshot, para render simple). Patrón como `avancePorLote`; se escribe en las filas abiertas del grupo.
- Helpers puros (`dominio/novedades.ts`, con tests): `agregarNovedad(lista, entrada)`, `eliminarNovedad(lista, index)`, `normalizarNovedades(json)`.
- Repo (grupo): `agregarNovedadGrupo(id, { dia, motivo, observacion })` (append en filas abiertas), `eliminarNovedadGrupo(id, index)`. Además, al fijar una novedad se **espeja la última** en `motivoId`/`nota` de la actividad (mantiene /resumen y export sin cambios). `motivoId` requiere resolver el id desde el nombre o recibirlo; el repo recibe `motivoId` + `motivoNombre` (el form envía ambos).
- Acciones: `agregarNovedadAccion`, `eliminarNovedadAccion` (con guardia de plazo + revalidate).
- UI: en la tarjeta, la sección de estado muestra la **lista** de novedades ("día · motivo · observación") con **×** para borrar cada una (solo si la actividad está abierta y sin plazo vencido). Un botón/enlace **"+ Novedad"** abre un mini-form (día + motivo [catálogo] + observación) que agrega al log sin cambiar el estado.

### B. Cierre con elección

- Reemplaza los botones "✓ Marcar cumplida" y el formulario de novedad-estado por **una acción "Cerrar actividad"** que ofrece elegir el resultado:
  - **Cumplida:** solo se ofrece si `lotesPendientes(...)` está vacío (todos los potreros con avance) o la actividad no maneja potreros. → `marcarCumplidaGrupo` (CUMPLIDA).
  - **Parcial:** fija/confirma `PARCIAL` (queda con sus avances y novedades; sigue siendo continuable la próxima semana). Nueva `cerrarParcialGrupo(id)` que setea `estado='PARCIAL'` en filas abiertas sin tocar avances.
  - **No se hizo:** casilla "¿reprogramar la próxima semana?" → marcada = `REPROGRAMADA` (devuelve al banco, como hoy); desmarcada = `NO_CUMPLIDA` (**ya NO devuelve al banco** — cambio real). Captura opcional de razón (novedad) en el mismo paso.
- El **Cambio de actividad** (reemplazo multi-potrero) pasa a ser una sub-opción del cierre "No se hizo" (motivo = cambio, con reprogramar típicamente desmarcado): el original queda `NO_CUMPLIDA` con su razón y se crea la actividad "En reemplazo de…" (toda la lógica del reemplazo multipotrero ya existente se conserva).
- Repo: dividir `registrarNovedadGrupo` de modo que "No se hizo" use `estado` NO_CUMPLIDA/REPROGRAMADA y **solo REPROGRAMADA** devuelva la tarea al banco (quitar `NO_CUMPLIDA` de la condición de devolución en ≈l.767).

### C. Estados intermedios y edición

- **Parcial** solo se alcanza por avances (o por "Cerrar → Parcial"). Se quita `PARCIAL` de las opciones del formulario de novedad.
- Se conservan: registrar avance (→Parcial), editar/borrar avances, "Continuar la próxima semana" (en Parcial), "Devolver al banco".
- `interactivo`/`bloqueado` sin cambios: editable en PENDIENTE/PARCIAL; terminal en CUMPLIDA/NO_CUMPLIDA/REPROGRAMADA.

### D. Reportes: un solo bucket "No se hizo"

- **Contador superior** (`page.tsx`): mostrar `✅ Cumplida · 🟡 Parcial · 🔴 No se hizo` donde "No se hizo" = `NO_CUMPLIDA + REPROGRAMADA`.
- **Etiqueta de estado en la tarjeta:** una actividad `NO_CUMPLIDA` o `REPROGRAMADA` muestra "No se hizo".
- **/resumen** (`resumen-area.tsx` + `resumen.ts`): en el desglose por estado, unir NO_CUMPLIDA+REPROGRAMADA en "No se hizo". `ESTADOS_CAMBIO_SIEMPRE` sin cambios (ambas siguen siendo "cambios").
- **/tablero:** unir en el conteo mostrado.
- **Excel** (`cumplimiento-export.ts`): `ESTADO_TXT` de NO_CUMPLIDA/REPROGRAMADA → "No se hizo" (aunque el Excel solo emite filas CUMPLIDA/PARCIAL, se ajusta por consistencia).
- Helper de display: `etiquetaEstado(estado): string` en `dominio/metricas.ts` (o `tipos.ts`) que devuelve "No se hizo" para ambas y el resto normal; usado por todos los puntos de arriba (DRY).

## Testing

- **Dominio (Vitest):** `novedades.ts` (agregar/eliminar/normalizar); `etiquetaEstado` (NO_CUMPLIDA y REPROGRAMADA → "No se hizo"); ajustar tests existentes de `conteoEstado`/`resumen` que asuman las etiquetas separadas.
- **Repo:** typecheck fiable (`npx tsc --noEmit -p tsconfig.check.json`); verificación de que NO_CUMPLIDA ya no devuelve al banco (test de `registrarNovedadGrupo`/nueva función si es puro; si no, verificación en vivo).
- **UI:** typecheck + `next build` + verificación en vivo (preview).
- **Manual (preview):**
  1. "+ Novedad" agrega razones a una Pendiente/Parcial sin cambiar el estado; se listan; se borran con ×.
  2. "Cerrar actividad" ofrece Cumplida solo si no hay potreros pendientes; Parcial deja la actividad en Parcial (continuable); "No se hizo" con reprogramar=sí vuelve al banco, reprogramar=no queda cerrada y NO vuelve.
  3. Contador y /resumen muestran un solo "No se hizo".
  4. El Cambio (reemplazo) sigue creando la actividad "En reemplazo de…".

## Fuera de alcance

- Rehacer el cálculo del % (sigue pendiente para /resumen).
- Bloquear/lockear una Parcial cerrada (sigue editable/continuable, por diseño).
- Log de novedades en el Excel (solo en la tarjeta por ahora).
- Migración de datos (no hay cambio de esquema salvo el campo JSON `novedades`, que es aditivo y opcional).

## Nota de esquema

`novedades Json?` es el único campo nuevo en `Actividad` (aditivo, nullable). `prisma migrate` genera una migración aditiva; sin backfill (las actividades viejas quedan sin log, con su `motivoId`/`nota` actuales intactos).

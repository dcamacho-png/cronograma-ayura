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
- **Cerrar con elección que BLOQUEA:** Cumplida / Parcial / No se hizo. Al cerrar, la actividad queda **bloqueada** (solo lectura: no admite más avances/novedades/edición), vía un nuevo campo `cerrada`. **Cumplida siempre disponible** (el usuario decide); si hay potreros pendientes al elegirla, se pide una **confirmación suave** (aviso "quedan N potreros sin avance, ¿marcar Cumplida igual?"), no un bloqueo. `haRealizada` al cerrar Cumplida = suma de lo avanzado.
- **Sin migración de datos ni cambio de estados existentes.** Los 5 valores de `Estado` se conservan; no se reescribe data vieja. Cambios de esquema: dos campos **aditivos** en `Actividad` — `novedades Json?` (log) y `cerrada Boolean @default(false)` (bloqueo de cierre). Prisma genera una migración aditiva sin backfill (los `PARCIAL` viejos quedan `cerrada=false`, editables como hoy; los terminales viejos ya eran no-interactivos por su estado).
- **Conteo del "cambio de actividad": sin cambios en esta entrega.** Un cambio seguirá generando la original como "No se hizo" (0 medida) + el reemplazo como Cumplida (su **medida sí suma** en el avance, cuenta como +1 actividad). La política de si un cambio debe penalizar el cumplimiento se decidirá junto al rework del % en /resumen (fuera de alcance).

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

**Ya construido (tanda 1, en `master`):** campo JSON `novedades` = lista de `{ dia; motivoId; observacion }` (patrón `avancePorLote`, escrito en filas abiertas); helpers `normalizarNovedades`/`agregarNovedad`/`eliminarNovedad`; repo `agregarNovedadGrupo`/`eliminarNovedadGrupo` (SIN espejo a `motivoId`/`nota` — se quitó por colisión con la nota del avance); acciones `agregarNovedadAccion`/`eliminarNovedadAccion`; componente `NovedadesLista` con "+ Novedad" (día + motivo + observación) y × borrar. Registrar una novedad NO cambia el estado. El motivo se resuelve a nombre en `page.tsx` (mapa de `motivos`).

**Lo que agrega la tanda 2 (unificación + editar):**
- **Unificar:** el "+ Novedad" es el **único** registro de novedades. Se **elimina** el viejo botón "registrar/editar novedad" (el `FormRegistrar` que cambiaba el estado). Su parte de cambio-de-estado y de reemplazo/cambio se mueve a "Cerrar actividad" (sección B).
- **Editar una novedad:** además de borrar (×), cada entrada del log tiene **✏️ editar** (día + motivo + observación), como en los avances editables. Nuevo helper `editarNovedad(lista, index, cambios)`, repo `editarNovedadGrupo(id, index, { dia, motivoId, observacion })`, acción `editarNovedadAccion`, y edición en línea en `NovedadesLista`.
- **Diseño más completo:** el mini-form de "+ Novedad" pasa a una presentación de formulario consistente con el resto (labels y estilo tipo `FormRegistrar`), no un mini-form pelado. Conserva su funcionamiento (agregar varias, cada una con su día).

### B. Cierre con elección (bloquea)

- Reemplaza los botones "✓ Marcar cumplida" y el formulario de novedad-estado por **una acción "Cerrar actividad"** que ofrece elegir el resultado y, en todos los casos, fija **`cerrada=true`** en las filas abiertas del grupo:
  - **Cumplida:** siempre disponible. Si `lotesPendientes(...)` NO está vacío (hay potreros sin avance) y la actividad maneja potreros, el botón pide **confirmación** en el navegador antes de enviar ("quedan N potreros sin avance, ¿marcar Cumplida?"). → `marcarCumplidaGrupo` (CUMPLIDA, `haRealizada`=suma de avances) + `cerrada=true`.
  - **Parcial:** deja `estado='PARCIAL'` y `cerrada=true` (queda con sus avances y novedades, **bloqueada**). Nueva `cerrarParcialGrupo(id)`.
  - **No se hizo:** casilla "¿reprogramar la próxima semana?" → marcada = `REPROGRAMADA` (devuelve al banco, como hoy) + `cerrada=true`; desmarcada = `NO_CUMPLIDA` (**ya NO devuelve al banco** — cambio real) + `cerrada=true`. Captura opcional de razón (novedad) en el mismo paso.
- El **Cambio de actividad** (reemplazo multi-potrero) pasa a ser una sub-opción del cierre "No se hizo" (motivo = cambio, reprogramar típicamente desmarcado): el original queda `NO_CUMPLIDA` + `cerrada=true` con su razón y se crea la actividad "En reemplazo de…" (toda la lógica del reemplazo multipotrero existente se conserva).
- Repo: la lógica de "No se hizo" usa `estado` NO_CUMPLIDA/REPROGRAMADA y **solo REPROGRAMADA** devuelve la tarea al banco (quitar `NO_CUMPLIDA` de la condición de devolución en ≈l.767). Todas las vías de cierre setean `cerrada=true`.
- **Reabrir** (`reabrirGrupo`, ampliado): pone `cerrada=false` **conservando** avances/novedades/estado (para corregir un cierre por error). — Nota: el `reabrirGrupo` de hoy limpia todo; se ajusta para que el "reabrir de un cierre" solo quite el bloqueo sin borrar el trabajo. (El "↩ desmarcar" que sí resetea a PENDIENTE se conserva aparte para actividades terminales sin avances.)
- **Continuar la próxima semana:** disponible en una **Parcial cerrada** (crea la actividad de la próxima semana con los potreros pendientes; no modifica la cerrada). `continuarParcialSemanaSiguiente` ya existe; solo cambia dónde se ofrece el botón (en la Parcial cerrada).

### C. Estados intermedios y edición

- **Parcial** solo se alcanza por avances (o por "Cerrar → Parcial"). Se quita `PARCIAL` de las opciones del formulario de novedad.
- Se conservan: registrar avance (→Parcial), editar/borrar avances, "Devolver al banco".
- `interactivo` pasa a ser `!cerrada && (estado === 'PENDIENTE' || estado === 'PARCIAL')`. Una vez `cerrada=true`, la tarjeta es solo lectura (sin avances/novedades/edición); muestra los avances y el log de novedades, más "Continuar la próxima semana" (si Parcial cerrada) y "Reabrir". `bloqueado` (plazo) sin cambios.

### D. Reportes: un solo bucket "No se hizo"

- **Contador superior** (`page.tsx`): mostrar `✅ Cumplida · 🟡 Parcial · 🔴 No se hizo` donde "No se hizo" = `NO_CUMPLIDA + REPROGRAMADA`.
- **Etiqueta de estado en la tarjeta:** una actividad `NO_CUMPLIDA` o `REPROGRAMADA` muestra "No se hizo".
- **/resumen** (`resumen-area.tsx` + `resumen.ts`): en el desglose por estado, unir NO_CUMPLIDA+REPROGRAMADA en "No se hizo". `ESTADOS_CAMBIO_SIEMPRE` sin cambios (ambas siguen siendo "cambios").
- **/tablero:** unir en el conteo mostrado.
- **Excel** (`cumplimiento-export.ts`): `ESTADO_TXT` de NO_CUMPLIDA/REPROGRAMADA → "No se hizo" (aunque el Excel solo emite filas CUMPLIDA/PARCIAL, se ajusta por consistencia).
- Helper de display: `etiquetaEstado(estado): string` en `dominio/metricas.ts` (o `tipos.ts`) que devuelve "No se hizo" para ambas y el resto normal; usado por todos los puntos de arriba (DRY).

## Testing

- **Dominio (Vitest):** `novedades.ts` — nuevo `editarNovedad` (cambia solo los campos dados; fuera de rango sin cambios; inmutable); `etiquetaEstado` (NO_CUMPLIDA y REPROGRAMADA → "No se hizo"); ajustar tests existentes de `conteoEstado`/`resumen` que asuman las etiquetas separadas. (agregar/eliminar/normalizar ya están de tanda 1.)
- **Repo:** typecheck fiable (`npx tsc --noEmit -p tsconfig.check.json`); verificación de que NO_CUMPLIDA ya no devuelve al banco (test de `registrarNovedadGrupo`/nueva función si es puro; si no, verificación en vivo).
- **UI:** typecheck + `next build` + verificación en vivo (preview).
- **Manual (preview):**
  1. "+ Novedad" (formulario completo) agrega razones a una Pendiente/Parcial sin cambiar el estado; se listan; cada una se **edita** (✏️) o **borra** (×). Ya no existe el viejo botón "registrar/editar novedad" que cambiaba el estado.
  2. "Cerrar actividad": Cumplida siempre elegible (con confirmación si hay potreros pendientes); al cerrar (cualquier resultado) la tarjeta queda **bloqueada** (solo lectura); "No se hizo" con reprogramar=sí vuelve al banco, reprogramar=no queda cerrada y NO vuelve.
  3. "Reabrir" una actividad cerrada quita el bloqueo conservando avances/novedades; "Continuar la próxima semana" aparece en la Parcial cerrada y crea la de la semana siguiente con los pendientes.
  4. Contador y /resumen muestran un solo "No se hizo".
  5. El Cambio (reemplazo) sigue creando la actividad "En reemplazo de…".

## Fuera de alcance

- Rehacer el cálculo del % y la política de conteo del "cambio" (van con el rework de /resumen).
- Log de novedades en el Excel (solo en la tarjeta por ahora).
- Backfill de datos viejos (no se reescribe nada).

## Nota de esquema

Dos campos nuevos en `Actividad`, ambos aditivos: `novedades Json?` (log de razones) y `cerrada Boolean @default(false)` (bloqueo de cierre). `prisma migrate` genera una migración aditiva; sin backfill — las actividades viejas quedan `cerrada=false` y sin log, con su `motivoId`/`nota`/estado intactos. Los estados terminales viejos (CUMPLIDA/NO_CUMPLIDA/REPROGRAMADA) ya eran no-interactivos por su estado, así que `cerrada=false` en ellos no los "reabre".

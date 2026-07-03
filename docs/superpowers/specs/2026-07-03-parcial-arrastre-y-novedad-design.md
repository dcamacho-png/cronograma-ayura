# Parcial: continuar la próxima semana + editar novedad estando en Parcial — Design Spec

**Fecha:** 2026-07-03

## Objetivo

Dos ajustes sobre las actividades en estado **PARCIAL** en `/cumplimiento`:

1. **Editar la novedad estando en Parcial.** Hoy el botón "registrar novedad" solo aparece cuando la actividad está PENDIENTE; una vez PARCIAL desaparece y el usuario se ve forzado a marcarla cumplida. Se abrirá el formulario también en Parcial, precargado con estado/motivo/observación actuales, para editar la novedad sin cerrar la actividad.
2. **Continuar la próxima semana.** Nuevo botón en actividades PARCIAL que crea la continuación en la semana siguiente, llevando **solo los potreros pendientes** (los que aún no tienen avance). La parcial de esta semana queda como registro histórico de lo hecho.

## Decisiones confirmadas (brainstorming)

- Botón explícito y auditable, **no** arrastre 100% automático.
- "Continuar" convive con "Devolver al banco" (este último sigue para el caso "va al banco sin fecha").
- Se llevan **solo los potreros pendientes** (sin avance). Los ya hechos quedan como histórico en la semana actual. Si la actividad no maneja potreros (medida general), se lleva completa. Si no queda nada pendiente, el botón "Continuar" no aparece.
- La parcial de esta semana **no** vuelve al banco al continuar.
- La continuación aparece en la semana siguiente como **PENDIENTE**, lista para trabajar, con sus potreros pendientes conectados.
- Fuera de alcance: tocar el flujo de `/programar`.

## Contexto (verificado en código)

- **UI actual** (`actividad-estandar.tsx` l.184-186, `actividad-maquinaria.tsx` l.118-120): el botón `registrar novedad` está envuelto en `{!esParcial && (…)}`. En Parcial la tarjeta solo ofrece: seguir avance, `✓ Marcar cumplida` y `Devolver al banco` (`{esParcial && …}`). El formulario de novedad se abre con estado local `novedad` y renderiza `<FormRegistrar … accion={registrarNovedad}/>`.
- **FormRegistrar** (`form-registrar.tsx`): `useState('')` para `estado`, `motivoId`, `reemplazoDesc`. El campo `nota` es un `<input name="nota">` **sin** `defaultValue`. No recibe valores iniciales de motivo/nota/estado.
- **registrarNovedadGrupo** (`repositorio.ts` l.733): aplica `estado`, `motivoId`, `nota` a las filas no-CUMPLIDA del grupo; **no** toca `avancePorLote` ni `haRealizada`, así que los avances registrados se conservan al editar la novedad. Solo reconecta `lotes`/`lotesHechos` si el form envía `loteHecho` (opcional).
- **devolverAlBanco** (`repositorio.ts` l.560): `tarea → PENDIENTE`, `anioSel/semanaSel = null`, `vecesReprogramada+1`. La Actividad parcial se queda en su semana.
- **Reprogramación** (`reprogramarActividad` l.134 + `datosReprogramacion` en `dominio/programacion.ts` l.113): crea una Actividad nueva en la semana destino copiando campos y fijando `origenId`; **no** copia `tareaId` ni potreros; usa guardia anti-doble por `origenId` (`findFirst({ where:{ origenId } })`).
- **Avances por lote** (`dominio/avance-lote.ts`): `avancePorLote: Record<loteId, AvanceEntrada[]>`. Un potrero "con avance" = tiene alguna entrada con `cantidad > 0`. `normalizarAvancePorLote` acepta forma vieja/nueva.
- **siguienteSemana** (`dominio/semana.ts`, ya importado en `acciones.ts`): calcula (anio, semana) siguiente con rollover de año.
- **filasHermanas** (`repositorio.ts` l.573): grupo por `tareaId+anio+semana`; `base` es la fila representativa (incluye `lotes`). La continuación se crea desde `base` (un responsable). Multi-responsable es borde: se lleva el responsable de `base`.

## Diseño

### A. Parte 1 — Editar novedad en Parcial

**`FormRegistrar`** — aceptar valores iniciales:
- Nuevos props opcionales: `estadoInicial?: string` (default `''`), `motivoInicial?: string` (default `''`), `notaInicial?: string` (default `''`).
- `useState(estadoInicial ?? '')`, `useState(motivoInicial ?? '')`; `<input name="nota" defaultValue={notaInicial}>`.

**`ActividadEstandar` / `ActividadMaquinaria`**:
- Nuevo prop `motivoActualId: string | null` (id del motivo actual de la actividad).
- Mostrar el botón de novedad **siempre** (Pendiente y Parcial), con etiqueta `registrar/editar novedad`. Es decir, quitar el `{!esParcial && …}` que lo envuelve; el `<button onClick={() => setNovedad(true)}>` queda visible en ambos estados.
- Al abrir en Parcial, pasar `estadoInicial={estado}`, `motivoInicial={motivoActualId ?? ''}`, `notaInicial={nota ?? ''}` al `FormRegistrar`. En Pendiente, no pasarlos (defaults `''`).

**`page.tsx`**: pasar `motivoActualId` = `motivoId` de la actividad a ambos componentes (ya se cargan las actividades con sus campos; añadir el dato al render).

No hay cambios en `registrarNovedadGrupo` ni en la acción `registrarNovedadActividadAccion`: editar la novedad de una parcial reusa el mismo camino (estado=PARCIAL, motivo, nota), y los avances se conservan.

### B. Parte 2 — Continuar la próxima semana

**Repo `continuarParcialSemanaSiguiente(actividadId)`** (`repositorio.ts`):
- Cargar `base = actividad.findUnique({ where:{id}, include:{ lotes:true } })`. Si no existe o `estado !== 'PARCIAL'` → `null`.
- Guardia anti-doble: `const ya = await prisma.actividad.findFirst({ where:{ origenId: id } })`; si existe → devolverla (idempotente).
- Potreros pendientes: `av = normalizarAvancePorLote(base.avancePorLote as …)`; `pendientes = base.lotes.filter((l) => (av[l.id] ?? []).every((e) => e.cantidad <= 0) )` (equivalente: sin entradas o todas en 0). Si `base.lotes.length > 0 && pendientes.length === 0` → `null` (nada que continuar).
- `fincaId` = finca del primer pendiente si hay potreros; si no, `base.fincaId`.
- `{ anio, semana } = siguienteSemana(base.anio, base.semana)`.
- Crear Actividad:
  - `anio`, `semana`, `dia: base.dia`, `descripcion`, `turno`, `areaId`, `responsableId`, `areaTareaId`, `maquinaId`, `horas`, `fincaId`,
  - `estado: 'PENDIENTE'`,
  - `unidadRealizada: base.unidadRealizada` (conserva la unidad),
  - `origenId: id`, `vecesReprogramada: base.vecesReprogramada + 1`,
  - **sin** `tareaId` (como la reprogramación; queda como actividad autónoma fuera del banco),
  - `lotes: pendientes.length ? { connect: pendientes.map((l) => ({ id: l.id })) } : undefined`,
  - `bultosPorLote`: si `base.bultosPorLote`, filtrar a las claves de `pendientes` y adjuntar si queda algo.
- La parcial original **no se modifica** (queda PARCIAL con su histórico).

**Acción `continuarParcialAccion(form)`** (`cumplimiento/acciones.ts`):
- `id = texto(form,'id')`; si `!id` → return. `if (await bloqueadoPorPlazoActividad(id)) return`.
- `await continuarParcialSemanaSiguiente(id)`; `revalidatePath('/cumplimiento')`.

**UI** (`ActividadEstandar` / `ActividadMaquinaria` + `page.tsx`):
- Nuevo prop `continuar: (f: FormData) => void | Promise<void>` y `puedeContinuar: boolean`.
- `page.tsx` calcula `puedeContinuar`: para una actividad PARCIAL, `true` si no tiene potreros (medida general) **o** si tiene al menos un potrero pendiente (mismo criterio que el repo). Para no-parcial, `false`.
- Botón (solo `esParcial && puedeContinuar`), junto a "Devolver al banco":
  `<form action={continuar}><input type="hidden" name="id" value={actividadId}/><button>Continuar la próxima semana</button></form>`.

## Testing

- **Dominio (Vitest):** la única lógica pura nueva es el filtro de potreros pendientes. Es trivial (filter sobre `avancePorLote`), pero si se extrae a un helper (`dominio/avance-lote.ts`, p. ej. `lotesPendientes(lotes, avancePorLote)`), añadir un test: potrero sin entradas ⇒ pendiente; con entrada `cantidad>0` ⇒ no; con entrada `cantidad=0` ⇒ pendiente.
- **Repo/acciones/UI:** typecheck fiable (`npx tsc --noEmit -p tsconfig.check.json`) + build + verificación en vivo (preview).
- **Manual (preview):**
  1. Editar novedad en Parcial: abrir una actividad PARCIAL → "registrar/editar novedad" visible → el form aparece con estado Parcial + motivo + observación actuales → cambiar la observación y guardar → persiste sin perder los avances ni cerrar la actividad.
  2. Continuar: una PARCIAL con parte de potreros avanzados → "Continuar la próxima semana" → en la semana siguiente aparece la actividad PENDIENTE solo con los potreros pendientes; la de esta semana sigue PARCIAL con lo hecho. Pulsar de nuevo no duplica (idempotente).
  3. Medida general (sin potreros) PARCIAL → "Continuar" lleva la actividad completa como PENDIENTE a la semana siguiente.
  4. Sin pendientes (todos los potreros con avance) → el botón "Continuar" no aparece.

## Fuera de alcance

- Arrastre automático sin acción del usuario.
- Cambios en `/programar` y en el banco de tareas.
- Fusionar/mover avances entre semanas: la continuación arranca limpia (PENDIENTE) con los potreros pendientes; no copia avances (no los hay para esos potreros).
- Multi-responsable en la continuación: se usa el responsable de la fila base.

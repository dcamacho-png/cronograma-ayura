# "+ Novedad" con bloque de cambio — Design

**Fecha:** 2026-07-04
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

En la Entrega B (tanda 2b) el viejo botón "registrar novedad" —que abría un formulario rico y, al guardar, **cambiaba el estado** de la actividad— se reemplazó por:

- **"+ Novedad"** en la tarjeta: log de **varias** novedades `{día, motivo, observación}`, editable/borrable, que **no** cambia el estado.
- **"Cerrar actividad"** (`FormCerrar`): un único cierre (Cumplida / Parcial / No se hizo + ¿reprogramar? + bloque de **cambio**).

El bloque rico ("actividad de reemplazo desde desplegable + lotes + medida + cantidades + día") quedó **solo** dentro del cierre `No se hizo → cambio`. El usuario necesita ese mismo bloque **al registrar una novedad** ("+ Novedad"), como se diligenciaba antes.

## Objetivo

Que el formulario de **"+ Novedad"** ofrezca el bloque de cambio (igual al viejo) cuando el motivo elegido es **"cambio"**, creando la actividad "En reemplazo de…" **sin** cambiar el estado de la actividad original.

## Decisiones (acordadas con el usuario)

1. **Visibilidad:** el bloque rico aparece **solo cuando el motivo = "cambio"** (`motivoCambioId`). Con otros motivos, la novedad queda simple (día + motivo + observación).
2. **Efecto en estado:** registrar la novedad **no** cambia el estado ni cierra la actividad. Solo agrega la entrada al log y —si hay cambio— crea la actividad de reemplazo. Cerrar sigue siendo aparte (`FormCerrar`).
3. **Día:** un **solo** selector de día. El día de la novedad se reutiliza como día de la actividad de reemplazo (no hay un segundo selector "día del reemplazo" en este formulario).
4. **Alcance:** aplica al **agregar** una novedad. **Editar (✏️)** una novedad existente sigue siendo simple (día/motivo/observación) y **no** re-crea ni modifica el reemplazo. (Límite explícito; se puede abordar aparte si se necesita.)

## Arquitectura

### 1. Componente compartido `BloqueReemplazo` (nuevo, client)

Se **extrae** el JSX del bloque `esCambio` que hoy vive dentro de `form-cerrar.tsx` a un componente reutilizable:

- **Archivo:** `src/app/cumplimiento/bloque-reemplazo.tsx`.
- **Responsabilidad:** renderizar los campos de reemplazo con **exactamente los mismos `name`s** que ya lee la acción de reemplazo (`reemplazoDescripcion`, `reemplazoDescripcionOtra`, `reemplazoUnidad`, `reemplazoUnidadOtra`, `reemplazoMaquinaId`, `reemplazoDia`, `reemplazoLoteId[]`, `reemplazoMedida_<id>`, `reemplazoBultos_<id>`). Maneja su propio estado interno (descripción elegida, unidad, día).
- **Props:**
  `{ esMaquinaria: boolean; estipuladas: {id;nombre;unidad}[]; lotes: Lote[]; maquinas: {id;nombre}[]; diaActividad: number; mostrarDia?: boolean }`
- `mostrarDia`:
  - `FormCerrar` → `true` (mantiene su propio selector de día, único día del cierre).
  - `NovedadesLista` "+ Novedad" → `false` (no renderiza `reemplazoDia`; el día lo aporta la novedad).

`FormCerrar` pasa a usar `<BloqueReemplazo … mostrarDia />` y deja de duplicar ese JSX/estado (se simplifica).

### 2. `NovedadesLista` (modificar)

- **Props nuevos:** `esMaquinaria: boolean`, `motivoCambioId: string | null`, `estipuladas: {id;nombre;unidad}[]`, `lotes: Lote[]`, `maquinas: {id;nombre}[]`, `diaActividad: number`.
- En el **form de agregar** ("+ Novedad"): el `select` de **Motivo** se vuelve controlado (`useState`). Cuando `motivoSel === motivoCambioId`, se renderiza `<BloqueReemplazo … mostrarDia={false} />` dentro del mismo `<form action={agregar}>`.
- El form de **editar** no cambia.

### 3. `agregarNovedadAccion` (modificar, `acciones.ts`)

- Además de `{id, dia, motivoId, observacion}`, la acción **lee los campos de reemplazo cuando llega `reemplazoDescripcion` no vacía** (que solo ocurre cuando el bloque se renderizó, es decir motivo = "cambio"), con la misma lógica que `registrarNovedadActividadAccion` (descripción + "Otra", unidad + "otro", loteIds, medida/bultos por lote). No depende de comparar `motivoId` en el servidor.
- El **día del reemplazo** se toma del `dia` de la novedad (no de `reemplazoDia`, que no se envía en este contexto).
- Construye `reemplazo = { descripcion, unidad, loteIds, medida, bultos, dia }` (o `null`) y lo pasa a `agregarNovedadGrupo`.

### 4. Repositorio (`repositorio.ts`)

- **Extraer** la creación del reemplazo (hoy embebida en `registrarNovedadGrupo`) a un helper interno:
  `crearActividadReemplazo(tx, base, reemplazo)` — crea la `Actividad` "En reemplazo de: <base.descripcion>" (CUMPLIDA, con `lotes`/`haRealizada`/`unidadRealizada`/`bultosPorLote`/`dia`).
  `registrarNovedadGrupo` pasa a llamar ese helper (comportamiento idéntico al actual).
- **`agregarNovedadGrupo`** gana un parámetro `reemplazo?` opcional. Se envuelve en una transacción `callback`: (a) escribe el log de novedades en las filas abiertas (como hoy), (b) si hay `reemplazo?.descripcion`, llama a `crearActividadReemplazo`. **No** toca `estado`/`cerrada`.

### 5. `page.tsx` (modificar)

Pasa los props nuevos a `<NovedadesLista>`: `esMaquinaria`, `motivoCambioId`, `estipuladas={estipuladasMaq}`, `lotes={lotes}`, `maquinas={maquinas}`, `diaActividad={cab.dia}`.

## Flujo de datos

```
Usuario abre "+ Novedad" → elige motivo "cambio"
  → BloqueReemplazo se despliega (actividad/lotes/medida/cantidades)
  → submit del <form action={agregarNovedadAccion}>
      → agregarNovedadAccion lee {dia, motivoId, observacion} + campos reemplazo
      → reemplazo.dia = dia de la novedad
      → agregarNovedadGrupo(id, {dia, motivoId, observacion}, reemplazo)
          → append al log de novedades (filas abiertas)
          → crearActividadReemplazo(tx, base, reemplazo)  // "En reemplazo de…", CUMPLIDA
      → revalidatePath('/cumplimiento')
```

La actividad original conserva su estado (PENDIENTE/PARCIAL). La actividad de reemplazo aparece como una tarjeta CUMPLIDA aparte en la grilla.

## Casos borde

- **Motivo ≠ cambio:** no se muestra el bloque; se guarda la novedad simple (comportamiento actual).
- **Motivo = cambio pero sin descripción de reemplazo:** se guarda la novedad simple; **no** se crea reemplazo (guardas contra `reemplazo?.descripcion` vacía). La descripción de reemplazo es `required` en la UI, pero la acción también lo valida.
- **Actividad cerrada:** "+ Novedad" no se muestra (ya es solo-lectura); sin cambios.
- **Editar/borrar una novedad de cambio:** solo afecta el log; **no** borra ni edita la actividad de reemplazo ya creada (igual que hoy el cierre tampoco enlaza su reemplazo). Límite conocido.
- **Estándar sin catálogo:** descripción libre (input), unidad por selector — igual que el bloque actual.

## Contrato de `name`s (sin cambios respecto al cierre)

`reemplazoDescripcion`, `reemplazoDescripcionOtra`, `reemplazoUnidad`, `reemplazoUnidadOtra`, `reemplazoMaquinaId`, `reemplazoLoteId` (múltiple), `reemplazoMedida_<loteId>`, `reemplazoBultos_<loteId>`. En "+ Novedad" **no** se envía `reemplazoDia` (el día lo aporta el campo `dia` de la novedad).

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- En vivo (server local + cookie firmada, escrituras reversibles con snapshot/restore):
  1. "+ Novedad" con motivo distinto de "cambio" → guarda novedad simple, sin reemplazo.
  2. "+ Novedad" con motivo "cambio" → aparece el bloque; al guardar, la novedad queda en el log **y** aparece una actividad "En reemplazo de…" CUMPLIDA; la original **sigue** en su estado (no cerrada).
  3. `FormCerrar` "No se hizo → cambio" sigue funcionando igual (usa el mismo `BloqueReemplazo`).
  - Nota: los selects controlados por React son poco fiables en headless; el flujo de "cambio" completo conviene probarlo en navegador real.

## Fuera de alcance

- Editar el bloque de cambio de una novedad ya registrada.
- Enlazar la actividad de reemplazo con la entrada del log (borrado en cascada).
- Cambios en el export de Excel o en /resumen (la actividad de reemplazo ya se contabiliza como cualquier CUMPLIDA).

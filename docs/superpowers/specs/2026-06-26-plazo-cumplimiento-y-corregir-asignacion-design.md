# Plazo de cumplimiento y corregir asignación en la parrilla

Fecha: 2026-06-26

## Contexto

Dos ajustes solicitados sobre pantallas existentes:

1. **Plazo de cumplimientos.** El registro de cumplimiento de una semana solo debe poder
   diligenciarse hasta el **fin del domingo de esa misma semana** (23:59 hora Colombia).
   Pasado ese plazo, solo el **ADMIN** puede seguir registrando/corrigiendo.
2. **Corregir una actividad mal asignada en la parrilla** (la grilla de la pantalla
   *Programar*): poder devolverla a la sección "📌 Tareas por asignar" para reasignarla.

## Hallazgos previos (reducen el trabajo)

- **El plazo equivale a `esSemanaPasada(anio, semana, semanaActual())`.** La semana ISO
  termina el domingo 23:59 y `semanaActual()` ya corre en hora de Colombia
  (`aHoraColombia`). No se necesita cálculo de fechas nuevo ni un instante "domingo 12pm":
  apenas la semana queda atrás (lunes 00:00 Colombia de la semana siguiente), está vencida.
- **"Devolver a asignar" ya existe y funciona** (`src/app/programar/grilla-semana.tsx:90`,
  acción `devolverAAsignacionAccion`, repo `devolverAAsignacion`). Borra las actividades de
  la tarea en esa semana y devuelve la tarea a `PENDIENTE`, con lo que reaparece en
  "Tareas por asignar". **Pero solo se muestra en semanas futuras** (`turnoEditable = futura`),
  por eso no aparece cuando la semana ya empezó.
- Decisión del usuario: el botón "Editar" que pidió **es el mismo "Devolver a asignar"**
  (reusar lo existente, no duplicar lógica de asignación). Por tanto **no se agrega un botón
  nuevo**; se amplía la disponibilidad del que ya hay.

## Feature 1 — Plazo de cumplimiento

### Regla
Una semana de cumplimiento está **bloqueada** cuando `esSemanaPasada(anio, semana, semanaActual())`
es verdadero, **salvo** que el usuario sea ADMIN (`u.rol === 'ADMIN'`), que nunca se bloquea.

### UI (`src/app/cumplimiento/page.tsx`)
- Calcular `bloqueado = !esAdmin && esSemanaPasada(anio, semana, semanaActual())`.
- Cuando `bloqueado`:
  - Mostrar un aviso destacado: "⛔ Plazo vencido — solo el administrador puede modificar
    el cumplimiento de esta semana." (estilo similar al aviso ámbar existente).
  - **Ocultar todos los formularios de acción**: `FormActividadRealizada`, los componentes de
    día (`DiaMaquinaria` / `DiaNoMaquinaria`), `desmarcar`, `FormAvanceLote`,
    "marcar cumplida", "devolver al banco". La semana queda en **solo lectura** (los estados y
    avances ya registrados siguen visibles).
- Navegar a semanas pasadas sigue permitido (solo lectura); el ADMIN ve todo editable.

### Servidor (defensa real) — `src/app/cumplimiento/acciones.ts`
- Guard compartido `async function bloqueado(anio: number, semana: number): Promise<boolean>`:
  carga `usuarioActual()`; devuelve `true` si el usuario no es ADMIN y
  `esSemanaPasada(anio, semana, semanaActual())`.
- Cada acción valida y hace `return` temprano si está bloqueada:
  - `agregarActividadRealizadaAccion`: ya tiene `anio`/`semana` en el form.
  - `marcarEstadoAccion`, `desmarcarAccion`, `registrarAccion`, `registrarAvanceLoteAccion`,
    `devolverAlBancoAccion`, `marcarCumplidaParcialAccion`, `reprogramarAccion`: reciben solo
    `id` de actividad → resolver su semana con un helper de repositorio
    `semanaDeActividad(id): Promise<{ anio: number; semana: number } | null>`
    (un `findUnique` que selecciona `anio, semana`). Si no se encuentra, `return`.

### Dominio / pruebas
- No hace falta función de dominio nueva: se reutiliza `esSemanaPasada`. Si para legibilidad
  se extrae un helper `plazoCumplimientoVencido(anio, semana, hoy)`, se acompaña de un test
  unitario (semana pasada → vencido; semana actual y futura → no vencido). Decisión menor a
  tomar en implementación; el comportamiento es el descrito arriba.

## Feature 2 — Corregir asignación en la parrilla

### Cambio de visibilidad (`src/app/programar/grilla-semana.tsx`)
- Mostrar "↩️ Devolver a asignar" cuando la semana **no es pasada** (en curso **o** futura),
  no solo futura. La página ya distingue `futura`; se añade el caso "semana en curso".
  Concretamente, el botón se muestra si `(futura || enCurso) && a.tareaId`.

### Salvaguarda de datos
Como en la semana en curso puede haber días ya registrados (CUMPLIDA/PARCIAL/etc.) y
`devolverAAsignacion` borra **todas** las actividades de la tarea en la semana, hay que
evitar borrar cumplimiento ya diligenciado:

- En el repositorio, `devolverAAsignacion(tareaId, anio, semana)` **rechaza** la operación si
  alguna actividad de esa tarea/semana tiene `estado !== 'PENDIENTE'` (devuelve un resultado
  tipo `{ ok: false, motivo: 'tieneRegistros' }`); solo borra y devuelve a `PENDIENTE` cuando
  todas están pendientes.
- La acción `devolverAAsignacionAccion`:
  - Relaja el guard de `esSemanaFutura` a "no pasada" (en curso o futura).
  - Si el repo responde `tieneRegistros`, redirige con un mensaje de error
    (mismo patrón `?error=` que usa `asignarTareaAccion`): "No se devolvió: la tarea ya tiene
    días registrados en cumplimiento."

### Reconciliación con la respuesta del usuario
El usuario marcó "ambos botones" y luego "Editar = Devolver a asignar". Se concluye que
**basta un botón** ("Devolver a asignar"); no se agrega un "Editar" separado, evitando
duplicación. Si tras probarlo el usuario quiere edición en línea de responsable/día, se hará
en una iteración posterior.

## Componentes y límites

- `src/dominio/semana.ts`: sin cambios funcionales (se reutiliza `esSemanaPasada`); posible
  helper de legibilidad con test.
- `src/datos/repositorio.ts`: nuevo `semanaDeActividad`; ajuste de `devolverAAsignacion`.
- `src/app/cumplimiento/acciones.ts`: guard `bloqueado` + return temprano en cada acción.
- `src/app/cumplimiento/page.tsx`: cálculo de `bloqueado`, aviso y ocultar formularios.
- `src/app/programar/grilla-semana.tsx`: visibilidad del botón en semana en curso.
- `src/app/programar/acciones.ts`: guard relajado + manejo de `tieneRegistros`.
- `src/app/programar/page.tsx`: pasar el indicador de "en curso" a la grilla si hace falta.

## Fuera de alcance (YAGNI)

- Edición en línea de responsable/día/turno en la parrilla.
- Configurar el plazo (hora/día) desde la interfaz: la regla es fija (fin de domingo).
- Notificaciones o recordatorios de plazo.

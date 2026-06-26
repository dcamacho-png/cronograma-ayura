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
  (reusar lo existente, no duplicar lógica de asignación).
- **Decisión de alcance (2026-06-26):** la grilla se edita **solo en semanas futuras** (como
  hoy). El usuario confirmó que las correcciones siempre son de la **tarea completa** y que el
  límite de edición se queda igual. En consecuencia, **Feature 2 ya está construido**
  (desde el 2026-06-21) y **no requiere ningún cambio**. Este spec queda reducido a Feature 1.

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

## Feature 2 — Corregir asignación en la parrilla (YA EXISTE, sin cambios)

El comportamiento pedido ya está implementado desde el 2026-06-21:

- En semanas **futuras**, cada actividad de la grilla con `tareaId` muestra
  "↩️ Devolver a asignar" (`src/app/programar/grilla-semana.tsx:90`).
- La acción `devolverAAsignacionAccion` → repo `devolverAAsignacion` borra las actividades de
  la tarea en esa semana y la devuelve a `PENDIENTE`, con lo que reaparece en
  "📌 Tareas por asignar" para reasignarla.
- Funciona para maquinaria y no-maquinaria; el texto del botón ya es "Devolver a asignar".

Como el usuario confirmó que (a) corrige la **tarea completa** y (b) el límite de edición se
queda en **solo semanas futuras**, este comportamiento ya satisface el requisito.
**No se requiere ningún cambio de código para Feature 2.**

## Componentes y límites

- `src/dominio/semana.ts`: sin cambios funcionales (se reutiliza `esSemanaPasada`); posible
  helper de legibilidad con test.
- `src/datos/repositorio.ts`: nuevo `semanaDeActividad`; ajuste de `devolverAAsignacion`.
- `src/app/cumplimiento/acciones.ts`: guard `bloqueado` + return temprano en cada acción.
- `src/app/cumplimiento/page.tsx`: cálculo de `bloqueado`, aviso y ocultar formularios.
- `src/app/programar/*`: **sin cambios** (Feature 2 ya existe).

## Fuera de alcance (YAGNI)

- Edición en línea de responsable/día/turno en la parrilla.
- Configurar el plazo (hora/día) desde la interfaz: la regla es fija (fin de domingo).
- Notificaciones o recordatorios de plazo.

# Tope de programación: lunes 11 pm de esa semana

**Fecha:** 2026-07-20
**Estado:** aprobado, pendiente de implementación

## Objetivo

Aflojar la restricción de horario para **programar/editar** una semana. Hoy una semana solo
es editable mientras es estrictamente **futura**: apenas llega su lunes (00:00 Colombia) queda
en solo lectura. Se cambia para que una semana se pueda programar **hasta el lunes de esa misma
semana a las 23:00 (11 pm) hora Colombia**. Así el lunes en el día todavía se puede terminar de
programar, y a las 11 pm de ese lunes se cierra.

Pedido por dcamacho (2026-07-20): "que se cumplan mejor todos los lunes antes de las 11 pm".

## Regla nueva (única)

Una semana `(anio, semana)` está **abierta a programación** mientras `ahora` sea anterior al
**lunes de esa semana a las 23:00 hora Colombia**. Consecuencias:
- Semanas **futuras**: abiertas (su lunes aún no llegó).
- Semana **actual**: abierta solo el **lunes antes de las 23:00**; el lunes 23:00 en adelante (y
  martes–domingo) queda cerrada.
- Semanas **pasadas**: cerradas.

11 pm = **23:00 Colombia** (UTC-5, sin horario de verano), fijo.

## Arquitectura

### 1. Nuevo helper de dominio — `src/dominio/semana.ts`

```ts
programacionAbierta(anio: number, semana: number, ahora?: Date): boolean
```

- Usa el helper interno existente `lunesDeIsoSemana(anio, semana)` (devuelve el lunes 00:00 UTC
  de esa semana ISO).
- Instante límite (UTC) = `lunes.getTime() + OFFSET_COLOMBIA_MS + 23h`, donde `OFFSET_COLOMBIA_MS`
  (5 h) ya existe en el archivo. Esto ubica el límite en **lunes 23:00 hora Colombia**
  (= martes 04:00 UTC).
- Devuelve `ahora.getTime() < limite`. `ahora` por defecto `new Date()`; determinista al pasarlo.
- Comparación **estricta** (`<`): exactamente a las 23:00 ya está cerrada.
- Se **agrega** esta función; `esSemanaFutura`/`esSemanaPasada` se **conservan** intactas (las
  usan otras pantallas / `plazoCumplimientoVencido`).

### 2. Aplicación de la regla — reemplaza las dos reglas que hoy coexisten

**UI** — `src/app/programar/page.tsx`:
- Línea ~56: `const futura = esSemanaFutura(anio, semana, hoy)` → `const programable = programacionAbierta(anio, semana)`.
- Renombrar la variable local `futura` → `programable` en sus usos (`turnoEditable`, prop de
  `GrillaTractor`, bloque "Tareas por asignar", banner).
- `src/app/programar/grilla-tractor.tsx`: renombrar el prop `futura` → `programable` (un componente
  + su call site) para que no quede mal nombrado. `grilla-semana.tsx` ya usa el prop genérico
  `turnoEditable`, no cambia de nombre.

**Servidor** — `src/app/programar/acciones.ts` (unificar TODO al mismo tope):
- Los guards que hoy exigen semana estrictamente futura pasan a `programacionAbierta(anio, semana)`:
  `actualizarActividadAccion`, `devolverAAsignacionAccion`, `devolverGrillaAlBancoAccion`,
  `devolverActividadAlBancoAccion`, `dedicarTractorAccion`, `crearNovedadResponsableAccion`,
  `eliminarNovedadResponsableAccion`.
- Los guards de crear/asignar que hoy solo bloquean semana **pasada** (`esSemanaPasada`) pasan
  **también** a `programacionAbierta`: `crearActividadAccion`, `duplicarSemanaAccion`,
  `asignarTareaAccion`. Esto cierra el hueco actual (un POST crafteado podía crear en la semana
  en curso cualquier día) y unifica la regla. Los checks finos por día (`esDiaPasado`) se
  **mantienen** como filtro adicional.
- La autorización por rol/área (`puedeMutarArea`, VISOR bloqueado) no cambia. **ADMIN no gana
  bypass** del tope en programar (igual que hoy).

**Servidor** — `src/app/tareas/acciones.ts` (mismo tope, decisión 2026-07-20):
- `programarTareaAccion` (línea ~242): agendar una tarea del banco a una semana
  (`seleccionarTarea`) también pasa de `esSemanaFutura` a `programacionAbierta(anio, semana)`, para
  que "programar en una semana" use la misma regla en /tareas y en /programar.

### 3. Texto del candado — `src/app/programar/page.tsx` (~línea 148)

De *"🔒 Esta semana ya empezó — solo lectura. La programación se hace antes del lunes de inicio de
la semana."* a un texto acorde a la regla nueva, p. ej.:
*"🔒 El plazo para programar esta semana venció (lunes 11 pm). Ahora es solo lectura."*

## Pruebas — `src/dominio/semana.test.ts`

Casos deterministas de `programacionAbierta(anio, semana, ahora)` con instantes UTC fijos
(recordar: lunes 23:00 COT = martes 04:00 UTC):
- Semana **futura** (su lunes en el futuro respecto a `ahora`) → `true`.
- Semana actual, **lunes 22:59 COT** (martes 03:59 UTC) → `true`.
- Semana actual, **lunes 23:00 COT** exacto (martes 04:00 UTC) → `false` (borde estricto).
- Semana actual, **lunes 23:01 COT** → `false`.
- Semana actual, **martes** → `false`.
- Semana **pasada** → `false`.

Todos los tests existentes de `semana.test.ts` y del resto del proyecto siguen verdes (la función
es aditiva).

## Verificación

- `npm test` (Vitest) — nuevos tests + regresión.
- `npx next build` — compila (el `npm run build` local falla por `DIRECT_URL` ausente; usar
  `npx next build`).
- Manual/navegador tras deploy: en la semana en curso, el lunes antes de las 11 pm la grilla de
  programar está editable; después, en solo lectura. (No bloqueante para el merge; se verifica en
  vivo con la usuaria.)

## Fuera de alcance (YAGNI)

- No se toca el plazo de **cumplimiento** (`plazoCumplimientoVencido`).
- No se borra `esSemanaFutura`/`esSemanaPasada`: la función se conserva (la usan `semana.test.ts`,
  `plazoCumplimientoVencido` y `esSemanaPasada`), solo se cambian los call sites de programar +
  el de `programarTareaAccion`.
- Sin bypass de ADMIN en programar.
- Sin configurabilidad de la hora (23:00 fijo).

Relacionado: [[bloqueo-semana-futura-y-editar-turno]], `src/dominio/semana.ts`.

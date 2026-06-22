# Programar/editar solo en semanas futuras (bloqueo desde el lunes) — Design

**Fecha:** 2026-06-21
**Estado:** aprobado por la usuaria (pendiente de plan)

Una sola regla con dos efectos, todos sobre el mismo umbral (**el lunes de inicio de cada semana**):

- **Programar actividades** (asignar en Programar y earmarcar en el banco) se permite SOLO mientras la semana **no haya empezado** (es futura).
- **Editar el turno** de una actividad en la grilla se permite SOLO en semanas futuras.
- Desde el lunes de esa semana en adelante (semana **presente** y pasadas) ambas cosas quedan bloqueadas; la grilla muestra el turno como texto. **Cumplimiento sigue funcionando aparte** (registrar lo que pasó en presente/pasadas no cambia).

Sin migración (cambios de lógica/UI).

## Decisiones (acordadas con la usuaria)

- Umbral único: **semana futura** = estrictamente posterior a la semana ISO actual. Presente y pasadas = bloqueadas para programar y editar turno.
- Editar turno: re-introducir un control editable de turno en la grilla, visible solo en semanas futuras; conserva la descripción (solo cambia el turno).
- Las tareas ya programadas a la semana presente quedan sin poder asignarse (ventana pasada); se pueden "Devolver al banco" y reprogramar a una futura. Aceptado.

## Arquitectura

### Helper de dominio (TDD)

`src/dominio/semana.ts`:
```ts
// ¿La semana (anio, semana) es estrictamente posterior a la de referencia?
export function esSemanaFutura(anio: number, semana: number, referencia: Semana): boolean {
  return anio > referencia.anio || (anio === referencia.anio && semana > referencia.semana)
}
```
Test `src/dominio/semana.test.ts`: futura → true; misma semana → false; pasada → false; año siguiente → true; año anterior → false.

### 1. Programar — asignar solo en semanas futuras

`src/app/programar/page.tsx`:
- Importar `esSemanaFutura` (y quitar `esSemanaPasada` del import si queda sin uso).
- Reemplazar `const pasada = esSemanaPasada(anio, semana, hoy)` por `const futura = esSemanaFutura(anio, semana, hoy)`.
- El banner pasa a mostrarse cuando `!futura` (presente o pasada), con texto: `🔒 Esta semana ya empezó — solo lectura. La programación se hace antes del lunes de inicio de la semana.`
- La sección "📌 Tareas por asignar" se muestra con `{futura && porAsignar.length > 0 && (…)}`.
- (Pasa además `turnoEditable={futura}` a `GrillaSemana` — ver §3.)
- `diasPasados` no cambia (en una semana futura queda vacío).

### 2. Banco — "Programar para" solo semanas futuras

`src/app/tareas/page.tsx`:
- Construir la lista `semanas` empezando en la **próxima** semana (8 futuras), sin incluir la actual:
  ```ts
  const semanas: { anio: number; semana: number }[] = []
  let w = siguienteSemana(semanaActual().anio, semanaActual().semana)
  for (let i = 0; i < 8; i++) {
    semanas.push(w)
    w = siguienteSemana(w.anio, w.semana)
  }
  ```
- En la `<option>` del selector, quitar el sufijo `(esta)` (ya no hay semana actual en la lista): `Semana {s.semana} · {s.anio}`.
- Se conserva la lógica `opciones.unshift(...)` que mantiene visible la semana ya seleccionada de una tarea (p. ej. si quedó en la presente).

`src/app/tareas/acciones.ts` (`programarTareaAccion`):
- Importar `esSemanaFutura` (junto a `esSemanaPasada`, `semanaActual`).
- Guard antes de `seleccionarTarea`: si la semana elegida no es futura, no programar:
  ```ts
    if (Number.isInteger(anio) && Number.isInteger(semana)) {
      if (!esSemanaFutura(anio, semana, semanaActual())) return
      await seleccionarTarea(id, anio, semana)
    }
  ```

### 3. Grilla — turno editable solo en semanas futuras

`src/app/programar/grilla-semana.tsx` (Server Component, compartido con el PDF):
- Importar la acción: `import { actualizarActividadAccion } from './acciones'`.
- Nueva prop opcional `turnoEditable: boolean` con **default `false`** (así el PDF y la descarga de imagen, que no la pasan, siguen mostrando texto).
- Reemplazar `{a.turno && <div className="text-xs text-gray-500">{a.turno}</div>}` por:
  ```tsx
  {turnoEditable ? (
    <form action={actualizarActividadAccion} className="mt-0.5 flex items-center gap-1">
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="descripcion" value={a.descripcion} />
      <input name="turno" defaultValue={a.turno} className="w-20 rounded border p-0.5 text-xs" />
      <button className="rounded bg-[#11603a] px-1.5 text-xs font-semibold text-white">✓</button>
    </form>
  ) : (
    a.turno && <div className="text-xs text-gray-500">{a.turno}</div>
  )}
  ```
  (`actualizarActividadAccion(form)` ya existe: lee `id`/`descripcion`/`turno` y llama `actualizarActividad`; conserva la descripción vía el hidden y solo cambia el turno.)
- `programar/page.tsx` pasa `turnoEditable={futura}`. `programar/exportar/page.tsx` NO la pasa (default false) → no se toca.

## Flujo

Semana futura → en /tareas se puede "Programar para" esa semana → en /programar aparece "Tareas por asignar" y se asigna; en la grilla el turno es editable (✓). Al llegar el lunes de esa semana (se vuelve presente) → /programar muestra "🔒 solo lectura", el banco ya no la ofrece, y la grilla muestra el turno como texto.

## Retrocompatibilidad y constraints

- Sin migración.
- `esSemanaFutura` es aditivo; `esSemanaPasada`/`esDiaPasado`/`semanaActual` no cambian.
- `GrillaSemana.turnoEditable` default `false` → PDF, descarga de imagen y semanas presente/pasada sin cambios visuales (texto).
- `actualizarActividadAccion` ya existía (sin uso en UI hasta ahora); se reutiliza tal cual.
- Cumplimiento, Resumen, Tablero y otras áreas: sin cambios.
- Despliegue: build de Vercel (sin migración nueva).
- AGENTS.md: `GrillaSemana` server component; el `<form>` inline con server action funciona sin `'use client'`.

## Notas / fuera de alcance

- La descarga de imagen (PNG) de una semana futura capturaría los campos de turno editables (inputs) en vez de texto. Es una semana de planeación; aceptable. No se cambia.
- Tareas ya programadas a la semana presente: no asignables (ventana pasada); usar "Devolver al banco"/reprogramar a futura.

## Archivos

- `src/dominio/semana.ts` (+`.test.ts`) — `esSemanaFutura`.
- `src/app/programar/page.tsx` — gate `futura` (banner + asignar) + `turnoEditable`.
- `src/app/tareas/page.tsx` — selector de semanas solo futuras.
- `src/app/tareas/acciones.ts` — guard futura en `programarTareaAccion`.
- `src/app/programar/grilla-semana.tsx` — turno editable (prop `turnoEditable`).

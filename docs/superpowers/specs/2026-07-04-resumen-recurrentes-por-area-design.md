# "Actividades recurrentes del mes" en /resumen (por área) — Design

**Fecha:** 2026-07-04
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

`/resumen` es la hoja **semanal por área** (`resumen/page.tsx` carga `listarActividades(areaId, anio, semana)` → `ResumenArea`). Ya tiene la sección colapsable "🔄 Actividades cambiadas o reprogramadas" (esa **semana**, del área, ordenada por `vecesReprogramada` desc con badge ×N). En `/tablero` existe "🔁 Actividades recurrentes del mes" pero es **global (todas las áreas)** y mensual.

El usuario quiere ver, **por área** dentro de su hoja de resumen, la **escala mensual de recurrentes** (qué labores de esa área vienen arrastrándose en el mes).

Datos: `vecesReprogramada` (contador acumulado por arrastre), `actividadesRecurrentes(filas)` (dominio, ya existe: dedup por descripción+área, mayor veces, descarta 0, orden desc), `colorSemaforo(veces)`, `semanasDelMes(anio, mes)`, `fechasDeSemana(anio, semana)`. `listarActividadesDeSemanas(semanas)` trae todas las áreas con `area`/`vecesReprogramada`/`descripcion`/`areaId`.

## Objetivo

Agregar a `/resumen` una sección **"🔁 Actividades recurrentes del mes"** del **área seleccionada**: las actividades de esa área, a lo largo del **mes** de la semana elegida, que se han arrastrado, con su ×N.

## Decisiones (acordadas)

1. **Periodo = el mes de la semana seleccionada.** El mes se deriva del **jueves ISO** de la semana (`fechasDeSemana(anio, semana)[3]` → su año/mes), y se usan `semanasDelMes(...)` de ese mes.
2. **Por área:** solo las actividades del área seleccionada (filtro por `areaId`).
3. **Reusa `actividadesRecurrentes`** (dominio, sin cambios) + `colorSemaforo`. Sin dominio nuevo.
4. **Sección colapsable nueva** en `/resumen` (un `<details>` más, consistente con la estructura por-sección ya existente), mostrando **descripción · ×N** (color de severidad). No se toca el resto de `/resumen`.
5. **No se toca `/tablero`** (ya tiene la global) ni el **export PDF** de `/resumen`.
6. Sin cambios de esquema.

## Arquitectura

### `src/app/resumen/page.tsx`
- Imports nuevos: `fechasDeSemana`, `semanasDelMes` (`@/dominio/semana`); `listarActividadesDeSemanas` (`@/datos/repositorio`); `actividadesRecurrentes` (`@/dominio/resumen`).
- Derivar el mes: `const fechas = fechasDeSemana(anio, semana); const jv = fechas[3]; const anioMes = jv.getUTCFullYear(); const mes = jv.getUTCMonth() + 1;` y `const semanasMes = semanasDelMes(anioMes, mes)`.
- Añadir `listarActividadesDeSemanas(semanasMes)` al `Promise.all`.
- Calcular:
  ```ts
  const recurrentesMes = actividadesRecurrentes(
    actividadesMes
      .filter((a) => a.areaId === areaId)
      .map((a) => ({ descripcion: a.descripcion, areaNombre: areaActual.nombre, vecesReprogramada: a.vecesReprogramada })),
  )
  ```
- Pasar `recurrentesMes={recurrentesMes}` a `<ResumenArea>`.

### `src/app/resumen/resumen-area.tsx`
- Nuevo prop: `recurrentesMes: { descripcion: string; areaNombre: string; veces: number }[]`.
- Nueva sección colapsable (dentro del bloque de `<details>` por-sección), p. ej. junto a "Cambiadas o reprogramadas":
  ```tsx
  <details className="tarjeta p-3">
    <summary className="cursor-pointer select-none text-sm font-semibold text-tinta">🔁 Actividades recurrentes del mes ({recurrentesMes.length})</summary>
    {recurrentesMes.length === 0 ? (
      <p className="mt-2 text-sm text-tierra">Ninguna actividad recurrente este mes.</p>
    ) : (
      <ul className="mt-2 space-y-2">
        {recurrentesMes.map((r, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg border border-borde bg-marfil p-3 text-sm">
            <span className="flex-1">{r.descripcion}</span>
            <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: COLOR_HEX[colorSemaforo(r.veces)] }}>×{r.veces}</span>
          </li>
        ))}
      </ul>
    )}
  </details>
  ```
  (`colorSemaforo` y `COLOR_HEX` ya están disponibles en el componente; se usan en la sección de cambios.)

## Casos borde

- Semana en frontera de mes: el mes se define por el **jueves ISO** (criterio ISO estándar, igual que `semanasDelMes`), así que la semana pertenece a un solo mes.
- Actividad arrastrada varias semanas del mes: aparece **una vez** con su mayor ×N (lo hace `actividadesRecurrentes`).
- Mes sin arrastres en el área: "Ninguna actividad recurrente este mes."
- Área estándar o maquinaria: igual (no depende de maquinaria).
- La sección "🔄 Cambiadas o reprogramadas" (semanal) se conserva tal cual; la nueva es la vista **mensual** del área.

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- Vitest: suite existente verde (no se añade dominio nuevo; `actividadesRecurrentes` ya está testeada).
- En vivo (server local + cookie firmada, solo lectura): en `/resumen` de un área con reprogramaciones en el mes, la nueva sección "🔁 Actividades recurrentes del mes" lista las actividades de ESA área con su ×N, deduplicadas y ordenadas; una semana de otro mes muestra el conjunto del mes correspondiente; el resto de `/resumen` intacto.

## Fuera de alcance

- `/tablero` (ya tiene la vista global) y su agrupación por área.
- Export PDF de `/resumen`.
- Nueva función de dominio (se reutiliza `actividadesRecurrentes`).
- Cambios de esquema.

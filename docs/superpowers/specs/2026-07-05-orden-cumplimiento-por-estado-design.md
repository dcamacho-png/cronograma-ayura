# Ordenar la hoja de cumplimiento por estado — Design

**Fecha:** 2026-07-05
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

`/cumplimiento` (`src/app/cumplimiento/page.tsx`) lista las actividades agrupadas por actividad (`agruparPorActividad`), y hoy las ordena **por día**: cada grupo se ordena por `dia` y las tarjetas por el primer día del grupo (`page.tsx:81-83`). El estado de cada grupo se calcula con `estadoActividad(dias)` (`@/dominio/metricas`), que devuelve un `Estado` (`PENDIENTE | PARCIAL | CUMPLIDA | NO_CUMPLIDA | REPROGRAMADA`): el estado común si todos los días coinciden, o `PARCIAL` si están mezclados.

El usuario quiere que las que aún requieren atención queden arriba y las ya resueltas abajo.

## Objetivo

En la **pantalla** `/cumplimiento`, ordenar las tarjetas por **estado** (y, como desempate, por día como hoy). El **Excel** exportado NO cambia: sigue **organizado por fecha**.

## Decisiones (acordadas)

1. Orden de arriba hacia abajo por estado: **Pendientes → Parciales → No se hizo/Reprogramadas → Cumplidas.**
   - Rango: `PENDIENTE = 0`, `PARCIAL = 1`, `NO_CUMPLIDA = 2`, `REPROGRAMADA = 2`, `CUMPLIDA = 3`.
2. **Desempate:** dentro del mismo rango, por el **primer día** del grupo (orden actual). Dentro de cada grupo, los días siguen ordenados por `dia`.
3. Aplica **solo a la pantalla**. El Excel de `cumplimiento/exportar` queda **por fecha** (sin tocar).
4. Sin cambios de esquema ni de datos.

## Arquitectura

### Dominio — `src/dominio/metricas.ts`
- **Nuevo** `ordenEstadoCumplimiento(estado: Estado): number` — función pura que mapea el estado a su rango de orden (`PENDIENTE 0`, `PARCIAL 1`, `NO_CUMPLIDA 2`, `REPROGRAMADA 2`, `CUMPLIDA 3`). Con tests.

### Página — `src/app/cumplimiento/page.tsx`
- Importar `ordenEstadoCumplimiento` (ya se importa `estadoActividad` desde `@/dominio/metricas`).
- Cambiar el `.sort` final de `gruposActividad` (línea ~83) para ordenar primero por `ordenEstadoCumplimiento(estadoActividad(grupo))` y, como desempate, por `grupo[0].dia` (el criterio actual). El `.map(...sort por dia)` interno de cada grupo se conserva.

## Casos borde

- Grupo con días de distintos estados → `estadoActividad` devuelve `PARCIAL` → rango 1 (medio). Consistente.
- `NO_CUMPLIDA` y `REPROGRAMADA` comparten rango 2; entre ellas y dentro del rango, el desempate por día define el orden (estable).
- Grupo vacío: `estadoActividad([])` = `PENDIENTE` (rango 0). No aplica en la práctica (todo grupo tiene ≥1 día).

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Vitest: tests nuevos de `ordenEstadoCumplimiento` + suite existente verde.
- Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- En vivo (server local + cookie firmada, solo lectura): en `/cumplimiento` de un área con estados variados, las tarjetas quedan agrupadas visualmente Pendientes → Parciales → No se hizo/Reprogramadas → Cumplidas, y dentro de cada bloque por día. El Excel exportado sigue por fecha.

## Fuera de alcance

- Excel de `cumplimiento/exportar` (sigue por fecha).
- Reordenar días dentro de un grupo (se mantiene por `dia`).
- Cambios de esquema o de datos.

# Escala de actividades recurrentes (reprogramadas/parciales) — Design

**Fecha:** 2026-07-04
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

El usuario quiere ver, semana a semana y mes a mes, las actividades que se **arrastran** (reprogramadas o parciales devueltas al banco) durante varias semanas — una "escala" de lo crónico —, **viendo cuáles son**, y **sin romper** la estructura recién rediseñada de `/resumen` (cuadros + secciones colapsables).

Datos existentes:
- Cada actividad lleva `vecesReprogramada` (contador que sube en cada arrastre: `reprogramarActividad`/`datosReprogramacion` y `devolverAlBanco` incrementan +1). Es la medida natural de "cuántas semanas viene arrastrándose".
- `colorSemaforo(veces)` da color de severidad (verde→amarillo→naranja→rojo).
- En `/resumen`, `actividadesConCambio(actividades)` (dominio) **ya devuelve la lista ordenada por `vecesReprogramada` desc** y la sección colapsable "🔄 Actividades cambiadas o reprogramadas" ya muestra el badge ×N con `colorSemaforo`.
- `/tablero` (Vista mensual) carga `listarActividadesDeSemanas(semanas del mes)` (trae `area`, `vecesReprogramada`, `descripcion`, `estado`, `tareaId`), y hoy muestra: cumplimiento del mes, reprogramadas del mes (%), cumplimiento por área, y tendencia semana a semana. No hay lista de "cuáles" actividades se arrastran.

## Objetivo

Mostrar la **escala de actividades recurrentes** por `vecesReprogramada`:
1. **/resumen (semanal):** ya existe (la sección "Cambiadas o reprogramadas" está ordenada por veces desc con badge). **No se cambia.**
2. **/tablero (mensual):** agregar una **sección nueva** que liste las actividades del mes que se han arrastrado, una vez por actividad, ordenadas de más a menos, mostrando cuáles son y su severidad.

## Decisiones (acordadas)

1. **Métrica = `vecesReprogramada`** (nº de arrastres = "semanas arrastrándose"). Severidad por `colorSemaforo`.
2. **/resumen: sin cambios** — la sección "🔄 Actividades cambiadas o reprogramadas" ya es la escala semanal (ordenada por veces desc, badge ×N). Se respeta la estructura nueva.
3. **/tablero: sección nueva** "🔁 Actividades recurrentes del mes": actividades del mes con `vecesReprogramada > 0`, **deduplicadas por (descripción + área)** tomando el **mayor** nº de arrastres, ordenadas desc, mostrando **descripción · área · ×N** con color de severidad.
4. Sin cambios de esquema.

## Arquitectura

### Dominio — `src/dominio/resumen.ts`
- **Nuevo** `actividadesRecurrentes(filas)`:
  - Input: `filas: { descripcion: string; areaNombre: string; vecesReprogramada: number }[]`.
  - Dedup por clave `${descripcion}|${areaNombre}` tomando el **máximo** `vecesReprogramada` (una actividad recurrente aparece varias veces en el mes —una por semana arrastrada—; se colapsa a una fila con su mayor arrastre).
  - Filtra `veces > 0`.
  - Devuelve `{ descripcion: string; areaNombre: string; veces: number }[]` ordenado por `veces` desc y luego `descripcion` asc.
  - Función pura, con tests.

### Página — `src/app/tablero/page.tsx`
- Construye la lista con `actividadesRecurrentes(actividades.map((a) => ({ descripcion: a.descripcion, areaNombre: a.area.nombre, vecesReprogramada: a.vecesReprogramada })))` (usa el resultado ya cargado de `listarActividadesDeSemanas`).
- Renderiza una sección nueva "🔁 Actividades recurrentes del mes" (tras la tendencia): si vacía, "Ninguna actividad se arrastró este mes. 🎉"; si no, una lista/tabla con `descripción`, `área` y un badge `×{veces}` coloreado con `colorSemaforo` (reusar el mapa de color hex que ya usa el tablero, o añadir uno si no existe).
- No se toca la lógica de cumplimiento/tendencia/porArea existente.

## Casos borde

- Actividad arrastrada varias semanas en el mes: aparece **una sola fila** con su mayor `vecesReprogramada`.
- Misma descripción en dos áreas: filas separadas (la clave incluye el área).
- Mes sin arrastres: mensaje "Ninguna actividad se arrastró este mes 🎉".
- `/resumen` semanal: sin cambios (ya ordenado por veces desc).

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- Vitest: tests nuevos de `actividadesRecurrentes` (dedup por descripción+área con máximo; filtra veces=0; orden desc) + suite existente verde.
- En vivo (server local + cookie firmada, solo lectura): en un mes con reprogramaciones, `/tablero` muestra la sección "Actividades recurrentes del mes" con las actividades correctas, una por (descripción+área), ordenadas por nº de arrastres, con color; `/resumen` semanal sigue igual.

## Fuera de alcance

- Cambiar `/resumen` (ya cumple la escala semanal).
- Contar "semanas distintas" en vez del contador `vecesReprogramada` (se eligió el contador).
- Umbral mínimo configurable (se muestran todas con veces>0).
- Cambios en export de Excel.

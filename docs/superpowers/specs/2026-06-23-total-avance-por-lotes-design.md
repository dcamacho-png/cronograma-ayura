# Total de avance acotado a los lotes vigentes — Diseño

**Fecha:** 2026-06-23

## Objetivo

Hacer que la **medida total** de una actividad con avances (en pantalla y la guardada en `haRealizada` al marcar cumplida) sume **solo las entradas de los lotes vigentes de la actividad** (`a.lotes`), igual que ya lo hacen el Excel (`filasCumplimiento`), el texto "Avances:" (`textoAvanceConFecha`) y el "Progreso" (`lotesPendientes`).

Es un follow-up de consistencia surgido en la revisión final del plan "avances en cumplida + Excel una fila por avance" (hallazgo I1).

## Contexto

`totalAvance(avance)` (`src/dominio/avance-lote.ts`) recorre **todas** las claves del JSON `avancePorLote` (`Object.values(avance)`), incluyendo hipotéticas entradas de un lote que ya no pertenece a la actividad. Se usa en dos lugares:

- `src/app/cumplimiento/page.tsx:266` — la medida mostrada de una fila no-pendiente con avances.
- `src/datos/repositorio.ts:510` — `marcarCumplidaDesdeParcial` fija `haRealizada = totalAvance(avance)`.

En cambio, `textoAvanceConFecha` y `filasCumplimiento` iteran `a.lotes` y omiten entradas de lotes ausentes.

**Hoy la divergencia es imposible:** los lotes de una actividad solo se *agregan* (`connect`), nunca se quitan (no hay `disconnect` ni `lotes: { set }` en `src/datos/repositorio.ts`), y `registrarAvanceLote` solo recibe loteIds del formulario, que ofrece `a.lotes`. El cambio es **defensivo y de consistencia**, sin cambio de comportamiento observable con los flujos actuales.

## Decisión

Alinear hacia el **alcance por lotes vigentes** ("contar solo lo que se ve"). Es lo que ya hacen el Excel y la lista; deja todas las superficies sumando el mismo conjunto por construcción.

Alternativa descartada: alinear al revés (que el Excel y la lista también muestren entradas huérfanas) — más trabajo y mostraría datos de lotes que ya no pertenecen a la actividad.

## Cambios

### 1. Nuevo helper puro `totalAvanceLotes`

En `src/dominio/avance-lote.ts`:

```ts
// Suma de las cantidades de los avances, ACOTADA a los lotes dados (los
// vigentes de la actividad). Ignora entradas de lotes que ya no pertenecen.
// Mismo recorrido que textoAvanceConFecha/filasCumplimiento.
export function totalAvanceLotes(
  lotes: { id: string }[],
  avance: AvancePorLote | null | undefined,
): number {
  if (!avance) return 0
  let total = 0
  for (const l of lotes) {
    for (const e of avance[l.id] ?? []) total += e.cantidad
  }
  return total
}
```

### 2. Reemplazar los dos call sites

- `src/app/cumplimiento/page.tsx`: usar `totalAvanceLotes(a.lotes, avances)` en lugar de `totalAvance(avances)` (medida mostrada). Ajustar el import.
- `src/datos/repositorio.ts`: en `marcarCumplidaDesdeParcial`, usar `totalAvanceLotes(act.lotes, avance)`. Requiere que `findUnique` traiga `lotes` (hoy lee la actividad sin `include`); agregar `include: { lotes: { select: { id: true } } }` (o `select` equivalente) para tener `act.lotes`. Ajustar el import.

### 3. Eliminar `totalAvance`

Queda sin uso tras el reemplazo. Borrarlo de `src/dominio/avance-lote.ts` para no dejar un helper inconsistente como trampa, y migrar sus pruebas a `totalAvanceLotes`.

## Pruebas

`src/dominio/avance-lote.test.ts`:
- Reemplazar el bloque `describe('totalAvance')` por `describe('totalAvanceLotes')`:
  - Suma solo las entradas de los lotes dados (mismo dataset `avance` del test: lotes a+b → 5+2 = 7).
  - Ignora entradas de un lote ausente de la lista (p. ej. avance con clave `z` no incluida en `lotes` → no suma).
  - `0` cuando no hay avance (`null`).

No se tocan pruebas de pantalla ni de repositorio (cubiertas por tipos/lint y verificación manual); `marcarCumplidaDesdeParcial` no tiene prueba unitaria hoy.

## Restricciones

- Sin migración de esquema (`avancePorLote` sigue JSON).
- Comentarios en español.
- No cambiar el flujo de registro de avance; solo el cálculo del total (pantalla + cierre manual) para acotarlo a los lotes vigentes.

## Self-Review

- **Cobertura:** total acotado a lotes → helper (cambio 1) + 2 call sites (cambio 2); limpieza del helper inconsistente → cambio 3. ✅
- **Consistencia de tipos:** `totalAvanceLotes(lotes: {id}[], avance)` — firma idéntica en definición y en ambos call sites; `marcarCumplidaDesdeParcial` debe cargar `act.lotes`. ✅
- **Ambigüedad:** se elige explícitamente el alcance por lotes vigentes; `totalAvance` se elimina (no se mantiene en paralelo). ✅
- **Sin placeholders.** ✅

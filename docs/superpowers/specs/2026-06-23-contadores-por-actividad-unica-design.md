# Contadores por actividad única (no por filas-día)

**Fecha:** 2026-06-23

## Problema

En `/cumplimiento`, el área ganadería muestra **"de 67"** actividades, pero ese
número cuenta **filas-día**, no actividades únicas. Una tarea programada para varios
días/responsables crea **una fila `Actividad` por (día × responsable)**, todas con el
mismo `tareaId` (`repositorio.ts:312` — `asignarTarea`). Es intencional para el
seguimiento diario, y **la vista de tarjetas ya agrupa** correctamente por tarea
(`page.tsx:82` — `gruposActividad`), igual que el **`%` de cumplimiento**
(`metricas.ts` — `porcentajeCumplimiento`, ya agrupado; ver
`2026-06-22-cumplimiento-por-actividad-design.md`).

Lo que quedó sin alinear son los **contadores numéricos de texto**, que siguen
contando filas crudas:

| Lugar | Hoy | Debe |
|---|---|---|
| `page.tsx:150` — `de {actividades.length}` | filas-día (67) | actividades únicas |
| `page.tsx:89-93` — `conteoEstado` (✅🟡🔴🔄) | filas por estado | actividades por estado |
| `page.tsx:78,154-157` — `pendientes` (aviso + bloqueo de semana) | filas PENDIENTE | actividades con algún día sin registrar |
| `resumen-area.tsx:121` — `/{actividades.length}` | filas-día | actividades únicas |

## Decisión (acordada)

**Enfoque B1:** contar **actividades únicas** (agrupadas por `tareaId`, igual que las
tarjetas), **manteniendo el seguimiento por día por dentro**. Estado de una actividad
agrupada, derivado de sus filas-día:

- **Cumplida** si **todas** las filas-día son `CUMPLIDA`.
- **Pendiente** si **todas** son `PENDIENTE`.
- **No cumplida** si **todas** son `NO_CUMPLIDA`.
- **Reprogramada** si **todas** son `REPROGRAMADA`.
- **Parcial** en cualquier **mezcla** (algo registrado pero no todo igual).

El aviso "Faltan N por registrar" y el **bloqueo de pasar de semana** cuentan las
**actividades que aún tienen algún día sin registrar** (algún día `PENDIENTE`) — así
se sigue obligando a registrar todos los días antes de avanzar.

## Cambio en el dominio (`src/dominio/metricas.ts`)

Helper nuevo, puro y testeable:

```ts
import type { Estado } from './tipos'

// Estado de UNA actividad a partir de sus filas-día: si todas comparten estado,
// ese estado; si hay mezcla, PARCIAL. (Una actividad con días en distinto estado
// está, por definición, parcialmente cumplida.)
export function estadoActividad(dias: { estado: Estado }[]): Estado {
  const estados = new Set(dias.map((d) => d.estado))
  if (estados.size === 1) return [...estados][0]
  return 'PARCIAL'
}

// ¿La actividad tiene algún día aún sin registrar (PENDIENTE)?
export function tieneDiaPendiente(dias: { estado: Estado }[]): boolean {
  return dias.some((d) => d.estado === 'PENDIENTE')
}
```

> Nota: usa el mismo agrupamiento existente `agruparPorActividad` (por `tareaId`;
> `solo:${id}` para filas sin tarea). No se introduce otra clave de agrupación.

## Cambios en la página (`src/app/cumplimiento/page.tsx`)

Calcular una vez los grupos (ya existe `gruposActividad`) y derivar los contadores
de ahí:

```ts
// gruposActividad: T[][] (cada grupo = una actividad, sus filas-día)
const totalActividades = gruposActividad.length
const conteoEstado = {
  CUMPLIDA:    gruposActividad.filter((g) => estadoActividad(g) === 'CUMPLIDA').length,
  PARCIAL:     gruposActividad.filter((g) => estadoActividad(g) === 'PARCIAL').length,
  NO_CUMPLIDA: gruposActividad.filter((g) => estadoActividad(g) === 'NO_CUMPLIDA').length,
  REPROGRAMADA:gruposActividad.filter((g) => estadoActividad(g) === 'REPROGRAMADA').length,
}
const pendientes = gruposActividad.filter((g) => tieneDiaPendiente(g)).length
```

- Línea 150: `de {totalActividades}`.
- Líneas 145-151: la franja ✅🟡🔴🔄 usa el `conteoEstado` agrupado.
- Líneas 78/127/154-157: `pendientes` (aviso "Faltan N actividad(es)" y bloqueo de
  "Semana →") usa el conteo de actividades con día pendiente. El texto del aviso
  sigue siendo correcto ("actividad(es)").

> El `%` (`porcentajeCumplimiento`) **no cambia** — ya estaba agrupado.

## Cambios en el resumen (`src/app/resumen/resumen-area.tsx`)

- Línea 121: `{conteo.CUMPLIDA}/{actividades.length}` → usar el total de actividades
  agrupadas y, si el desglose `conteo` viene de `resumen.ts` por filas, recalcularlo
  por actividad con `estadoActividad`. El plan revisa `conteoPorEstado` en
  `src/dominio/resumen.ts` (líneas 47-49) y lo ajusta a grupos o agrega una variante
  agrupada, según se use en otras vistas. Mantener consistencia: todos los "N/Total"
  visibles cuentan actividades únicas.

## Testing

- `metricas.test.ts`: `estadoActividad` (todas iguales → ese estado; mezcla → PARCIAL;
  un solo día) y `tieneDiaPendiente`.
- Si se ajusta `conteoPorEstado` en `resumen.ts`, test correspondiente.
- Verificación manual en producción (ganadería): el contador deja de decir "67" y
  pasa a mostrar el número de actividades únicas; el bloqueo de semana sigue activo
  mientras falte registrar algún día.

## Fuera de alcance

- No se cambia el modelo de filas-día ni `asignarTarea` (la programación por día se
  mantiene; la usuaria confirmó "contar 1 actividad, seguir por día por dentro").
- El Excel mantiene una fila por día (decisión del spec previo).
- Los avances múltiples por parcial son un cambio aparte (ver
  `2026-06-23-varios-avances-y-marcar-cumplida-design.md`).

# Resumen de avances con fecha + Excel cumplidas/parciales sin restricción — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar el detalle de avances con fecha en la tarjeta del parcial, y hacer el Excel descargable siempre, solo con actividades Cumplidas/Parciales y con una columna de avance por lote.

**Architecture:** Un helper de dominio puro (`textoAvanceConFecha`) formatea "fecha · lote — cantidad unidad" recibiendo una función `etiquetaDia` inyectada (testeable, sin depender del calendario). La tarjeta y el Excel lo consumen, cada uno aportando su propio `etiquetaDia` a partir de las fechas de la semana. El Excel filtra a CUMPLIDA/PARCIAL y agrega una columna; la página deja el botón de descarga siempre activo.

**Tech Stack:** Next.js (App Router, RSC), TypeScript, Prisma, ExcelJS, Vitest.

## Global Constraints

- **Tarjeta:** en actividades PARCIAL, línea "Avances:" con, por lote realizado, `<día> · <lote> — <cantidad> <unidad>`, separados por `; `.
- **Excel — descarga sin restricción:** el botón "📥 Descargar Excel" siempre es un enlace activo (quitar el bloqueo por pendientes). **Mantener** el bloqueo de "pasar a la siguiente semana".
- **Excel — solo CUMPLIDA y PARCIAL** (excluye Pendiente, No cumplida, Reprogramada).
- **Excel — columna nueva** `Avance por lote` con el mismo texto fecha · lote — cantidad.
- No cambiar cálculo, modelo de datos, agrupación, ni el flujo de registro de avance (solo su visualización/export).
- Comentarios en español; color de marca `#11603a`.

---

### Task 1: Helper de dominio `textoAvanceConFecha`

**Files:**
- Modify: `src/dominio/avance-lote.ts`
- Test: `src/dominio/avance-lote.test.ts`

**Interfaces:**
- Consumes: `type AvancePorLote` (ya existe en `avance-lote.ts`).
- Produces: `textoAvanceConFecha(lotes: { id: string; nombre: string }[], avance: AvancePorLote | null | undefined, unidadAbrev: string, etiquetaDia: (dia: number) => string): string`.

- [ ] **Step 1: Escribir las pruebas (que fallan)**

Agregar a `src/dominio/avance-lote.test.ts` (el import de `./avance-lote` ya existe; añade `textoAvanceConFecha`):

```ts
import { lotesPendientes, textoAvancePorLote, textoAvanceConFecha, type AvancePorLote } from './avance-lote'
```

```ts
describe('textoAvanceConFecha', () => {
  it('arma "<día> · <lote> — <cantidad> <unidad>" por cada lote con avance, en orden', () => {
    const lotes = [{ id: 'a', nombre: 'L-A' }, { id: 'b', nombre: 'L-B' }, { id: 'c', nombre: 'L-C' }]
    const avance: AvancePorLote = { a: { dia: 1, maquinaId: null, cantidad: 3 }, b: { dia: 2, maquinaId: null, cantidad: 2 } }
    expect(textoAvanceConFecha(lotes, avance, 'ha', (d) => `D${d}`)).toBe('D1 · L-A — 3 ha; D2 · L-B — 2 ha')
  })
  it('vacío si no hay avance', () => {
    expect(textoAvanceConFecha([{ id: 'a', nombre: 'L-A' }], null, 'ha', (d) => `D${d}`)).toBe('')
  })
})
```

> Nota: el import existente de la línea superior del test ya trae `lotesPendientes, textoAvancePorLote, type AvancePorLote`; solo agrega `textoAvanceConFecha` a esa lista (no dupliques el import).

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- src/dominio/avance-lote.test.ts`
Expected: FALLA — `textoAvanceConFecha` no existe.

- [ ] **Step 3: Implementar el helper**

En `src/dominio/avance-lote.ts`, agregar al final:

```ts
// Resumen de avances con fecha: por cada lote realizado "<etiquetaDia> · <lote> — <cantidad> <unidad>".
// `etiquetaDia` traduce el día (1..7) a su etiqueta (ej. "Lun 22"); se inyecta para mantener el
// helper puro (sin depender del calendario). Entradas separadas por "; ".
export function textoAvanceConFecha(
  lotes: { id: string; nombre: string }[],
  avance: AvancePorLote | null | undefined,
  unidadAbrev: string,
  etiquetaDia: (dia: number) => string,
): string {
  if (!avance) return ''
  return lotes
    .filter((l) => l.id in avance)
    .map((l) => `${etiquetaDia(avance[l.id].dia)} · ${l.nombre} — ${avance[l.id].cantidad} ${unidadAbrev}`)
    .join('; ')
}
```

- [ ] **Step 4: Correr toda la suite**

Run: `npm test`
Expected: PASA (incluye las dos pruebas nuevas).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/`.

- [ ] **Step 6: Commit**

```bash
git add src/dominio/avance-lote.ts src/dominio/avance-lote.test.ts
git commit -m "feat(dominio): textoAvanceConFecha (resumen de avance por lote con fecha)"
```

---

### Task 2: Excel — filtro Cumplida/Parcial + columna de avance por lote

**Files:**
- Modify: `src/dominio/cumplimiento-export.ts` (columna + parámetro `avanceTexto`)
- Test: `src/dominio/cumplimiento-export.test.ts` (columna + celda nueva)
- Modify: `src/app/cumplimiento/exportar/route.ts` (filtro + cálculo del texto)

**Interfaces:**
- Consumes: `textoAvanceConFecha` (Task 1); `filaCumplimiento`, `COLUMNAS_CUMPLIMIENTO` (este archivo); `unidadDe`/`unidadAbreviada` (`@/dominio/unidad`).
- Produces: `filaCumplimiento(a, fecha, unidadPorNombre, avanceTexto?: string)` con una celda final extra (parámetro con default `''`).

- [ ] **Step 1: Actualizar las pruebas de `cumplimiento-export.test.ts` (que fallan)**

(a) En el test de `COLUMNAS_CUMPLIMIENTO`, cambiar la descripción a "13 columnas" y agregar la columna nueva al final del arreglo esperado:

```ts
describe('COLUMNAS_CUMPLIMIENTO', () => {
  it('tiene las 13 columnas en el orden acordado', () => {
    expect([...COLUMNAS_CUMPLIMIENTO]).toEqual([
      'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados', 'Avance por lote',
    ])
  })
})
```

(b) En cada test de `filaCumplimiento` que compara la fila completa con `.toEqual([...])` (los 5 casos), agregar `''` como **última** celda del arreglo esperado. Por ejemplo el primero:

```ts
    expect(filaCumplimiento(act({}), '15 jun', mapa)).toEqual(
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 3, 'ha', '', '', '', ''],
    )
```

(Hacer lo mismo —agregar un `''` al final— en los casos "hora", "kg", "sin medida" y "fuera del catálogo".) Los tests por índice (`[9]`, `[10]`, `[11]`) no cambian.

(c) Agregar un test nuevo para la columna de avance (índice 12):

```ts
  it('incluye el avance por lote (texto pre-formateado) en la última columna', () => {
    expect(filaCumplimiento(act({}), '15 jun', mapa, 'Lun 22 · L1 — 3 ha')[12]).toBe('Lun 22 · L1 — 3 ha')
  })
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- src/dominio/cumplimiento-export.test.ts`
Expected: FALLA — la columna nueva y la celda 12 aún no existen.

- [ ] **Step 3: Agregar la columna y el parámetro en `cumplimiento-export.ts`**

Agregar `'Avance por lote'` al final de `COLUMNAS_CUMPLIMIENTO`:

```ts
export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados', 'Avance por lote',
] as const
```

Cambiar la firma de `filaCumplimiento` para recibir `avanceTexto` (con default `''`, así las llamadas por índice del test siguen compilando) y agregarlo como última celda:

```ts
export function filaCumplimiento(
  a: ActividadExport,
  fecha: string,
  unidadPorNombre: Record<string, string>,
  avanceTexto = '',
): (string | number)[] {
  const unidad: Unidad = normalizarUnidad(unidadPorNombre[a.descripcion])
  return [
    DIAS[a.dia] ?? '',
    fecha,
    a.responsable.nombre,
    a.descripcion,
    a.maquina?.nombre ?? '',
    a.lotes.map((l) => l.nombre).join(', '),
    ESTADO_TXT[a.estado] ?? a.estado,
    a.haRealizada ?? '',
    a.haRealizada == null ? '' : unidadAbreviada(unidad),
    textoBultosPorLote(a.lotes, a.bultosPorLote),
    a.centroCosto ?? '',
    textoLotesHechos(a.lotes, a.lotesHechos),
    avanceTexto,
  ]
}
```

> `ActividadExport` no necesita cambios: el texto del avance se calcula en la ruta (que tiene el
> calendario de la semana) y se pasa ya formateado.

- [ ] **Step 4: Filtrar y calcular el avance en la ruta**

En `src/app/cumplimiento/exportar/route.ts`, ampliar imports:

```ts
import { COLUMNAS_CUMPLIMIENTO, filaCumplimiento } from '@/dominio/cumplimiento-export'
import { textoAvanceConFecha, type AvancePorLote } from '@/dominio/avance-lote'
import { unidadDe, unidadAbreviada } from '@/dominio/unidad'
import type { BultosPorLote } from '@/dominio/bultos'
```

Reemplazar el bucle que arma las filas (hoy: `for (const a of actividades) { ... ws.addRow(filaCumplimiento(...)) }`) por:

```ts
  const NOMBRES_DIA = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const etiquetaDia = (dia: number) =>
    `${NOMBRES_DIA[dia] ?? ''} ${fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}`.trim()

  // Solo actividades cumplidas o parciales.
  const filas = actividades.filter((a) => a.estado === 'CUMPLIDA' || a.estado === 'PARCIAL')
  for (const a of filas) {
    const fecha = fechas[a.dia - 1] ? fmtFecha(fechas[a.dia - 1]) : ''
    const unidadAbrev = unidadAbreviada(unidadDe(unidadPorNombre, a.descripcion))
    const avanceTexto = textoAvanceConFecha(a.lotes, a.avancePorLote as AvancePorLote | null, unidadAbrev, etiquetaDia)
    ws.addRow(filaCumplimiento(
      { ...a, bultosPorLote: a.bultosPorLote as BultosPorLote | null, lotesHechos: a.lotesHechos as string[] | null },
      fecha,
      unidadPorNombre,
      avanceTexto,
    ))
  }
```

> `a.lotes` y `a.avancePorLote` ya vienen de `listarActividades` (incluye `lotes`; `avancePorLote`
> es columna escalar devuelta por defecto).

- [ ] **Step 5: Correr la suite y verificar tipos/lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: PASA (incluye los tests actualizados de export) y sin errores en `src/` (ignora errores preexistentes en archivos generados de `.next/`).

- [ ] **Step 6: Commit**

```bash
git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts src/app/cumplimiento/exportar/route.ts
git commit -m "feat(excel): solo cumplidas/parciales + columna de avance por lote con fecha"
```

---

### Task 3: Página — línea "Avances:" + Excel siempre descargable

**Files:**
- Modify: `src/app/cumplimiento/page.tsx`

**Interfaces:**
- Consumes: `textoAvanceConFecha` (`@/dominio/avance-lote`); `unidadAbreviada` (`@/dominio/unidad`); `DIAS`, `fechas`, `fmtFecha`, `unidad` (en scope en la tarjeta).

- [ ] **Step 1: Importar `textoAvanceConFecha`**

En `src/app/cumplimiento/page.tsx`, ampliar el import de avance-lote (hoy: `import { lotesPendientes, textoAvancePorLote, type AvancePorLote } from '@/dominio/avance-lote'`):

```ts
import { lotesPendientes, textoAvanceConFecha, type AvancePorLote } from '@/dominio/avance-lote'
```

> Se quita `textoAvancePorLote` del import porque ya no se usa (ver Step 3). Verifica que
> `unidadAbreviada` ya esté importado de `@/dominio/unidad` (se agregó en una iteración previa para
> mostrar la medida en el estado registrado); si no estuviera, agrégalo.

- [ ] **Step 2: Quitar la restricción de descarga del Excel**

Reemplazar el bloque del botón de Excel (hoy `{pendientes > 0 ? (<span … >📥 Descargar Excel</span>) : (<a …>📥 Descargar Excel</a>)}`, líneas ~139-153) por solo el enlace:

```tsx
        <a
          href={`/cumplimiento/exportar?area=${areaId}&anio=${anio}&semana=${semana}`}
          className="rounded border border-[#11603a] px-3 py-1 text-sm font-semibold text-[#11603a] hover:bg-green-50"
        >
          📥 Descargar Excel
        </a>
```

> No tocar el bloque de "Semana {proxima.semana} →" (el bloqueo de pasar de semana se mantiene).

- [ ] **Step 3: Línea "Avances:" en la sección PARCIAL**

En la sección `{a.estado === 'PARCIAL' && ( … )}`, reemplazar el `<span>` de "Progreso" (que hoy
incluye el sufijo `· {textoAvancePorLote(...)}`) por la versión sin sufijo, y agregar debajo la línea
"Avances:". El bloque queda:

```tsx
                                  {a.lotes.length > 0 && (
                                    <span className="text-gray-600">
                                      Progreso: {a.lotes.length - lotesPendientes(a.lotes, a.avancePorLote as AvancePorLote | null).length} de {a.lotes.length} lotes
                                    </span>
                                  )}
                                  {a.lotes.length > 0 && textoAvanceConFecha(a.lotes, a.avancePorLote as AvancePorLote | null, unidadAbreviada(unidad), (dia) => `${DIAS[dia] ?? ''} ${fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}`.trim()) && (
                                    <span className="text-gray-600">
                                      Avances: {textoAvanceConFecha(a.lotes, a.avancePorLote as AvancePorLote | null, unidadAbreviada(unidad), (dia) => `${DIAS[dia] ?? ''} ${fechas[dia - 1] ? fmtFecha(fechas[dia - 1]) : ''}`.trim())}
                                    </span>
                                  )}
```

(El resto de la sección — el `<div>` con `FormAvanceLote` y "Devolver al banco" — no cambia.)

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores en `src/` (la eliminación de `textoAvancePorLote` del import no debe dejar usos colgantes; si `tsc` marca un uso restante, conviértelo a `textoAvanceConFecha` o elimínalo).

- [ ] **Step 5: Verificación manual**

Run: `npm run dev` (requiere `DATABASE_URL`). En `/cumplimiento`:
- Con actividades pendientes, el botón **📥 Descargar Excel** está activo y descarga.
- El Excel descargado trae **solo Cumplidas y Parciales** y una columna **"Avance por lote"** con el detalle (fecha · lote — cantidad) en las parciales con avances.
- Una actividad parcial con avances muestra la línea **"Avances: Lun 22 · … — … ha; …"**.

- [ ] **Step 6: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): línea de avances con fecha en la tarjeta + Excel siempre descargable"
```

---

## Self-Review

**Spec coverage:**
- Tarjeta "Avances:" con fecha → Task 1 (helper) + Task 3 (línea). ✅
- Excel sin restricción de descarga (manteniendo el de semana) → Task 3 Step 2. ✅
- Excel solo Cumplida/Parcial → Task 2 Step 2 (filtro). ✅
- Excel columna avance por lote → Task 2 (columna + texto). ✅
- Helper puro testeable → Task 1. ✅
- No cambia cálculo/modelo/flujo → ninguna task los toca. ✅

**Placeholder scan:** sin TBD/TODO; código completo en cada paso.

**Type consistency:** `textoAvanceConFecha(lotes, avance, unidadAbrev, etiquetaDia)` con la misma firma en Task 1, Task 2 (ruta) y Task 3 (página). `filaCumplimiento(a, fecha, unidadPorNombre, avanceTexto)` con el 4º parámetro nuevo consumido solo desde la ruta (único llamador). El import de `page.tsx` deja de traer `textoAvancePorLote` y Task 3 elimina su único uso (el sufijo de "Progreso"), evitando referencias colgantes.

# Excel de cumplimiento día a día + columna Finca Implementation Plan

> ✅ **COMPLETADO** — 2 tareas + afinación "solo lo que se hizo", desplegadas a producción (commits 974d720..cd20743, último deploy cronograma-ayura-c32zos4ux); verificado por la usuaria.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Que el Excel de cumplimiento sea un registro día a día (avances, culminadas, novedades/cambios, nuevas), añadiendo columnas Finca y Observación; maquinaria emite por (día·responsable) sin agrupar, estándar por avance agrupado.

**Architecture:** Dominio (`cumplimiento-export.ts`): dos columnas nuevas (Finca, Observación) y `finca`/`nota` en `ActividadExport`; `filasCumplimiento` ya emite por avance o fila-resumen. Ruta (`exportar/route.ts`): dejar de omitir NO_CUMPLIDA/REPROGRAMADA (omitir solo PENDIENTE) y ramar por área: maquinaria = una fila por fila del grupo (`filasCumplimiento` por fila), estándar = `filasCumplimientoGrupo`.

**Tech Stack:** Next.js 16 (route handler, Node runtime), ExcelJS, TypeScript, Vitest.

## Global Constraints

- Dominio con Vitest (`npm test`); la ruta/RSC con typecheck + ejecución.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- Orden de columnas nuevo (15): `Día, Fecha, Responsable, Actividad, Máquina, Lote(s), Finca, Estado, Medida realizada, Unidad, Bultos por lote, Centro de costo, Potreros realizados, Ejecutada por, Observación`.
- Detección de maquinaria: `esMaquinaria(area, 'cumplimiento')` de `@/dominio/variante` (bandera `maqCumplimiento`). Se omite **solo** PENDIENTE.

---

### Task 1: Dominio — columnas Finca + Observación

**Files:**
- Modify: `src/dominio/cumplimiento-export.ts`
- Test: `src/dominio/cumplimiento-export.test.ts`

**Interfaces:**
- Produces: `COLUMNAS_CUMPLIMIENTO` con 15 columnas; `ActividadExport` con `finca: { nombre: string } | null` y `nota: string | null`; `filasCumplimiento`/`filasCumplimientoGrupo` emiten esas dos columnas.

- [x] **Step 1: Actualizar el test**

En `src/dominio/cumplimiento-export.test.ts`:

(a) En el helper `act(...)`, añadir dos defaults (tras `avancePorLote: null,`):
```ts
    finca: null,
    nota: null,
```

(b) Reemplazar la aserción de `COLUMNAS_CUMPLIMIENTO` por (15 columnas):
```ts
describe('COLUMNAS_CUMPLIMIENTO', () => {
  it('tiene las 15 columnas en el orden acordado (Finca tras Lote(s), Observación al final)', () => {
    expect([...COLUMNAS_CUMPLIMIENTO]).toEqual([
      'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Finca', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados', 'Ejecutada por', 'Observación',
    ])
  })
})
```

(c) En **cada** aserción de fila existente (las de `filasCumplimiento`/`filasCumplimientoGrupo` que comparan arreglos completos), como los defaults `finca`/`nota` son `null`, insertar `''` en la **posición 7** (índice 6, la nueva `Finca`, justo después del valor de `Lote(s)`) y añadir `''` al **final** (la nueva `Observación`). Ejemplo — esta fila:
```ts
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', 'Cumplida', 3, 'ha', '', '', '', ''],
```
pasa a:
```ts
      ['Lun', '15 jun', 'Ana', 'ENCALADORA', '6603', 'L1', '', 'Cumplida', 3, 'ha', '', '', '', '', ''],
```
Aplicar la misma transformación (insertar `''` en índice 6 y añadir `''` al final) a **todas** las filas esperadas del archivo. Para las aserciones que comparan por índice (`f[5]`, `f[7]`, etc.), ajustar los índices al nuevo orden: `Lote(s)` sigue en 5, `Estado` pasa de 6→7, `Medida` de 7→8. (El test "avances en dos lotes … `f[5]`,`f[7]`" pasa a `f[5]` (lote) y `f[8]` (medida).)

(d) Añadir dos casos nuevos al final:
```ts
describe('filasCumplimiento — Finca y Observación (columnas nuevas)', () => {
  it('incluye la finca de la actividad y la nota (novedad) en la fila', () => {
    expect(
      filasCumplimiento(act({ estado: 'NO_CUMPLIDA', haRealizada: null, finca: { nombre: 'La Esperanza' }, nota: 'Cambiada por: Riego' }), '', mapa, ctx),
    ).toEqual([
      ['Lun', '', 'Ana', 'ENCALADORA', '6603', 'L1', 'La Esperanza', 'No cumplida', '', '', '', '', '', '', 'Cambiada por: Riego'],
    ])
  })
  it('finca en cada fila de avance', () => {
    const a = act({
      finca: { nombre: 'La Esperanza' },
      avancePorLote: { l1: [{ dia: 2, maquinaId: null, cantidad: 4 }] },
    })
    const filas = filasCumplimiento(a, '15 jun', mapa, ctx)
    expect(filas[0][6]).toBe('La Esperanza')
    expect(filas[0][14]).toBe('') // Observación vacía (nota null)
  })
})
```

- [x] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- cumplimiento-export`
Expected: FALLA (columnas 13 vs 15; filas sin Finca/Observación; `ActividadExport` sin `finca`/`nota`).

- [x] **Step 3: Implementar en `cumplimiento-export.ts`**

(a) Reemplazar `COLUMNAS_CUMPLIMIENTO` por:
```ts
export const COLUMNAS_CUMPLIMIENTO = [
  'Día', 'Fecha', 'Responsable', 'Actividad', 'Máquina', 'Lote(s)', 'Finca', 'Estado', 'Medida realizada', 'Unidad', 'Bultos por lote', 'Centro de costo', 'Potreros realizados', 'Ejecutada por', 'Observación',
] as const
```

(b) En el tipo `ActividadExport`, añadir (tras `avancePorLote: …`):
```ts
  finca: { nombre: string } | null
  nota: string | null
```

(c) En `filasCumplimiento`, la fila de **avance** (dentro del doble `for`) pasa a:
```ts
      filas.push([
        DIAS[e.dia] ?? '',
        ctx.fechaDeDia(e.dia),
        a.responsable.nombre,
        a.descripcion,
        ctx.nombreMaquina(e.maquinaId) || (a.maquina?.nombre ?? ''),
        l.nombre,
        a.finca?.nombre ?? '',
        estado,
        e.cantidad,
        unidadAbrev,
        bultos,
        centro,
        potreros,
        ejecutadaPor,
        a.nota ?? '',
      ])
```

(d) La fila **resumen** (sin avances) pasa a:
```ts
  return [[
    DIAS[a.dia] ?? '',
    fecha,
    a.responsable.nombre,
    a.descripcion,
    a.maquina?.nombre ?? '',
    a.lotes.map((l) => l.nombre).join(', '),
    a.finca?.nombre ?? '',
    estado,
    a.haRealizada ?? '',
    a.haRealizada == null ? '' : unidadAbrev,
    bultos,
    centro,
    potreros,
    ejecutadaPor,
    a.nota ?? '',
  ]]
```

> `filasCumplimientoGrupo` no cambia: la fila representativa es `{ ...base, … }`, y `base` ya trae `finca`/`nota`, así que se propagan solas.

- [x] **Step 4: Correr el test para verlo pasar**

Run: `npm test -- cumplimiento-export`
Expected: PASS (todas las aserciones actualizadas + los 2 casos nuevos).

- [x] **Step 5: Typecheck fiable**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida. (La ruta `exportar/route.ts` construye `ActividadExport` con `...a`, que ya incluye `finca`/`nota`; si el typecheck se quejara de que faltan, se resuelve en Task 2.)

- [x] **Step 6: Commit**

```bash
git add src/dominio/cumplimiento-export.ts src/dominio/cumplimiento-export.test.ts
git commit -m "feat(cumplimiento): Excel con columnas Finca y Observacion"
```

---

### Task 2: Ruta — registro día a día (maquinaria por fila, incluir novedades)

**Files:**
- Modify: `src/app/cumplimiento/exportar/route.ts`

**Interfaces:**
- Consumes: `filasCumplimiento`, `filasCumplimientoGrupo`, `COLUMNAS_CUMPLIMIENTO` (Task 1); `esMaquinaria` de `@/dominio/variante`; `agruparPorActividad`, `estadoActividad`.

- [x] **Step 1: Importar `esMaquinaria` y `filasCumplimiento`**

En `src/app/cumplimiento/exportar/route.ts`:
- En el import de `@/dominio/cumplimiento-export`, añadir `filasCumplimiento` (junto a `COLUMNAS_CUMPLIMIENTO, filasCumplimientoGrupo`).
- Añadir: `import { esMaquinaria } from '@/dominio/variante'`.

- [x] **Step 2: Ramar por área y dejar de omitir novedades**

En `src/app/cumplimiento/exportar/route.ts`, reemplazar la función `agregarGrupos` (líneas ~63-81) por:

```ts
  const agregarGrupos = (
    items: ((typeof actividades)[number] | (typeof solicitadas)[number])[],
    ejecutadaPor: (grupo: typeof items) => string,
    esMaq: (grupo: typeof items) => boolean,
  ) => {
    for (const grupo of agruparPorActividad(items).values()) {
      const e = estadoActividad(grupo.map((a) => ({ estado: a.estado as Estado })))
      if (e === 'PENDIENTE') continue // solo se omite lo pendiente (sin evento)
      if (esMaq(grupo)) {
        // Maquinaria: una fila por FILA (día·responsable), sin agrupar (cada día su medida).
        for (const f of grupo) {
          if (f.estado === 'PENDIENTE') continue
          for (const fila of filasCumplimiento(
            aExport(f),
            fechaDeDia(f.dia),
            unidadPorNombre,
            { fechaDeDia, nombreMaquina },
            ejecutadaPor(grupo),
          )) {
            ws.addRow(fila)
          }
        }
      } else {
        // Estándar: una fila por avance, agrupada (misma medida en las hermanas).
        for (const fila of filasCumplimientoGrupo(
          grupo.map(aExport),
          fechaDeDia(grupo[0].dia),
          unidadPorNombre,
          { fechaDeDia, nombreMaquina },
          ejecutadaPor(grupo),
        )) {
          ws.addRow(fila)
        }
      }
    }
  }
```

- [x] **Step 3: Pasar el detector de maquinaria en las dos llamadas**

En `src/app/cumplimiento/exportar/route.ts`, reemplazar:
```ts
  // Actividades propias del área.
  agregarGrupos(actividades, () => '')
  // Actividades que esta área solicitó a otra (ejecutadas por la otra área).
  agregarGrupos(solicitadas, (grupo) => (grupo[0] as (typeof solicitadas)[number]).area.nombre)
```
por:
```ts
  // Actividades propias del área.
  agregarGrupos(actividades, () => '', () => esMaquinaria(area, 'cumplimiento'))
  // Actividades que esta área solicitó a otra (ejecutadas por la otra área).
  agregarGrupos(
    solicitadas,
    (grupo) => (grupo[0] as (typeof solicitadas)[number]).area.nombre,
    (grupo) => esMaquinaria((grupo[0] as (typeof solicitadas)[number]).area, 'cumplimiento'),
  )
```

> `aExport` ya incluye `finca` y `nota` vía `...a` (vienen de `listarActividades`/`Solicitadas`); no requiere cambios. Si el typecheck exige que `ActividadExport` traiga `finca` como `{ nombre }`, el objeto de Prisma (relación `finca`) lo satisface estructuralmente.

- [x] **Step 4: Typecheck fiable**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida.

- [x] **Step 5: Suite de tests sigue verde**

Run: `npm test`
Expected: PASS.

- [x] **Step 6: Verificación manual**

Run: `npm run dev`, abrir `/cumplimiento` (admin) y descargar el Excel (botón "Exportar", `/cumplimiento/exportar?...`).
Verificar en un área de **maquinaria** con una actividad multi-día: aparece **una fila por día** (el día reemplazado con "Cambiada por…" en Observación; el reemplazo como fila propia "En reemplazo de…"; el avance de otro día con su cantidad); columna **Finca** poblada; no aparecen las PENDIENTE. En un área **estándar**: una fila por avance (día·lote), sin duplicar por responsable, con Finca/Observación. Si no hay datos a mano, validar en el deploy.

- [x] **Step 7: Commit**

```bash
git add src/app/cumplimiento/exportar/route.ts
git commit -m "feat(cumplimiento): Excel registro dia a dia (maquinaria por fila, incluye novedades)"
```

---

## Notas de cierre

- No se añade columna Motivo (la novedad se ve en Observación/nota); posible follow-up.
- Despliegue: flujo habitual de Vercel; el build corre typecheck real.

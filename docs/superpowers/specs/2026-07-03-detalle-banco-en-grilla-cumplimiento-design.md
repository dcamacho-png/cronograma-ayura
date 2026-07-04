# Observación del banco (`detalle`) en grilla, tarjeta de cumplimiento y Excel — Design Spec (Entrega A)

**Fecha:** 2026-07-03

## Objetivo

La observación/detalle que se escribe al crear una tarea en el banco (`Tarea.detalle`, textarea "detalle" — p. ej. "aplicar urea, 2 bultos/ha") hoy solo se ve en la pestaña **Tareas**. Debe verse también en:
- la **grilla** del cronograma (`/programar`), en la celda de cada actividad;
- la **tarjeta** de cada actividad en **/cumplimiento**;
- el **Excel** de cumplimiento (nueva columna).

Esta es la **Entrega A**. El rework de estados + historial de novedades (Entrega B) es un ciclo aparte y NO se toca aquí.

## Decisiones confirmadas (brainstorming)

- Se lee `Tarea.detalle` por la relación `Actividad.tarea` (no se copia ni se migra data). Actividades sin `tareaId` (creadas a mano / reemplazo) no tienen detalle → no se muestra nada.
- Se muestra en grilla + tarjeta + Excel.
- En pantalla se muestra como `📝 {detalle}`, con el mismo estilo `text-tierra` que 🚜/🏠.

## Contexto (verificado en código)

- `Tarea.detalle: String?` (schema l.134). Se captura en `form-nueva-tarea-estandar.tsx`/`form-nueva-tarea-maquinaria.tsx` (textarea `name="detalle"`) y se muestra en `tareas/page.tsx` como `📝 {t.detalle}`. NO se propaga a `Actividad`.
- `listarActividades(areaId, anio, semana)` (`repositorio.ts:39`) hace `findMany` con `include: { responsable, finca, motivo, maquina, areaTarea, lotes, _count }` — **no** incluye `tarea`. La usan tanto `/programar` como `/cumplimiento`.
- `listarActividadesSolicitadas(...)` (`repositorio.ts:57`) — include análogo (+ `area`); la usa el Excel para lo solicitado a otras áreas.
- `GrillaSemana` (`programar/grilla-semana.tsx`): tipo local `Actividad` (≈l.10-14) y celda (≈l.84-100) que pinta `a.descripcion`, turno, `🚜 a.maquina.nombre`, `🏠 a.finca.nombre`, `InfoLotes`. Mismo componente se usa para pantalla y para exportación (`paraExportar`).
- `/cumplimiento` `page.tsx`: la tarjeta pinta `<InfoLotes … className="mb-2" />` (l.217) tras la cabecera; `cab` es la fila representativa del grupo.
- Excel: `COLUMNAS_CUMPLIMIENTO` (`dominio/cumplimiento-export.ts:8`) — 15 columnas terminando en `'Observación'`. `ActividadExport` (l.24-40) es el tipo de entrada. `filasCumplimiento` arma las filas; `filasCumplimientoGrupo` es el wrapper por grupo. La ruta `cumplimiento/exportar/route.ts` llama a `listarActividades`/`listarActividadesSolicitadas` y a `filasCumplimientoGrupo`, y escribe `COLUMNAS_CUMPLIMIENTO` como cabecera.

## Diseño

### A. Datos — incluir `tarea.detalle`

En `repositorio.ts`, añadir a los `include` de `listarActividades` y `listarActividadesSolicitadas`:
```ts
      tarea: { select: { detalle: true } },
```
Con esto cada actividad trae `a.tarea?.detalle: string | null | undefined`. (Ambas ya devuelven objetos Prisma; el tipo se ensancha solo.)

### B. Grilla (`GrillaSemana`)

- En el tipo local `Actividad`, añadir `tarea?: { detalle: string | null } | null`.
- En la celda (junto a las líneas de 🚜/🏠), añadir:
```tsx
  {a.tarea?.detalle && (
    <div className={`whitespace-pre-line text-tierra ${paraExportar ? 'text-sm' : 'text-xs'}`}>📝 {a.tarea.detalle}</div>
  )}
```

### C. Tarjeta de /cumplimiento

- Tras `<InfoLotes … />` (l.217), añadir:
```tsx
  {cab.tarea?.detalle && (
    <div className="mb-2 whitespace-pre-line text-xs text-tierra">📝 {cab.tarea.detalle}</div>
  )}
```
(`cab` ya trae `tarea.detalle` por el cambio en A.)

### D. Excel de cumplimiento

- En `cumplimiento-export.ts`:
  - Añadir la columna `'Detalle (banco)'` a `COLUMNAS_CUMPLIMIENTO` (al final, tras `'Observación'`).
  - Añadir `detalle?: string | null` a `ActividadExport`.
  - En `filasCumplimiento`, agregar `a.detalle ?? ''` como último valor de **cada** fila que produce la actividad (tras la observación), en todos los caminos que devuelven filas (con avances: una por avance; sin avances: la fila-resumen). `filasCumplimientoGrupo` no cambia: arma `representativa` con `...base`, así que `detalle` fluye solo.
- En `cumplimiento/exportar/route.ts`: el mapper `aExport` (≈l.61) hace `{ ...a, … }`; añadirle `detalle: a.tarea?.detalle ?? null` (aplica a propias y solicitadas, ambas ahora incluyen `tarea.detalle`).

## Testing

- **Dominio (Vitest):** `cumplimiento-export.test.ts` ya existe — añadir un caso que verifique que la fila trae `detalle` como última columna cuando `ActividadExport.detalle` está presente, y `''` cuando es null/ausente. Ajustar cualquier aserción existente que compare la longitud/última columna de la fila (ahora hay 16 columnas).
- **UI/repo:** typecheck fiable (`npx tsc --noEmit -p tsconfig.check.json`) + `next build`.
- **Manual (preview):**
  1. Crear una tarea con detalle → programarla → en la **grilla** de esa semana la celda muestra `📝 {detalle}`.
  2. En **/cumplimiento**, la tarjeta de esa actividad muestra `📝 {detalle}`.
  3. Descargar el **Excel**: la columna "Detalle (banco)" trae el detalle en las filas de esa actividad; en actividades sin tarea/ detalle, va vacía.

## Fuera de alcance

- Entrega B: Parcial solo desde avances, unificar No cumplida/Reprogramada en "No se hizo" + reprogramar, e historial de novedades.
- Editar el `detalle` desde cumplimiento (solo se muestra; se edita donde ya se edita la tarea/solicitud).
- Propagar `detalle` a otras pantallas (tablero, resumen).

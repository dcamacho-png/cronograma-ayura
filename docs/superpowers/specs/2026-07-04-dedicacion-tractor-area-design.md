# Dedicar tractor a un área (día a día) + mostrar todos los tractores — Design

**Fecha:** 2026-07-04
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

En `/programar` del área de maquinaria hay una grilla de solo lectura **"🚜 Resumen por tractor"** (`src/app/programar/grilla-tractor.tsx`), inverso del cronograma: una fila por tractor, columnas Lun–Dom, con la(s) actividad(es) y el responsable de cada tractor por día. Hoy:

- Solo aparecen los tractores que **tienen alguna actividad** esa semana (si `tractores.size === 0`, la grilla no se muestra).
- Se alimenta con `actividadesCronograma` (actividades del área de maquinaria, que es la única que asigna máquina).
- Es 100% solo-lectura; no hay forma de reservar un tractor para un área.

Las máquinas (`model Maquina { id, nombre }`) no tienen relación con área. Las áreas se marcan como "maquinaria" por bandera (`Area.maqProgramar`, vía `esMaquinaria(area, 'programar')` en `src/dominio/variante.ts`).

## Objetivo

1. En la grilla de tractores deben aparecer **todos** los tractores del catálogo, tengan o no actividad esa semana.
2. Poder marcar que un tractor queda **dedicado a un área ese día** (sin responsable ni actividad), **día a día**, desde la misma grilla; y desmarcarlo.

## Decisiones (acordadas)

1. **Duración: día a día.** La dedicación se pone por **celda (tractor × día)** de la semana seleccionada; cada día es independiente.
2. **Solo informativo.** La dedicación se muestra en la grilla pero **no** bloquea la asignación de ese tractor en otras actividades (no toca el conflicto de máquina).
3. **Se marca en la misma grilla de tractores.** Cada celda de día lleva un control (desplegable de área + "— ninguna —"), visible **solo en semanas futuras** (editables); en semanas ya iniciadas la grilla sigue en solo-lectura.
4. **Áreas ofrecidas: todas menos las de maquinaria** (las que tengan `maqProgramar = false`). Dedicar un tractor "a maquinaria" no tiene sentido.
5. **Visual:** una celda (tractor × día) dedicada muestra **"🔒 &lt;área&gt;"** (sin responsable ni actividad). Las celdas no dedicadas muestran sus actividades por día como hoy; las sin nada, vacías (con el control de dedicar si la semana es futura).
6. **Todos los tractores** salen siempre (orden por nombre). La grilla solo deja de mostrarse si el catálogo de máquinas está vacío.
7. Requiere **cambio de esquema** (tabla nueva + migración).

## Arquitectura

### Esquema — `prisma/schema.prisma`
Tabla nueva:
```prisma
model DedicacionTractor {
  id        String  @id @default(cuid())
  maquinaId String
  maquina   Maquina @relation(fields: [maquinaId], references: [id])
  areaId    String
  area      Area    @relation(fields: [areaId], references: [id])
  anio      Int
  semana    Int
  dia       Int
  @@unique([maquinaId, anio, semana, dia])
}
```
- Back-relations: `Maquina` gana `dedicaciones DedicacionTractor[]`; `Area` gana `dedicaciones DedicacionTractor[]`.
- Única por `(maquinaId, anio, semana, dia)`: un tractor solo puede estar dedicado a un área por día.
- `dia` = 1..7 (Lun..Dom), igual que `Actividad.dia`.
- Migración con `prisma migrate dev` (nombre `dedicacion_tractor`); el deploy corre `prisma migrate deploy`.

### Dominio — `src/dominio/tractor.ts` (nuevo, puro y testeable)
`construirFilasTractor(maquinas, actividades, dedicaciones)`:
- `maquinas: { id: string; nombre: string }[]`
- `actividades: ActividadTractor[]` (las que ya usa la grilla; con `maquinaId`, `dia`, `descripcion`, `turno`, `responsable`)
- `dedicaciones: { maquinaId: string; dia: number; areaNombre: string }[]`
- Devuelve, **una fila por máquina** (orden por nombre): `{ maquinaId, nombre, actividades: ActividadTractor[], dedicadasPorDia: Record<number, string> }` donde `dedicadasPorDia[dia]` es el nombre del área dedicada ese día (si existe). `actividades` = las de ese tractor (para las celdas por día).
- Función pura; tests: (a) salen todas las máquinas aunque no tengan actividad; (b) una máquina con dedicación en un día trae ese día en `dedicadasPorDia` con el nombre del área; (c) sin dedicación `dedicadasPorDia` es `{}` y conserva sus actividades; (d) orden por nombre; (e) dos días distintos del mismo tractor dedicados a áreas distintas conviven.

### Repositorio — `src/datos/repositorio.ts`
- `listarDedicaciones(anio, semana)`: `findMany({ where: { anio, semana }, include: { area: true } })` → lista con `maquinaId`, `dia` y `area.nombre`.
- `dedicarTractor(maquinaId, areaId, anio, semana, dia)`: si `areaId` es vacío/null → `deleteMany({ where: { maquinaId, anio, semana, dia } })` (quitar); si no → `upsert` sobre la clave única `(maquinaId, anio, semana, dia)` fijando `areaId` (crear o actualizar).

### Acción — `src/app/programar/acciones.ts`
- `dedicarTractorAccion(formData)`:
  - Lee `maquinaId`, `areaId` (puede venir `''`), `anio`, `semana`, `dia`.
  - Auth: `usuarioActual()`; debe poder ver `programar` y ser ADMIN o de un área con `maqProgramar` (mismo criterio que ya rige la grilla). Si no, redirige.
  - Solo semanas futuras (`esSemanaFutura`); si no, no muta (redirige a la grilla en solo-lectura).
  - Llama `dedicarTractor(...)`, `revalidatePath('/programar')` y redirige de vuelta a `/programar?area=&anio=&semana=`.
  - Sigue el patrón de las acciones existentes en ese archivo (`asignarTareaAccion`, `devolverAlBancoAccion`).

### Página — `src/app/programar/page.tsx`
- Añade `listarDedicaciones(anio, semana)` al `Promise.all` (junto a `maquinas`).
- Calcula `areasParaDedicar = areas.filter((a) => !esMaquinariaVar(a, 'programar'))`.
- Pasa a `GrillaTractor`: `maquinas` (todas), `dedicaciones`, `areasParaDedicar`, `futura`, `anio`, `semana`, `accion={dedicarTractorAccion}` (además de `fechas` y `actividades` que ya recibe).

### Componente — `src/app/programar/grilla-tractor.tsx`
- Usa `construirFilasTractor(maquinas, actividades, dedicaciones)` para las filas (una por máquina).
- Si `filas.length === 0` (catálogo vacío) → `null`.
- Por fila, columna "Tractor": `🚜 {nombre}`. Luego una celda por día (Lun..Dom):
  - Si `dedicadasPorDia[dia]` existe → **"🔒 {área}"** (más el control preseleccionado a esa área, si `futura`, para poder cambiarla/quitarla).
  - Si no → las actividades de ese día (como hoy) y, si no hay actividad, celda vacía; más el control de dedicar si `futura`.
- **Control de dedicar (por celda, solo `futura`):** componente cliente pequeño `src/app/programar/select-dedicacion.tsx` (`'use client'`): un `<form action={accion}>` con inputs ocultos (`maquinaId`, `anio`, `semana`, `dia`) y un `<select name="areaId">` **no controlado** (`defaultValue = areaId dedicado ese día o ''`) con `<option value="">— ninguna —</option>` + `areasParaDedicar`, que **auto-envía** en `onChange` (`ev.currentTarget.form?.requestSubmit()`). Sin estado React que gobierne el valor (evita el problema conocido de selects controladas en verificación headless).

## Casos borde

- **Semana ya iniciada / pasada:** no aparece el control (grilla solo-lectura); las dedicaciones existentes de esos días igual se muestran (🔒 área).
- **Celda con actividad y dedicación el mismo día:** por ser solo informativo, prevalece la dedicación "🔒 área" en esa celda (la actividad de ese día no se lista ahí). Caso improbable (si está dedicado no se le asigna otra cosa ese día).
- **Quitar dedicación:** elegir "— ninguna —" borra el registro de ese día.
- **Catálogo de máquinas vacío:** la grilla no se muestra (igual que hoy con 0 tractores usados).
- **Cambiar de semana:** cada semana (y cada día) tiene sus propias dedicaciones (independientes).

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Migración aplicada + Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- Vitest: tests nuevos de `construirFilasTractor` + suite existente verde.
- En vivo (server local + cookie firmada, ADMIN): en `/programar` del área de maquinaria, semana **futura**, aparecen todos los tractores; dedicar un tractor en un día a un área (menos maquinaria) muestra "🔒 &lt;área&gt;" en esa celda; "— ninguna —" la quita; otro día del mismo tractor puede dedicarse a otra área; en una semana ya iniciada no aparece el control pero sí las dedicaciones existentes. Prueba de escritura reversible (dedicar un día → verificar → quitar).

## Fuera de alcance

- Bloquear el tractor / conflicto de máquina (se eligió "solo informativo").
- Dedicación por semana completa o permanente (se eligió día a día).
- Export PDF de `/programar` (la grilla de tractores no está en el export) y export de imagen.
- Dedicar a áreas de maquinaria.
- Cambios en el cronograma principal (`GrillaSemana`).

# Actividades nuevas no programadas (novedades de la semana)

Estado: APROBADO (2026-06-20)

## Problema / petición

Durante la semana surgen actividades que no estaban en el cronograma. Se quiere **registrarlas en Cumplimiento** (como hechas), que **NO cambien el cronograma** (Programar), y que el **Resumen muestre cuántas** actividades nuevas no programadas hubo (con su lista).

## Decisiones acordadas

- Captura: botón **"+ Agregar actividad realizada"** en Cumplimiento → formulario con **responsable, día (Lun–Dom de la semana vista), descripción, finca→lote (opcional)** y, si el área es Maquinaria, **máquina (opcional)**. Se guarda como **CUMPLIDA**.
- Se marca como **no programada** (`noProgramada = true`).
- **No aparece en Programar** (ni en la grilla ni en la detección de choques): el cronograma planeado no cambia. Sí aparece en Cumplimiento (como registrada) y en Resumen.
- En **Resumen**: sección "🆕 Actividades nuevas (no programadas): N" + la lista (descripción · responsable · lote). Como son cumplidas, **también suman** en el cumplimiento general.

## Contexto técnico

- `Actividad` (Prisma/Postgres) — se agrega `noProgramada Boolean`.
- `cumplimiento/page.tsx` ya trae `motivos, actividades, lotes, maquinas` y `motivoCambioId` (de la corrección anterior); `esMaquinaria` calculado. NO trae responsables aún.
- `programar/page.tsx`: la grilla (`GrillaSemana`) y `ocupacion` se construyen de `actividades` (de `listarActividades`). Las `noProgramada` deben excluirse aquí.
- `programar/exportar/page.tsx` (PDF cronograma) usa `GrillaSemana` por área → también debe excluir `noProgramada`.
- `resumen-area.tsx`: tipo `ActividadResumen`; render del informe.
- Cumplimiento permite semanas pasadas (registrar lo ocurrido) → la nueva acción NO bloquea semanas pasadas.

## Modelo de datos

Agregar a `Actividad`:
```prisma
  noProgramada Boolean @default(false)
```
Migración incremental `prisma/migrations/20260620150000_add_no_programada/migration.sql`:
```sql
ALTER TABLE "Actividad" ADD COLUMN "noProgramada" BOOLEAN NOT NULL DEFAULT false;
```

## Componentes y cambios

### Repositorio (`src/datos/repositorio.ts`)
Nueva función:
```ts
export async function crearActividadRealizada(datos: {
  areaId: string
  anio: number
  semana: number
  dia: number
  responsableId: string
  descripcion: string
  loteId: string | null
  maquinaId: string | null
}) {
  let fincaId: string | null = null
  if (datos.loteId) {
    const lote = await prisma.lote.findUnique({ where: { id: datos.loteId } })
    fincaId = lote?.fincaId ?? null
  }
  return prisma.actividad.create({
    data: {
      anio: datos.anio,
      semana: datos.semana,
      dia: datos.dia,
      descripcion: datos.descripcion,
      estado: 'CUMPLIDA',
      noProgramada: true,
      areaId: datos.areaId,
      fincaId,
      responsableId: datos.responsableId,
      maquinaId: datos.maquinaId,
      lotes: datos.loteId ? { connect: [{ id: datos.loteId }] } : undefined,
    },
  })
}
```

### Acción (`src/app/cumplimiento/acciones.ts`)
Nueva acción `agregarActividadRealizadaAccion(form)`:
- lee `areaId`, `anio`, `semana`, `dia` (número), `responsableId`, `descripcion`, `loteId` (opcional), `maquinaId` (opcional).
- valida obligatorios: `areaId, anio, semana, dia (1–7), responsableId, descripcion`; si falta algo, retorna sin hacer nada.
- llama `crearActividadRealizada(...)` y `revalidatePath('/cumplimiento')`.

### Formulario cliente (`src/app/cumplimiento/form-actividad-realizada.tsx`)
Componente `'use client'` con props `{ areaId, anio, semana, esMaquinaria, responsables: {id,nombre}[], lotes: Lote[], maquinas: {id,nombre}[], accion }`:
- hidden `areaId`, `anio`, `semana`.
- select **Responsable** (`name="responsableId"`, required, de `responsables`).
- select **Día** (`name="dia"`, required, opciones 1–7 con etiquetas Lun…Dom).
- input **Descripción** (`name="descripcion"`, required).
- **finca→lote**: `<SelectFincaLote lotes={lotes} name="loteId" />`.
- si `esMaquinaria`: select **Máquina** (`name="maquinaId"`, opción "— sin máquina —" + `maquinas`).
- botón "Agregar".

### Página de Cumplimiento (`src/app/cumplimiento/page.tsx`)
- Traer también responsables **activos** del área: agregar `listarResponsablesPorArea(areaId)` al `Promise.all` y filtrar `.filter((r) => r.activo)`.
- Renderizar `<FormActividadRealizada ... />` (en un recuadro arriba de la lista de actividades), pasando `areaId, anio, semana, esMaquinaria, responsables, lotes, maquinas` y `agregarActividadRealizadaAccion`.
- La lista de actividades no cambia: las `noProgramada` (cumplidas) ya se muestran como registradas.

### Programar (`src/app/programar/page.tsx`)
- Tras `listarActividades`, derivar `const actividadesCronograma = actividades.filter((a) => !a.noProgramada)` y usar **ese** para construir `ocupacion` y para el prop `actividades` de `GrillaSemana`. (Lo demás igual.)

### Exportar cronograma (`src/app/programar/exportar/page.tsx`)
- Donde se arma `datos` por área, filtrar las actividades de cada área con `.filter((a) => !a.noProgramada)` antes de pasarlas a `GrillaSemana`.

### Resumen (`src/app/resumen/resumen-area.tsx`)
- `ActividadResumen`: agregar `noProgramada: boolean`.
- Calcular `const nuevas = actividades.filter((a) => a.noProgramada)`.
- Agregar una sección (antes de "Actividades cambiadas o reprogramadas"):
  - Título "🆕 Actividades nuevas (no programadas) ({nuevas.length})".
  - Lista de `nuevas`: `descripción · responsable · 📍 lote(s)` (si hay).
  - Si `nuevas.length === 0`, no mostrar la sección.

## Qué NO cambia

- Flujos de cambio de actividad y hectáreas realizadas (recién hechos): intactos.
- Banco, programación normal, login, etc.: sin cambios.
- Las `noProgramada` cuentan como cumplidas en el % y conteos del Resumen (decisión acordada).

## Pruebas

- Sin lógica de dominio pura nueva → sin tests unitarios nuevos. Verificación: `npx tsc --noEmit` y `npm run lint` limpios; suite (65) verde.
- Verificación manual (tras desplegar): en Cumplimiento, "+ Agregar actividad realizada" crea una cumplida que NO aparece en Programar, sí en Cumplimiento, y el Resumen muestra la sección "Actividades nuevas (no programadas)" con el conteo y la lista.

## Despliegue (después del código)

1. `git push` + `vercel deploy --prod` → el build aplica la migración `add_no_programada` en Neon.
2. Verificar en la URL.

## Notas

- Migración aditiva (columna con default), sin pérdida de datos.
- La unidad por actividad (Ha/Hora/Kg) es la funcionalidad **B**, aparte (siguiente ciclo).

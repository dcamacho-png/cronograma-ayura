# Tabla resumen por tractor — Design Spec

**Fecha:** 2026-06-29

## Objetivo

Añadir en `/programar`, para áreas de maquinaria, una tabla de **solo lectura** que resuma la semana **por tractor** (el inverso del cronograma): una fila por tractor, columnas Lun–Dom, y en cada celda la(s) actividad(es) de ese tractor ese día con su responsable. No se edita.

## Contexto

- El cronograma actual (`src/app/programar/grilla-semana.tsx`) muestra **responsable (filas) × día (columnas)**, con la máquina (🚜) dentro de cada actividad.
- `src/app/programar/page.tsx` ya carga `actividadesCronograma` (filas de `listarActividades`, que incluyen `responsable`, `maquina`, `lotes`) y `fechas` (las 7 fechas de la semana). La variante de maquinaria se detecta con `esMaquinaria` (`esMaquinariaVar(areaActual, 'programar')`).
- `DIAS = ['Lunes', ... 'Domingo']` (índice 0..6 ↔ `dia` 1..7).

## Diseño

Una tabla nueva, espejo del cronograma, **debajo** de la grilla actual.

**Componente nuevo:** `src/app/programar/grilla-tractor.tsx` — presentacional puro (Server Component, sin `'use client'`, sin formularios ni acciones).

**Props:**
```ts
type ActividadTractor = {
  id: string
  dia: number                       // 1..7
  descripcion: string
  turno: string
  maquinaId: string | null
  maquina: { nombre: string } | null
  responsable: { nombre: string }
}

function GrillaTractor({
  fechas,
  actividades,
}: {
  fechas: Date[]
  actividades: ActividadTractor[]
}): JSX.Element | null
```

**Lógica:**
- Filtrar las actividades que **tienen** `maquinaId`/`maquina` (las sin tractor se omiten; siguen en el cronograma normal).
- Agrupar por `maquinaId` (mostrando `maquina.nombre`); **solo** los tractores con ≥1 actividad esa semana; ordenar las filas por nombre de tractor (asc).
- Si no queda ningún tractor, el componente **devuelve `null`** (no se muestra la sección).
- Columnas: los 7 días (`DIAS`), con la fecha bajo cada día (igual que el cronograma).
- Celda (tractor, día): las actividades de ese tractor en ese `dia`. Por cada una, mostrar **descripción** + **responsable** (y el `turno` si no está vacío). Si hay varias (p. ej. dos turnos), se **apilan**. Día sin actividad = celda vacía.

**Estilo:** consistente con `GrillaSemana` — `table` con `border-collapse`, bordes `border-borde`, cabezado `bg-arena`, paleta cálida (tokens existentes). Encabezado de sección tipo `🚜 Resumen por tractor`.

**Integración en `page.tsx`:**
- Importar `GrillaTractor` y renderizarlo **después** del bloque `<div className="mb-6">…<GrillaSemana .../></div>` del cronograma visible y **antes** del bloque oculto de export (`#grilla-export`).
- Condicionado a `esMaquinaria` (la tabla por tractor solo tiene sentido en maquinaria). Pasarle `fechas` y `actividadesCronograma`.

## Fuera de alcance

- **No** se incluye en la imagen descargada ni en el PDF (esos quedan idénticos; el bloque `#grilla-export` no se toca).
- **No** edición, formularios ni acciones de servidor.
- **No** se listan tractores ociosos (solo los usados esa semana).
- **No** se muestran lotes en esta tabla (decisión del usuario; el cronograma ya los muestra).

## Testing

- Convención del repo: el componente/RSC se verifica con **typecheck fiable** (tsconfig que excluye `.next`) + **ejecución/verificación en vivo**; no lleva tests unitarios (no hay lógica de dominio nueva). El agrupamiento por tractor vive en el componente.
- Verificación manual en `/programar` (área de maquinaria, semana con actividades): la tabla lista los tractores usados, cada uno con su actividad y responsable en el día correcto; tractores sin uso no aparecen; actividades sin tractor no aparecen; varios turnos del mismo tractor/día se apilan; en áreas no-maquinaria la tabla no se muestra; imagen y PDF sin cambios.

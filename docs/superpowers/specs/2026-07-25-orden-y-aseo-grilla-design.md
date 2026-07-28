# Orden y aseo en la grilla de programación — Diseño

Fecha: 2026-07-25

## Objetivo

Agregar a la grilla de `/programar` una fila extra rotulada `🧹 Orden y aseo` que
registra, por día de la semana, uno o varios encargados de orden y aseo. Es una
programación **única y compartida**: la misma fila aparece en la grilla de todas
las áreas.

## Comportamiento acordado

- Fila extra al final de la grilla, con las 7 columnas de días (lunes…domingo).
- **Global y compartida**: no es por área. La misma programación de orden y aseo
  se muestra en la grilla de cualquier área.
- Cada día puede tener **uno o varios encargados**, elegidos de **todos los
  responsables** (de cualquier área).
- **Editable por cualquier área** con permiso de `programar` (ADMIN también;
  VISOR no), respetando el **mismo candado de tiempo** que el resto de la
  programación: `programacionAbierta(anio, semana)` (hasta el lunes 11pm de esa
  semana; después es solo lectura).
- Aparece en **pantalla** y en la **imagen de WhatsApp** (la foto de la grilla).
  NO aparece en el PDF de todas las áreas ni en el Excel maestro a Drive.

## Modelo de datos

Nueva tabla global, una fila por asignación `(anio, semana, dia, responsable)`:

```prisma
model OrdenAseo {
  id            String      @id @default(cuid())
  anio          Int
  semana        Int
  dia           Int          // 1=lunes … 7=domingo
  responsableId String
  responsable   Responsable @relation(fields: [responsableId], references: [id], onDelete: Cascade)

  @@unique([anio, semana, dia, responsableId])
  @@index([anio, semana])
}
```

En `Responsable` se agrega la relación inversa: `ordenAseo OrdenAseo[]`.

`onDelete: Cascade`: si se elimina un responsable, sus asignaciones de orden y
aseo se borran solas.

Migración: crea una tabla nueva y agrega una relación inversa (sin columnas
nuevas en tablas existentes). Es segura para producción (no toca datos actuales).
Se aplica con el flujo normal de Prisma (`migrate deploy` en producción — NUNCA
`migrate reset` contra prod).

## Datos y repositorio (`src/datos/repositorio.ts`)

- `listarOrdenAseo(anio, semana)` → `Promise<{ dia: number; responsableId: string; nombre: string }[]>`
  (global; incluye el nombre del responsable ya resuelto para pintar los chips).
- `agregarOrdenAseo(anio, semana, dia, responsableId)` → crea la fila si no existe.
  Idempotente gracias al `@@unique` (usar `upsert` o `createMany` con
  `skipDuplicates`, o `create` capturando el choque de único).
- `quitarOrdenAseo(anio, semana, dia, responsableId)` → borra la fila
  correspondiente.
- `listarTodosResponsables()` → `{ id: string; nombre: string; areaNombre: string }[]`
  con los responsables **activos** de todas las áreas, para poblar el selector.
  Se muestra `nombre — área` en el `<select>` para desambiguar nombres repetidos.
  (Un responsable ya asignado que luego se inactiva sigue apareciendo como chip
  porque su nombre viene de `listarOrdenAseo`, no del selector.)

## Server actions (`src/app/programar/acciones.ts`)

Dos acciones nuevas:

- `agregarOrdenAseoAccion(form)` — lee `anio`, `semana`, `dia`, `responsableId`.
- `quitarOrdenAseoAccion(form)` — lee `anio`, `semana`, `dia`, `responsableId`.

Autorización **global** (no por área, porque el recurso es compartido y no
pertenece a ninguna área):

- Usuario con sesión válida, con permiso `programar` y que NO sea solo-lectura
  (Visor). ADMIN pasa; VISOR nunca.
- `programacionAbierta(anio, semana)` debe ser verdadero.
- Se implementa con un helper nuevo (p. ej. `autorizadoGlobalProgramar()`) que
  usa `usuarioActual()` + `puedeVer(u, 'programar')` + `!esSoloLectura(u)`. Se
  documenta en el código que esto se aparta a propósito del patrón
  `puedeMutarArea` porque orden y aseo no tiene dueño de área.

Ambas acciones validan que `anio`/`semana`/`dia` sean enteros válidos
(`dia` en 1..7) y llaman `revalidatePath('/programar')`.

## UI

### `src/app/programar/grilla-semana.tsx`

Nuevos props (opcionales, para no romper otros usos):

- `ordenAseo?: { dia: number; responsableId: string; nombre: string }[]`
- `todosResponsables?: { id: string; nombre: string; areaNombre: string }[]`

Render: una fila nueva al final del `<tbody>`, **fuera** de la agrupación por
finca (porque es global, aparece una sola vez):

- Celda-rótulo: `🧹 Orden y aseo`.
- 7 celdas (una por día). Cada celda muestra:
  - **Chips** de encargados de ese día (`nombre`), cada uno con `✕` para quitar
    (solo si `editable`), vía `quitarOrdenAseoAccion`.
  - Si `editable`: un `<select>` con `todosResponsables` (opciones
    `nombre — área`) + botón `➕` que envía `agregarOrdenAseoAccion`. Se ocultan
    en el select los que ya están asignados ese día (opcional; si no, el
    `@@unique` lo hace idempotente).
- En modo `paraExportar` (imagen de WhatsApp): solo los chips como texto, sin
  `<select>` ni botones (igual que el resto de controles, que ya se apagan con
  `editable = turnoEditable && !paraExportar`).

La fila se distingue visualmente (p. ej. `bg-arena` en la celda-rótulo y borde
superior) para separarla de los responsables.

### `src/app/programar/page.tsx`

- Agregar a las consultas en paralelo: `listarOrdenAseo(anio, semana)` y
  `listarTodosResponsables()`.
- Pasar `ordenAseo` y `todosResponsables` a **ambos** usos de `GrillaSemana`
  (el de pantalla y los de exportación por finca), para que la fila salga también
  en la imagen de WhatsApp.
- `editable` de la fila = `programable && !soloLectura` (igual que el resto de la
  grilla; ver `turnoEditable` que ya se pasa así).

## Fuera de alcance (YAGNI)

- No aparece en el PDF de todas las áreas ni en el Excel maestro a Drive.
- No hay historial/edición por observaciones ni estados de cumplimiento del orden
  y aseo — es solo la asignación de encargados por día.
- No hay lista separada de "personas de orden y aseo": se usa el listado de
  responsables existente.

## Pruebas

- Dominio/repositorio: `agregarOrdenAseo` es idempotente (no duplica ante
  `(anio, semana, dia, responsableId)` repetido); `quitarOrdenAseo` borra solo la
  fila indicada; `listarOrdenAseo` devuelve los nombres resueltos y solo de la
  semana pedida.
- Autorización: la acción rechaza a VISOR y a usuarios sin permiso `programar`;
  rechaza cuando `programacionAbierta` es falso.

# Respaldo a Drive: un archivo por área, con hoja General + hojas por mes

**Fecha:** 2026-07-20
**Estado:** aprobado, pendiente de implementación

## Objetivo

Reemplazar el respaldo actual (un único `cumplimiento-maestro.xlsx` con una sola hoja que mezcla
todas las áreas) por **un archivo Excel por cada área**, y dentro de cada archivo: una hoja
**General** con toda la información de esa área + una **hoja por mes** con la info de ese mes.

Pedido por dcamacho (2026-07-20), afinando el respaldo diario existente
([[pendiente-excel-drive]]).

## Estructura resultante en Drive

Un `.xlsx` por área que tenga datos (áreas sin datos no generan archivo):

```
Carpeta Drive/
 ├─ cumplimiento-Ganadería-ceba.xlsx
 │    ├─ General   ← toda la info del área (todas las semanas/meses)
 │    ├─ 2026-07   ← solo julio de esa área
 │    ├─ 2026-08
 │    └─ …
 ├─ cumplimiento-Nelore.xlsx   (misma estructura)
 └─ …
```

- **NO** hay archivo cruzado entre áreas: cada archivo es de una sola área, con su propia hoja
  General.
- Se **regenera todo cada noche y se sobrescribe** cada archivo (idempotente, igual que hoy). El
  viejo `cumplimiento-maestro.xlsx` queda huérfano en Drive (la usuaria lo borra a mano una vez).

### Hojas dentro de cada archivo de área

- **General** (primera hoja): todas las filas del área. Columnas `['Mes', 'Semana', ...COLUMNAS_CUMPLIMIENTO]`.
  Orden: Mes → Semana → día.
- **Una hoja por mes**, nombre `AÑO-MM` (p. ej. `2026-07`), en **orden cronológico ascendente**
  (más viejo primero, después de General). Solo las filas de ese mes. Columnas
  `['Semana', ...COLUMNAS_CUMPLIMIENTO]` (sin Mes, es implícito). Orden: Semana → día.
- **Mes de una semana** = el mes del **jueves** de esa semana ISO (convención que ya usa
  `semanasDelMes`), para que una semana no se parta entre dos hojas.
- Filas: solo actividades **propias** del área, solo `CUMPLIDA`/`PARCIAL` (igual que hoy).

## Arquitectura

### 1. Helper de dominio — `src/dominio/semana.ts`

```ts
mesDeSemana(anio: number, semana: number): { anio: number; mes: number }
```
Mes (1-12) del **jueves** de la semana ISO. Implementación: `fechasDeSemana(anio, semana)[3]`
(índice 3 = jueves) → `{ anio: j.getUTCFullYear(), mes: j.getUTCMonth() + 1 }`. Puro y testeable.

### 2. Assembler puro — `src/datos/export-cumplimiento.ts`

Nuevo:
```ts
export type HojaExport = { nombre: string; columnas: string[]; filas: (string|number)[][] }
export type LibroArea = { area: string; hojas: HojaExport[] } // hojas[0] = General, luego meses asc

export function construirLibrosPorArea(
  actividades: ActMaestro[],
  catalogo: { nombre: string; unidad: string }[],
  maquinas: { id: string; nombre: string }[],
  responsables: { id: string; nombre: string }[],
): LibroArea[]
```
- Agrupa por `areaId`. Para cada área (ordenadas por nombre):
  - Agrupa sus actividades por `(anio, semana)`, arma las filas con el ya existente
    `construirFilasCumplimiento(items, ctx, () => '')` (propias, sin etiqueta ejecutadaPor),
    igual que hace hoy `construirFilasMaestro` pero acotado a un área.
  - `mesLabel = \`${a}-${String(m).padStart(2,'0')}\`` con `mesDeSemana`; `semanaLabel = \`${anio}-S${semana}\``.
  - **General**: `[mesLabel, semanaLabel, ...fila]`, ordenado por (año-mes, semana). Columnas
    `['Mes','Semana',...COLUMNAS_CUMPLIMIENTO]`.
  - **Meses**: agrupa las filas por `mesLabel`; una `HojaExport` por mes (nombre = `mesLabel`),
    filas `[semanaLabel, ...fila]` ordenadas por semana; columnas `['Semana',...COLUMNAS_CUMPLIMIENTO]`.
    Meses en orden cronológico ascendente.
- Devuelve un `LibroArea` por área **con al menos una fila** (áreas sin datos se omiten).

Se **elimina** `construirFilasMaestro` y `COLUMNAS_MAESTRO` (quedan sin uso al cambiar la ruta) y sus
tests; se conserva `ActMaestro` (mismo tipo de entrada) y `construirFilasCumplimiento`.

### 3. Ruta cron — `src/app/api/backup-drive/route.ts`

- Igual carga de datos (todas las actividades + catálogo + máquinas + responsables).
- `const libros = construirLibrosPorArea(...)`.
- Para cada `libro`: construir un `ExcelJS.Workbook`, agregar cada `hoja` (`addWorksheet(nombre)`,
  fila de header en negrita, filas), `writeBuffer`, y **POST** a `DRIVE_WEBHOOK_URL` con
  `name=cumplimiento-${safe}.xlsx` (`safe = area.replace(/[^\p{L}\p{N}]+/gu, '-')`) + `token` +
  `file` base64. Un POST por área (secuencial; 4-6 áreas).
- Se mantiene el try/catch + `console.error` por etapa. Se acumulan los resultados por área; si
  **alguna** subida falla (`!res.ok || texto !== 'ok'`), la ruta responde `500` nombrando las áreas
  que fallaron; si todas OK, `200` con `{ archivos: N, areas: [...] }`. (El maestro nocturno es
  idempotente: un fallo parcial se corrige la próxima corrida.)
- Nombres de hoja válidos para Excel (`General`, `2026-07`): ≤31 chars y sin `: \ / ? * [ ]` — se
  cumplen sin sanitizar.

### 4. Apps Script — cambio (lo re-pega la usuaria)

`doPost` acepta un nombre de archivo por parámetro en vez de fijo:
```javascript
var NAME = (e.parameter.name || 'cumplimiento-maestro.xlsx');
```
El resto igual (valida token, decodifica base64, envía a papelera los archivos con ese nombre en la
carpeta y crea el nuevo). Como el `/exec` corre la versión **desplegada**, tras pegar el código hay
que **volver a implementar** (Administrar implementaciones → editar → versión nueva); la URL `/exec`
no cambia. Se actualiza `docs/BACKUP-DRIVE.md` con el script nuevo y este paso.

## Pruebas

- `src/dominio/semana.test.ts`: `mesDeSemana` — casos deterministas, incluyendo una semana que
  cruza fin de mes (verifica que el mes se toma por el jueves).
- `src/datos/export-cumplimiento.test.ts`: `construirLibrosPorArea` —
  - un archivo por área (áreas sin datos omitidas);
  - hoja `General` con columnas `[Mes, Semana, ...]` y orden Mes→Semana;
  - una hoja por mes con nombre `AÑO-MM`, en orden ascendente, con solo las filas de ese mes y
    columnas `[Semana, ...]`;
  - actividades de dos meses distintos caen en hojas distintas.
  - Quitar/reemplazar los tests de `construirFilasMaestro`.
- `npm test` verde; `npx next build` compila (el `npm run build` local falla por `DIRECT_URL`; usar
  `npx next build`).

## Verificación

Post-deploy: la usuaria pega el Apps Script nuevo y re-implementa; luego se dispara `GET /api/backup-drive`
con el `CRON_SECRET` y se confirma en Drive que aparece **un archivo por área** con hoja General +
hojas por mes.

## Fuera de alcance (YAGNI)

- Sin archivo consolidado entre áreas.
- No se toca el cron/horario, el tope de programación, ni la autorización.
- Sin dependencias npm nuevas (exceljs + fetch nativo).

Relacionado: [[pendiente-excel-drive]], [[despliegue-nube]].

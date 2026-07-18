# Respaldo diario del Excel maestro a Google Drive

**Fecha:** 2026-07-18
**Estado:** aprobado, pendiente de implementación

## Objetivo

Que los datos del cumplimiento queden respaldados automáticamente en Google Drive,
sin intervención manual. Cada noche se genera un único Excel **maestro** (todas las
áreas, todas las semanas) y se sobrescribe en una carpeta de Drive de la usuaria.

Pedido por dcamacho (2026-07-18): guardar el Excel en Drive, automático, día a día,
en un archivo maestro que crece.

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Estructura | **Un solo archivo maestro** `cumplimiento-maestro.xlsx`, una hoja, todas las áreas y semanas. |
| Frecuencia | **Diaria**, 23:59 hora Colombia (= `59 4 * * *` en UTC). |
| Regeneración | **Regenerar todo desde cero y sobrescribir** (idempotente, refleja correcciones de semanas pasadas, sin duplicados). |
| Subida a Drive | **Google Apps Script Web App** en la cuenta de la usuaria (no service account, no Google Cloud, no `googleapis`). |
| Dependencias npm | Ninguna nueva. `fetch` nativo para el POST; `exceljs` ya está. |

Se descartó el service account (Opción B) porque los service accounts ya casi no pueden
ser dueños de archivos en un Drive personal (restricción de Google, falla con "quota
exceeded") y por la fricción del setup en Google Cloud. Se descartó el correo (Opción C)
porque no es Drive y acumula adjuntos.

## Contenido del maestro

- **Columnas:** `Semana`, `Área`, seguidas de las `COLUMNAS_CUMPLIMIENTO` actuales
  (`Día`, `Fecha`, `Responsable`, `Actividad`, `Máquina`, `Lote(s)`, `Finca`, `Estado`,
  `Medida realizada`, `Unidad`, `Bultos por lote`, `Centro de costo`, `Potreros realizados`,
  `Ejecutada por`, `Observación`, `Detalle (banco)`).
  - `Semana` = formato `AÑO-SNN` (ej. `2026-S29`), igual que en `/consulta`. **Ya implementada**
    en el export interactivo (`route.ts`).
  - `Área` = área ejecutora de la actividad.
- **Alcance de filas:** solo las actividades **propias** de cada área (las que tienen
  `areaId = area.id`). Cada actividad pertenece a exactamente un área ejecutora, así que
  iterar las propias de todas las áreas cubre cada actividad **una sola vez** — sin el doble
  conteo que habría si se incluyeran también las "solicitadas". `Ejecutada por` queda vacío
  para las propias (se conserva la columna por compatibilidad de forma con el export interactivo).
- **Filtro de estado:** solo `CUMPLIDA` y `PARCIAL` (igual que el export actual).
- **Orden:** por Área, luego Semana, luego día.

## Arquitectura

### Componentes

1. **Módulo compartido de construcción de filas** (refactor)
   Extraer de `src/app/cumplimiento/exportar/route.ts` la lógica que hoy vive en `agregarGrupos`
   (agrupar por actividad → filtrar a CUMPLIDA/PARCIAL → `filasCumplimientoGrupo`) a una función
   reutilizable server-side, p. ej. `construirFilasCumplimiento(...)` en un módulo nuevo
   (`src/app/cumplimiento/exportar/construir.ts` o `src/datos/export-cumplimiento.ts`).
   - Recibe: las actividades ya cargadas de un (área, año, semana) + los mapas globales
     (`unidadPorNombre`, `nombreMaquina`, `nombreResponsable`) + resolvers de fecha.
   - Devuelve: `(string|number)[][]` sin las columnas Semana/Área (esas las antepone cada
     llamador).
   - **La función de dominio `filasCumplimiento`/`filasCumplimientoGrupo` NO cambia** (queda
     pura; sus 26 tests siguen verdes).

2. **Ruta interactiva** (`/cumplimiento/exportar`)
   Se refactoriza para usar el módulo compartido. Comportamiento visible **idéntico** al actual
   (por área, una semana, con la columna `Semana` al frente ya agregada).

3. **Ruta del cron** (`GET /api/backup-drive`) — nueva
   - Verifica `Authorization: Bearer $CRON_SECRET`; si no coincide → `401`.
   - Carga en pocas consultas amplias: todas las actividades (todas las áreas y semanas, con las
     mismas relaciones que `listarActividades`), catálogo (`estipuladas`), máquinas y responsables.
     Agrupa en memoria por (área, año, semana) — **no** un query por semana.
   - Para cada (área, año, semana) llama al módulo compartido y antepone `[Semana, Área]` a cada fila.
   - Arma un `ExcelJS.Workbook` con una hoja `Cumplimiento`, header
     `['Semana', 'Área', ...COLUMNAS_CUMPLIMIENTO]`, y todas las filas ordenadas.
   - Serializa a buffer `.xlsx`.
   - Hace **POST** a `DRIVE_WEBHOOK_URL` con el archivo (base64) + `DRIVE_WEBHOOK_TOKEN`.
   - Devuelve `200` con un resumen `{ filas, bytes }`; ante fallo del POST → `500` + log.
   - `runtime = 'nodejs'` (exceljs).

4. **Repositorio** (nueva función)
   `listarActividadesTodas()` (o equivalente) que devuelve todas las actividades con las mismas
   relaciones que `listarActividades`, sin filtrar por área/semana. Se usa solo desde el cron.

5. **Apps Script Web App** (lo pega la usuaria en su cuenta)
   `doPost(e)`:
   - valida `e.parameter.token === <secreto>`; si no → salida `unauthorized`.
   - decodifica el base64, arma un `Blob` `.xlsx` con nombre fijo `cumplimiento-maestro.xlsx`.
   - en la carpeta `folderId`: envía a papelera los archivos con ese nombre y crea el nuevo
     (sobrescritura efectiva; Drive conserva versiones).
   - responde `ok`.
   - Publicado como Web App: **ejecutar como yo**, acceso **cualquiera con el enlace** (protegido
     por el token). Se entrega guía paso a paso a la usuaria.

6. **`vercel.json`** (nuevo)
   ```json
   { "crons": [{ "path": "/api/backup-drive", "schedule": "59 4 * * *" }] }
   ```
   `59 4 * * *` UTC = 23:59 hora Colombia (UTC-5). Vercel Cron solo dispara en producción.

### Variables de entorno (Vercel, "Sensitive", producción)

- `CRON_SECRET` — Vercel inyecta el header `Authorization: Bearer` a los crons cuando existe.
- `DRIVE_WEBHOOK_URL` — URL de la Web App de Apps Script.
- `DRIVE_WEBHOOK_TOKEN` — secreto compartido que valida el `doPost`.

## Flujo de datos

```
Vercel Cron (23:59 COT / 04:59 UTC)
  → GET /api/backup-drive  (Authorization: Bearer CRON_SECRET)
    → valida secreto
    → carga actividades/catálogo/máquinas/responsables (consultas amplias)
    → agrupa por (área, año, semana) → construirFilasCumplimiento → antepone [Semana, Área]
    → ExcelJS → buffer .xlsx
    → POST DRIVE_WEBHOOK_URL { token, file(base64) }
      → Apps Script doPost → sobrescribe cumplimiento-maestro.xlsx en la carpeta de Drive
    → 200 { filas, bytes }
```

## Manejo de errores

- Header de cron ausente/incorrecto → `401`, no procesa.
- POST a Apps Script no-200 o excepción → la ruta responde `500` y loguea; el dashboard de Vercel
  marca el cron como fallido. (Sin reintentos en v1; el cron vuelve a correr al día siguiente y el
  maestro es idempotente, así que un fallo puntual no pierde datos.)
- Sin actividades → igual se sube un maestro con solo el header (no rompe).

## Pruebas

- **Unitario:** construcción del maestro — `Semana` y `Área` antepuestas en el orden correcto,
  solo propias (sin doble conteo con solicitadas), solo CUMPLIDA/PARCIAL, orden Área→Semana→día.
- **Regresión:** los 26 tests de `cumplimiento-export.test.ts` siguen verdes (la función de dominio
  no cambia); la ruta interactiva produce las mismas filas que antes más la columna `Semana`.
- **Manual (post-deploy):** disparar `GET /api/backup-drive` con el `CRON_SECRET` y confirmar que
  `cumplimiento-maestro.xlsx` aparece/actualiza en la carpeta de Drive con el contenido esperado.

## Fuera de alcance (YAGNI)

- Sin UI (todo automático).
- Sin archivos por-semana ni por-área (un solo maestro).
- Sin versionado propio (lo provee Drive).
- Sin `googleapis` ni service account.
- Sin reintentos automáticos del POST en v1.

## Dependencias / prerequisitos de la usuaria

1. Crear una carpeta en su Drive y anotar su `folderId`.
2. Crear el Apps Script (script.google.com), pegar el `doPost`, publicar como Web App, copiar la URL.
3. Pasar la URL y elegir el token; se guardan como env Sensitive en Vercel.

Relacionado: [[pendiente-excel-drive]], [[despliegue-nube]], `docs/DESPLIEGUE.md`.

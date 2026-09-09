# Respaldos de datos

Esta carpeta guarda respaldos de migraciones de datos hechas a mano contra
producción. Son el único camino de reversión si algo sale mal: el directorio
de trabajo de cada plan (`.superpowers/sdd/<plan>/...`) no está versionado
(ver `.gitignore`), así que un respaldo que solo viva ahí desaparece con la
máquina que lo generó. Se versionan acá igual que `prisma/lotes.json` (los
356 potreros del catálogo, también commiteado): no son datos personales ni
secretos, son el estado de potreros/actividades del cronograma.

## `2026-09-08-respaldo-potreros-entremontes.json`

Estado previo de los potreros de la finca Entremontes, tomado el 2026-09-08
justo antes de aplicar el nuevo mapa de esa finca (plan
`2026-09-07-potreros-retirados-y-mapa-entremontes`). Es un array de 188
potreros (los que tenía Entremontes antes del cambio), cada uno con:

- `id`, `nombre`, `hectareas`, `tipoPasto`, `fincaId`
- `activo` (bandera de retiro; en este respaldo todos estaban `true`)
- `_count`: conteo de referencias por relación (`actividades`, `tareas`,
  `tareasMulti`, `notasConservatorio`) — las mismas cuatro que cuenta la
  guarda de borrado en `src/dominio/lote-retiro.ts`.

La migración, a partir de este estado:

- **Retiró** 52 potreros (bandera `activo` a `false`, conservan su historial).
- **Borró** 43 potreros que no tenían ninguna referencia (los cuatro conteos
  en cero).
- **Creó** 58 potreros nuevos con el mapa actualizado de la finca.

### Cómo revertir

- Los 52 **retirados** y los 58 **creados** se revierten con una consulta
  (poner `activo: true` a los primeros por `id`; borrar los segundos por
  `id`, ya que no tenían referencias al crearlos) — no hace falta este
  archivo para eso, sus datos ya están en la base.
- Los 43 **borrados** no están en la base: hay que re-crearlos desde este
  archivo (los registros cuyo `id` ya no exista en `Lote`), usando
  `nombre`, `hectareas`, `tipoPasto` y `fincaId` tal cual quedaron acá.
  Como los cuatro conteos de `_count` eran cero para todos ellos, no tenían
  ninguna actividad/tarea/nota enganchada — no hay nada más que restaurar
  aparte de la fila del potrero.

## `2026-09-09-respaldo-vencidas-sin-registrar.json` y `…-linea-base-pct-vencidas.json`

Estado previo de las **257 filas** (97 actividades) que la pasada retroactiva
del plan `2026-09-08-sin-registrar-y-reprogramar-vencidas` cerró como
`SIN_REGISTRAR`: lo que había quedado `PENDIENTE` en semanas ya vencidas antes
de que existiera el cron semanal. Reparto por área: Ganadería ceba 127 ·
Maquinaria 58 · Maiz-Riego 53 · Genetica Nelore 16 · Nelore 3, en las semanas
28 a 36 de 2026.

El respaldo es un array con **todos** los campos que el cierre NO debía tocar
—`motivoId`, `nota`, `haRealizada`, `unidadRealizada`, `hectareas`, `horas`,
`centroCosto`, `avancePorLote`, `avanceGeneral`, `lotesHechos`,
`bultosPorLote`, `vecesReprogramada`, `origenId`, `maquinaId`,
`responsableId`, `tareaId`— además de `estado` y `cerrada`, que son los dos
únicos que sí cambiaron. Comprobado después de aplicar: 0 campos distintos
fuera de esos dos.

`linea-base-pct-vencidas.json` guarda el **% de cumplimiento y el conteo por
estado de cada uno de los 17 pares (área, semana) afectados**, medidos antes
de escribir. Es la prueba de que cerrar lo vencido no reescribe la historia:
después de aplicar, los 17 porcentajes salieron idénticos.

### Cómo revertir

Un `updateMany` por lista de `id` de este archivo, poniendo
`estado: 'PENDIENTE'` y `cerrada: false` (todas las filas del respaldo tenían
exactamente ese estado). Ojo: el cron semanal las volvería a cerrar el lunes
siguiente a la 01:17 de Colombia, así que revertir sin desactivar el cron solo
dura hasta el lunes.

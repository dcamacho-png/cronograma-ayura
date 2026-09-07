# Potreros retirados y adopción del mapa nuevo de Entremontes — Diseño

Fecha: 2026-09-07

## Objetivo

Adoptar en la app el levantamiento GIS de la finca **Entremontes** (151 polígonos),
que no es una re-medición del mapa que la app tiene sino una **re-división** de la
finca: sectores partidos, unidos y renombrados.

Para eso hace falta poder **retirar** un potrero: que deje de ofrecerse al programar
y registrar, conservando intacto todo lo ya registrado sobre él. Hoy la única forma
de sacar un potrero del selector es borrarlo, y borrarlo desengancha en silencio el
potrero de las actividades pasadas.

El 2026-09-06 ya se actualizó la medida de los **93 potreros** que el levantamiento
describe como el mismo potrero que la app tiene (finca: 1.568,5 → 1.447,1 ha). Este
diseño cubre los **95 restantes** y los **58 polígonos nuevos**.

## Decisiones acordadas

- **El historial no se reescribe.** Un potrero retirado conserva su nombre y su
  medida en todo lo ya registrado. `LAGUNA1` deja de aparecer al programar, pero sus
  actividades siguen diciendo `LAGUNA1` con sus 18,92 ha, y los informes de semanas
  pasadas siguen cuadrados. No se necesita la equivalencia viejo→nuevo.
- **Retirar se implementa como bandera `activo`** en `Lote`, la misma convención que
  ya usa `Responsable.activo`. Se descartó una fecha de retiro (introduce una segunda
  convención sin que nadie vaya a consultar la fecha) y se descartó renombrar los
  viejos a "X (retirado)" (ensucia los nombres dentro de los informes ya emitidos y
  los potreros seguirían en los selectores).
- **Lo que nunca se usó se borra**, no se retira: 43 potreros sin una sola referencia
  de ningún tipo. Retirarlos dejaría basura permanente en la pantalla de configuración.
- **Los corrales, mangas y módulos también salen.** El levantamiento midió praderas y
  no los incluye; ninguno tiene actividades registradas. Quedan dentro de los 43 que
  se borran.
- Los 58 potreros nuevos entran con **el nombre del archivo tal cual** ("Laguna 1",
  "Chile 1-A", "Orosol Sección A"): se verificó que ninguno choca con un nombre
  existente, y su grafía distinta de los viejos en mayúsculas ayuda a distinguirlos.

## Modelo de datos

Un solo campo nuevo:

```prisma
model Lote {
  // …
  activo Boolean @default(true)
}
```

Migración: `ALTER TABLE "Lote" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true`.
Aditiva y con `true` por defecto, así que al desplegar **nada cambia de comportamiento**
hasta que se voltean las banderas en el paso de datos.

## Consultas

- `listarLotes()` pasa a filtrar `where: { activo: true }`. Un solo cambio cubre los
  selectores de las cuatro pantallas que la consumen: `/configuracion`,
  `/conservatorio`, `/cumplimiento` y `/tareas` (y de ahí bajan `FormAvance`,
  `FormSolicitar`, `FormNuevaTarea*`, `FormEditarSolicitud`, `BloqueReemplazo`,
  `PickerReemplazoPotreros`).
- Se agrega **`listarLotesTodos()`** (activos + retirados, con el conteo de
  referencias) y la usa solo `/configuracion`, que es donde se administran.
- **Nada más cambia.** Todo lo que lee un potrero *a través de* una actividad o una
  tarea sale de la relación, no del catálogo: `InfoLotes`, `/consulta`, el Excel de
  cumplimiento y el Excel maestro a Drive siguen mostrando los potreros retirados con
  su nombre y su medida donde ya estaban.

## Borrar un potrero deja de poder mutar el pasado

`eliminarLote(id)` hoy es `prisma.lote.delete`. Como `Lote.actividades` y
`Lote.tareasMulti` son relaciones muchos-a-muchos **implícitas**, borrar un potrero
usado no falla: Prisma elimina las filas de la tabla intermedia y el potrero
desaparece de las actividades pasadas sin aviso. `NotaConservatorio.loteId` es
opcional, así que ahí queda en `null`.

Cambio: `eliminarLote` cuenta primero las referencias (`actividades`, `tareas`,
`tareasMulti`, `notasConservatorio`) **dentro de la misma transacción** que el borrado,
y si hay alguna no borra y devuelve el conteo. La UI muestra el motivo y ofrece
retirar en su lugar. La regla vive en el dominio como función pura para poder probarla:

```ts
// src/dominio/lote-retiro.ts
export type ReferenciasLote = { actividades: number; tareas: number; tareasMulti: number; notas: number }
export function totalReferencias(r: ReferenciasLote): number
export function puedeBorrarse(r: ReferenciasLote): boolean   // total === 0
```

## Pantalla de configuración

`LotesLista` (cliente, con su buscador) recibe además `activo` y el total de
referencias por potrero, y por cada uno:

- **Activo**: se ve como hoy; botón **Retirar**. El botón **eliminar** solo aparece si
  no tiene referencias.
- **Retirado**: fila atenuada con la marca `retirado`; botón **Reactivar**.
- Un contador arriba: `N activos · M retirados`, y el buscador filtra sobre ambos.

Acciones nuevas en `src/app/configuracion/acciones.ts`: `retirarLoteAccion` y
`reactivarLoteAccion`, con la misma guarda de autorización que el resto de esa
pantalla (solo ADMIN).

## Paso de datos de Entremontes

Un script de un solo uso, con **ensayo en seco por defecto** y respaldo completo
antes de escribir (id, nombre, hectáreas, finca, activo y conteo de referencias de
los 188 potreros actuales). En una transacción:

1. **Borrar 43** potreros (118,4 ha), re-verificando dentro de la transacción que
   siguen en cero referencias; si alguno cambió, se salta y se reporta.
2. **Retirar 52** potreros (445,8 ha, 731 referencias: 619 actividades y 112 tareas
   multi-lote) con `activo = false`.
3. **Crear 58** potreros (443,7 ha) en Entremontes con nombre, hectáreas y
   `tipoPasto` tomados del archivo (la columna *Especie*, presente en 57 de 58).

Estado final: **151 potreros activos = 1.326,6 ha**, el total exacto del
levantamiento, más 52 retirados sosteniendo el historial. Acajure (422,9 ha) y
Normandía (221,8 ha) no se tocan; el script filtra por `fincaId` de Entremontes y
opera sobre una lista explícita de identificadores.

El archivo `.xls` del levantamiento se lee con `leer_xls.py` del scratchpad: guarda
sus cadenas al estilo BIFF5 dentro de un libro BIFF8 (bytes UTF-8 con `cch` contando
caracteres y sin el byte `grbit`), y los lectores estándar se comen un carácter por
cada tilde. Validación de que la lectura es correcta: el encabezado debe leerse
`Nombre del área` y `Área (ha)` completos.

## Pruebas

- **Dominio**: `puedeBorrarse` / `totalReferencias` — cero referencias, una de cada
  tipo, varias combinadas.
- **Repositorio**: que `listarLotes()` excluya retirados y `listarLotesTodos()` los
  incluya; que `eliminarLote` se niegue con referencias y borre sin ellas.
- **Ensayo en seco** del paso de datos contra producción antes de escribir, y
  verificación posterior: los 43 ya no existen, los 52 están `activo=false` con su
  conteo de referencias sin cambios, los 58 existen con su medida, y el total activo
  de Entremontes da 1.326,6 ha.
- **Navegador**: levantar la app contra un schema Postgres aislado en la misma base
  Neon (técnica ya usada el 2026-09-05) con un **fixture mínimo** —un área, un
  responsable, un usuario y tres potreros, uno de ellos retirado— en vez del seed
  completo, que tarda ~10 minutos. Comprobar que el potrero retirado no aparece en el
  selector de `FormAvance` ni al crear una tarea, y que sí aparece en
  `/configuracion` con su marca.

## Fuera de alcance

- La equivalencia viejo→nuevo (qué potrero de hoy corresponde a cuáles del mapa
  nuevo). No se necesita con la decisión de no reescribir historial; si más adelante
  se quiere rastrear, es un trabajo aparte que arranca por conseguir ese mapeo.
- Retirar potreros de Acajure o Normandía.
- Cualquier cambio a `/consulta`, al Excel de cumplimiento o al respaldo a Drive.

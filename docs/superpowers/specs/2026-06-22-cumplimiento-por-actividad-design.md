# Cumplimiento por actividad (no por días)

**Fecha:** 2026-06-22

## Problema

El cumplimiento se calcula contando **cada fila-día como una actividad**. Cuando
una misma tarea se programa para varios días (p. ej. "Fertilizar lote 5" de lunes
a miércoles), se crean 3 filas de `Actividad` y esa tarea pesa como **3 actividades**
en el `%`. Eso distorsiona el cumplimiento: una actividad larga domina el promedio
y una actividad corta casi no cuenta.

Lo correcto: **una actividad cuenta como una sola actividad**, sin importar cuántos
días tenga. El día a día es un **seguimiento** para llegar al cumplimiento real de
esa única actividad.

## Decisiones (acordadas)

1. **Qué agrupa los días:** la **tarea de origen** (`tareaId`). Filas con el mismo
   `tareaId` = una actividad. Filas con `tareaId = null` = cada una su propia
   actividad (un solo día), como hoy.
2. **Cómo se calcula el % de una actividad:** **proporcional** =
   `días cumplidos ÷ días totales`, usando los pesos por día existentes
   (Cumplida=1, Parcial=0.5, No cumplida / Pendiente / Reprogramada=0).
3. **Novedad:** actúa **por día** (opción 1). Un día con novedad de "no cumplida"
   (motivo + nota) queda como `NO_CUMPLIDA` → ese día no suma y baja el % de la
   actividad automáticamente. No hay novedad a nivel de actividad completa.
4. **Peso en el %:** cada actividad pesa **1** en el cumplimiento del área, sin
   importar cuántos días tenga.
5. **Alcance:** se hacen **las dos partes** (cálculo + UI de registro).
6. **Excel:** se mantiene **una fila por día** (el detalle día a día sigue siendo
   útil). Sin cambios en la exportación.

## Parte 1 — Cálculo (núcleo)

### Cambio de tipo

Agregar `tareaId: string | null` al tipo `Actividad` del dominio
(`src/dominio/tipos.ts`). El campo ya existe en la base (`Actividad.tareaId` en
Prisma) y `listarActividades` usa `include` (no `select`), así que Prisma ya
devuelve `tareaId` en cada fila. No hay que cambiar la consulta: solo exponer el
campo en el tipo de dominio para que TypeScript lo conozca en el cálculo.

### Nueva lógica de agrupamiento

`porcentajeCumplimiento(actividades)` cambia de "promedio por fila" a
"promedio por actividad":

```
clave de grupo = tareaId ?? `solo:${id}`   // null → grupo propio de un día
para cada grupo:
  fracción = Σ pesoDia(día) / nDías         // pesoDia: Cumplida=1, Parcial=0.5, resto=0
% del área = promedio de las fracciones de todos los grupos × 100
```

- Denominador del grupo = **todos** sus días (los Pendiente/Reprogramada/No cumplida
  cuentan como 0 en el numerador pero siguen en el denominador). Esto mantiene la
  semántica actual de "Pendiente cuenta como 0".
- Devuelve `null` solo si no hay actividades.
- `Math.round` al final, igual que hoy.

Como `rankingResponsables`, `cumplimientoPorArea` y `tendenciaSemanal` ya se
apoyan en `porcentajeCumplimiento`, **heredan el arreglo sin cambios** (siempre que
sigan recibiendo `Actividad[]` con `tareaId`). Verificar que el agrupamiento por
responsable/área/semana siga siendo correcto: una actividad multi-día comparte
`responsableId`, `areaId`, `anio` y `semana` entre sus filas, así que cae en un solo
grupo de esas dimensiones. (Si una actividad multi-día tuviera responsables distintos
por día, cada (tareaId, responsableId) se trata como un grupo dentro de ese
responsable — comportamiento aceptable.)

### Helper reutilizable

Extraer una función `agruparPorActividad(actividades)` que devuelva los grupos por
`tareaId ?? id`, para reutilizarla tanto en el cálculo como en la UI (Parte 2) y
evitar duplicar la regla de agrupamiento.

## Parte 2 — UI de registro (seguimiento día a día)

En `/cumplimiento` (`src/app/cumplimiento/page.tsx`), agrupar las filas por
actividad usando `agruparPorActividad`. **Una tarjeta por actividad**:

- **Cabecera:** descripción, responsable, lote(s)/máquina, y el **% en vivo** de la
  actividad (`días cumplidos / total`). Badge de reprogramada si aplica.
- **Días adentro:** una fila por cada día de la actividad. Para cada día:
  - **Sin medida (no maquinaria):** un **checkbox** "cumplido". Marcarlo registra el
    día como `CUMPLIDA`; desmarcarlo lo vuelve `PENDIENTE`. Al marcar todos los días
    → la actividad llega a 100%.
  - **Maquinaria / con medida:** input de la **medida del día** (ha / kg / horas
    según la unidad de la actividad). Guardar una medida marca el día `CUMPLIDA` y
    alimenta los totales de medida existentes.
  - **Novedad (cualquier día):** opción para registrar una **novedad de "no
    cumplida"** (motivo + nota) → el día queda `NO_CUMPLIDA`.
- Las actividades de un solo día (sin tarea) se ven como una tarjeta de un día,
  más simple.

### Acciones de servidor

Reutilizar las acciones existentes por día (`marcarEstadoAccion`,
`registrarAccion`/`registrarCumplimiento`) — el modelo de datos por día **no cambia**;
cada día sigue siendo una fila `Actividad`. Lo nuevo es la **agrupación visual** y los
controles simplificados (checkbox / medida) que escriben el `estado` del día.

### Gate de "pendientes" y bloqueos

- El gate actual ("registra todas las actividades para pasar de semana / exportar")
  sigue contando **días Pendiente**: una actividad no está lista hasta que todos sus
  días estén resueltos (cumplido o con novedad). Sin cambio de fórmula.
- El bloqueo de edición tras registrar (`🔒 registrada`) se mantiene; un día ya
  resuelto puede reabrirse solo dentro de la semana abierta (comportamiento actual,
  no se amplía en esta spec).

## Lo que NO cambia

- El modelo de datos (Prisma): cada día sigue siendo una fila `Actividad`.
- La exportación a Excel: una fila por día.
- Los pesos por estado (`pesoEstado`): Cumplida=1, Parcial=0.5, resto=0.
- El cálculo de medidas por unidad (`medidasPorUnidad`, `hectareasRealizadas`).

## Pruebas

- `metricas.test.ts`: agregar casos que demuestren el cambio de "por día" a "por
  actividad":
  - 1 actividad de 5 días cumplidos + 1 actividad de 1 día no cumplido → 50%
    (antes 83%).
  - Actividad multi-día parcialmente cumplida → fracción proporcional correcta.
  - Novedad por día baja el % de la actividad.
  - Actividades sueltas (sin `tareaId`) siguen contando una cada una.
  - `null` cuando no hay actividades.
- Verificar que `rankingResponsables`, `cumplimientoPorArea` y `tendenciaSemanal`
  reflejan el nuevo agrupamiento (al menos un caso cada uno).

## Criterios de aceptación

1. En el cumplimiento, una tarea de N días pesa como **1 actividad**, no como N.
2. El % de una actividad = días cumplidos ÷ días totales.
3. Una novedad por día baja el % de su actividad.
4. La página de cumplimiento muestra **una tarjeta por actividad** con sus días y su
   % en vivo; checkbox para días sin medida y medida para maquinaria.
5. Tablero, resumen, ranking y tendencia reflejan el cálculo por actividad.
6. El Excel sigue exportando una fila por día.

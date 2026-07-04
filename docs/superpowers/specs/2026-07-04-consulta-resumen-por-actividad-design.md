# /consulta como resumen por actividad (estilo Excel de cumplimiento) — Design

**Fecha:** 2026-07-04
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

`/consulta` (recién desplegada) lista **una fila por `Actividad` de BD** = una fila por (responsable × día), así que una actividad hecha por varias personas o en varios días aparece repetida. El usuario quiere que sea un **resumen por actividad**, prácticamente igual al **Excel de cumplimiento**: agrupado por actividad (filas-hermanas por `tareaId`), uniendo responsables, sin duplicar la medida por persona.

El Excel de cumplimiento (`src/app/cumplimiento/exportar/route.ts`) ya hace exactamente eso con dominio probado: `agruparPorActividad` + `estadoActividad` + `filasCumplimientoGrupo`/`COLUMNAS_CUMPLIMIENTO` (`src/dominio/cumplimiento-export.ts`, con tests en `cumplimiento-export.test.ts`).

## Objetivo

Reescribir la tabla de `/consulta` para que **agrupe por actividad y renderice como el Excel de cumplimiento** (mismas columnas + una columna "Semana"), mostrando **solo CUMPLIDA**, con los filtros aplicados a nivel de actividad.

## Decisiones (acordadas)

1. **Agrupado por actividad**, reutilizando `agruparPorActividad` + `filasCumplimientoGrupo` (une responsables, una fila por avance o una fila-resumen si no hay avances) — idéntico al Excel, sin duplicar por responsable.
2. **Columnas = las del Excel** (`COLUMNAS_CUMPLIMIENTO`) **menos "Estado"** (aquí todo es Cumplida) **más una columna "Semana"** al inicio (Consulta abarca varias semanas). Orden final: `Semana` + [Día, Fecha, Responsable, Actividad, Máquina, Lote(s), Finca, Medida realizada, Unidad, Bultos por lote, Centro de costo, Potreros realizados, Ejecutada por, Observación, Detalle (banco)].
3. **Solo CUMPLIDA** (no Parcial, a diferencia del Excel). El agrupado usa `estadoActividad(grupo)`; solo se emiten grupos cuyo estado sea `CUMPLIDA`.
4. **Filtros** (responsable, finca, centro de costo, potrero): se conservan, aplicados **a nivel de actividad** — si la actividad matchea, se muestra completa (con todos sus responsables/avances). Las opciones de cada desplegable se derivan de los valores presentes en las culminadas del área.
5. Sin cambios de esquema.

## Arquitectura

### Repo — `consultarCulminadas`
`src/datos/repositorio.ts`: ya trae las CUMPLIDA del área (propias + solicitadas). Ajustes:
- El `include` de `tarea` debe traer también `detalle` (además de `solicitadaPorAreaId`), porque `filasCumplimiento` usa `detalle`.
- Los campos escalares que necesita `ActividadExport` (`avancePorLote`, `lotesHechos`, `bultosPorLote`, `nota`, `unidadRealizada`, `haRealizada`, `centroCosto`, `dia`, `descripcion`, `estado`) ya vienen por defecto en un `findMany`.
- El filtrado de responsable/finca/centro/potrero **se mueve a la página** (a nivel de grupo). `consultarCulminadas(areaId)` devuelve todas las CUMPLIDA del área con sus includes; ya no recibe `filtros` (o los ignora). Datos acotados → filtrar/agrupar en memoria es correcto.

### Página `/consulta`
`src/app/consulta/page.tsx`:
- Carga: `consultarCulminadas(areaId)`, `listarActividadesEstipuladas()` (para `unidadPorNombre`), `listarMaquinas()`, `listarResponsablesTodos()` (para resolver nombres de máquina/responsable en los avances, incluidos los de otras áreas en solicitadas).
- **Separa** las CUMPLIDA en **propias** (`a.areaId === areaId`) y **solicitadas** (`a.areaId !== areaId`), porque la columna "Ejecutada por" va vacía en las propias y con el nombre del área ejecutora (`grupo[0].area.nombre`) en las solicitadas — igual que el Excel.
- Para cada conjunto: `agruparPorActividad(...)`; por cada grupo, si `estadoActividad(grupo)` es `CUMPLIDA` **y** el grupo pasa los filtros de actividad, construye las filas con `filasCumplimientoGrupo(grupoExport, fecha, unidadPorNombre, ctx, ejecutadaPor)`.
  - `ctx.fechaDeDia`, `fecha`: se construyen **por grupo** con la semana del grupo (`fechasDeSemana(anio, semana)`), porque Consulta abarca varias semanas.
  - `ctx.nombreMaquina`, `ctx.nombreResponsable`: mapas desde `listarMaquinas`/`listarResponsablesTodos`.
- **Filtros a nivel de grupo** (todos opcionales, AND):
  - responsable: `grupo.some(a => a.responsableId === sel)`
  - finca: `grupo[0].fincaId === sel`
  - centro de costo: `grupo.some(a => a.centroCosto === sel)`
  - potrero: `grupo[0].lotes.some(l => l.id === sel)`
- **Columnas/filas para la tabla:** header = `['Semana', ...COLUMNAS_CUMPLIMIENTO sin 'Estado']`. Para cada fila que devuelve `filasCumplimientoGrupo` (array en el orden de `COLUMNAS_CUMPLIMIENTO`), se quita la posición de "Estado" (`COLUMNAS_CUMPLIMIENTO.indexOf('Estado')`, para no hardcodear el índice) y se antepone `"<anio>-S<semana>"` del grupo.
- **Opciones de filtros:** derivadas del conjunto completo de CUMPLIDA del área: responsables (id+nombre presentes en las filas-hermanas), fincas (id+nombre presentes), centros de costo (distintos no nulos), potreros (lotes presentes). Así los desplegables solo ofrecen valores con datos.
- Estado vacío: "No hay actividades culminadas con esos filtros".

### `filtros-consulta.tsx`
Sin cambios de contrato (form GET con `area/responsable/finca/centro/lote`). Solo cambian las **fuentes** de opciones (ahora derivadas de los datos, ver arriba) — el componente sigue recibiendo `responsables/fincas/lotes/centros` como listas.

## Flujo de datos

```
/consulta?area=X&responsable=..&finca=..&centro=..&lote=..
  → consultarCulminadas(X)  // todas las CUMPLIDA del área (propias + solicitadas)
  → separar propias (areaId===X) / solicitadas (areaId!==X)
  → por cada conjunto: agruparPorActividad → por grupo:
        si estadoActividad(grupo)===CUMPLIDA y pasa filtros:
          filasCumplimientoGrupo(grupo, fecha(semana del grupo), unidadPorNombre, ctx, ejecutadaPor)
          → por cada fila: quitar col "Estado", anteponer "Semana"
  → tabla con header ['Semana', ...COLUMNAS_CUMPLIMIENTO sin 'Estado']
```

## Casos borde

- Actividad con varios avances (distintos días/lotes): varias filas (una por avance), responsables unidos — "por actividad", no por responsable.
- Actividad CUMPLIDA sin avances: una fila-resumen con la medida total (`haRealizada`) — igual que el Excel.
- Solicitadas: "Ejecutada por" = área ejecutora; "Responsable" = responsable(s) de esa área.
- Filtro que no matchea ninguna actividad: mensaje de vacío.
- El grupo se muestra completo aunque el filtro (p. ej. responsable) matchee solo a un miembro (se conserva la consolidación de responsables).

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- Vitest: la suite existente de `cumplimiento-export` sigue verde (no se toca ese dominio). No se añade lógica pura nueva significativa (la página compone dominio existente); si se extrae algún helper de agrupado, se le añade test.
- En vivo (server local + cookie firmada, solo lectura): en un área con varias actividades cumplidas por 2+ responsables, confirmar que aparece **una fila por actividad/avance** (no una por responsable), con responsables unidos, columnas del Excel + Semana; que solicitadas muestran "Ejecutada por"; y que cada filtro acota a nivel de actividad.

## Fuera de alcance

- Export a Excel desde /consulta (el Excel de cumplimiento ya existe por semana).
- Incluir Parcial (solo CUMPLIDA).
- Cambiar el Excel de cumplimiento o su dominio (`cumplimiento-export.ts`) — se reutiliza tal cual.
- Filtros nuevos (rango de semanas, texto, máquina) — se mantienen los cuatro actuales.

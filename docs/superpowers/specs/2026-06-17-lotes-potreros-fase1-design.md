# Diseño — Lotes / Potreros (Fase 1)

**Fecha:** 2026-06-17 · **Estado:** Aprobado (Fase 1 de 2)

## Objetivo (Fase 1)
Cada actividad se asocia a un **lote** (potrero); al elegir el lote, la **finca se deduce** automáticamente (ya no se elige por separado). Catálogo de 265 lotes sembrado del Excel. Un lote por actividad (la selección de **varios lotes** para fertilización es la Fase 2).

## Datos
- **Lote**: `{ id, nombre (único), fincaId→Finca, hectareas Float?, tipoPasto String? }`. Sembrado del Excel POTREROS (265: 189 Entremontes, 76 Acajure).
- **Actividad ↔ Lote**: muchos-a-muchos (`Actividad.lotes` / `Lote.actividades`). Se conserva `Actividad.fincaId` (se llena a partir del lote elegido).
- **Tarea**: gana `loteId String?` (relación opcional a Lote). Se conserva `Tarea.fincaId` (derivada del lote).
- **Finca**: relación inversa `lotes Lote[]`.

## Dónde se elige el lote (reemplaza el campo finca)
Desplegable de lotes **agrupados por finca** (`<optgroup>` por finca), selección de UNO:
1. **Programar → Agregar actividad**: se elige lote; el server pone `fincaId = lote.finca` y enlaza el lote.
2. **Programar → Asignar tarea**: se elige lote (preseleccionado con el lote de la tarea si tiene); idem.
3. **Tareas → Nueva tarea**: lote opcional; si se elige, finca derivada.

## Repositorio
- `listarLotes()` → todos, con finca, ordenados por finca y luego nombre (para agrupar).
- `crearLote(nombre, fincaId, hectareas|null, tipoPasto|null)`, `eliminarLote(id)` (para Configuración).
- `crearActividadDesdeLotes(base, loteIds)` → finca del primer lote; crea la actividad y conecta los lotes. (Fase 1: un lote.)
- `asignarTarea(tareaId, responsableId, dia, loteId)` → finca del lote; crea actividad + conecta lote (cambia el parámetro `fincaId`→`loteId`).
- `crearTarea(areaId, descripcion, loteId|null)` → finca derivada del lote (cambia `fincaId`→`loteId`).
- `listarActividades(...)` incluye `lotes` (para mostrarlos).

## Mostrar
- En **Cumplimiento** y en la **grilla de Programar**, cada actividad muestra su lote (o "—" si no tiene). (Mostrar el lote, no la finca.)

## Configuración
- Nueva sección **"Lotes / Potreros"**: lista (agrupada por finca o simple) con **agregar** (nombre + finca + ha + pasto) y **eliminar**. Los 265 vienen sembrados.

## Fuera de alcance (Fase 2)
- Selección de **varios lotes** cuando la actividad de maquinaria es fertilización (requiere un componente cliente).
- Duplicar semana: en Fase 1 copia la finca pero **no** los lotes (se vuelven a elegir). Se mejora luego si hace falta.

## Pruebas
- Sin lógica pura nueva relevante. Se verifica con `npm run build`, una prueba end-to-end (crear lote, crear actividad con lote → finca derivada + lote enlazado, asignar tarea con lote) y `curl` de las pantallas. Reiniciar `npm run dev` tras la migración.

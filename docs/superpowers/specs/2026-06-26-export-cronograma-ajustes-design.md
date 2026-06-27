# Ajustes al export del cronograma (imagen y PDF) — Design

**Fecha:** 2026-06-26

## Objetivo

Mejorar cómo se ve el cronograma **exportado** desde `/programar` (imagen PNG y PDF):
sin botones de acción, con letra más grande y oscura, y repitiendo el cabezado cada 5
filas. La pantalla de trabajo (la grilla interactiva) **no cambia**.

## Alcance

- Aplica **solo a la imagen y al PDF**. La grilla interactiva en pantalla queda igual.
- No cambia datos, esquema ni acciones del servidor.

## Contexto actual

`GrillaSemana` (`src/app/programar/grilla-semana.tsx`) es una `<table>` con columnas =
Responsable + 7 días y filas = responsables. La usan dos superficies:
- **Imagen:** `#grilla-export` en `programar/page.tsx` envuelve `GrillaSemana` con
  `turnoEditable={futura}`; `BotonDescargarImagen` captura ese id con html2canvas.
- **PDF:** `programar/exportar/page.tsx` renderiza `GrillaSemana` por área (sin
  `turnoEditable`), con `@page landscape`.

En modo editable la grilla muestra un form de turno (input + ✓) y el botón
"Devolver a asignar" (`turnoEditable && a.tareaId`). El botón "Devolver al banco" vive en
la lista de *tareas por asignar* de `page.tsx`, **fuera** de `#grilla-export`, así que no
aparece en ningún export.

## Diseño

### Prop `paraExportar` en `GrillaSemana`

Nueva prop `paraExportar?: boolean` (default `false`). Cuando es `true`:

1. **Sin controles interactivos:** el turno se muestra como texto (igual que la rama no
   editable); nunca se renderiza el form de turno (input + ✓) ni "Devolver a asignar".
   En la práctica `paraExportar` implica no-editable.
2. **Letra más grande y oscura:** el cuerpo de la tabla pasa de `text-sm` a `text-base`
   y el color de texto a negro (`text-black`) en cabezado y celdas. El nombre del área
   permanece destacado (tamaño actual o un punto mayor), en negro.
3. **Cabezado repetido cada 5 filas:** la fila de cabezado (Responsable + 7 días) se
   extrae a un fragmento reutilizable y se reinserta como fila de `tbody` después de cada
   bloque de 5 responsables (tras la fila 5, la 10, etc.). El `<thead>` sigue mostrándolo
   al inicio.

### Imagen

En `programar/page.tsx`:
- La grilla interactiva visible se mantiene igual pero **pierde** el `id="grilla-export"`.
- Se agrega un contenedor **oculto fuera de pantalla** (p. ej. `position:absolute;
  left:-100000px; top:0`) con `id="grilla-export"` que renderiza
  `<GrillaSemana ... paraExportar />` con los mismos datos (sin `turnoEditable`).
- `BotonDescargarImagen` ya captura `#grilla-export`; ahora captura la grilla de export.
  El bucle que fuerza orientación horizontal funciona igual sobre ese elemento (mide
  `scrollHeight`/ajusta `width` aunque esté fuera de pantalla).

### PDF

En `programar/exportar/page.tsx`: pasar `paraExportar` a cada `GrillaSemana`. Ya no tenía
botones; esto añade letra grande/oscura + cabezado repetido. Se mantiene `@page landscape`.

## Casos borde

- Áreas con ≤5 responsables: el cabezado no se repite (no hay un 6º bloque). Correcto.
- Área sin responsables: la grilla muestra "Sin actividades programadas" (sin cambios).
- "Devolver al banco": fuera del export; no requiere cambios.

## Pruebas / verificación

- Convención del repo: componentes/páginas sin pruebas unitarias automáticas — se verifican
  con typecheck + ejecución. Verificación: typecheck fiable; descargar la imagen real desde
  prod y comprobar (a) sin botones, (b) letra base/negra, (c) cabezado repetido cada 5 filas,
  (d) sigue horizontal; abrir el PDF (`/programar/exportar`) y comprobar lo mismo; confirmar
  que la grilla en pantalla quedó intacta (con sus botones).

## Fuera de alcance

- La grilla interactiva en pantalla (sin cambios).
- "Devolver al banco" en la lista de tareas por asignar (sin cambios).
- Cambios de paginación del PDF más allá del cabezado repetido.

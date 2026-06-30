# Unidad "cantidad" + editar unidad en Configuración — Design Spec

**Fecha:** 2026-06-29

## Objetivo

Permitir medir actividades de maquinaria **por cantidad** (un número genérico), no solo por ha/hora/kg. En concreto, que la actividad "estercolero" se mida por cantidad. Para asignarla, agregar en Configuración la capacidad de **cambiar la unidad** de una actividad de maquinaria existente (hoy solo se elige al crear).

## Contexto (verificado en código)

- `src/dominio/unidad.ts` define `Unidad = 'ha' | 'hora' | 'kg'`. `normalizarUnidad(u)` cae a `'ha'` para cualquier cosa distinta de `'hora'`/`'kg'`. `etiquetaMedida` da la etiqueta del campo ("Hectáreas/Horas/Kg realizadas/cosechados") y `unidadAbreviada` la forma corta ("ha"/"horas"/"kg").
- La medida se guarda en un único campo numérico `Actividad.haRealizada`; la unidad es solo interpretación/etiqueta. Solo el caso `'ha'` se deriva del área de lotes cuando está CUMPLIDA; el resto (`hora`/`kg`) viene del número explícito.
- `ActividadEstipulada` (catálogo) tiene `nombre` (único) y `unidad` (string, default `'ha'`). Las actividades se enlazan a su unidad por **descripción** (`unidadDe(unidadPorNombre, descripcion)`), no por id.
- Configuración (`src/app/configuracion/page.tsx`): el formulario de crear estipulada tiene un `<select name="unidad">` con opciones Ha/Hora/Kg (líneas 193-197); cada fila existente muestra la unidad como **badge de solo lectura** (`<span>{e.unidad}</span>`, línea 186). Acciones en `src/app/configuracion/acciones.ts`: `crearActividadEstipuladaAccion` valida la unidad a mano (línea 119); existen `renombrar`/`eliminar`, **no** editar unidad.
- El resumen totaliza por unidad: `medidasPorUnidad` (`src/dominio/resumen.ts`) devuelve `Record<Unidad, number>` inicializado `{ ha, hora, kg }`; `resumen-area.tsx:106` itera `['ha','hora','kg']`.

## Diseño

### 1. Nueva unidad `cantidad` — `src/dominio/unidad.ts`

- `Unidad = 'ha' | 'hora' | 'kg' | 'cantidad'`.
- `normalizarUnidad`: aceptar también `'cantidad'` (`u === 'hora' || u === 'kg' || u === 'cantidad' ? u : 'ha'`).
- `etiquetaMedida('cantidad')` → `"Cantidad realizada"`.
- `unidadAbreviada('cantidad')` → `"cantidad"` (el `return unidad` actual ya lo produce; mantener).
- Se comporta como `hora`/`kg`: número capturado en `haRealizada`, sin derivación por hectáreas.

### 2. El resumen totaliza `cantidad` — `src/dominio/resumen.ts` + `src/app/resumen/resumen-area.tsx`

- `medidasPorUnidad`: el acumulador y el retorno pasan a `{ ha: 0, hora: 0, kg: 0, cantidad: 0 }` (TypeScript lo exige porque el retorno es `Record<Unidad, number>`).
- `resumen-area.tsx`: el array de unidades a mostrar pasa a `['ha', 'hora', 'kg', 'cantidad']`.

### 3. Configuración: elegir y editar la unidad

- **Crear** (`page.tsx`): añadir `<option value="cantidad">Cantidad</option>` al `<select name="unidad">`.
- **Validación de crear** (`acciones.ts`): reemplazar la validación manual de la línea 119 por `normalizarUnidad(unidadRaw)` (DRY; incluye `cantidad` automáticamente). Importar `normalizarUnidad` de `@/dominio/unidad`.
- **Editar unidad por fila** (`page.tsx`): reemplazar el badge de solo lectura (`<span>{e.unidad}</span>`) por un pequeño formulario con `<select name="unidad" defaultValue={e.unidad}>` (Ha/Hora/Kg/Cantidad) + botón "guardar", que envía a la nueva acción con `id`.
- **Repositorio** (`src/datos/repositorio.ts`): nueva función `setUnidadActividadEstipulada(id: string, unidad: string)` que hace `prisma.actividadEstipulada.update({ where: { id }, data: { unidad } })`.
- **Acción** (`acciones.ts`): `setUnidadActividadEstipuladaAccion(form)` que lee `id` y `unidad`, normaliza con `normalizarUnidad`, llama al repositorio y refresca (patrón `correr(...)` como las demás).

### Captura de la medida (sin cambios)

El flujo de Cumplimiento ya usa `etiquetaMedida(unidad)` para la etiqueta y guarda en `haRealizada` (con o sin lotes). Con `cantidad` solo cambia la etiqueta del campo; no hay lógica nueva de captura.

## Testing

- **Dominio (Vitest):**
  - `src/dominio/unidad.test.ts` (crear si no existe; si existe, ampliar): `normalizarUnidad('cantidad') === 'cantidad'`; `normalizarUnidad('otra') === 'ha'`; `etiquetaMedida('cantidad') === 'Cantidad realizada'`; `unidadAbreviada('cantidad') === 'cantidad'`.
  - `src/dominio/resumen.test.ts`: actualizar el `expect(...).toEqual({ ha: 6, hora: 6, kg: 100 })` de `medidasPorUnidad` a `{ ha: 6, hora: 6, kg: 100, cantidad: 0 }`; añadir un caso que totalice una fila `cantidad` (p. ej. `{ estado: 'CUMPLIDA', haProgramada: 0, haRealizada: 12, unidad: 'cantidad' }` → `cantidad: 12`).
- **Configuración / RSC:** typecheck fiable (tsconfig que excluye `.next`) + verificación en vivo. El repositorio y las acciones son envoltorios finos (sin tests unitarios, como el resto del repo).
- **Verificación manual:** en Configuración, cambiar la unidad de "estercolero" a Cantidad; en Cumplimiento ver la etiqueta "Cantidad realizada" y registrar un número; en `/resumen` (maquinaria) ver el total "N cantidad".

## Fuera de alcance

- No se cambia el almacenamiento de la medida (sigue en `haRealizada`).
- No se toca cómo se captura el avance por lote (sigue igual; solo cambia la etiqueta de la unidad).
- ha/hora/kg existentes no se ven afectadas.
- El texto exacto ("Cantidad realizada" / abreviatura "cantidad") es ajustable; se deja así salvo que se pida otro.

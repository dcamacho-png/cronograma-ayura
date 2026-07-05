# Solicitar a otra área: varios lotes independiente de la actividad

**Fecha:** 2026-07-05

## Problema

Al solicitar una actividad a otra área (`/tareas`), la selección de lotes/potreros
depende del tipo de actividad, y en dos casos queda corta:

| Rama | Selección de lotes hoy |
|---|---|
| Maquinaria **con bultos** | ✅ varios lotes (`PickerLotesBultos`) |
| Maquinaria **sin bultos** | ⚠️ un solo lote (`SelectFincaLote`) |
| Estándar (no maquinaria) | ❌ ningún selector, solo texto |

Se quiere poder elegir **varios lotes** al solicitar, sin importar el tipo de actividad.

## Hallazgo clave

El backend **ya soporta N lotes**: `crearSolicitudAccion` y `editarSolicitudAccion`
(`src/app/tareas/acciones.ts`) leen `form.getAll('loteId')` y arman un arreglo `loteIds`
que pasan a `crearSolicitud` / `editarSolicitud`. La limitación es **solo de UI**.

Por tanto **no se toca servidor, dominio ni base de datos.** El cambio es en los
componentes de formulario del cliente.

## Diseño

### 1. `PickerLotesBultos` — nueva prop `sinCantidad`

`src/app/tareas/picker-lotes-bultos.tsx`

Agregar una prop opcional `sinCantidad?: boolean` (default `false`). Cuando es `true`:

- No se renderiza el `<input type="number">` de cantidad junto a cada checkbox.
- No se emiten los `<input type="hidden" name="{campo}_{id}">` de cantidad.
- Se siguen emitiendo los `<input type="hidden" name="loteId">` por cada lote marcado.
- El resto (filtro por finca, persistencia de selección al cambiar de finca vía estado
  por id, resumen "Lotes: …") queda igual.

El componente conserva su comportamiento actual cuando `sinCantidad` no se pasa, de modo
que la rama maquinaria-con-bultos no cambia.

### 2. `FormSolicitar` — usar el picker en las dos ramas cortas

`src/app/tareas/form-solicitar.tsx`

- **Rama maquinaria sin bultos** (`esMaquinaria && !conBultos`): reemplazar
  `<SelectFincaLote lotes={lotes} name="loteId" />` por
  `<PickerLotesBultos lotes={lotes} sinCantidad />`.
  (La rama con bultos, `conBultos`, se queda con `<PickerLotesBultos lotes={lotes} />`.)
  El label pasa de "Finca y lote" a "Lotes" en el caso sin bultos.
- **Rama estándar** (no maquinaria): agregar, debajo del campo "Actividad", un nuevo
  bloque con label "Lotes (opcional)" y `<PickerLotesBultos lotes={lotes} sinCantidad />`.

### 3. `FormEditarSolicitud` — multi-lote al editar estándar

`src/app/tareas/form-editar-solicitud.tsx`

- **Rama no maquinaria**: reemplazar
  `<SelectFincaLote lotes={lotes} name="loteId" valorInicial={lotesActuales[0]?.id ?? ''} />`
  por `<PickerLotesBultos lotes={lotes} sinCantidad seleccionInicial={seleccionInicial} />`,
  donde `seleccionInicial` es `Object.fromEntries(lotesActuales.map((l) => [l.id, '']))`
  para que aparezcan marcados los lotes actuales.
- La rama maquinaria de este form no cambia (ya usa `PickerLotesBultos` con cantidad).

## Alcance / no-objetivos

- **No** se pide medida ni cantidad por lote en la solicitud estándar ni en maquinaria
  sin bultos: la solicitud solo indica "hacer esta actividad en estos lotes"; el área
  ejecutora programa la medida al asignar.
- **No** se modifica el backend, el dominio ni el esquema de la base de datos.
- **No** se cambia la rama maquinaria con bultos.

## Verificación

En la app desplegada (o local), como usuario de un área:

1. Solicitar a un área **estándar** → aparece el selector de lotes; marcar 2+ potreros
   de fincas distintas y enviar → la solicitud queda con esos lotes.
2. Solicitar a **maquinaria** una actividad **sin bultos** → poder marcar 2+ lotes.
3. Editar una solicitud **estándar** con varios lotes → aparecen marcados y se puede
   agregar/quitar.
4. Regresión: solicitar a maquinaria con actividad **con bultos** sigue mostrando el
   campo de cantidad por lote.

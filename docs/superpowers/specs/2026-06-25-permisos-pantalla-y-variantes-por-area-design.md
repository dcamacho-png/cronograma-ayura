# Permisos de pantalla por usuario + variantes por área — Design

**Fecha:** 2026-06-25
**Estado:** aprobado en brainstorming, pendiente de plan de implementación.

## Objetivo

Dos capacidades nuevas para el administrador, sin cambiar la lógica de negocio existente:

1. **Visibilidad de pantallas por usuario.** El admin decide qué pantallas ve cada usuario de área.
2. **Variante de pantalla por área, independiente por pantalla.** El admin elige, por área y por cada una de las 4 pantallas operativas, si usa la variante **Maquinaria** (formularios con máquina, unidades ha/hora/kg, registro por medida/avance) o la **Estándar**. Esto reemplaza la detección actual por nombre de área (`nombre.includes('maquinaria')`).

## Contexto actual (lo que existe hoy)

- `Usuario`: `{ id, usuario, nombre, hash, rol (ADMIN|AREA, default AREA), areaId? }`. No hay permisos por pantalla; la visibilidad es solo por rol.
- `secciones.ts`: lista fija `SECCIONES`; `seccionesVisibles(rol)` filtra por `soloAdmin`. Un usuario `AREA` ve siempre Tareas, Programar, Cumplimiento, Resumen. Tablero y Configuración son solo-admin.
- La variante "maquinaria" se calcula en cada página como `esMaquinaria = area.nombre.toLowerCase().includes('maquinaria')` y de ahí cambian formularios, selectores de máquina y unidades. También en `programar/exportar` y `resumen/exportar`.
- `tareas/page.tsx` calcula `maquinariaAreaId` (la única área cuyo nombre contiene "maquinaria") y `FormSolicitar` decide `esMaquinaria` comparando el área ejecutora con ese id.

## Decisiones tomadas (del brainstorming)

- Visibilidad **por usuario** (no por área ni por rol).
- Variante **por área, independiente por cada pantalla** (no un solo interruptor).
- Las **4** pantallas operativas tienen variante configurable: Tareas, Programar, Cumplimiento, Resumen (incluir Cumplimiento por coherencia del flujo de datos).
- Solo **2 variantes**: Estándar / Maquinaria (no se diseñan plantillas adicionales ahora).
- La visibilidad por usuario cubre: Tareas, Programar, Cumplimiento, Resumen y **Tablero** (concedible). **Configuración** sigue solo-admin (no asignable). **Inicio** siempre visible. El **ADMIN ve todo** siempre.
- Enfoque de almacenamiento **A**: columnas en los modelos existentes (no tablas normalizadas ni JSON).
- Combinaciones incoherentes de variante entre pantallas de una misma área **no se bloquean**, pero se muestra un **aviso suave** en Configuración.

## Modelo de datos (Prisma)

**Claves de pantalla canónicas (en código):** `tareas`, `programar`, `cumplimiento`, `resumen`, `tablero`. (`configuracion` no es asignable; `inicio` siempre visible.)

**`Usuario`:**
- `pantallas String?` — CSV de claves permitidas, p. ej. `"tareas,programar,resumen"`.
  - `null` ⇒ set por defecto de área.
  - Se ignora para ADMIN (ve todo).

**`Area`** — 4 booleanos, default `false` (`true` = variante maquinaria de esa pantalla):
- `maqTareas`, `maqProgramar`, `maqCumplimiento`, `maqResumen`.

**Migración** (`prisma migrate deploy` en producción):
1. Agrega las columnas con sus defaults (`pantallas` nullable; los 4 booleanos `false`).
2. `UPDATE` de respaldo: a las áreas con `lower(nombre) LIKE '%maquinaria%'` les pone los 4 booleanos en `true`. Preserva exactamente el comportamiento actual.
3. `Usuario.pantallas` queda `null` para todos ⇒ visibilidad actual intacta.

## Componentes

### `src/auth/permisos.ts` (funciones puras)
- `PANTALLAS_ASIGNABLES = ['tareas','programar','cumplimiento','resumen','tablero']`.
- `DEFAULT_AREA = ['tareas','programar','cumplimiento','resumen']` (sin Tablero).
- `pantallasDe(usuario): Set<string>`
  - ADMIN ⇒ todas las claves (incluye `configuracion`).
  - AREA con `pantallas == null` ⇒ `DEFAULT_AREA`.
  - AREA con `pantallas` definido ⇒ CSV parseado ∩ `PANTALLAS_ASIGNABLES` (nunca `configuracion`).
- `puedeVer(usuario, clave): boolean`.

### `src/dominio/variante.ts` (función pura)
- `esMaquinaria(area, pantalla): boolean` — devuelve la bandera correspondiente a la pantalla (`maqTareas`/`maqProgramar`/`maqCumplimiento`/`maqResumen`).

### Navegación
- `secciones.ts`: `seccionesVisibles(rol)` → `seccionesVisibles(usuario)`, filtra `SECCIONES` por `puedeVer`. Inicio siempre. Actualizar el llamador (`NavPrincipal`) y la página de Inicio (`/`) que también lista secciones.

### Refuerzo en servidor
- Cada página de las 5 asignables agrega, tras `usuarioActual()`, un guard: si `!puedeVer(usuario, clave)` ⇒ `redirect('/')`. Extiende el patrón actual de redirect.
- Borde: usuario sin pantallas ve solo Inicio (sin tarjetas). Responsabilidad del admin. ADMIN nunca afectado.

### Reemplazo de la detección por nombre
Eliminar todo `nombre.toLowerCase().includes('maquinaria')` y usar `esMaquinaria(area, '<pantalla>')`:
- `tareas/page.tsx` → `'tareas'`
- `programar/page.tsx` y `programar/exportar/page.tsx` → `'programar'`
- `cumplimiento/page.tsx` → `'cumplimiento'`
- `resumen/page.tsx` y `resumen/exportar/page.tsx` → `'resumen'`

**Caso "Solicitar a otra área" (`FormSolicitar`):** ya no existe "una" área de maquinaria. Se elimina `maquinariaAreaId`; al form se le pasan las áreas con su bandera `maqTareas`, y resuelve `esMaquinaria` según el `maqTareas` del **área ejecutora seleccionada**. Soporta varias o ninguna área maquinaria.

### UI de administración (en `configuracion/page.tsx`)
- **Usuarios:** por cada usuario de área, casillas para las 5 pantallas asignables; los ADMIN muestran "ve todo" (deshabilitado). Acción `actualizarPantallasUsuarioAccion` (escribe el CSV). Componente cliente `usuario-pantallas.tsx`.
- **Áreas:** por cada área, 4 toggles Estándar/Maquinaria (uno por pantalla) + **aviso suave** si las 4 no coinciden. Se conservan crear/eliminar. Acción `actualizarVariantesAreaAccion`. Componente cliente `area-variantes.tsx`.
- Estilo cálido existente (`.tarjeta`, `accent-bosque`).

## Manejo de errores / casos borde
- CSV con claves desconocidas: se ignoran al intersectar con `PANTALLAS_ASIGNABLES`.
- `configuracion` jamás entra al set de un usuario de área, aunque aparezca en el CSV.
- Acceso por URL directa a una pantalla no permitida: `redirect('/')`.
- Variantes incoherentes entre pantallas de un área: permitido, con aviso suave (no bloqueante).

## Pruebas
- **Unitarias nuevas (Vitest):**
  - `permisos.ts`: admin ve todo; default de área (sin Tablero); CSV parsea e intersecta; Tablero concedible; `configuracion` nunca para área; usuario sin pantallas ⇒ set vacío de asignables.
  - `variante.ts`: cada bandera mapea a su pantalla; default `false` ⇒ estándar.
- **No-regresión:** las 136 pruebas actuales siguen verdes; la lógica de cumplimiento/maquinaria no cambia, solo el origen del booleano `esMaquinaria`.
- **Verificación visual/manual:** Configuración (nuevas casillas/toggles), y que un usuario de área con permisos recortados no vea ni acceda a pantallas vetadas (typecheck fiable + screenshots).

## Fuera de alcance (YAGNI)
- Más de 2 variantes / plantillas de pantalla nuevas.
- Permisos por área o por rol-personalizado.
- Conceder Configuración a usuarios de área.
- Tablas normalizadas o config JSON.

# Rol "Visor" — solo lectura, todas las áreas — Design

**Fecha:** 2026-07-05
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

La app tiene dos roles (`Usuario.rol`, texto): **ADMIN** (ve todas las pantallas + selector de todas las áreas + edita todo) y **AREA** (solo su `areaId`, pantallas según CSV `pantallas` o `DEFAULT_AREA`). Los permisos viven en `src/auth/permisos.ts` (`pantallasDe`, `puedeVer`), la navegación en `src/app/_componentes/secciones.ts` (filtra por `puedeVer`), y la Home (`src/app/page.tsx`) muestra las tarjetas visibles.

Cada una de las 4 pantallas relevantes calcula `esAdmin = u.rol === 'ADMIN'` para: (a) el **selector de áreas** (ADMIN elige cualquiera; AREA queda fijo a la suya) y (b) la **edición**:
- **cumplimiento**: `bloqueado = !esAdmin && plazoCumplimientoVencido(...)`; TODO el edit ya está cableado a `!bloqueado`.
- **programar**: la edición se gatea por `futura` (`esSemanaFutura`); si no, banner "🔒 solo lectura".
- **resumen** y **tablero**: ya son de solo lectura (sin mutaciones).

Usuarios se crean en **Configuración** (solo ADMIN) con `crearUsuarioAccion` (rol = AREA|ADMIN).

## Objetivo

Un tipo de usuario **"Visor" (solo consulta)** que **ve todas las áreas** pero **solo lectura**, limitado a las pantallas **resumen, cumplimiento, programar, tablero**.

## Decisiones (acordadas)

1. **Rol nuevo `VISOR`.** Read-only, todas las áreas, exactamente esas 4 pantallas (no ve tareas, consulta ni configuración).
2. **Asignación solo al crear** el usuario (opción de rol "Visor" en el formulario de Configuración). No se agrega UI para cambiar el rol de un usuario existente.
3. **Doble candado**: ocultar todos los controles de edición en la UI **y** rechazar en las server actions alcanzables por el Visor (programar y cumplimiento).
4. **Sin cambios de esquema** (`rol` ya es texto; `VISOR` es un valor nuevo). El Visor no tiene área (`areaId = null`).

## Arquitectura

### `src/auth/permisos.ts`
- `pantallasDe(u)`: si `u.rol === 'VISOR'` → `new Set(['resumen','cumplimiento','programar','tablero'])` (ignora el CSV `pantallas`). ADMIN y AREA sin cambios.
- **Nuevo** `esSoloLectura(u: UsuarioPermiso): boolean` → `u.rol === 'VISOR'`.

### Selector de áreas (las 4 páginas: resumen, cumplimiento, programar, tablero)
- Donde hoy dice `const esAdmin = u.rol === 'ADMIN'` y se usa para elegir área / mostrar el switcher, introducir `const verTodas = esAdmin || u.rol === 'VISOR'` (o `esSoloLectura(u)`), y usar `verTodas` para: elegir `areaId` (de `sp.area` entre todas) y renderizar la barra de áreas. Así el Visor ve y navega todas las áreas como el ADMIN.

### Edición solo-lectura
- **cumplimiento** (`page.tsx`): `bloqueado = esSoloLectura(u) || (!esAdmin && plazoCumplimientoVencido(...))`. Como todo el edit ya está cableado a `!bloqueado`, el Visor no ve ningún control. El banner de "plazo vencido" se mantiene solo para el caso de plazo; para el Visor no hace falta banner (no verá controles).
- **programar** (`page.tsx`): definir `const soloLectura = esSoloLectura(u)` y gatear los controles de edición con `futura && !soloLectura` (bloque "tareas por asignar", control de dedicar tractor en la grilla, botón de crear responsable si aplica). El Visor ve el cronograma y la grilla de tractores en modo lectura.
- **resumen / tablero**: sin cambios de edición (no hay); solo el selector de áreas (arriba).

### Server actions (doble candado)
- Añadir al inicio de cada server action **mutante** de `src/app/programar/acciones.ts` y `src/app/cumplimiento/acciones.ts` una guarda: obtener `usuarioActual()` y `if (u && esSoloLectura(u)) return` (o redirect a la misma pantalla) antes de mutar. Son las acciones alcanzables desde las pantallas que el Visor puede abrir. (resumen/tablero no tienen acciones; tareas/consulta/configuración no son navegables por el Visor.)

### Configuración
- `src/app/configuracion/page.tsx`: en el `<select name="rol">` del formulario de crear usuario, añadir `<option value="VISOR">Visor (solo consulta)</option>`.
- `src/app/configuracion/acciones.ts` `crearUsuarioAccion`: aceptar `rol === 'VISOR'` (hoy valida solo AREA|ADMIN); para VISOR el área es `null`.
- `src/datos/repositorio.ts` `crearUsuario`: ampliar el tipo del parámetro `rol` a `'AREA' | 'ADMIN' | 'VISOR'`.
- `src/app/configuracion/usuario-pantallas.tsx`: para un usuario VISOR, no mostrar los toggles de pantallas (sus pantallas son fijas) — tratarlo como el caso admin (sin toggles). El listado de usuarios muestra el rol como hoy (`us.rol`).

### Navegación / Home
- Sin cambios de código: `seccionesVisibles` y la Home ya filtran por `puedeVer`, así que el Visor ve solo sus 4 tarjetas/secciones. Las páginas no permitidas siguen con `redirect('/')` y la Home es accesible.

## Casos borde

- Visor navega a `/tareas`, `/consulta` o `/configuracion` → `redirect('/')` (no permitido) → Home con sus 4 tarjetas.
- Visor en `programar` de una semana futura: ve el cronograma pero sin controles de asignar/dedicar/devolver.
- Visor en `cumplimiento`: ve estados y avances, sin botones de cerrar/avance/novedad/editar.
- Petición directa (fuera de la UI) a una acción mutante de programar/cumplimiento siendo Visor → rechazada por la guarda.
- Visor sin área: las 4 páginas eligen área desde `sp.area` (o la primera) como el ADMIN; nunca dependen de `u.areaId`.

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Vitest: tests de `permisos.ts` (pantallasDe VISOR = las 4; `esSoloLectura`) + suite existente verde.
- Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- En vivo (server local + cookie firmada): crear un usuario VISOR en Configuración; iniciar sesión como ese usuario (cookie firmada con su id) y comprobar: ve las 4 pantallas y el selector de todas las áreas; en cumplimiento y programar NO aparece ningún control de edición; resumen/tablero se ven; /tareas, /consulta y /configuración redirigen a Home. (Escritura reversible: crear el usuario de prueba y borrarlo al final por id.)

## Fuera de alcance

- Cambiar el rol de un usuario existente (solo al crear).
- Incluir /consulta u otras pantallas para el Visor (solo las 4).
- Guardas de solo-lectura en acciones de tareas/configuración (no alcanzables por el Visor).
- Cambios de esquema.

# Rol "Visor" (solo lectura, todas las áreas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un rol `VISOR` que ve las 4 pantallas (resumen, cumplimiento, programar, tablero) de **todas las áreas** en **solo lectura**, con doble candado (UI + server actions).

**Architecture:** El rol vive en `Usuario.rol` (texto, sin cambio de esquema). `permisos.ts` fija sus pantallas y expone `esSoloLectura`. Las 4 páginas usan `verTodas` (= admin || visor) para el selector de áreas y `soloLectura` (= visor) para ocultar controles de edición. Las server actions mutantes de programar/cumplimiento rechazan al Visor. La UI de Configuración permite crearlo.

**Tech Stack:** Next.js (App Router, esta versión con breaking changes — ver `AGENTS.md`), React Server Components, Server Actions, Prisma, Vitest, Tailwind v4.

## Global Constraints

- **Sin cambios de esquema.** `rol` ya es texto; `VISOR` es un valor nuevo. El Visor tiene `areaId = null`.
- **Doble candado obligatorio:** ocultar controles en UI **y** rechazar en las server actions alcanzables por el Visor (programar + cumplimiento).
- **Alcance del Visor:** exactamente `['resumen','cumplimiento','programar','tablero']`. No ve tareas, consulta ni configuración.
- **Asignación solo al crear** el usuario. No se añade UI para cambiar el rol de un usuario existente.
- **Verificación de tipos:** usar `npx tsc --noEmit -p tsconfig.check.json` (el `tsc` normal da falso-verde por `.next`).
- **Next.js:** antes de tocar APIs de Next, consultar `node_modules/next/dist/docs/` si hay duda; este proyecto ya usa Server Components/Actions, mantener el patrón existente.

---

## File Structure

- `src/auth/permisos.ts` — pantallas del Visor + `esSoloLectura` (**modificar**).
- `src/auth/permisos.test.ts` — tests del comportamiento VISOR (**modificar**).
- `src/datos/repositorio.ts` — ampliar tipo `rol` en `crearUsuario` (**modificar**, línea 465-475).
- `src/app/configuracion/acciones.ts` — `crearUsuarioAccion` acepta `VISOR` (**modificar**, línea 167-178).
- `src/app/configuracion/page.tsx` — `<option value="VISOR">` en el select de rol; `esAdmin` para `UsuarioPantallas` pasa a "sin toggles" también para VISOR (**modificar**, líneas 266-288).
- `src/app/configuracion/usuario-pantallas.tsx` — no mostrar toggles para VISOR (**modificar**).
- `src/app/resumen/page.tsx` — selector con `verTodas` (**modificar**, líneas 29-33, 68, 96).
- `src/app/programar/page.tsx` — `verTodas` + `soloLectura` en gating de edición (**modificar**, líneas 40-44, 98, 130, 202, 213).
- `src/app/cumplimiento/page.tsx` — `verTodas` + `soloLectura` en `bloqueado` y banner (**modificar**, líneas 50-63, 110, 164).
- `src/app/programar/acciones.ts` — guarda de solo-lectura en las 10 acciones mutantes (**modificar**).
- `src/app/cumplimiento/acciones.ts` — guarda de solo-lectura en las acciones mutantes (**modificar**).

**Sin cambios:** `src/app/tablero/page.tsx` (ya es mensual sobre todas las áreas, sin selector ni edición; el Visor lo obtiene vía `pantallasDe`), `src/app/_componentes/secciones.ts` y `src/app/page.tsx` (ya filtran por `puedeVer`).

---

### Task 1: Permisos del Visor (`pantallasDe` + `esSoloLectura`)

**Files:**
- Modify: `src/auth/permisos.ts`
- Test: `src/auth/permisos.test.ts`

**Interfaces:**
- Consumes: `UsuarioPermiso = { rol: string; pantallas: string | null }` (ya existe).
- Produces:
  - `pantallasDe(u)` devuelve `new Set(['resumen','cumplimiento','programar','tablero'])` cuando `u.rol === 'VISOR'`.
  - `esSoloLectura(u: UsuarioPermiso): boolean` → `true` solo si `u.rol === 'VISOR'`.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/auth/permisos.test.ts`, dentro del `describe('pantallasDe', ...)` añadir:

```typescript
  it('VISOR ve exactamente las 4 pantallas de solo lectura', () => {
    const s = pantallasDe({ rol: 'VISOR', pantallas: null })
    expect([...s].sort()).toEqual(['cumplimiento', 'programar', 'resumen', 'tablero'])
    expect(s.has('tareas')).toBe(false)
    expect(s.has('consulta')).toBe(false)
    expect(s.has('configuracion')).toBe(false)
  })

  it('VISOR ignora el CSV de pantallas', () => {
    const s = pantallasDe({ rol: 'VISOR', pantallas: 'tareas,configuracion' })
    expect([...s].sort()).toEqual(['cumplimiento', 'programar', 'resumen', 'tablero'])
  })
```

Y añadir un nuevo `describe` al final del archivo (después del `describe('puedeVer', ...)`), actualizando también el import de la primera línea a `import { pantallasDe, puedeVer, esSoloLectura } from './permisos'`:

```typescript
describe('esSoloLectura', () => {
  it('solo el VISOR es de solo lectura', () => {
    expect(esSoloLectura({ rol: 'VISOR', pantallas: null })).toBe(true)
    expect(esSoloLectura({ rol: 'ADMIN', pantallas: null })).toBe(false)
    expect(esSoloLectura({ rol: 'AREA', pantallas: null })).toBe(false)
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/auth/permisos.test.ts`
Expected: FAIL — `esSoloLectura is not a function` y el set de VISOR aún no coincide (hoy `pantallasDe` de VISOR cae en la rama del CSV y devuelve un set vacío).

- [ ] **Step 3: Implementar en `src/auth/permisos.ts`**

Añadir la rama VISOR dentro de `pantallasDe` (después de la línea `if (u.rol === 'ADMIN') ...`) y la nueva función al final del archivo:

```typescript
export const PANTALLAS_VISOR = ['resumen', 'cumplimiento', 'programar', 'tablero'] as const

export function pantallasDe(u: UsuarioPermiso): Set<string> {
  if (u.rol === 'ADMIN') return new Set<string>([...PANTALLAS_ASIGNABLES, 'configuracion'])
  if (u.rol === 'VISOR') return new Set<string>(PANTALLAS_VISOR)
  if (u.pantallas == null) return new Set<string>(DEFAULT_AREA)
  const claves = u.pantallas
    .split(',')
    .map((c) => c.trim())
    .filter((c) => ASIGNABLES.has(c))
  return new Set<string>(claves)
}

export function puedeVer(u: UsuarioPermiso, clave: string): boolean {
  return pantallasDe(u).has(clave)
}

// El Visor es un usuario de solo consulta (todas las áreas, sin editar).
export function esSoloLectura(u: UsuarioPermiso): boolean {
  return u.rol === 'VISOR'
}
```

(Definir `PANTALLAS_VISOR` a nivel de módulo, junto a las otras constantes de la parte superior; el bloque de arriba muestra la forma final de las funciones.)

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/auth/permisos.test.ts`
Expected: PASS (todos los `it`, incluidos los nuevos y los previos de AREA/ADMIN).

- [ ] **Step 5: Commit**

```bash
git add src/auth/permisos.ts src/auth/permisos.test.ts
git commit -m "feat(permisos): rol VISOR (4 pantallas solo lectura) + esSoloLectura"
```

---

### Task 2: Crear usuarios VISOR en Configuración

**Files:**
- Modify: `src/datos/repositorio.ts` (`crearUsuario`, líneas 465-475)
- Modify: `src/app/configuracion/acciones.ts` (`crearUsuarioAccion`, líneas 167-178)
- Modify: `src/app/configuracion/page.tsx` (select de rol línea 285-288; `UsuarioPantallas` línea 266-271)
- Modify: `src/app/configuracion/usuario-pantallas.tsx`

**Interfaces:**
- Consumes: nada de tareas previas (independiente de Task 1 salvo el valor `'VISOR'`).
- Produces: un usuario con `rol='VISOR'` y `areaId=null` creado desde el formulario de Configuración. `crearUsuario(usuario, nombre, password, rol, areaId)` acepta `rol: 'AREA' | 'ADMIN' | 'VISOR'`.

- [ ] **Step 1: Ampliar el tipo en `crearUsuario` (`src/datos/repositorio.ts`)**

El parámetro `rol` ya es `string` (línea 469), así que no requiere cambio de firma; confirmar que la línea de datos fuerza `areaId=null` salvo AREA (ya lo hace: `areaId: rol === 'AREA' ? areaId : null`). No se necesita edición aquí salvo verificar. **Si** en el futuro se tipara el parámetro como unión, sería `rol: 'AREA' | 'ADMIN' | 'VISOR'`. Dejar el archivo sin cambios en este step (el gate de valores válidos vive en la acción).

- [ ] **Step 2: Aceptar `VISOR` en `crearUsuarioAccion` (`src/app/configuracion/acciones.ts`)**

Reemplazar el cuerpo de `crearUsuarioAccion` (líneas 167-178):

```typescript
export async function crearUsuarioAccion(form: FormData) {
  const usuario = texto(form, 'usuario')
  const nombre = texto(form, 'nombre')
  const password = texto(form, 'password')
  const rol = texto(form, 'rol')
  const areaId = textoOpcional(form, 'areaId')
  if (!usuario || !nombre || !password || (rol !== 'AREA' && rol !== 'ADMIN' && rol !== 'VISOR')) faltanDatos()
  await correr(
    () => crearUsuario(usuario, nombre, password, rol, rol === 'AREA' ? areaId : null),
    'Usuario creado.',
  )
}
```

(Nota: `rol` se pasa como `string`; `crearUsuario` ya normaliza `areaId` a `null` cuando no es AREA. Se elimina el cast `as 'AREA' | 'ADMIN'` porque ahora hay tres valores válidos.)

- [ ] **Step 3: Añadir la opción VISOR y ocultar toggles para VISOR (`src/app/configuracion/page.tsx`)**

En el `<select name="rol">` (líneas 285-288) añadir la opción:

```tsx
            <select name="rol" required className="rounded-lg border border-borde bg-marfil p-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque/40">
              <option value="AREA">Área</option>
              <option value="ADMIN">Admin</option>
              <option value="VISOR">Visor (solo consulta)</option>
            </select>
```

En la lista de usuarios, pasar a `UsuarioPantallas` una prop que cubra también al VISOR (líneas 266-271). Cambiar `esAdmin={us.rol === 'ADMIN'}` por `sinToggles={us.rol === 'ADMIN' || us.rol === 'VISOR'}`:

```tsx
                <UsuarioPantallas
                  id={us.id}
                  sinToggles={us.rol === 'ADMIN' || us.rol === 'VISOR'}
                  pantallas={us.pantallas}
                  accion={actualizarPantallasUsuarioAccion}
                />
```

- [ ] **Step 4: Actualizar `UsuarioPantallas` para el caso "sin toggles" (`src/app/configuracion/usuario-pantallas.tsx`)**

Renombrar la prop `esAdmin` → `sinToggles` y ajustar el mensaje. Reemplazar la firma y la primera línea del cuerpo:

```tsx
export function UsuarioPantallas({
  id,
  sinToggles,
  pantallas,
  accion,
}: {
  id: string
  sinToggles: boolean
  pantallas: string | null
  accion: (formData: FormData) => void | Promise<void>
}) {
  if (sinToggles) return <span className="text-xs text-tierra">pantallas fijas</span>
  const activas = setActual(pantallas)
```

(El resto del componente queda igual. Para ADMIN y VISOR se muestra "pantallas fijas" en vez de checkboxes.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores (en particular, `crearUsuarioAccion` sin el cast y `UsuarioPantallas` con la prop renombrada compilan).

- [ ] **Step 6: Commit**

```bash
git add src/app/configuracion/acciones.ts src/app/configuracion/page.tsx src/app/configuracion/usuario-pantallas.tsx src/datos/repositorio.ts
git commit -m "feat(configuracion): crear usuario VISOR (solo consulta) sin toggles de pantallas"
```

---

### Task 3: Selector de todas las áreas en `resumen`

**Files:**
- Modify: `src/app/resumen/page.tsx` (líneas 29-33, 68, 96)

**Interfaces:**
- Consumes: `esSoloLectura` de Task 1 (`src/auth/permisos`).
- Produces: el Visor ve la barra de áreas y navega cualquier área en `/resumen`.

- [ ] **Step 1: Importar `esSoloLectura` y calcular `verTodas`**

En `src/app/resumen/page.tsx`, en el import de permisos añadir `esSoloLectura` (junto a `puedeVer`). Luego, después de `if (!puedeVer(u, 'resumen')) redirect('/')` (línea 28), reemplazar:

```tsx
  const esAdmin = u.rol === 'ADMIN'
  const verTodas = esAdmin || esSoloLectura(u)

  const areaId = verTodas
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
```

- [ ] **Step 2: Usar `verTodas` para renderizar la barra de áreas**

En la línea 68, cambiar `{esAdmin ? (` por `{verTodas ? (` (el bloque de chips de áreas vs. el texto "Área: <b>"). Dejar el botón "Exportar PDF (todas las áreas)" de la línea 96 con `{esAdmin && (` **sin cambios** (exportación masiva sigue siendo solo admin).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 4: Build (verifica RSC/serialización)**

Run: `DATABASE_URL="postgres://u:p@localhost:5432/db" npx next build`
Expected: `✓ Compiled successfully` (no requiere DB real para compilar; usa una URL cualquiera).

- [ ] **Step 5: Commit**

```bash
git add src/app/resumen/page.tsx
git commit -m "feat(resumen): el VISOR ve y navega todas las áreas"
```

---

### Task 4: Programar — todas las áreas + solo lectura

**Files:**
- Modify: `src/app/programar/page.tsx` (líneas 40-44, 98, 130, 202, 213)

**Interfaces:**
- Consumes: `esSoloLectura` de Task 1.
- Produces: el Visor ve el cronograma y la grilla de tractores de cualquier área **sin controles de edición** (asignar, devolver al banco, editar turno, dedicar tractor).

- [ ] **Step 1: Importar `esSoloLectura`, calcular `verTodas` y `soloLectura`**

En `src/app/programar/page.tsx`, añadir `esSoloLectura` al import de permisos. Después de `if (!puedeVer(u, 'programar')) redirect('/')` (línea 39), reemplazar:

```tsx
  const esAdmin = u.rol === 'ADMIN'
  const soloLectura = esSoloLectura(u)
  const verTodas = esAdmin || soloLectura

  const areaId = verTodas
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
```

- [ ] **Step 2: Barra de áreas con `verTodas`**

En la línea 98, cambiar `{esAdmin ? (` por `{verTodas ? (` (chips de áreas vs. texto "Área:"). El botón export-all de la línea 182 (`{esAdmin && (`) queda igual.

- [ ] **Step 3: Ocultar controles de edición para el Visor**

Aplicar `!soloLectura` a los tres puntos de edición:

- Bloque "Tareas por asignar" (línea 130): cambiar `{futura && porAsignar.length > 0 && (` por `{futura && !soloLectura && porAsignar.length > 0 && (`. Esto oculta `AsignarTareaForm` **y** el form "Devolver al banco" que vive dentro.
- `GrillaSemana` (línea 202): cambiar `turnoEditable={futura}` por `turnoEditable={futura && !soloLectura}`.
- `GrillaTractor` (línea 213): cambiar `futura={futura}` por `futura={futura && !soloLectura}`.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.
Run: `DATABASE_URL="postgres://u:p@localhost:5432/db" npx next build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/app/programar/page.tsx
git commit -m "feat(programar): VISOR ve todas las áreas en solo lectura (sin asignar/dedicar)"
```

---

### Task 5: Cumplimiento — todas las áreas + solo lectura

**Files:**
- Modify: `src/app/cumplimiento/page.tsx` (líneas 50-63, 110, 164)

**Interfaces:**
- Consumes: `esSoloLectura` de Task 1.
- Produces: el Visor ve estados/avances de cualquier área **sin** botones de cerrar/avance/novedad/editar, y **sin** el banner de "plazo vencido".

- [ ] **Step 1: Importar `esSoloLectura`, calcular `verTodas`, `soloLectura` y ajustar `bloqueado`**

En `src/app/cumplimiento/page.tsx`, añadir `esSoloLectura` al import de permisos. Después de `if (!puedeVer(u, 'cumplimiento')) redirect('/')` (línea 49), reemplazar el bloque `esAdmin`/`areaId` (líneas 50-54) y la definición de `bloqueado` (línea 63):

```tsx
  const esAdmin = u.rol === 'ADMIN'
  const soloLectura = esSoloLectura(u)
  const verTodas = esAdmin || soloLectura

  const areaId = verTodas
    ? (sp.area && areas.some((a) => a.id === sp.area) ? sp.area : areas[0].id)
    : (u.areaId && areas.some((a) => a.id === u.areaId) ? u.areaId : areas[0].id)
```

Y en la línea 63:

```tsx
  const bloqueado = soloLectura || (!esAdmin && plazoCumplimientoVencido(anio, semana, hoy))
```

- [ ] **Step 2: Barra de áreas con `verTodas`**

En la línea 110, cambiar `{esAdmin ? (` por `{verTodas ? (`.

- [ ] **Step 3: Ocultar el banner de plazo para el Visor**

En la línea 164, cambiar `{bloqueado && (` por `{bloqueado && !soloLectura && (`. Así el Visor (que también tiene `bloqueado=true`) no ve el mensaje "⛔ Plazo vencido"; todos los controles de edición ya están cableados a `!bloqueado`, por lo que quedan ocultos sin necesidad de banner.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.
Run: `DATABASE_URL="postgres://u:p@localhost:5432/db" npx next build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): VISOR ve todas las áreas en solo lectura (sin controles ni banner de plazo)"
```

---

### Task 6: Doble candado — guardas en las server actions

**Files:**
- Modify: `src/app/programar/acciones.ts`
- Modify: `src/app/cumplimiento/acciones.ts`

**Interfaces:**
- Consumes: `esSoloLectura` de Task 1, `usuarioActual` de `@/auth/sesion`.
- Produces: toda acción mutante alcanzable por el Visor retorna temprano (no muta) si el usuario es VISOR.

**Nota de testing:** estas guardas dependen de cookies/Prisma, así que no llevan test unitario (el codebase no testea server actions). Se verifican por typecheck + build + inspección del checklist de abajo y la prueba en vivo de Task 7.

- [ ] **Step 1: Añadir helper de guarda en `programar/acciones.ts`**

`programar/acciones.ts` aún no importa `usuarioActual`. Añadir imports y un helper tras las utilidades `texto/numeroOpcional/textoOpcional` (después de la línea 24):

```typescript
import { usuarioActual } from '@/auth/sesion'
import { esSoloLectura } from '@/auth/permisos'

// El Visor (solo consulta) nunca puede mutar. Doble candado con la UI.
async function bloqueadoVisor(): Promise<boolean> {
  const u = await usuarioActual()
  return !!u && esSoloLectura(u)
}
```

(Colocar los `import` junto a los demás imports del inicio del archivo, no en medio del cuerpo.)

- [ ] **Step 2: Guardar cada acción mutante de `programar/acciones.ts`**

Añadir `if (await bloqueadoVisor()) return` como **primera** línea del cuerpo de cada una de estas 10 acciones: `crearActividadAccion`, `eliminarActividadAccion`, `duplicarSemanaAccion`, `crearResponsableAccion`, `actualizarActividadAccion`, `asignarTareaAccion`, `devolverAlBancoAccion`, `devolverAAsignacionAccion`, `devolverGrillaAlBancoAccion`, `dedicarTractorAccion`.

Ejemplo (patrón idéntico en las 10):

```typescript
export async function crearActividadAccion(form: FormData) {
  if (await bloqueadoVisor()) return
  const areaId = texto(form, 'areaId')
  // …resto sin cambios…
}
```

- [ ] **Step 3: Añadir helper de guarda en `cumplimiento/acciones.ts`**

`cumplimiento/acciones.ts` ya importa `usuarioActual`. Añadir el import de `esSoloLectura` (línea 6 zona de imports) y un helper junto a `bloqueadoPorPlazo` (tras la línea 31):

```typescript
import { esSoloLectura } from '@/auth/permisos'

// El Visor (solo consulta) nunca puede mutar. Doble candado con la UI.
async function bloqueadoVisor(): Promise<boolean> {
  const u = await usuarioActual()
  return !!u && esSoloLectura(u)
}
```

- [ ] **Step 4: Guardar cada acción mutante de `cumplimiento/acciones.ts`**

Añadir `if (await bloqueadoVisor()) return` como **primera** línea del cuerpo de cada acción exportada: `reprogramarAccion`, `agregarActividadRealizadaAccion`, `devolverAlBancoAccion`, `registrarAvanceObservacionAccion`, `marcarCumplidaActividadAccion`, `setLotesActividadAccion`, `registrarAvanceAccion`, `editarAvanceAccion`, `eliminarAvanceAccion`, `agregarNovedadAccion`, `eliminarNovedadAccion`, `registrarMedidaGeneralAccion`, `registrarNovedadActividadAccion`, `desmarcarActividadAccion`, `cerrarParcialAccion`, `reabrirCierreAccion`, `editarNovedadAccion`.

Ejemplo:

```typescript
export async function reprogramarAccion(form: FormData) {
  if (await bloqueadoVisor()) return
  const id = texto(form, 'id')
  // …resto sin cambios…
}
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.
Run: `DATABASE_URL="postgres://u:p@localhost:5432/db" npx next build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Verificar cobertura (inspección)**

Run: `grep -c "if (await bloqueadoVisor()) return" src/app/programar/acciones.ts src/app/cumplimiento/acciones.ts`
Expected: `programar/acciones.ts:10` y `cumplimiento/acciones.ts:17`.

- [ ] **Step 7: Commit**

```bash
git add src/app/programar/acciones.ts src/app/cumplimiento/acciones.ts
git commit -m "feat(acciones): rechazar mutaciones del VISOR en programar y cumplimiento (doble candado)"
```

---

### Task 7: Verificación end-to-end

**Files:** ninguno (verificación).

- [ ] **Step 1: Suite completa de tests**

Run: `npx vitest run`
Expected: PASS (incluye los nuevos tests de `permisos.test.ts` y toda la suite previa verde).

- [ ] **Step 2: Typecheck total**

Run: `npx tsc --noEmit -p tsconfig.check.json`
Expected: sin errores.

- [ ] **Step 3: Build de producción**

Run: `DATABASE_URL="postgres://u:p@localhost:5432/db" npx next build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Prueba en vivo (server local + cookie firmada)**

Levantar la app localmente. Crear un usuario VISOR desde Configuración (como ADMIN). Iniciar sesión como ese usuario y comprobar:
- Home muestra solo 4 tarjetas: resumen, cumplimiento, programar, tablero.
- `/resumen`, `/cumplimiento`, `/programar` muestran la barra de chips de **todas las áreas** y permiten navegarlas.
- `/cumplimiento`: NO aparecen controles de cerrar/avance/novedad/editar; NO aparece el banner de "plazo vencido".
- `/programar` (semana futura): NO aparece "Tareas por asignar", ni edición de turno en la grilla, ni el control de dedicar tractor.
- `/tablero`: se ve (mensual, todas las áreas).
- `/tareas`, `/consulta`, `/configuracion` → `redirect('/')` (Home).
- Borrar el usuario de prueba por id al terminar (escritura reversible).

- [ ] **Step 5: Commit de docs si aplica**

(Si se ajustó algo del plan durante la ejecución, commitear el plan actualizado. Si no, nada que hacer.)

---

## Self-Review

**Spec coverage:**
- Decisión 1 (rol VISOR, 4 pantallas, todas las áreas, solo lectura) → Task 1 (pantallas) + Tasks 3/4/5 (áreas) + Tasks 4/5/6 (solo lectura). ✅
- Decisión 2 (asignación solo al crear) → Task 2 (option en crear; no se toca cambio de rol). ✅
- Decisión 3 (doble candado UI + acciones) → Tasks 4/5 (UI) + Task 6 (acciones). ✅
- Decisión 4 (sin esquema, areaId=null) → Task 2 (crearUsuario fuerza null) + Global Constraints. ✅
- Arquitectura `permisos.ts` → Task 1. ✅
- Selector de áreas en las 4 páginas → resumen/programar/cumplimiento (Tasks 3/4/5); tablero ya es all-areas sin selector (documentado en File Structure). ✅
- Edición solo-lectura cumplimiento/programar → Tasks 5/4; resumen/tablero sin edición. ✅
- Server actions doble candado → Task 6. ✅
- Configuración (select, acción, repositorio, usuario-pantallas) → Task 2. ✅
- Navegación/Home sin cambios → documentado en File Structure. ✅
- Casos borde (redirects, semana futura, Visor sin área) → cubiertos por la lógica de `verTodas` (nunca usa `u.areaId`) y `puedeVer`; verificados en Task 7 Step 4. ✅

**Placeholder scan:** sin TBD/TODO; todo el código concreto. ✅

**Type consistency:** `esSoloLectura`, `verTodas`, `soloLectura`, `bloqueadoVisor`, `PANTALLAS_VISOR`, prop `sinToggles` usados con el mismo nombre en todas las tareas. `crearUsuario` recibe `rol: string` (sin cast). ✅

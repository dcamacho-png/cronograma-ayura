# Conservatorio — temas puntuales para hablar con gerencia — Design

**Fecha:** 2026-07-05
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

La app tiene un **banco de tareas** por área (`/tareas`, modelo `Tarea`) para programar/cumplir trabajo, y un rol **VISOR** (usuario `gerencia`) que ve todas las áreas en solo lectura, hoy con 3 pantallas: resumen, programar, tablero (ver [[rol-visor-solo-lectura]]). Los permisos de pantalla viven en `src/auth/permisos.ts` (`PANTALLAS_ASIGNABLES`, `DEFAULT_AREA`, `PANTALLAS_VISOR`, `pantallasDe`, `puedeVer`); la navegación en `src/app/_componentes/secciones.ts`; los toggles de pantalla por usuario en `src/app/configuracion/usuario-pantallas.tsx`. Existe `src/app/_componentes/select-finca-lote.tsx` (selector finca→lote reutilizable, envía `name="loteId"`).

## Objetivo

Una pantalla nueva **`/conservatorio`** donde cada área escribe **temas puntuales para hablar con la persona de gerencia** (el usuario Visor). Gerencia los va **marcando como hablados** durante la semana y se **ocultan** (pasan a un historial colapsable). La pantalla debe ser **lo más limpia posible**.

## Decisiones (acordadas)

1. **Tema = nota nueva y corta** (texto), con **finca y potrero (lote) opcionales** como contexto. No está ligada al banco de tareas; es un modelo aparte.
2. **Lista corrida** (no atada a una semana): se acumula hasta que se marca como hablada.
3. **Visibilidad:** un usuario de **área** ve y crea **solo las notas de su área**; **gerencia (VISOR)** y **admin** ven **todas** las notas, agrupadas por área.
4. **Marcar "hablado":** lo hacen **gerencia (VISOR) y admin** (NO el área). Al marcar, la nota sale de la lista activa y va a un colapsable **"Ya hablados"**, con opción de **reabrir** (gerencia/admin).
5. **Borrar:** el **área** puede borrar sus propias notas **mientras estén pendientes**; admin puede borrar cualquiera.
6. **Fechas:** cada nota muestra su **fecha de creación** (discreta).
7. **UI minimalista:** al entrar se ve solo el campo para agregar + la lista de temas activos (texto + fecha + etiqueta de lote si tiene). Finca/lote van ocultos tras un "➕ contexto" opcional. Historial colapsado al fondo. Sin conteos ni adornos.

## Arquitectura

### Modelo de datos (`prisma/schema.prisma`) — requiere migración

```prisma
model NotaConservatorio {
  id        String    @id @default(cuid())
  texto     String
  hablado   Boolean   @default(false)
  creadaEn  DateTime  @default(now())
  habladaEn DateTime?

  areaId String
  area   Area   @relation(fields: [areaId], references: [id])

  fincaId String?
  finca   Finca?  @relation(fields: [fincaId], references: [id])
  loteId  String?
  lote    Lote?   @relation(fields: [loteId], references: [id])

  @@index([areaId, hablado])
}
```

- Se agregan las relaciones inversas en `Area` (`notasConservatorio NotaConservatorio[]`), `Finca` (`notasConservatorio NotaConservatorio[]`) y `Lote` (`notasConservatorio NotaConservatorio[]`).
- `fincaId` se **deriva** del lote elegido en el server (la UI solo envía `loteId` vía `SelectFincaLote`); se guarda para poder mostrar/filtrar por finca sin join adicional. Si no se elige lote, ambos quedan `null`.
- Migración nueva `prisma/migrations/<timestamp>_conservatorio` (generada con `prisma migrate dev --name conservatorio`).

### Permisos (`src/auth/permisos.ts`)
- Añadir `'conservatorio'` a **`PANTALLAS_ASIGNABLES`** (toggleable por usuario), a **`DEFAULT_AREA`** (las áreas la tienen por defecto) y a **`PANTALLAS_VISOR`** (gerencia queda con 4: resumen, programar, tablero, conservatorio).
- ADMIN ya ve todo (incluye la nueva por estar en `PANTALLAS_ASIGNABLES`).
- **Nuevo helper** `puedeMarcarConservatorio(u): boolean` → `u.rol === 'ADMIN' || u.rol === 'VISOR'`.
- **Caveat conocido:** usuarios AREA con CSV de pantallas guardado NO verán la nueva hasta que un admin la habilite en Configuración (mismo caso histórico de `consulta`).

### Navegación y toggles
- `src/app/_componentes/secciones.ts`: agregar `{ clave: 'conservatorio', href: '/conservatorio', texto: 'Conservatorio', icono: '🗣️', descripcion: 'Temas para hablar con gerencia' }`.
- `src/app/configuracion/usuario-pantallas.tsx`: agregar `{ clave: 'conservatorio', etiqueta: 'Conservatorio' }` a la lista `PANTALLAS`.

### Repositorio (`src/datos/repositorio.ts`)
- `crearNotaConservatorio({ areaId, texto, loteId })` → deriva `fincaId` del lote (si hay) y crea la nota.
- `listarNotasConservatorio(areaId | null)` → si `areaId` es `null` (admin/visor) trae todas; si no, solo las de esa área. Incluye `area`, `finca`, `lote`. Orden: `hablado asc`, luego `creadaEn desc`.
- `marcarNotaHablada(id)` → `hablado = true`, `habladaEn = now()`.
- `reabrirNotaConservatorio(id)` → `hablado = false`, `habladaEn = null`.
- `borrarNotaConservatorio(id)` → delete.

### Dominio testeable (`src/dominio/conservatorio.ts`)
- `separarNotas(notas)` → `{ pendientes, hablados }` (filtra por `hablado`).
- `agruparPorArea(notas)` → `Map<areaNombre, Nota[]>` para la vista de gerencia/admin.
- Tests unitarios de ambas.

### Server actions (`src/app/conservatorio/acciones.ts`)
- `crearNotaAccion(form)`: **solo AREA crea** (`areaId = u.areaId`). Admin y VISOR NO crean (rechazar; ellos solo gestionan). Texto requerido.
- `marcarHabladaAccion(form)` / `reabrirNotaAccion(form)`: solo si `puedeMarcarConservatorio(u)` (ADMIN/VISOR); si no, `return`.
- `borrarNotaAccion(form)`: permitido si ADMIN, o si AREA dueña de la nota (`nota.areaId === u.areaId`) **y** la nota está pendiente. Verificar en el server.
- Todas hacen `revalidatePath('/conservatorio')`.

### Pantalla (`src/app/conservatorio/page.tsx`)
- Guard: `puedeVer(u, 'conservatorio')` si no → `redirect('/')`.
- `verTodas = u.rol === 'ADMIN' || u.rol === 'VISOR'`; `puedeMarcar = puedeMarcarConservatorio(u)`; `puedeCrear = u.rol === 'AREA' && !!u.areaId`.
- `areaId` = para AREA su propia; para admin/visor `null` (todas).
- Datos: `listarNotasConservatorio(verTodas ? null : u.areaId)` + `listarLotes()` (para el picker, solo si `puedeCrear`).
- **Componentes:**
  - `FormNuevaNota` (cliente, `src/app/conservatorio/form-nueva-nota.tsx`): input de texto + botón "+"; un `<details>` "➕ contexto" con `SelectFincaLote` (name `loteId`). Solo se renderiza si el usuario **puede crear** (AREA; y admin con selector de área). VISOR no lo ve.
  - `ListaNotas` (server-render dentro de page): 
    - **Vista área:** lista de pendientes (texto · fecha · etiqueta de lote si hay · "×" borrar). 
    - **Vista gerencia/admin:** pendientes **agrupados por área** (encabezado = nombre de área) con "✓" por nota. 
    - Al fondo, `<details>` **"Ya hablados"** (colapsado) con las habladas; si `puedeMarcar`, cada una con "↩ reabrir".
- Estética: reutiliza `.tarjeta`/tokens cálidos; sin conteos; fecha con `Intl.DateTimeFormat('es-CO', {day,month})`.

## Casos borde

- AREA sin `areaId` (no debería pasar; AREA siempre tiene área): si `u.areaId` es null, no puede crear → mostrar aviso "Tu usuario no tiene área asignada".
- VISOR entra a `/conservatorio`: ve todas las notas agrupadas por área, con "✓ Hablado" y "↩ reabrir"; **no** ve el formulario de crear.
- Área intenta marcar/reabrir (petición directa): rechazada por `puedeMarcarConservatorio`.
- Área intenta borrar nota de otra área o ya hablada: rechazada en el server.
- Nota con lote → muestra finca+lote (etiqueta pequeña); sin lote → solo texto+fecha.
- Borrar una finca/lote referenciado: relación opcional (`onDelete` por defecto = Restrict); si estorba, la nota conserva `loteId`; no se contempla borrado en cascada (las notas son efímeras y se limpian al hablarlas).

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Vitest: tests de `permisos.ts` (`conservatorio` en las 3 sets; VISOR = 4 pantallas incluyendo conservatorio; `puedeMarcarConservatorio`) + `dominio/conservatorio.ts` (`separarNotas`, `agruparPorArea`) + suite existente verde.
- Migración: `prisma migrate dev --name conservatorio` crea la tabla; `prisma migrate deploy` (build) la aplica en prod.
- Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- En vivo (server local + cookie firmada, técnica de [[verificacion-navegador]]): como usuario AREA, crear un tema (con y sin lote) y verse solo el suyo; borrarlo estando pendiente. Como VISOR/admin, ver temas de varias áreas agrupados, marcar "✓ Hablado" (desaparece a "Ya hablados") y "↩ reabrir". Confirmar que AREA no ve el "✓" ni temas de otras áreas. Limpiar los datos de prueba por id.

## Fuera de alcance

- Editar el texto de una nota (solo crear/borrar/marcar/reabrir).
- Adjuntos, comentarios o hilos de conversación en la nota.
- Notificaciones o recordatorios.
- Atar las notas a una semana concreta.
- Exportar a PDF/Excel.
- Que el **admin o gerencia creen** notas en nombre de un área: no en esta versión (solo las áreas escriben; admin/gerencia solo marcan, reabren y borran).

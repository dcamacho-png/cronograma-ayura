# Pantalla "Consulta" de actividades culminadas — Design

**Fecha:** 2026-07-04
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

Hoy en **/tareas → "📨 Mis solicitudes a otras áreas"** se listan las tareas que un área pidió a otra (`tarea.solicitadaPorAreaId = areaId`), con estado **🕓 En banco** (PENDIENTE), **✅ Programada** (PROGRAMADA) o **🔴 No realizada** (DEVUELTA). La culminación real ocurre a nivel de **`Actividad`** (`estado = 'CUMPLIDA'`), no de la tarea: una solicitud programada permanece con etiqueta "Programada" aunque ya se haya cumplido, y no hay un lugar para consultar históricamente lo culminado con sus datos (medida, potreros, responsable, finca, centro de costo).

## Objetivo

1. Crear una pantalla nueva **`/consulta`** (solo lectura) para **buscar por filtros** las actividades **CUMPLIDA** del área, mostrando medida, potreros, responsable, finca, centro de costo y demás.
2. En "Mis solicitudes a otras áreas", **ocultar** las solicitudes ya culminadas (dejar solo banco, programación pendiente y no realizada), porque ahora viven en Consulta.

## Decisiones (acordadas con el usuario)

1. **Contenido de Consulta (por área):** actividades `estado = 'CUMPLIDA'` donde `areaId = areaSel` (propias) **o** `tarea.solicitadaPorAreaId = areaSel` (las que esa área pidió a otras y cumplieron).
2. **Definición de "culminada" para ocultar de "Mis solicitudes":** una solicitud se oculta en cuanto **≥1 de sus actividades** (`tareaId = tarea.id`) está `CUMPLIDA`.
3. **Filtros:** Responsable · Finca · Centro de costo · Potrero (lote). Todos opcionales y combinables (AND).
4. **Columnas mostradas:** semana/día · descripción · responsable · área ejecutora (si es solicitada a otra) · finca · potreros (con su medida por potrero cuando exista) · medida total + unidad · centro de costo · máquina.
5. **Solo lectura**, sin export a Excel (se puede añadir después).
6. **Sin cambios de esquema:** todo se deriva de `Actividad`/`Tarea` existentes.

## Arquitectura

### 1. Permiso y navegación

- `src/auth/permisos.ts`: añadir `'consulta'` a `PANTALLAS_ASIGNABLES` (así el ADMIN la ve y es asignable por usuario en /configuración) y a `DEFAULT_AREA` (así los usuarios de área con permisos por defecto la ven).
- `src/app/_componentes/secciones.ts`: añadir la sección `{ clave: 'consulta', href: '/consulta', texto: 'Consulta', icono: '🔎', descripcion: 'Actividades culminadas del área' }`.
- `/configuracion` (checklist de pantallas por usuario) la tomará automáticamente al iterar `PANTALLAS_ASIGNABLES` (verificar que lo hace; si enumera claves fijas, añadir 'consulta').

### 2. Repo — `consultarCulminadas`

`src/datos/repositorio.ts`:
```ts
export function consultarCulminadas(
  areaId: string,
  filtros: { responsableId?: string | null; fincaId?: string | null; centroCosto?: string | null; loteId?: string | null } = {},
) {
  return prisma.actividad.findMany({
    where: {
      estado: 'CUMPLIDA',
      OR: [{ areaId }, { tarea: { solicitadaPorAreaId: areaId } }],
      ...(filtros.responsableId ? { responsableId: filtros.responsableId } : {}),
      ...(filtros.fincaId ? { fincaId: filtros.fincaId } : {}),
      ...(filtros.centroCosto ? { centroCosto: filtros.centroCosto } : {}),
      ...(filtros.loteId ? { lotes: { some: { id: filtros.loteId } } } : {}),
    },
    include: {
      responsable: true,
      finca: true,
      maquina: true,
      lotes: true,
      area: true,
      tarea: { select: { solicitadaPorAreaId: true } },
    },
    orderBy: [{ anio: 'desc' }, { semana: 'desc' }, { dia: 'asc' }],
  })
}
```

### 3. Página `/consulta`

- `src/app/consulta/page.tsx` (server component). Patrón como otras pantallas:
  - Auth: `usuarioActual()`; `redirect('/login')` si no hay; `if (!puedeVer(u, 'consulta')) redirect('/')`.
  - Selector de **área** arriba (ADMIN cambia por `?area=`; no-admin fija su `areaId`), igual que /cumplimiento.
  - Lee filtros de `searchParams`: `?area`, `?responsable`, `?finca`, `?centro`, `?lote`.
  - Carga catálogos para los desplegables (responsables del área, fincas, centros de costo, lotes) y llama `consultarCulminadas(areaId, filtros)`.
  - Renderiza `<FiltrosConsulta>` (client) + una tabla de resultados (server).
- `src/app/consulta/filtros-consulta.tsx` (client): 4 desplegables (responsable/finca/centro/lote) + botón "Buscar" que navega con los query params (o `Link`/form GET). Botón "Limpiar" que va a `/consulta?area=...`.
- **Medida por potrero:** derivar con `normalizarAvancePorLote(avancePorLote)` (dominio existente) para mostrar cada lote con su cantidad; la medida total = `haRealizada` (+ `unidadRealizada`). Centros de costo para el desplegable: los valores **distintos y no nulos** de `centroCosto` presentes en las actividades CUMPLIDA del área (así el desplegable solo ofrece valores con resultados), no el catálogo completo.

### 4. Cambio en "Mis solicitudes a otras áreas" (/tareas)

- En `src/app/tareas/page.tsx`, para cada solicitud (tarea con `solicitadaPorAreaId = areaId`) se determina si tiene **≥1 actividad CUMPLIDA** (`Actividad` con ese `tareaId` y `estado='CUMPLIDA'`).
- Se **ocultan** de la lista las que sí (ya están en Consulta). Se conservan: PENDIENTE (banco), PROGRAMADA sin ninguna actividad CUMPLIDA aún, y DEVUELTA (no realizada, igual que hoy).
- Implementación: extender `listarSolicitudesDeArea` para traer un conteo filtrado de actividades CUMPLIDA por tarea (`_count` con filtro por relación, o una consulta auxiliar de `tareaId`s con CUMPLIDA), y filtrar en la página. (Confirmar el nombre de la relación `Tarea → actividades` al implementar.)

## Flujo de datos

```
/consulta?area=X&responsable=..&finca=..&centro=..&lote=..
  → page: auth + puedeVer('consulta') + resuelve areaId (admin cambia)
  → consultarCulminadas(areaId, { responsableId, fincaId, centroCosto, loteId })
      → Actividad CUMPLIDA con (areaId=X OR tarea.solicitadaPorAreaId=X) + filtros
  → tabla de resultados (medida/potreros/responsable/finca/centro/máquina/área ejecutora)

/tareas → "Mis solicitudes": oculta las tareas con ≥1 actividad CUMPLIDA.
```

## Columnas del resultado

| Columna | Origen |
|---|---|
| Semana/día | `anio`/`semana` + etiqueta de `dia` |
| Descripción | `descripcion` |
| Responsable | `responsable.nombre` |
| Área ejecutora | `area.nombre` (mostrar solo si `tarea.solicitadaPorAreaId === areaSel` y `areaId !== areaSel`) |
| Finca | `finca?.nombre` |
| Potreros (con medida) | `lotes` + `normalizarAvancePorLote(avancePorLote)` por lote |
| Medida total | `haRealizada` + `unidadRealizada` |
| Centro de costo | `centroCosto` |
| Máquina | `maquina?.nombre` |

## Casos borde

- **Sin resultados:** mensaje "No hay actividades culminadas con esos filtros".
- **Filtros combinados:** AND (todos deben cumplirse).
- **Actividad sin lotes / sin medida:** columnas de potreros/medida quedan vacías (—).
- **No-admin:** solo ve su propia área (sin selector de áreas), como en las demás pantallas.
- **Solicitud parcialmente cumplida:** al tener ≥1 CUMPLIDA, sale de "Mis solicitudes" (decisión del usuario); sus actividades CUMPLIDA aparecen en Consulta; las aún pendientes se siguen gestionando en /cumplimiento del área ejecutora.

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- En vivo (server local + cookie firmada; solo lectura, sin escrituras): entrar a `/consulta`, ver actividades CUMPLIDA del área; aplicar cada filtro y verificar que acota; confirmar que una solicitud a otra área con ≥1 CUMPLIDA aparece en Consulta y NO en "Mis solicitudes"; y que una DEVUELTA sigue en "Mis solicitudes".

## Fuera de alcance

- Export a Excel de la Consulta (posible follow-up).
- Filtros por rango de semanas, texto o máquina (se eligió el set responsable/finca/centro/potrero).
- Edición desde Consulta (es solo lectura).
- Cambiar el estado de la Tarea a "CUMPLIDA" (se sigue derivando de las actividades; no se toca el modelo de estados de Tarea).

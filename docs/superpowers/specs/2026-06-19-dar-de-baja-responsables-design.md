# Dar de baja responsables (sin perder historial)

Estado: APROBADO (2026-06-19)

## Problema / petición

Un responsable que ya no será programado para actividades futuras no se puede **eliminar** (la base lo bloquea si tiene historial, y eliminarlo borraría/dañaría ese historial). Se necesita **darlo de baja**: que deje de aparecer en Programar (no se le asignan tareas nuevas y no sale en la grilla), conservando todo su historial.

## Decisiones acordadas

1. **Dar de baja** = marcar al responsable como inactivo. No borra nada.
2. **Programar:** muestra **solo responsables activos** — tanto el desplegable de asignar como la grilla. Un inactivo desaparece de Programar por completo.
3. **Historial intacto:** las actividades del inactivo siguen en la base y **siguen visibles en Resumen y en Cumplimiento** (esas pantallas listan por actividad, no por la lista de responsables).
4. **Configuración → Responsables:**
   - Cada responsable tiene botón **"Dar de baja"** (o **"Reactivar"** si está inactivo) y etiqueta **"(inactivo)"** cuando aplica.
   - El **✕ eliminar** (borrado real) aparece **solo** para responsables **sin ninguna actividad**. Para los que tienen historial, el camino es "Dar de baja".

## Modelo de datos

Agregar a `Responsable`:

```prisma
model Responsable {
  ...
  activo Boolean @default(true)
  ...
}
```

Migración Prisma; los responsables existentes quedan `activo = true`.

## Componentes y cambios

### Repositorio (`src/datos/repositorio.ts`)

- `listarResponsablesPorArea(areaId)`: ya devuelve el modelo completo → incluye `activo` sin cambios de código (solo existe el campo nuevo).
- `listarResponsablesTodos()` (usado en Configuración): añadir el conteo de actividades para decidir si se puede eliminar:
  ```ts
  prisma.responsable.findMany({
    include: { area: true, _count: { select: { actividades: true } } },
    orderBy: { nombre: 'asc' },
  })
  ```
- Nueva función `setResponsableActivo(id: string, activo: boolean)`:
  ```ts
  export function setResponsableActivo(id: string, activo: boolean) {
    return prisma.responsable.update({ where: { id }, data: { activo } })
  }
  ```
- `eliminarResponsable(id)`: se mantiene como está (ya lanza `BloqueoError` si tiene actividades).

### Programar (`src/app/programar/page.tsx`)

- Tras traer `responsables = listarResponsablesPorArea(areaId)`, calcular `responsablesActivos = responsables.filter((r) => r.activo)`.
- Usar `responsablesActivos` para:
  - la **grilla** (`GrillaSemana` prop `responsables`), y
  - el **desplegable de asignar** (`AsignarTareaForm` prop `responsables`).
- `ocupacion` (conflicto de responsable) se construye desde `actividades` → sin cambios.

Nota: como la grilla solo recorre responsables activos, las actividades de un inactivo no se dibujan en la grilla de Programar (es lo pedido). No se pierden: están en la base, en Resumen y en Cumplimiento.

### Configuración (`src/app/configuracion/page.tsx` + `acciones.ts`)

- La lista de responsables muestra, por cada uno:
  - nombre · área, y `(inactivo)` en gris si `!activo`.
  - botón **"Dar de baja"** si `activo`, o **"Reactivar"** si `!activo` (form server action `cambiarEstadoResponsableAccion`).
  - el **✕ eliminar** solo si `r._count.actividades === 0` (sin historial). El borrado real sigue protegido por `eliminarResponsable` (BloqueoError) como respaldo.
- Nueva acción `cambiarEstadoResponsableAccion(form)`:
  - lee `id` y `activo` (`'1'`/`'0'`), llama `setResponsableActivo(id, activo === '1')`, redirige con aviso (`Responsable dado de baja.` / `Responsable reactivado.`) usando el helper `correr` existente.

### Resumen y Cumplimiento

Sin cambios. Siguen mostrando el historial del inactivo (listan por actividad).

## Qué NO cambia

- Tareas, cumplimiento, reprogramación, exportar, máquinas: sin cambios.
- `crearResponsable` no cambia (el campo `activo` toma su default `true`).
- Otras áreas/pantallas: sin cambios.

## Pruebas

- Sin lógica de dominio pura nueva → sin tests unitarios nuevos. Verificación: `npx tsc --noEmit` y `npm run lint` limpios; suite existente (61) sigue verde.
- Verificación manual:
  - Dar de baja a un responsable con historial en Configuración: aparece "(inactivo)" y "Reactivar"; ya no sale en el desplegable de asignar ni en la grilla de Programar; su historial sigue en Resumen y se puede registrar en Cumplimiento.
  - Reactivar: vuelve a aparecer en Programar.
  - Un responsable sin actividades muestra ✕ y se puede eliminar; uno con actividades no muestra ✕ (y si se fuerza, el guard responde "tiene N actividad(es)").

## Notas técnicas

- Cambio de esquema Prisma → tras migrar hay que **reiniciar `npm run dev`** (cliente Prisma en memoria).
- La migración añade columna con default `true`; sin pérdida de datos.

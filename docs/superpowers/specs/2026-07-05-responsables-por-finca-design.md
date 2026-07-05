# Organizar responsables por finca en la grilla de /programar

**Fecha:** 2026-07-05

## Problema

En la grilla de `/programar` las filas son los responsables del área, en lista plana
ordenada por nombre. En Ganadería se quiere **organizarlos por finca**: que los
responsables de una misma finca aparezcan agrupados bajo un encabezado de finca.

Hoy `Responsable` no tiene finca (solo `nombre`, `areaId`, `activo`), y la finca vive
en cada actividad. Decisión de diseño (confirmada): **cada responsable tiene UNA finca
fija** (p. ej. un mayordomo por finca).

## Enfoque

Finca **opcional** por responsable + agrupación **data-driven** en la grilla:
la grilla agrupa por finca cuando hay fincas asignadas; donde ningún responsable tiene
finca (Maquinaria, u otras áreas, o Ganadería antes de asignar) se ve **igual que hoy**.
Así no se hardcodea "Ganadería" por nombre de área.

## Diseño

### 1. Modelo de datos (`prisma/schema.prisma`)

- `Responsable` gana:
  - `fincaId String?`
  - `finca   Finca?  @relation(fields: [fincaId], references: [id])`
- `Finca` gana la relación inversa: `responsables Responsable[]`
- Campo nullable → migración no rompe datos existentes.
- Migración dev: `npx prisma migrate dev --name responsable_finca`. En producción corre
  sola vía `prisma migrate deploy` (script `build`).

### 2. Repositorio (`src/datos/repositorio.ts`)

- `listarResponsablesPorArea(areaId)`: agregar `include: { finca: true }` y ordenar por
  finca y luego nombre:
  ```ts
  return prisma.responsable.findMany({
    where: { areaId },
    include: { finca: true },
    orderBy: [{ finca: { nombre: 'asc' } }, { nombre: 'asc' }],
  })
  ```
  (Los de `fincaId = null` quedan agrupados juntos por el orden de Postgres; el
  componente los rotula "Sin finca" y los ubica al final — ver §4.)
- `listarResponsablesTodos()`: agregar `finca: true` al `include` (para mostrar/editar
  la finca en /configuracion).
- `crearResponsable(nombre, areaId, fincaId?)`: firma nueva con finca opcional:
  ```ts
  export function crearResponsable(nombre: string, areaId: string, fincaId?: string | null) {
    return prisma.responsable.create({ data: { nombre, areaId, fincaId: fincaId ?? null } })
  }
  ```
- Nueva `setResponsableFinca(id, fincaId)`:
  ```ts
  export function setResponsableFinca(id: string, fincaId: string | null) {
    return prisma.responsable.update({ where: { id }, data: { fincaId } })
  }
  ```

### 3. Administración en `/configuracion`

`acciones.ts`:
- `crearResponsableAccion`: leer `fincaId` opcional y pasarlo:
  ```ts
  const fincaId = textoOpcional(form, 'fincaId')
  await correr(() => crearResponsable(nombre, areaId, fincaId), 'Responsable agregado.')
  ```
- Nueva `cambiarFincaResponsableAccion`:
  ```ts
  export async function cambiarFincaResponsableAccion(form: FormData) {
    const id = texto(form, 'id')
    if (!id) faltanDatos()
    const fincaId = textoOpcional(form, 'fincaId')
    await correr(() => setResponsableFinca(id, fincaId), 'Finca del responsable actualizada.')
  }
  ```
  (Importar `setResponsableFinca` en el `import` del repositorio.)

`page.tsx` (sección Responsables, ya tiene `fincas` disponible):
- En el form de crear, agregar un `<select name="fincaId">` **opcional** con opción
  `— sin finca —` (value vacío) + las fincas.
- En cada item de la lista de responsables: mostrar la finca actual y un `<select>`
  inline (dentro de un `<form action={cambiarFincaResponsableAccion}>` con `id` oculto)
  que se envía al cambiar (`onChange` no aplica en server components; usar un botón
  pequeño "Guardar" o `<select>` con submit por JS mínimo). **Decisión:** para mantener
  todo server-side sin JS, usar un `<form>` con el `<select name="fincaId">`
  (defaultValue = finca actual) y un botón "✓" al lado, igual patrón que "turno" en la
  grilla de maquinaria.

### 4. Grilla `/programar` (`src/app/programar/grilla-semana.tsx`)

- El prop `responsables` cambia de `{ id: string; nombre: string }[]` a
  `{ id: string; nombre: string; finca: { nombre: string } | null }[]`.
- Construir los grupos por finca preservando el orden ya ordenado que llega:
  recorrer `responsables`, agrupar consecutivos por `finca?.nombre ?? null`. Como el
  repositorio ya ordena por finca, los `null` quedan juntos; forzar que el grupo
  "Sin finca" vaya al **final**.
- Render:
  - Si **ningún** responsable tiene finca → render actual sin cambios (cero filas de
    encabezado de grupo).
  - Si hay fincas → antes de las filas de cada grupo, una fila-encabezado:
    ```tsx
    <tr><td colSpan={8} className="border border-borde bg-arena/60 p-2 font-semibold text-bosque">🏠 {nombreFinca ?? 'Sin finca'}</td></tr>
    ```
    (8 = columna Responsable + 7 días.)
- **Interacción con el "repetir cabecera cada 5 filas" del export** (`paraExportar`):
  cuando hay agrupación, se **desactiva** la repetición cada-5 y en su lugar la fila de
  días se repite **una vez al inicio de cada grupo** (más legible por finca). Cuando no
  hay agrupación, se conserva el comportamiento actual (repetir cada 5).

Este componente lo comparten pantalla, PNG (`#grilla-export`) e impresión PDF
(`/programar/exportar`), así que el cambio cubre las tres salidas. Ambos call-sites ya
pasan la lista de `listarResponsablesPorArea` (que ahora incluye `finca`), así que solo
cambia el tipo del prop.

## Alcance / no-objetivos

- **No** se restringe por área en el código: la finca es opcional para cualquier
  responsable; en la práctica solo Ganadería la usa. Otras áreas quedan intactas.
- **No** se toca la asignación de actividades ni la finca de las actividades (que se
  deriva del lote). La finca del responsable es solo para **organizar/ordenar** la grilla.
- **No** se hace multi-finca por responsable (descartado: una finca fija).
- **No** cambia el Excel de cumplimiento ni otras pantallas.

## Verificación

1. En `/configuracion`, crear un responsable de Ganadería con finca y cambiar la finca de
   otro; confirmar que persiste.
2. En `/programar` (Ganadería, semana futura), la grilla muestra encabezados de finca y
   los responsables agrupados bajo su finca; los sin finca, al final bajo "Sin finca".
3. Regresión: en Maquinaria (nadie con finca) la grilla se ve igual que antes, sin
   encabezados de grupo.
4. El PNG descargado y el PDF (`/programar/exportar`) reflejan la misma agrupación.

# Unidad por actividad de maquinaria (Ha / Hora / Kg)

Estado: APROBADO (2026-06-20)

## Problema / petición

Cada actividad de maquinaria se evalúa en una unidad distinta: **Hectárea, Hora o Kg** (columna B del Excel de inventario). Al registrar cumplimiento —y al **agregar actividades nuevas no programadas**— debe pedirse la medida en la unidad correcta, y el Resumen debe totalizar por unidad.

## Decisiones acordadas

- Unidades: **ha | hora | kg**. Actividad cuya descripción no esté en el catálogo (texto libre) → **ha** por defecto.
- La unidad vive en el catálogo **Actividades de maquinaria** (`ActividadEstipulada.unidad`); se siembra desde la columna B.
- La unidad de una actividad se determina **buscando su descripción** en el catálogo.
- **Registro de cumplimiento** (actividad del cronograma): el campo de medida (opcional) cambia su etiqueta según la unidad de esa actividad: "Hectáreas realizadas" / "Horas realizadas" / "Kg cosechados".
- **Agregar actividad nueva no programada** (maquinaria): la descripción se elige de la **lista del catálogo** (para conocer la unidad) con opción "Otra" (texto libre → ha); aparece el campo de medida con la etiqueta de la unidad elegida.
- **Resumen** (maquinaria): tres totales `X ha · Y horas · Z kg` realizados; la lista "realizado por actividad" muestra la unidad de cada una.
- **Configuración**: al agregar una actividad de maquinaria se elige su unidad; la lista muestra la unidad.

## Mapa de unidades (columna B del Excel)

- **ha (14):** ENCALADORA, RENOVADOR, FERTILIZACION GRANULADA, FERTILIZACION POLLINAZA, FUMIGACION CONTROL MALEZAS, FUMIGACION CONTROL PLAGAS, RASTRA SIEMBRA, CINCEL SIEMBRA, PULIDOR SIEMBRA, PULIDOR SIEMBRA NEWMAN, SIEMBRA PASTOS, ROTOSPEED, COSECHAR PASTOS, COSECHA SILO.
- **hora (18):** REGAR COMPOST, ESTERCOLERO, MOVIMIENTOS MATERIALES Y INSUMOS, MOVIVIMIENTOS RIEGO, MOVIMIENTO CARRETE, ROLO, ESPARCIDOR, TAIPA, DESBROZADORA, PALA, SEMBRAR CON VOLEADORA, SIEMBRA MAIZ, ZANJADORA, ALQUILER MAQUINAS CEBA ENTREMONTES, ALQUILER MAQUINAS MAIZ, RIEL, BOLA, CADENA.
- **kg (2):** GRANEL, COSECHAR MAIZ.

## Contexto técnico

- `ActividadEstipulada` = `{ id, nombre @unique }`. Se agrega `unidad`.
- `Actividad` tiene `haRealizada Float?` (medida realizada). Se **reutiliza** como "medida realizada en la unidad de la actividad" (no se renombra la columna, para no arriesgar la base; el significado lo da la unidad).
- La unidad se deriva por descripción (no se guarda en `Actividad`); helper con un `Map<nombre, unidad>` desde `listarActividadesEstipuladas()`.
- `cumplimiento/page.tsx` ya trae motivos, actividades, lotes, maquinas, responsables; `FormRegistrar` y `FormActividadRealizada` ya existen.
- `resumen-area.tsx` muestra "hectáreas realizadas" (un total) y "realizado por actividad"; lo usan `resumen/page.tsx` y `resumen/exportar/page.tsx`.

## Modelo de datos

```prisma
model ActividadEstipulada {
  id     String @id @default(cuid())
  nombre String @unique
  unidad String @default("ha")
}
```
Migración `prisma/migrations/20260620160000_estipulada_unidad/migration.sql`:
```sql
ALTER TABLE "ActividadEstipulada" ADD COLUMN "unidad" TEXT NOT NULL DEFAULT 'ha';
```

## Seed (`prisma/seed.ts`)

- Cambiar `ACTIVIDADES_ESTIPULADAS: string[]` por `{ nombre: string; unidad: 'ha'|'hora'|'kg' }[]` con el mapa de arriba.
- El upsert pasa a `update: { unidad }, create: { nombre, unidad }` (así re-correr el seed fija las unidades en la base en vivo).

## Componentes y cambios

### Repositorio
- `crearActividadEstipulada(nombre, unidad)` (default `'ha'`).
- `crearActividadRealizada(...)` (de la funcionalidad anterior): agregar parámetro `medida: number | null`; guardarlo en `haRealizada`.
- `listarActividadesEstipuladas()` ya devuelve `unidad`.

### Configuración (`configuracion/page.tsx` + `acciones.ts`)
- Form de "agregar actividad de maquinaria": agregar `<select name="unidad">` (Ha / Hora / Kg).
- `crearActividadEstipuladaAccion` lee `unidad` (default 'ha') y lo pasa.
- En la lista, mostrar la unidad de cada actividad (ej. "ENCALADORA · ha").

### Helper de unidad
- En las páginas (cumplimiento, resumen, export), construir `unidadPorNombre = new Map(estipuladas.map((e) => [e.nombre, e.unidad]))`.
- `unidadDe(descripcion) = unidadPorNombre.get(descripcion) ?? 'ha'`.
- Etiqueta por unidad: `ha→"Hectáreas realizadas"`, `hora→"Horas realizadas"`, `kg→"Kg cosechados"`. (Un helper compartido pequeño, ej. `etiquetaMedida(unidad)`.)

### Cumplimiento — registro normal (`FormRegistrar`)
- Nueva prop `unidad: 'ha'|'hora'|'kg'` (la página la calcula con `unidadDe(a.descripcion)`).
- El campo de medida (hoy "Hectáreas realizadas", `name="haRealizada"`) usa la etiqueta de la unidad. Sigue opcional. (Sin cambios en `registrarAccion`: ya lee `haRealizada`.)

### Cumplimiento — actividad nueva no programada (`FormActividadRealizada`)
- Recibe `estipuladas: { nombre, unidad }[]`.
- Si `esMaquinaria`: la **descripción** es un `<select>` con las estipuladas (value = nombre) + opción "Otra" (que muestra un input de texto libre). Estado cliente para saber la unidad de la estipulada elegida ("Otra" ⇒ ha).
- Si `esMaquinaria`: campo de **medida** (`name="medida"`, opcional) con etiqueta según la unidad elegida (reactivo).
- Si NO es maquinaria: queda como hoy (descripción texto libre, sin medida).
- `agregarActividadRealizadaAccion`: leer `medida` (numeroOpcional) y la descripción (de "Otra" si viene, si no la del select); pasar `medida` a `crearActividadRealizada`. (Para que el Resumen calce la unidad, la descripción guardada debe ser el nombre del catálogo cuando se eligió de la lista.)

### Resumen (`resumen-area.tsx`)
- Nueva prop `unidadPorNombre: Record<string, string>` (la pasan `resumen/page.tsx` y `resumen/exportar/page.tsx` desde las estipuladas).
- Reemplazar el cálculo de "ha realizadas" por **tres totales** por unidad:
  - para cada actividad no PENDIENTE: `unidad = unidadPorNombre[a.descripcion] ?? 'ha'`; `medida = a.haRealizada ?? (unidad === 'ha' && a.estado === 'CUMPLIDA' ? sumaHaLotes(a) : 0)`; sumar a `totales[unidad]`.
  - Tarjeta: mostrar las unidades con total > 0 como `X ha · Y horas · Z kg` (si todas 0, mostrar "—").
- La lista "realizado por actividad": agrupar por descripción y mostrar `valor + unidad` (ej. "Riego compost · 6 horas").
- `resumen/page.tsx` y `resumen/exportar/page.tsx`: traer `listarActividadesEstipuladas()`, armar `unidadPorNombre` y pasarlo a `ResumenArea`.

## Qué NO cambia

- El flujo de "cambio de actividad" (reemplazo) sigue con texto libre → ha por defecto (se puede afinar después).
- Programar, banco, login, etc.: sin cambios.
- No se renombra la columna `haRealizada` (se reinterpreta por unidad).

## Pruebas

- Helper `etiquetaMedida(unidad)` y, si se extrae, `unidadDe` son funciones puras → test unitario pequeño.
- `npx tsc --noEmit` y `npm run lint` limpios; suite (65) verde.
- Verificación manual (tras desplegar): registrar una actividad de Hora (ej. Estercolero) pide "Horas realizadas"; una de Kg (Granel) pide "Kg cosechados"; el Resumen muestra los tres totales; agregar una actividad nueva de maquinaria elige del catálogo y pide la medida en su unidad.

## Despliegue

1. `git push` + `vercel deploy --prod` → el build aplica `estipulada_unidad`.
2. Re-correr el seed contra Neon (upsert) para fijar las unidades de las estipuladas existentes (o ajustarlas en Configuración).

## Notas

- Migración aditiva (columna con default), sin pérdida de datos.
- Las estipuladas nuevas creadas en Configuración toman la unidad elegida (default ha).

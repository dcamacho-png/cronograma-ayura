# Máquina separada del responsable (solo área Maquinaria)

Estado: APROBADO (2026-06-19)

## Problema / observación del usuario

En la programación del área **Maquinaria**, el responsable (operario) puede **cambiar de máquina**. Hoy el catálogo `Maquina` amarra cada máquina a un `operario` fijo, y el flujo actual de programar (banco → asignar) **no permite elegir máquina** en ningún punto. Se necesita que la máquina (tractor) se asigne **por separado del responsable**, al programar la semana.

El inventario real está en la hoja **"I. MAQUINAS"** del Excel `ACTIVIDAD INVENTARIO MAQUINAS.xlsx` (columna C = TRACTOR).

## Alcance

**TODO lo de máquinas aplica únicamente al área Maquinaria.** Las demás áreas (Maíz, Riego, Ganadería ceba, Nelore) no cambian en nada.

## Decisiones acordadas

1. **Dónde se elige:** al **asignar** la tarea a la semana (pantalla Programar, sección "Tareas por asignar"), junto a responsable / días / turno.
2. **Granularidad:** **una máquina por día**. Si una tarea se asigna a varios días, cada día puede tener una máquina distinta.
3. **Operario:** se **quita** el campo `operario` del catálogo de máquinas. La máquina queda solo como inventario (placa/nombre); el responsable se elige aparte.
4. **Inventario:** se recarga con **solo los tractores** de la hoja "I. MAQUINAS".
5. **Obligatoriedad:** la máquina es **opcional** (se puede asignar sin máquina, ej. alquiler).
6. **Dónde se muestra:** grilla de Programar, Cumplimiento y Resumen (además de quedar guardada en la actividad).
7. **Gating:** el selector de máquina solo aparece cuando el área es Maquinaria (`esMaquinaria`).

## Modelo de datos

`Actividad.maquinaId` (String?, relación a `Maquina`) **ya existe** — se reutiliza. La actividad de cada día guarda su propia máquina.

Cambio en `Maquina`:

```prisma
model Maquina {
  id          String      @id @default(cuid())
  nombre      String
  // operario  String?   <-- SE ELIMINA
  actividades Actividad[]
}
```

Requiere migración Prisma (`npx prisma migrate dev`). Como se elimina una columna en SQLite, Prisma recrea la tabla; las máquinas se recargan por seed.

### Inventario de tractores (seed)

Reemplaza la lista `MAQUINAS` actual. Sin operario:

```
6603, 5090E, 5090E PALA, 5075E, 5403, 8030, 4299, 365, SAME 55, KUBOTA 108s, ZETOR 5711
```

El seed siembra estos nombres si la tabla está vacía (mismo patrón condicional que hoy).

## Componentes y flujo

### 1. `asignarTarea` (src/datos/repositorio.ts)

Firma actual:
```ts
asignarTarea(tareaId, responsableId, dias: number[], loteIdFallback, turno)
```

Nueva firma — recibe la máquina por día:
```ts
asignarTarea(tareaId, responsableId, dias: number[], loteIdFallback, turno, maquinaPorDia: Record<number, string | null>)
```

Al crear la actividad de cada `dia`, se setea `maquinaId: maquinaPorDia[dia] ?? null`. El resto del comportamiento (lotes, finca derivada, turno por día, contador, marcar tarea PROGRAMADA) no cambia. `maquinaPorDia` vacío o sin entrada para un día ⇒ ese día sin máquina.

### 2. `asignarTareaAccion` (src/app/programar/acciones.ts)

Lee del `FormData` un campo `maquina_<dia>` por cada día marcado (ej. `maquina_1`, `maquina_3`). Construye `maquinaPorDia` solo con los días seleccionados y lo pasa a `asignarTarea`. Campos vacíos ⇒ sin máquina. No afecta áreas no-maquinaria (no envían esos campos).

### 3. `AsignarTareaForm` (src/app/programar/asignar-tarea-form.tsx) — componente cliente

- Nuevas props: `esMaquinaria: boolean` y `maquinas: { id: string; nombre: string }[]`.
- Las casillas de días pasan a **estado controlado** (set de días marcados) para poder reaccionar.
- Cuando `esMaquinaria` es `true`, debajo de las casillas se muestra, **por cada día marcado**, un selector de máquina etiquetado con el día:
  - `Lun: [— sin máquina — / tractor ▾]` (name=`maquina_1`), etc.
  - Opción vacía "— sin máquina —" (opcional).
- Cuando `esMaquinaria` es `false`, no se renderiza nada de máquinas (comportamiento idéntico al actual).

### 4. `programar/page.tsx`

- Trae `listarMaquinas()` (ya existe en el repo).
- Calcula `esMaquinaria = areaActual.nombre.toLowerCase().includes('maquinaria')` (mismo criterio que en tareas/cumplimiento/resumen).
- Pasa `esMaquinaria` y `maquinas` a `AsignarTareaForm`.
- **Grilla:** en cada celda de actividad, si `a.maquina` existe, muestra `🚜 {a.maquina.nombre}` (debajo del turno). `listarActividades` ya incluye `maquina`.

### 5. Cumplimiento (src/app/cumplimiento/page.tsx)

Donde se muestra cada actividad, si tiene máquina, mostrar `🚜 {a.maquina.nombre}`. Ya usa `listarActividades` (incluye `maquina`). Sin cambios de consulta.

### 6. Resumen (src/app/resumen/page.tsx)

En el detalle de actividades de maquinaria, mostrar la máquina (`🚜 nombre`) junto a cada actividad. Ya usa `listarActividades`. Sin cambios de consulta.

### 7. Configuración (src/app/configuracion/page.tsx + acciones.ts)

- Quitar el input "operario" del formulario de crear máquina.
- `crearMaquina(nombre)` (sin operario); `crearMaquinaAccion` deja de leer `operario`.

## Qué NO cambia

- Otras áreas: sin máquinas, formularios y grillas idénticos.
- Banco de tareas: no se elige máquina al crear la tarea.
- Turno: sigue siendo único para todos los días marcados (solo la **máquina** es por día).
- Lotes, finca derivada, reprogramación / novedad al banco, bloqueos de semana: sin cambios.

## Pruebas

- Dominio: no hay lógica pura nueva (la máquina por día es asignación directa). Los tests existentes que referencian `maquinaId` siguen válidos.
- Verificación manual e2e: como Maquinaria, asignar una tarea a 2 días con máquinas distintas → la grilla muestra la máquina correcta por día; Cumplimiento y Resumen la muestran. Asignar sin máquina → sin 🚜. Otra área → no aparece selector de máquina.

## Notas técnicas / operación

- Tras cambiar el esquema: `npx prisma migrate dev` y **reiniciar `npm run dev`** (el cliente Prisma en memoria queda viejo y da 500 en queries nuevas).
- Recargar seed (`npm run db:seed`) para poblar los tractores.
- Proyecto usa Prisma 6 y SQLite (`prisma/dev.db`).

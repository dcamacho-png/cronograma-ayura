# Novedades por responsable (permisos y vacaciones) — Diseño

**Fecha:** 2026-07-11

## Objetivo

Registrar y mostrar en la grilla de `/programar` **novedades por responsable que no son actividades**: permisos personales y vacaciones. Se ven en la grilla (y en la imagen exportada/WhatsApp) y quedan registradas para un **reporte mensual de ausencias** en `/resumen`.

- **Vacaciones**: rango largo de fechas (puede cruzar varias semanas).
- **Permiso**: uno o pocos días sueltos, con un **horario específico** (texto, ej. "8:00–12:00").

No bloquea ni avisa al asignar (queda fuera de alcance): es informativo + reporte.

## Modelo de datos

Modelo nuevo en `prisma/schema.prisma`:

```prisma
model NovedadResponsable {
  id            String   @id @default(cuid())
  responsableId String
  responsable   Responsable @relation(fields: [responsableId], references: [id])
  tipo          String   // "VACACIONES" | "PERMISO"
  fechaInicio   DateTime @db.Date   // día inicio (inclusive)
  fechaFin      DateTime @db.Date   // día fin (inclusive); permiso de 1 día ⇒ = fechaInicio
  horario       String?             // solo permisos: "8:00–12:00", "mañana"…
  nota          String?
  creadoEn      DateTime @default(now())

  @@index([responsableId])
}
```

Y en `Responsable`, agregar la relación inversa:

```prisma
  novedades   NovedadResponsable[]
```

**Por qué fechas reales (no año/semana/día):** unas vacaciones de 15 días son **un solo registro** que se ve en cada semana que toca, sin duplicar filas, y el reporte mensual se calcula por intersección de rangos. `@db.Date` guarda día puro (sin hora/zona), consistente con los `Date` UTC que ya usa la grilla (`fechasDeSemana`).

Migración: `prisma migrate` normal contra Neon (nunca `migrate reset` contra prod).

## Capa de datos (`src/datos/repositorio.ts`)

- `crearNovedadResponsable({ responsableId, tipo, fechaInicio, fechaFin, horario, nota })` — crea el registro.
- `eliminarNovedadResponsable(id)` — borra por id.
- `listarNovedadesEnRango(areaId, desde, hasta)` — novedades de responsables del área cuyo `[fechaInicio, fechaFin]` **se cruza** con `[desde, hasta]` (condición: `fechaInicio <= hasta && fechaFin >= desde`). Devuelve también `responsableId`, `tipo`, fechas, `horario`, `nota`. Filtra por área vía `responsable.areaId`.

## Dominio (`src/dominio/`)

Módulo puro nuevo `novedades.ts` (con test) para no meter lógica de fechas en la UI:

- `diasCubiertos(novedad, fechas: Date[]): number[]` — dado el arreglo de 7 fechas de la semana, devuelve los `dia` (1..7) que caen dentro de `[fechaInicio, fechaFin]`. Comparación por día UTC.
- `resumenAusenciasMes(novedades, primerDia, ultimoDia)` — agrupa por responsable y tipo, contando **días de ausencia dentro del mes** (intersección del rango de cada novedad con `[primerDia, ultimoDia]`, contando días calendario). Devuelve `[{ responsableId, nombre, vacaciones: n, permiso: m, detalle: [...] }]`.

Se testean los bordes: novedad que empieza antes del lunes y termina el miércoles; permiso de un día; vacaciones que cruzan el fin de mes.

## Registro — UI y acciones

### Server actions (`src/app/programar/acciones.ts`)

Siguiendo el patrón existente (`bloqueadoVisor()`, helpers `texto`/`textoOpcional`, guard de semana futura con `esSemanaFutura`, `revalidatePath('/programar')`):

- `crearNovedadResponsableAccion(form)`:
  - `if (await bloqueadoVisor()) return`
  - lee `responsableId`, `tipo` (validar ∈ {VACACIONES, PERMISO}), `fechaInicio`, `fechaFin`, `horario?`, `nota?`, y `anio`/`semana` (para el guard).
  - guard: `esSemanaFutura(anio, semana, semanaActual())`.
  - normaliza fechas: si `fechaFin < fechaInicio`, usar `fechaFin = fechaInicio`; si `tipo=PERMISO` y no hay `fechaFin`, `fechaFin = fechaInicio`.
  - `await crearNovedadResponsable(...)`.
- `eliminarNovedadResponsableAccion(form)`:
  - candado Visor + guard semana futura; `await eliminarNovedadResponsable(id)`.

Editar = borrar y volver a crear (YAGNI, sin acción de edición).

### Formulario (`src/app/programar/form-novedad.tsx`, client component)

Patrón fiable de inputs **no controlados** (solo estado abrir/cerrar), como `FormAvanceLote`:

- Botón **"＋ Novedad"** que despliega el form inline en la celda del nombre.
- Campos: `tipo` (select Vacaciones/Permiso, `defaultValue`), `fechaInicio` (`<input type="date">`), `fechaFin` (`<input type="date">`), `horario` (`<input type="text">`, opcional — rótulo "solo permisos"), `nota` (opcional). Todos siempre visibles (no ocultar por tipo, para no depender de selects controladas).
- Hidden: `responsableId`, `anio`, `semana`.
- Submit "Guardar" → `crearNovedadResponsableAccion`.

## Visualización en la grilla (`src/app/programar/grilla-semana.tsx`)

`GrillaSemana` recibe un prop nuevo `novedades` (las de la semana vista, ya filtradas). Tipo:
`{ id, responsableId, tipo, fechaInicio, fechaFin, horario, nota }[]`.

- **Celda del nombre (1ª columna):** debajo del nombre, cuando `editable` (= `turnoEditable && !paraExportar`): el botón "＋ Novedad" y la lista de novedades de ese responsable en la semana, cada una con ✕ (form → `eliminarNovedadResponsableAccion`). Ej.: `🌴 Vac. 5–20 jul  ✕`.
- **Celdas por día:** para cada día que `diasCubiertos` marque, un chip tintado con color distinto al verde de actividades (p. ej. vacaciones = ámbar/`bg-amber-100`, permiso = azul/`bg-sky-100`): `🌴 Vacaciones` o `📄 Permiso · 8:00–12:00`. Se ubica dentro del `<td>` del día, junto a las actividades.
- **Export (`paraExportar`):** los chips por día **sí** se muestran (útil en la imagen de WhatsApp); el botón "＋ Novedad" y el ✕ **no** (ya se ocultan porque dependen de `editable`).

## Carga de datos (`src/app/programar/page.tsx`)

Agregar a `Promise.all` la llamada `listarNovedadesEnRango(areaId, fechas[0], fechas[6])` y pasar el resultado como prop `novedades` a **ambas** instancias de `GrillaSemana` (la interactiva y las de export). No se pasan controles de edición a las de export porque `turnoEditable` no se define ahí.

## Reporte mensual de ausencias (`/resumen`)

En `src/app/resumen/page.tsx`, reutilizar el patrón mensual existente:

- El mes se deriva del **jueves ISO** de la semana vista (ya se calcula `jueves` para recurrentes).
- Primer y último día del mes → `listarNovedadesEnRango(areaId, primerDiaMes, ultimoDiaMes)`.
- `resumenAusenciasMes(...)` agrega días por responsable y tipo.

En `resumen-area.tsx`, una sección **colapsable** "🌴 Ausencias del mes" (misma estética que "🔁 Actividades recurrentes del mes"): por responsable, `Vacaciones: N días · Permisos: M días`, y al expandir, el detalle de cada novedad (rango + horario/nota). Si no hay ausencias, no se muestra (o "Sin ausencias registradas este mes").

## Permisos y alcance

- Aplica a **todas las áreas** (no solo maquinaria).
- Crear/borrar: usuarios **AREA** de esa área + **ADMIN**; **Visor** solo ve (doble candado UI + `bloqueadoVisor()` en las acciones).
- Registro solo en **semana futura** (igual que el resto de la programación). La visualización aparece en cualquier semana/mes que se consulte.

## Pruebas

- **Dominio (`novedades.test.ts`):** `diasCubiertos` (borde de semana, permiso de 1 día); `resumenAusenciasMes` (intersección con el mes, cruce de fin de mes, conteo de días).
- **Verificación en prod (post-deploy):** crear una vacación que cruce dos semanas y ver el chip en ambas; crear un permiso con horario y verlo en el día; borrar; confirmar que aparece en la imagen de WhatsApp; ver el reporte mensual en `/resumen`. (Escritura sobre data real: crear solo lo propio y borrarlo al terminar.)

## Fuera de alcance (YAGNI)

- Bloqueo/aviso al asignar actividades en días de ausencia.
- Edición in-place de una novedad (se borra y recrea).
- Aprobación/flujo de solicitud de permiso.
- Tipos de novedad más allá de Vacaciones/Permiso (incapacidad, calamidad… se pueden agregar luego cambiando el conjunto de `tipo`).

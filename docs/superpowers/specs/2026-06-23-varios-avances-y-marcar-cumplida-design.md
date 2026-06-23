# Varios avances por parcial + marcar cumplida a mano

**Fecha:** 2026-06-23

## Problema

Hoy, en una actividad **PARCIAL**, el avance por lote se guarda como
`avancePorLote: Record<loteId, {dia, maquinaId, cantidad}>` — **un solo avance por
lote**: registrar un segundo avance sobre el mismo lote **sobrescribe** el primero.
Además, el formulario "Registrar avance" **solo ofrece lotes sin avance**
(`lotesPendientes`) y **desaparece** cuando todos los lotes ya tienen uno, de modo
que no se puede seguir registrando avances de días siguientes. Y **no existe** una
forma de marcar la actividad como CUMPLIDA estando en PARCIAL (habría que desmarcar
→ volver a PENDIENTE → registrar de nuevo).

La usuaria necesita:
- Registrar **varios avances** sobre un mismo parcial a lo largo de **uno o más días**
  (incluido el mismo lote en días distintos).
- Que el parcial **solo se cierre a mano**: ella marca CUMPLIDA cuando sabe que
  terminó. Hasta ese momento **no se conoce el total** — el total es la **suma de los
  avances** y se fija al cerrar.

> Relacionado: este cambio se apoya en `registrarAvanceLote`, que ya quedó dejando
> la actividad **siempre en PARCIAL** (no salta a CUMPLIDA automática — commit
> `96ba1b7`). Este spec agrega el historial de avances y el cierre manual.

## Decisiones (acordadas)

1. **Acumulación:** cada avance es **lo avanzado ese día** (incremental). Se guardan
   **todos** como historial; el total del lote es la **suma**.
2. **Cierre manual:** botón simple **"✓ Marcar cumplida"** en la tarjeta del parcial.
   Cambia el estado a CUMPLIDA y fija `medida realizada (haRealizada) = suma de las
   cantidades` de todos los avances. Sin diálogo ni medida final aparte.
3. **El total no se asume mientras está PARCIAL** — solo se muestran los avances
   acumulados; el total se materializa al marcar cumplida.
4. **El formulario de avance siempre está disponible** y ofrece **todos los lotes**
   de la actividad (no solo los "pendientes"), para agregar avances de días nuevos.

## Cambio de modelo de datos

`avancePorLote` es una columna **JSON** (`Actividad.avancePorLote Json?` en Prisma) →
**no hay migración de esquema**. Cambia solo la forma del JSON.

**Tipo nuevo** en `src/dominio/avance-lote.ts`:

```ts
export type AvanceEntrada = { dia: number; maquinaId: string | null; cantidad: number }
export type AvancePorLote = Record<string, AvanceEntrada[]>  // por lote: lista (historial)
```

**Compatibilidad hacia atrás (normalizar al leer).** Hay datos ya guardados con la
forma vieja (`Record<loteId, AvanceEntrada>` — un objeto suelto), incluida una
entrada creada hoy en producción (actividad RENOVADOR, lote R.OSO3). El código debe
tolerar ambas formas. Helper nuevo:

```ts
// Acepta la forma vieja (un objeto por lote) y la nueva (lista por lote);
// devuelve siempre la nueva. Un valor que no es arreglo se envuelve en [valor].
export function normalizarAvancePorLote(
  raw: Record<string, AvanceEntrada | AvanceEntrada[]> | null | undefined,
): AvancePorLote {
  if (!raw) return {}
  const out: AvancePorLote = {}
  for (const [loteId, v] of Object.entries(raw)) {
    out[loteId] = Array.isArray(v) ? v : [v]
  }
  return out
}
```

Todos los consumidores (`registrarAvanceLote`, helpers, página, export) normalizan
con este helper antes de operar. No se escribe ninguna migración masiva: los datos
viejos se reinterpretan en memoria y, en cuanto se vuelve a escribir esa actividad,
quedan en la forma nueva.

## Helpers afectados (`src/dominio/avance-lote.ts`)

**Decisión de borde:** los helpers operan sobre el tipo **ya normalizado**
(`AvancePorLote` = listas). La normalización (`normalizarAvancePorLote`) ocurre en el
**borde de lectura** — en `registrarAvanceLote`/`marcarCumplidaDesdeParcial` (repo),
y en la página y la ruta de export antes de llamar a los helpers. Así los helpers
quedan puros y fáciles de testear. Comportamiento esperado:

- **`lotesPendientes(lotes, avance)`** — sin cambios de firma. Un lote es "pendiente"
  si **no tiene ninguna entrada** (`!(l.id in avance)` o lista vacía). (Se sigue
  usando para "Progreso", no para ocultar el formulario.)
- **`textoAvancePorLote(lotes, avance)`** — por cada lote con avances, su **suma**:
  `"L-A: 5, L-B: 2"`. (Sigue usándose donde se muestre el total por lote.)
- **`textoAvanceConFecha(lotes, avance, unidadAbrev, etiquetaDia)`** — lista **cada
  entrada** (puede haber varias por lote), en orden de lote y luego de día:
  `"Lun 22 jun · L-A — 3 ha; Mar 23 jun · L-A — 2 ha; Mar 23 jun · L-B — 2 ha"`.
- **`totalAvance(avance)`** (nuevo) — suma de todas las `cantidad` de todas las
  entradas. Lo usa el cierre manual para fijar `haRealizada`.

## Repositorio (`src/datos/repositorio.ts`)

- **`registrarAvanceLote(actividadId, dia, maquinaId, avances)`** — **agrega** una
  entrada a la lista de cada lote (ya no sobrescribe). Normaliza lo existente, hace
  `actual[loteId] = [...(actual[loteId] ?? []), { dia, maquinaId, cantidad }]`, guarda
  y deja `estado: 'PARCIAL'` (como hoy). Mantiene el guard `estado === 'PARCIAL'`.
- **`marcarCumplidaDesdeParcial(actividadId)`** (nuevo) — guard `estado === 'PARCIAL'`;
  pone `estado: 'CUMPLIDA'` y `haRealizada = totalAvance(avancePorLote normalizado)`.
  No toca `avancePorLote` (queda como historial). Devuelve null si no aplica.

## Acciones (`src/app/cumplimiento/acciones.ts`)

- **`registrarAvanceLoteAccion`** — sin cambios estructurales (sigue leyendo `dia`,
  `maquinaId`, `loteAvance[]`, `cantidad_<loteId>`). Ahora los `loteAvance` pueden
  incluir lotes que ya tenían avance.
- **`marcarCumplidaParcialAccion(form)`** (nueva) — lee `id`, llama
  `marcarCumplidaDesdeParcial(id)`, `revalidatePath('/cumplimiento')`.

## UI

**`FormAvanceLote`** (`src/app/cumplimiento/form-avance-lote.tsx`): la prop
`pendientes` pasa a llamarse **`lotes`** (todos los lotes de la actividad). El resto
del formulario no cambia (día, máquina, checkbox + cantidad por lote). El día
predeterminado sigue siendo `diaActividad`.

**`page.tsx`** (sección `a.estado === 'PARCIAL'`):
- El `FormAvanceLote` se muestra **siempre que la actividad tenga lotes**
  (se quita la condición `lotesPendientes(...).length > 0`) y se le pasan **todos**
  `a.lotes`.
- Se agrega el botón **"✓ Marcar cumplida"** (form con `marcarCumplidaParcialAccion`,
  estilo de marca `#11603a`), junto a "Devolver al banco".
- "Progreso: X de N lotes" se mantiene como dato informativo (X = lotes con ≥1 avance).
- "Avances:" usa `textoAvanceConFecha` (ahora con varias entradas por lote).

## Excel (`src/dominio/cumplimiento-export.ts`, `exportar/route.ts`)

Sin cambios de estructura: la columna **"Avance por lote"** ya consume
`textoAvanceConFecha`, que ahora lista varias entradas. La ruta normaliza el JSON
antes de pasarlo. Una actividad cerrada manualmente aparece como **Cumplida** con su
`Medida realizada` = suma de avances y el detalle por día en "Avance por lote".

## Impacto en métricas

`fraccionFila` (`src/dominio/metricas.ts`) solo comprueba **presencia de clave**
(`l.id in a.avancePorLote`) para contar lotes con avance — sigue funcionando con la
forma nueva (las claves siguen siendo `loteId`). No requiere cambios, pero el plan
debe **verificarlo con un test** sobre la forma de lista.

## Testing

- `avance-lote.test.ts`: `normalizarAvancePorLote` (forma vieja y nueva), `lotesPendientes`
  con listas, `textoAvancePorLote` (suma por lote), `textoAvanceConFecha` (varias
  entradas por lote, orden lote→día), `totalAvance`.
- Test de `fraccionFila` con `avancePorLote` en forma de lista (no rompe el %).
- Los tests existentes de `cumplimiento-export` y de `textoAvanceConFecha` se
  actualizan a la forma de lista.

## Fuera de alcance

- No se cambia cómo se programan las tareas ni el modelo de filas-día.
- No se agrega edición/borrado de un avance individual (solo agregar y cerrar).
- El conteo de actividades únicas es un cambio aparte (ver
  `2026-06-23-contadores-por-actividad-unica-design.md`).

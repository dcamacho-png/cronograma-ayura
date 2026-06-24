# Registrar avance directo desde Pendiente — Diseño

**Fecha:** 2026-06-23

## Objetivo

Permitir registrar avances (historial día a día por lote) **directamente desde una actividad Pendiente**, sin pasar por "novedad" ni marcarla Cumplida automáticamente. El primer avance deja la actividad en **Parcial** acumulando; el usuario la cierra a mano con "✓ Marcar cumplida".

## Causa raíz (por qué hoy no funciona)

El formulario que alimenta la lista `avancePorLote` (`FormAvanceLote`, botón "Registrar avance") solo se renderiza dentro del bloque `a.estado === 'PARCIAL'` de `page.tsx`, y `registrarAvanceLote` (repositorio) rechaza todo lo que no sea PARCIAL (`if (act.estado !== 'PARCIAL') return null`). Desde **Pendiente** el día solo ofrece "✓ cumplido" (→ CUMPLIDA de un clic) y "novedad" (→ `FormRegistrar`, motivo, sobrescribe `haRealizada`). No hay entrada al historial de avances, por eso en producción **todas** las actividades tienen `avancePorLote: null` y se ve "solo el último registrado".

## Contexto del código

- `src/app/cumplimiento/page.tsx`: rama `a.estado === 'PENDIENTE'` renderiza `DiaMaquinaria` (áreas de maquinaria) o `DiaNoMaquinaria` (resto), pasándoles `motivos`, `lotes`, `maquinas`, `estipuladas`, `lotesActividad` (= `a.lotes`), `unidad`, y las acciones `registrarAccion` / `marcarEstadoAccion`.
- `DiaMaquinaria` / `DiaNoMaquinaria`: muestran botones "cumplido" / "novedad"; "novedad" revela `FormRegistrar`.
- `FormAvanceLote` (`form-avance-lote.tsx`): ya existe; props `actividadId`, `diaActividad`, `esMaquinaria`, `maquinas`, `unidad`, `lotes`, `accion`. Botón colapsado "Registrar avance" que abre el form (día, máquina si maquinaria, casilla+cantidad por lote).
- `registrarAvanceLoteAccion` (`acciones.ts`): lee el form y llama `registrarAvanceLote`.
- `registrarAvanceLote` (`repositorio.ts`): normaliza, `agregarAvances` (append), `update` con `estado: 'PARCIAL'`. NO toca `haRealizada`.

## Cambios

### 1. Repositorio — abrir el guard a PENDIENTE

En `src/datos/repositorio.ts`, `registrarAvanceLote`, cambiar:

```ts
if (act.estado !== 'PARCIAL') return null // solo se registran avances sobre un parcial
```

por:

```ts
// Se permite arrancar desde PENDIENTE (el primer avance lo pasa a PARCIAL) o seguir
// sumando en PARCIAL. No se registran avances sobre cerradas/no cumplidas/reprogramadas.
if (act.estado !== 'PENDIENTE' && act.estado !== 'PARCIAL') return null
```

El resto de la función no cambia: `agregarAvances` (append) + `update({ estado: 'PARCIAL' })`. Así el primer avance sobre un Pendiente lo deja en Parcial acumulando, sin tocar `haRealizada` ni marcarlo Cumplida.

### 2. UI — tercer botón "Registrar avance" en el día Pendiente

En `DiaMaquinaria` y `DiaNoMaquinaria`, junto a los botones "✓ cumplido" y "novedad", agregar un botón que revele `FormAvanceLote` (mismo patrón colapsado que ya usa `FormAvanceLote` internamente: el componente ya gestiona su propio abierto/cerrado, así que basta con renderizarlo).

- Solo se renderiza si la actividad **tiene lotes** (`lotesActividad.length > 0`); el avance es por lote, no aplica a actividades sin lotes.
- Props para `FormAvanceLote`: `actividadId`, `diaActividad={dia de la fila}`, `esMaquinaria`, `maquinas`, `unidad`, `lotes={lotesActividad}`, `accion={registrarAvanceLoteAccion}`.
- Ambos componentes reciben una prop nueva `accionAvance: (formData: FormData) => void | Promise<void>` (y, en `DiaNoMaquinaria`, ya tiene `maquinas`; `esMaquinaria` es `false`). `DiaMaquinaria` usa `esMaquinaria=true`.

`page.tsx` pasa `accionAvance={registrarAvanceLoteAccion}` (ya importado) a ambos componentes en la rama PENDIENTE. Para `diaActividad` se usa el `dia` de la fila (cada `DiaMaquinaria`/`DiaNoMaquinaria` se renderiza por fila-día y conoce su `actividadId`; el `dia` se le pasa como prop nueva `dia`).

### 3. Comportamiento resultante

- *Pendiente* → "Registrar avance" → se anota el avance, la actividad pasa a *Parcial*.
- En *Parcial* (rama existente): se ve la lista "Avances: …", el "Progreso", el `FormAvanceLote` para seguir sumando, y "✓ Marcar cumplida" (medida = suma de avances de los lotes vigentes).
- "✓ cumplido" y "novedad" quedan **sin cambios**.

## Restricciones

- Sin migración de esquema (`avancePorLote` es JSON).
- Comentarios en español; color de marca `#11603a`.
- No tocar el flujo de "novedad" ni "✓ cumplido" ni "marcar cumplida".
- `registrarAvanceLote` no toca `haRealizada` (la novedad es un concepto distinto del avance).

## Pruebas

- Las funciones de repositorio usan Prisma y **no tienen harness de pruebas** en este proyecto (las pruebas son de dominio puro). El cambio del guard es de una condición; `agregarAvances` ya está cubierto por `avance-lote.test.ts`. No se agrega prueba unitaria de `registrarAvanceLote`.
- Verificación de tipos/lint y **verificación manual en producción**: desde una actividad *Pendiente* con lotes, "Registrar avance" día 1 y día 2 → la actividad queda *Parcial* mostrando ambas entradas; "✓ Marcar cumplida" → Cumplida con medida = suma; el Excel lista una fila por avance.

## Self-Review

- **Cobertura:** entrada de avance desde Pendiente → cambio 1 (guard) + cambio 2 (botón); no auto-cumplida → ya garantizado (`registrarAvanceLote` deja PARCIAL); cierre manual → "✓ Marcar cumplida" existente. ✅
- **Consistencia:** `FormAvanceLote` se reutiliza tal cual (prop `lotes`); `registrarAvanceLoteAccion` ya existe; `registrarAvanceLote` solo cambia el guard. ✅
- **Ambigüedad:** "Registrar avance" en Pendiente aparece solo con lotes; explícito. ✅
- **Sin placeholders.** ✅
- **Alcance:** un solo plan de implementación. ✅

# Botón "Cumplida" rápido Implementation Plan

> ✅ **COMPLETADO** — implementado, revisado (MERGE) y desplegado a producción (commit 0133a47, deploy cronograma-ayura-h9olxh37t); verificado por la usuaria.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Permitir marcar una actividad como cumplida sin registrar avance ni llenar medida, en cumplimiento estándar y de maquinaria.

**Architecture:** En estándar se quita la condición que ocultaba "Cumplida" mientras no hubiera avance. En maquinaria se añade un botón rápido "✓ Cumplida" que cierra la fila vía la acción existente `marcarEstadoAccion` (estado CUMPLIDA, sin medida). Sin BD ni dominio nuevo.

**Tech Stack:** Next.js 16 (App Router, RSC, Server Actions), TypeScript.

## Global Constraints

- Componentes/RSC: se verifican con **typecheck fiable** + ejecución (convención del repo); sin tests unitarios.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- Cerrar sin avance deja `haRealizada` 0/null (aceptado). Respeta el guard de plazo (las acciones ya lo aplican). Sin migración.

---

### Task 1: Botón "Cumplida" rápido en estándar y maquinaria

**Files:**
- Modify: `src/app/cumplimiento/actividad-estandar.tsx` (línea 57)
- Modify: `src/app/cumplimiento/dia-maquinaria.tsx` (prop + botón rápido)
- Modify: `src/app/cumplimiento/page.tsx` (pasar `marcarCumplido` a `DiaMaquinaria`)

**Interfaces:**
- Consumes: `marcarCumplidaActividadAccion` (ya pasada como `marcarCumplida` a `ActividadEstandar`); `marcarEstadoAccion` (ya importada en `page.tsx`).
- Produces: `DiaMaquinaria` gana la prop `marcarCumplido: (f: FormData) => void | Promise<void>`.

- [x] **Step 1: Estándar — mostrar "Cumplida" siempre**

En `src/app/cumplimiento/actividad-estandar.tsx`, reemplazar la línea 57:

```tsx
  const mostrarCumplida = !tieneLotes || esParcial
```

por:

```tsx
  // La actividad solo se renderiza si está abierta (PENDIENTE/PARCIAL); "Cumplida" siempre
  // disponible para poder cerrarla directo, sin exigir un avance previo.
  const mostrarCumplida = true
```

- [x] **Step 2: Maquinaria — añadir la prop `marcarCumplido`**

En `src/app/cumplimiento/dia-maquinaria.tsx`:

(a) En el destructuring de props (junto a `accionAvance,`), añadir:
```tsx
  marcarCumplido,
```

(b) En el tipo de props (junto a `accionAvance: (formData: FormData) => void | Promise<void>`), añadir:
```tsx
  marcarCumplido: (formData: FormData) => void | Promise<void>
```

- [x] **Step 3: Maquinaria — botón rápido "✓ Cumplida"**

En `src/app/cumplimiento/dia-maquinaria.tsx`, dentro del `return` principal, **inmediatamente después** del `</form>` del formulario de "Registrar cumplimiento" (el `<form action={accionRegistrar} …>`) y **antes** del bloque `{lotesActividad.length > 0 && (<FormAvanceLote …/>)}`, insertar:

```tsx
      <form action={marcarCumplido}>
        <input type="hidden" name="id" value={actividadId} />
        <input type="hidden" name="estado" value="CUMPLIDA" />
        <button className="rounded-lg border border-bosque px-3 py-1 text-sm font-semibold text-bosque hover:bg-arena/40">
          ✓ Cumplida
        </button>
      </form>
```

- [x] **Step 4: Página — pasar `marcarCumplido` a `DiaMaquinaria`**

En `src/app/cumplimiento/page.tsx`, en el `<DiaMaquinaria … />` (≈ línea 243), añadir la prop (p. ej. tras `accionAvance={registrarAvanceLoteAccion}`):

```tsx
                                  marcarCumplido={marcarEstadoAccion}
```

`marcarEstadoAccion` ya está importada en `page.tsx` (línea 13) y marca `estado='CUMPLIDA'` sin medida, respetando el plazo.

- [x] **Step 5: Typecheck fiable**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida (cero errores en `src/`).

- [x] **Step 6: Suite de tests sigue verde**

Run: `npm test`
Expected: PASS (no se añadieron tests; nada roto).

- [x] **Step 7: Verificación manual**

Run: `npm run dev` y abrir `/cumplimiento`.
Verificar:
- **Estándar** (área no maquinaria) con una actividad **con potreros en PENDIENTE**: aparece "Cumplida" y al pulsarla la actividad queda CUMPLIDA sin haber registrado avance.
- **Maquinaria**: en una fila/día PENDIENTE aparece el botón rápido "✓ Cumplida" (junto a "Registrar cumplimiento"); al pulsarlo la fila queda CUMPLIDA sin llenar la medida.
- En una semana con **plazo vencido** (usuario de área), ninguno de los dos cierra (guard).
- Los flujos existentes (registrar con medida en maquinaria, avances en estándar) siguen igual.
Si no hay datos a mano, dejar constancia y validar en el deploy.

- [x] **Step 8: Commit**

```bash
git add src/app/cumplimiento/actividad-estandar.tsx src/app/cumplimiento/dia-maquinaria.tsx src/app/cumplimiento/page.tsx
git commit -m "feat(cumplimiento): boton Cumplida rapido en estandar y maquinaria (sin exigir avance)"
```

---

## Notas de cierre

- El rediseño grande de captura estándar (unidad + finca→lote→cantidad) queda para un ciclo aparte.
- Despliegue: tras revisar, seguir el flujo habitual de Vercel. El build de Vercel regenera `.next` limpio y corre el typecheck real.

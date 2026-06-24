# Renombrar botón maquinaria + quitar "Cumplida" de la novedad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renombrar el botón verde de maquinaria "Guardar avance" → "✓ Registrar cumplimiento" (que marca CUMPLIDA con la medida) y quitar la opción "✅ Cumplida" del formulario de novedad.

**Architecture:** Dos cambios de UI aislados, un archivo cada uno. Sin cambios de backend ni de comportamiento (CUMPLIDA sigue siendo estado válido del servidor; solo se renombra un botón y se quita una opción redundante del desplegable de novedad).

**Tech Stack:** Next.js (App Router, client components), TypeScript.

## Global Constraints

- Comentarios en español; color de marca `#11603a`.
- No tocar el backend: `CUMPLIDA` sigue siendo estado válido del servidor (lo usan los botones directos vía `estado=CUMPLIDA` y `marcarEstadoAccion`).
- No tocar el flujo de avances ni "marcar cumplida".
- Sin migración de esquema.
- **TYPECHECK FIABLE (obligatorio):** `npx tsc --noEmit` da falso-verde en este repo (`.next/dev/types/validator.ts` corrupto). Verificar tipos así:
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/" ; echo "errores src: $(npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -cE '^src/')"
  rm -f tsconfig.check.json
  ```
  No commitear `tsconfig.check.json`.

---

### Task 1: Renombrar el botón de maquinaria

**Files:**
- Modify: `src/app/cumplimiento/dia-maquinaria.tsx` (línea ~111)

- [ ] **Step 1: Cambiar el texto del botón**

En `src/app/cumplimiento/dia-maquinaria.tsx`, reemplazar:

```tsx
        <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Guardar avance</button>
```

por:

```tsx
        <button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">✓ Registrar cumplimiento</button>
```

(Solo el texto. El `<input type="hidden" name="estado" value="CUMPLIDA" />`, la medida, el centro de costo, el botón "registrar novedad" y el `FormAvanceLote` no cambian.)

- [ ] **Step 2: Verificar tipos y lint**

Run (typecheck fiable, ver Global Constraints) + `npm run lint`.
Expected: `errores src: 0` y lint limpio.

- [ ] **Step 3: Commit**

```bash
git add src/app/cumplimiento/dia-maquinaria.tsx
git commit -m "feat(cumplimiento): botón de maquinaria 'Registrar cumplimiento' (antes 'Guardar avance')"
```

---

### Task 2: Quitar "✅ Cumplida" del formulario de novedad

**Files:**
- Modify: `src/app/cumplimiento/form-registrar.tsx` (línea ~63 y expresiones ~41, ~43)

- [ ] **Step 1: Eliminar la opción CUMPLIDA del desplegable**

En `src/app/cumplimiento/form-registrar.tsx`, borrar la línea:

```tsx
          <option value="CUMPLIDA">✅ Cumplida</option>
```

(Quedan `— marcar —`, 🔴 No cumplida, 🟡 Parcial, 🔄 Reprogramada.)

- [ ] **Step 2: Simplificar las expresiones que excluían CUMPLIDA**

Como `estado` ya no puede ser `'CUMPLIDA'`, simplificar:

Reemplazar:

```tsx
  const requiereMotivo = estado !== '' && estado !== 'CUMPLIDA'
```

por:

```tsx
  const requiereMotivo = estado !== ''
```

Y reemplazar:

```tsx
  const esCambio = estado !== '' && estado !== 'CUMPLIDA' && motivoId !== '' && motivoId === motivoCambioId
```

por:

```tsx
  const esCambio = estado !== '' && motivoId !== '' && motivoId === motivoCambioId
```

(El resto del formulario —motivo, potreros, reemplazo, máquina, centro de costo— no cambia.)

- [ ] **Step 3: Verificar tipos y lint**

Run (typecheck fiable, ver Global Constraints) + `npm run lint`.
Expected: `errores src: 0` y lint limpio.

- [ ] **Step 4: Commit**

```bash
git add src/app/cumplimiento/form-registrar.tsx
git commit -m "feat(cumplimiento): novedad ya no ofrece estado Cumplida (redundante)"
```

---

### Task 3: Suite + desplegar + verificación manual

**Files:** (ninguno — verificación)

- [ ] **Step 1: Suite + tipos fiables + lint**

Run:
```
npm test
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -cE '^src/'
rm -f tsconfig.check.json
npm run lint
```
Expected: pruebas PASAN; `0` errores en `src/`; lint limpio.

- [ ] **Step 2: Desplegar a producción**

Run: `timeout 540 npx vercel@latest --prod --yes --scope ayura-llanos`
Expected: `readyState: READY`, aliased a https://cronograma-ayura.vercel.app

- [ ] **Step 3: Verificación manual (producción)**

- En un día de **maquinaria** Pendiente: el botón verde dice **"✓ Registrar cumplimiento"**; al enviarlo con una medida, la actividad queda **Cumplida** con esa medida.
- En **"registrar novedad"** (maquinaria y no-maquinaria): el desplegable de estado **NO** ofrece "Cumplida"; ofrece No cumplida / Parcial / Reprogramada, y el motivo se sigue exigiendo para esos estados.

---

## Self-Review

**Cobertura del spec:**
- Renombrar botón maquinaria → Task 1. ✅
- Quitar opción CUMPLIDA de la novedad → Task 2 (Step 1). ✅
- Simplificar `requiereMotivo` / `esCambio` → Task 2 (Step 2). ✅
- Backend intacto / sin tocar avances → ninguna task los toca. ✅

**Placeholder scan:** sin TBD/TODO; código completo en cada paso.

**Type consistency:** cambios de solo texto/JSX y simplificación de dos booleanos; sin nuevas firmas ni props. `estado` sigue siendo `string`; las expresiones simplificadas conservan el mismo tipo.

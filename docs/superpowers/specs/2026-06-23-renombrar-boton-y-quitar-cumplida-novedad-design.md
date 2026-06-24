# Renombrar botón de maquinaria + quitar "Cumplida" de la novedad — Diseño

**Fecha:** 2026-06-23

## Objetivo

Dos ajustes de UX en el registro de cumplimiento, surgidos tras agregar "Registrar avance" en Pendiente:

1. En maquinaria, el botón verde dice **"Guardar avance"** pero en realidad marca la actividad **CUMPLIDA** con la medida ingresada. Choca con el nuevo botón "Registrar avance" (historial). Renombrarlo a **"✓ Registrar cumplimiento"**.
2. El formulario de **novedad** (`FormRegistrar`) ofrece "✅ Cumplida" en el desplegable de estado, redundante: el cumplido ya se registra con un botón directo ("✓ Cumplido" en no-maquinaria, "✓ Registrar cumplimiento" en maquinaria). Quitar esa opción.

## Contexto del código

- `src/app/cumplimiento/dia-maquinaria.tsx`: la vista por defecto es un `<form action={accionRegistrar}>` con `<input type="hidden" name="estado" value="CUMPLIDA" />`, un input de medida (`haRealizada`), centro de costo, y un botón **`Guardar avance`** (línea ~105) que envía → marca CUMPLIDA. (Este es el botón a renombrar; su comportamiento NO cambia.)
- `src/app/cumplimiento/form-registrar.tsx`: `<select name="estado">` con opciones `""` (— marcar —), `CUMPLIDA` (✅ Cumplida, línea ~63), `NO_CUMPLIDA`, `PARCIAL`, `REPROGRAMADA`. Lógica derivada:
  - `requiereMotivo = estado !== '' && estado !== 'CUMPLIDA'`
  - `esCambio = estado !== '' && estado !== 'CUMPLIDA' && motivoId !== '' && motivoId === motivoCambioId`

## Cambios

### 1. Renombrar el botón (maquinaria)

En `src/app/cumplimiento/dia-maquinaria.tsx`, cambiar el texto del botón verde de submit del formulario de medida:

- De: `<button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">Guardar avance</button>`
- A: `<button className="rounded bg-[#11603a] px-3 py-1 text-sm font-semibold text-white">✓ Registrar cumplimiento</button>`

Solo cambia el texto. El `<input type="hidden" name="estado" value="CUMPLIDA" />`, la medida, el centro de costo y el flujo (sigue marcando CUMPLIDA) **no cambian**. El botón "registrar novedad" y el `FormAvanceLote` ("Registrar avance") tampoco cambian.

### 2. Quitar "✅ Cumplida" de la novedad

En `src/app/cumplimiento/form-registrar.tsx`:

(a) Eliminar la línea de la opción CUMPLIDA del `<select name="estado">`:

```tsx
<option value="CUMPLIDA">✅ Cumplida</option>
```

Quedan: `— marcar —`, 🔴 No cumplida, 🟡 Parcial, 🔄 Reprogramada.

(b) Simplificar las dos expresiones que ya no necesitan excluir CUMPLIDA (no se puede seleccionar):

- `const requiereMotivo = estado !== '' && estado !== 'CUMPLIDA'` → `const requiereMotivo = estado !== ''`
- `const esCambio = estado !== '' && estado !== 'CUMPLIDA' && motivoId !== '' && motivoId === motivoCambioId` → `const esCambio = estado !== '' && motivoId !== '' && motivoId === motivoCambioId`

(El resto del formulario —motivo, potreros, reemplazo, máquina, centro de costo— no cambia.)

## Restricciones

- Comentarios en español; color de marca `#11603a`.
- No tocar el backend: `CUMPLIDA` sigue siendo un estado válido del servidor (lo usan los botones directos "✓ Cumplido"/"✓ Registrar cumplimiento" vía `estado=CUMPLIDA`, y `marcarEstadoAccion`). Solo se quita como opción del formulario de novedad.
- No tocar el flujo de avances ni "marcar cumplida".
- Sin migración de esquema.

## Pruebas

Son componentes client sin harness de pruebas en este proyecto. Verificación por tipos/lint (typecheck FIABLE excluyendo `.next`) + manual en producción:
- En un día de maquinaria Pendiente, el botón verde dice "✓ Registrar cumplimiento" y al enviarlo la actividad queda Cumplida con la medida.
- En "registrar novedad" (ambos tipos de área), el desplegable de estado ya NO ofrece "Cumplida"; sí ofrece No cumplida / Parcial / Reprogramada, y el motivo se sigue exigiendo para esos estados.

## Self-Review

- **Cobertura:** renombrar botón → cambio 1; quitar Cumplida de novedad + simplificar guards → cambio 2. ✅
- **Consistencia:** "✓ Registrar cumplimiento" (maquinaria) y "✓ Cumplido" (no-maquinaria) son los caminos directos de cumplido; la novedad deja de duplicarlo. ✅
- **Ambigüedad:** se elimina la opción y se simplifican exactamente dos expresiones nombradas. ✅
- **Backend intacto:** CUMPLIDA sigue válido en el servidor. ✅
- **Sin placeholders.** ✅

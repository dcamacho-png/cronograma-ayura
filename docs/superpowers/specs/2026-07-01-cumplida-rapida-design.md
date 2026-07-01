# Botón "Cumplida" rápido (maquinaria + estándar) — Design Spec

**Fecha:** 2026-07-01

## Objetivo

Permitir marcar una actividad como **cumplida directamente**, sin tener que registrar antes un avance ni llenar la medida, tanto en la versión **estándar** como en la de **maquinaria**.

## Problema (verificado en código)

- **Estándar** (`src/app/cumplimiento/actividad-estandar.tsx`): `const mostrarCumplida = !tieneLotes || esParcial`. Una actividad **con potreros** que sigue **PENDIENTE** (sin ningún avance) **no muestra** el botón "Cumplida"; obliga a registrar un avance primero (que la pasa a PARCIAL) para poder cerrarla.
- **Maquinaria** (`src/app/cumplimiento/dia-maquinaria.tsx`): el cierre es por **fila/día** con "✓ Registrar cumplimiento", pero el campo de medida (`haRealizada`) es `required`; no hay un cierre rápido sin llenar la medida.

## Diseño

Cerrar sin exigir avance/medida; la actividad queda CUMPLIDA con la medida que ya tuviera (0/ninguna si no hubo). Respeta el guard de plazo (las acciones ya lo aplican). Sin cambios de base de datos.

### Estándar — `actividad-estandar.tsx`

- Cambiar `const mostrarCumplida = !tieneLotes || esParcial` por `const mostrarCumplida = true`. El componente solo se renderiza para actividades abiertas (PENDIENTE/PARCIAL), así que el botón "Cumplida" queda siempre disponible.
- El botón sigue llamando a la prop `marcarCumplida` (= `marcarCumplidaActividadAccion` → `marcarCumplidaGrupo`), que cierra el grupo con los avances que haya (0 si ninguno). Etiqueta actual sin cambio: `✓ {esParcial ? 'Marcar cumplida' : 'Cumplida'}`.

### Maquinaria — `dia-maquinaria.tsx`

- Añadir la prop `marcarCumplido: (f: FormData) => void | Promise<void>`.
- Junto a "✓ Registrar cumplimiento" (que conserva su medida), añadir un botón rápido **"✓ Cumplida"** en su propio `<form action={marcarCumplido}>` con `hidden id` + `hidden estado="CUMPLIDA"`, que cierra esa fila **sin** exigir medida.

### Página — `page.tsx`

- Pasar `marcarCumplido={marcarEstadoAccion}` a `<DiaMaquinaria />`. `marcarEstadoAccion` ya está importada y en uso (la recibe `DiaNoMaquinaria`); marca `estado='CUMPLIDA'` (sin medida) y respeta el plazo (`bloqueadoPorPlazoActividad`).

## Alcance / límites

- Solo se añade la vía rápida; los formularios con medida (maquinaria) y el flujo de avances (estándar) siguen igual.
- Marcar cumplida sin avance deja `haRealizada` en 0/null (aceptado); no se deriva del área programada.
- Sin migración; sin cambios de dominio.

## Testing

- Componentes/RSC: **typecheck fiable** (tsconfig que excluye `.next`) + verificación en vivo (sin tests unitarios, por convención).
- Manual: en estándar, una actividad **con potreros en PENDIENTE** muestra "Cumplida" y al pulsarla queda cumplida sin avance; en maquinaria, el botón rápido "✓ Cumplida" cierra la fila sin llenar la medida; ambos respetan el plazo vencido (usuario de área) y no cambian el flujo de registrar con medida/avance.

## Fuera de alcance

- El rediseño grande de captura estándar (unidad + finca→lote→cantidad) — ciclo aparte, ya brainstormeado.

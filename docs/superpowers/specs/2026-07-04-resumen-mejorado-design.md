# /resumen mejorado (cuadros claros + medidas de tractor + detalle colapsable) — Design

**Fecha:** 2026-07-04
**Estado:** propuesto (pendiente de aprobación del usuario)

## Contexto

`/resumen` (componente `src/app/resumen/resumen-area.tsx`) muestra tarjetas (Cumplimiento %, Cumplidas, **Reprogramadas %**, Realizado, Nuevas) y varias listas siempre visibles (detalle por estado, motivos, finalizadas por labor, nuevas, realizado por actividad, cambiadas/reprogramadas). Problemas señalados por el usuario:
1. El **"Reprogramadas %"** no es claro (`porcentajeReprogramadas` = % de actividades con `vecesReprogramada>0` sobre el total).
2. En maquinaria las medidas van combinadas en un solo texto ("Realizado"); se quieren **desglosadas por unidad** y **por tractor**.
3. Demasiado **ruido visual**: las listas de detalle deberían ocultarse por defecto.

Datos: las medidas por unidad usan `Unidad = 'ha'|'hora'|'kg'|'cantidad'` (`medidasPorUnidad` en `src/dominio/resumen.ts`). Los **bultos** se guardan por lote en `Actividad.bultosPorLote` (no por avance ni por tractor). Los **avances** (`AvanceEntrada`) llevan `maquinaId` (qué tractor hizo cada medida).

## Objetivo

Reorganizar `/resumen`: cuadros-resumen claros (conteos, sin % de reprogramadas), medidas de maquinaria desglosadas (5 totales por unidad + tabla tractor×unidad), y todas las listas de detalle bajo un único **"Ver detalle"** colapsable.

## Decisiones (acordadas)

1. **Cuadros-resumen (arriba, siempre visibles):**
   - **Cumplimiento %** (único porcentaje, se conserva `porcentajeCumplimiento`).
   - **Cumplidas** (N / total actividades).
   - **No se hizo** (N) = `conteo.NO_CUMPLIDA + conteo.REPROGRAMADA`.
   - **Reprogramadas** (N — conteo de actividades-grupo con `vecesReprogramada>0`; es el numerador que hoy usa `porcentajeReprogramadas`, mostrado como cantidad, no porcentaje).
   - **Nuevas no programadas** (N).
   - Se **elimina** la tarjeta "Reprogramadas %" y la tarjeta "Realizado" combinada (se reemplaza por el desglose de maquinaria).
2. **Medidas de maquinaria (siempre visibles, solo si `esMaquinaria`):**
   - **5 totales por unidad** (cuadros, solo los que tengan dato > 0), en este orden: **Horas** (`hora`), **Bultos aplicados** (bultos), **Ha aplicadas** (`ha`), **Kg (granel)** (`kg`), **Cantidad (estércoles)** (`cantidad`).
   - **Tabla tractor × unidad** debajo: una fila por tractor (incluida "— sin tractor —" si aplica), columnas por las unidades con dato (Horas/Ha/Kg/Cantidad). **Los bultos NO van en la tabla por tractor** (no se registran por tractor); solo en el total de arriba.
3. **Chips de conteo por estado** (Cumplidas/Parciales/No se hizo/Pendientes): se conservan visibles (son compactos).
4. **"Ver detalle" colapsable (un solo bloque, colapsado por defecto):** dentro van TODAS las listas actuales: listas por estado, motivos frecuentes, finalizadas por labor, nuevas (lista), realizado por actividad, y cambiadas/reprogramadas. Se implementa con `<details><summary>Ver detalle</summary>…</details>` nativo (sin JS de cliente; el componente sigue siendo server).
5. Sin cambios de esquema.

## Arquitectura

### Dominio — `src/dominio/resumen.ts`
- **Reusar** `medidasPorUnidad` para los totales de `ha/hora/kg/cantidad`.
- **Nuevo** `bultosAplicados(actividades)`: suma `bultosPorLote` (valores) de las actividades no-PENDIENTE del área → total de bultos. Testeable.
- **Nuevo** `medidasPorTractor(filas)`: recibe una fila por **actividad-grupo** con `{ estado, unidad, haProgramada, haRealizada, maquinaId, avances: { maquinaId: string|null; cantidad: number }[] }` y devuelve `Map<string, Record<Unidad, number>>` (clave = `maquinaId` o `''` para "sin tractor"). Atribución:
  - Se ignora `PENDIENTE`.
  - Si la actividad tiene avances: cada avance suma `cantidad` a `porTractor[avance.maquinaId ?? actividad.maquinaId ?? ''][unidad]`.
  - Si no tiene avances: suma `haRealizada ?? (unidad==='ha' && estado==='CUMPLIDA' ? haProgramada : 0)` a `porTractor[maquinaId ?? ''][unidad]`.
  - Con tests (avances de distinto tractor/unidad; sin avances; tractor nulo).

### Componente — `src/app/resumen/resumen-area.tsx`
- Reordena las tarjetas superiores a los 5 cuadros de conteo (Decisión 1). `pctRep`/`porcentajeReprogramadas` deja de usarse para la tarjeta; se muestra el **conteo** de reprogramadas (nuevo: contar actividades-grupo con `vecesReprogramada>0`, o reutilizar el dato ya disponible).
- Bloque de medidas de maquinaria: 5 totales (de `medidasPorUnidad` + `bultosAplicados`) + tabla `medidasPorTractor` (resolviendo nombres con el mapa `nombreMaquina` ya existente; unidades-columna = las que tengan dato).
- Envuelve todas las listas actuales en un único `<details className="…"><summary>Ver detalle</summary> … </summary></details>` colapsado.
- `resumen/page.tsx`: sin cambios (ya pasa `actividades`, `unidadPorNombre`, etc.). El componente compone las medidas a partir de `actividadesUnicas` (que ya calcula) + los avances (necesita pasar/leer `avancePorLote` — añadir al tipo `ActividadResumen` y al `select`/mapeo si falta).

### Export (`resumen/exportar`)
- Fuera de alcance: el Excel de resumen no cambia en esta iteración (se puede alinear después si se quiere).

## Casos borde

- Área **no** maquinaria: no se muestran los cuadros de medidas ni la tabla de tractores (igual que hoy la sección de maquinaria).
- Unidad sin dato (total 0): no se muestra su cuadro ni su columna en la tabla.
- Actividad cumplida sin avances: su medida se atribuye al tractor de la actividad (`maquinaId`).
- Bultos sin tractor: solo cuentan en el total "Bultos aplicados".
- Sin actividades: cuadros en 0/—, "Ver detalle" vacío o con "sin datos".

## Verificación

- Typecheck: `npx tsc --noEmit -p tsconfig.check.json`.
- Build: `DATABASE_URL=… npx next build` → `✓ Compiled successfully`.
- Vitest: tests nuevos de `bultosAplicados` y `medidasPorTractor` (dominio puro) + suite existente verde.
- En vivo (server local + cookie firmada, solo lectura): en un área de maquinaria con avances de 2+ tractores, confirmar los 5 totales, la tabla tractor×unidad (suma coherente), los conteos de los cuadros (sin % de reprogramadas), y que "Ver detalle" está colapsado y al abrirlo muestra todas las listas de hoy.

## Fuera de alcance

- Bultos por tractor (requeriría registrar bultos por avance — cambio de datos).
- Cambiar el Excel de `/resumen/exportar`.
- Nuevos filtros o gráficos.
- Tocar el cálculo de `porcentajeCumplimiento` (se conserva).

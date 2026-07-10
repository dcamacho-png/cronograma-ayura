# Unidad por defecto en formularios + fertilización visible en /resumen

Fecha: 2026-07-10

## A) Unidad por defecto (catálogo) en formularios de /cumplimiento

Problema: el selector "Unidad" en Registrar avance / actividad estándar / actividad no
programada no viene con la unidad del catálogo de la actividad; pide en blanco (default
genérico Ha/Cantidad). Debe traer por defecto la unidad del catálogo, editable, respetando
la unidad ya registrada si existe.

Datos: `page.tsx` tiene `unidadPorNombre = {nombre: e.unidad}` (unidad CRUDA del catálogo).
La versión normalizada (`unidadDe`) es lossy (colapsa jornales/bultos→ha), así que se usa la
cruda. Las opciones del selector (`['Ha','Hora','Kg','Cantidad','Bultos','Jornales']`) cubren
las 6 unidades del catálogo con match case-insensitive.

Cambios:
- `page.tsx`: pasar `unidadCatalogo={unidadPorNombre[cab.descripcion] ?? ''}` a
  `ActividadMaquinaria` y `ActividadEstandar`.
- `actividad-maquinaria.tsx` / `actividad-estandar.tsx`: recibir `unidadCatalogo` y
  reenviarlo a `FormAvance`; en `actividad-estandar` usarlo también en el `selectorUnidad`
  del formulario inline (sin lotes).
- `form-avance.tsx`: nueva prop `unidadCatalogo?: string`. El default de `unidadSel` pasa a
  ser: unidad registrada (`unidadActual`) si existe; si no, la del catálogo (matcheada contra
  UNIDADES); si no, `esMaquinaria ? 'Ha' : 'Cantidad'`.
- `form-actividad-realizada.tsx`: al elegir la actividad (`desc`), fijar `unidadSel` desde
  `estipuladas.find(e => e.nombre === desc)?.unidad` (matcheada contra UNIDADES); editable.

## B) Fertilización (y toda PARCIAL con avances) no aparece en /resumen

Causa: en `resumen-area.tsx`, `actividadesUnicas` toma `haRealizada: base.haRealizada ?? null`.
En actividades PARCIAL la medida vive en `avancePorLote` (no en `haRealizada`), así que
`medidasPorUnidad` y `medidaPorActividad` la cuentan como 0 (fertilización = 122.1 ha reales
→ 0). Por eso no sale el cuadrito y "Ha aplicadas" se queda corto.

Cambio: en la construcción de `actividadesUnicas`, `haRealizada` cae a la **suma de los
avances** cuando `base.haRealizada` es null: `base.haRealizada ?? (sumAvances > 0 ? sumAvances
: null)`. Con eso `medidasPorUnidad` (totales por unidad), `medidaPorActividad` (cuadritos +
colapsable) y el resto quedan correctos. `medidasPorTractor` ya usa `avances`, así que no hay
doble conteo (usa avances, no `haRealizada`).

## Verificación y despliegue
- Tests + typecheck.
- Navegador (dev local → DB prod, lectura; para A, solo abrir formularios y leer el valor
  por defecto del selector sin guardar):
  - A: abrir Registrar avance de una actividad cuya unidad de catálogo sea ha/jornales y
    confirmar que el selector viene con esa unidad. No-programada: elegir una actividad y ver
    que la unidad cambia a la del catálogo.
  - B: abrir /resumen maquinaria semana con fertilización PARCIAL y confirmar el cuadrito
    "FERTILIZACION GRANULADA — 122.1 ha" y que "Ha aplicadas" incluye esas ha.
- `git push` + `npx vercel@latest deploy --prod --yes`.

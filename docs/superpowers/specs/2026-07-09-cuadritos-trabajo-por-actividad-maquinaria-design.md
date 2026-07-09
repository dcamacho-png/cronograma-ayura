# Cuadritos "Trabajo por actividad" (maquinaria) en /resumen

Fecha: 2026-07-09

## Contexto

En /resumen (maquinaria) ya se muestran cuadritos de medidas **por unidad** (Horas, Ha
aplicadas, Bultos, Kg, Cantidad) y una tabla tractor×unidad. La medida **por actividad**
existe (`medidaActividadLista` en `resumen-area.tsx`) pero solo se ve escondida en una lista
colapsable "Realizado por actividad". El usuario quiere verla como **cuadritos pequeños**
que digan en qué actividad está desglosada la medida (p. ej. "Fertilización — 45 ha",
"Rastra siembra — 12 ha", "Cosecha silo — 8 horas").

## Decisiones (confirmadas)
- **Solo maquinaria.**
- **Conservar** la lista colapsable existente y **además** agregar los cuadritos.

## Cambio

`src/app/resumen/resumen-area.tsx`: dentro del bloque `esMaquinaria`, junto a los cuadritos
de medidas por unidad, agregar una sección **"🚜 Trabajo por actividad"** con una grilla de
cuadritos (mismo estilo `tarjeta p-4` que los de medidas): uno por actividad con medida > 0,
etiqueta = descripción, valor = `${total} ${unidadAbreviada(unidad)}`.

Fuente de datos: se reutiliza `medidaActividadLista` (ya calculado: `[descripcion, {valor,
unidad}]`, ordenado desc, ignora PENDIENTE), filtrando `valor > 0`. No se agrega función de
dominio nueva ni se cambia la agregación (la misma que alimenta el colapsable).

## Verificación y despliegue
- Typecheck + tests (sin cambios de dominio, deben seguir verdes).
- Navegador (dev local → DB prod, solo lectura): abrir /resumen de maquinaria en una semana
  con actividades realizadas y confirmar que aparecen los cuadritos por actividad con su
  medida y unidad; el colapsable sigue presente.
- `git push` + `npx vercel@latest deploy --prod --yes`.

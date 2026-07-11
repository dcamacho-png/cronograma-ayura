# Resumen por tractor: tarjeta con las labores de cada tractor

Fecha: 2026-07-10

## Contexto

La tabla "🚜 Medidas de tractores" (tractor × unidad) solo muestra totales por unidad, así que
no se ve QUÉ labores hizo cada tractor. Cada avance guarda su `maquinaId`, así que se puede
desglosar por (tractor → labor → medida).

Diseño elegido (confirmado con el usuario): **una tarjeta por tractor** con la lista de labores
que hizo y su medida, más una línea de total por unidad. Ejemplo:

```
🚜 5075E
   Fumigación malezas .... 30 ha
   Rastra siembra ........ 9.5 ha
   Movimientos ........... 5 horas
   Total: 39.5 ha · 5 horas

🚜 — sin tractor —
   Siembra pastos ........ 4.5 ha
```

## Cambios

### Dominio (`src/dominio/resumen.ts`, testeable — TDD)
Nueva función pura `laboresPorTractor(filas)` que devuelve `Map<string, LaborTractor[]>`
(clave `''` = sin tractor), donde `LaborTractor = { descripcion, unidad, total }`. Misma
atribución que `medidasPorTractor`: por avance a su `maquinaId` (o el de la actividad); si no
hay avances, la medida (haRealizada, o haProgramada para ha CUMPLIDA) va al tractor de la
actividad; ignora PENDIENTE. Agrega por (descripción + unidad) y ordena por total desc.

### UI (`src/app/resumen/resumen-area.tsx`)
Reemplazar la `<table>` tractor×unidad por una **grilla de tarjetas** (una por tractor). Cada
tarjeta: encabezado con el nombre del tractor (o "— sin tractor —"), lista de labores
(`descripción — total <unidadAbrev>`), y una línea "Total:" con los totales por unidad de ese
tractor (reutiliza `porTractor` = `medidasPorTractor`, solo unidades > 0, unidos por " · ").
Orden de tarjetas: tractores por nombre, "— sin tractor —" al final. Se conserva el encabezado
"🚜 Medidas de tractores" (o se ajusta el texto). Sección visible solo si hay labores.

## Verificación y despliegue
- Test unitario de `laboresPorTractor` (TDD) + suite completa + typecheck.
- Navegador (dev local → DB prod, lectura): /resumen maquinaria de una semana con avances por
  tractor; confirmar las tarjetas con labores + total por tractor y "— sin tractor —".
- `git push` + `npx vercel@latest deploy --prod --yes`.

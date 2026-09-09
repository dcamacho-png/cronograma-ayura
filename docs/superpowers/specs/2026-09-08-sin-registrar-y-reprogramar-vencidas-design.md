# Actividades vencidas sin registrar: aviso, cierre honesto y reprogramación — Diseño

Fecha: 2026-09-08

## El problema

El cumplimiento de una semana pasada es solo lectura para las áreas
(`plazoCumplimientoVencido`). Lo que no se registró antes del domingo queda
**PENDIENTE para siempre**: el área ya no puede marcarlo cumplido, ni cerrarlo como
parcial, ni siquiera notificar una novedad — el botón se esconde y la server action lo
rechaza. Nadie puede resolverlo salvo el administrador.

Medido en producción el 2026-09-08: **257 filas-día congeladas así, el 13,1% de todas
las actividades**, unas **97 actividades** distintas. No es un episodio: pasa todas las
semanas (S32: 62 · S33: 64 · S35: 32 · S36: 25).

| Área | Filas atascadas |
|---|---|
| Ganadería ceba | 127 |
| Maquinaria | 58 |
| Maiz-Riego | 53 |
| Genetica Nelore | 16 |
| Nelore | 3 |

Tres daños:

1. **El estado miente.** "Pendiente" significa "falta hacerla", y la verdad es que nunca
   se va a poder registrar.
2. **El porcentaje es mudo.** `fraccionFila` cuenta PENDIENTE como 0, así que esas
   actividades hunden el cumplimiento de la semana — pero el número no distingue *no se
   hizo* de *no se reportó*, que son problemas distintos y se corrigen distinto.
   Maquinaria en la S33 muestra 30%: de las 6 actividades que reportó cumplió las 6, y
   las otras 14 nunca se registraron. Genetica Nelore muestra 0% en la S35 y la S36
   porque no registró **nada** (10 de 10 y 4 de 4) — su cero no mide desempeño.
3. **El trabajo hecho y no registrado desaparece.** El Excel y el respaldo a Drive solo
   exportan CUMPLIDA y PARCIAL.

## Decisiones acordadas

- **El porcentaje de cumplimiento NO cambia.** La meta es lo que se programó, así que el
  denominador sigue siendo lo programado y lo no registrado sigue contando como cero.
  Sacarlo del cálculo equivaldría a bajarle la meta a quien no reportó, y premiaría
  justamente la conducta que se quiere corregir. Ningún número que gerencia ya vio se
  mueve. (Se evaluó y se descartó calcular el % solo sobre lo reportado.)
- **El valor está al lado del número, no en el número**: un contador propio que diga
  cuántas quedaron sin registrar, para que un 30% se lea "6 cumplidas, 14 sin registrar"
  en vez de ser un número mudo.
- **Se puede reprogramar lo vencido sin registrar**, y eso **no rompe el plazo**:
  `reprogramarActividad` crea una actividad **nueva** en la semana destino ligada por
  `origenId` y deja la original intacta. El pasado queda congelado y honesto; el trabajo
  comprometido y no hecho nace hacia adelante, sumando al conteo de reprogramaciones que
  ya alimenta el semáforo y el tablero mensual.
- **Registrar retroactivamente sigue prohibido para las áreas.** Marcar cumplida una
  semana cerrada sí rompería el plazo. Solo el administrador puede, como hoy.
- Se descartó **extender el plazo** o dar días de gracia: solo mueve la pared y debilita
  la razón por la que el plazo existe.

## Modelo de datos

Un estado nuevo en el tipo del dominio y en los datos:

```ts
// src/dominio/tipos.ts
export type Estado =
  | 'PENDIENTE'
  | 'CUMPLIDA'
  | 'PARCIAL'
  | 'NO_CUMPLIDA'
  | 'REPROGRAMADA'
  | 'SIN_REGISTRAR'   // la semana venció y nadie reportó nada
```

`Actividad.estado` es `String` en Prisma, así que **no hace falta migración**: es un valor
nuevo, no una columna. Las filas se cierran además con `cerrada = true`, para que ninguna
acción de área las reabra.

## El cierre automático

Un endpoint `/api/cerrar-vencidas` con la misma forma que el respaldo a Drive: runtime
Node, autorizado por `Authorization: Bearer <CRON_SECRET>`, y una entrada en `vercel.json`
junto a la que ya existe.

```json
{ "crons": [
  { "path": "/api/backup-drive",    "schedule": "59 4 * * *" },
  { "path": "/api/cerrar-vencidas", "schedule": "17 6 * * 1" }
]}
```

Lunes 06:17 UTC = **lunes 01:17 en Colombia**: la semana ya cerró (domingo a medianoche) y
no hay nadie usando la app. Corre una vez por semana, es idempotente y solo toca filas de
semanas ya vencidas.

Qué hace, por cada actividad de una semana vencida con `estado = 'PENDIENTE'` y
`cerrada = false`:

```
estado   = 'SIN_REGISTRAR'
cerrada  = true
```

Nada más: no toca medidas, ni notas, ni avances, ni el motivo. La regla de qué es
"vencida sin registrar" vive en el dominio como función pura para poder probarla:

```ts
// src/dominio/sin-registrar.ts
export function quedoSinRegistrar(
  a: { anio: number; semana: number; estado: string; cerrada: boolean },
  hoy: Semana,
): boolean   // esSemanaPasada && estado === 'PENDIENTE' && !cerrada
```

**Pasada retroactiva:** el mismo endpoint, corrido a mano una vez, cierra las 257 filas
que ya están atascadas. Con respaldo previo y ensayo en seco, igual que el paso de datos
de los potreros.

## El aviso antes de que sea tarde

En `/cumplimiento`, cuando la semana mostrada es la **en curso**, es **sábado o domingo** y
quedan actividades sin registrar, un aviso destacado arriba:

> ⏳ Te quedan **N actividades** sin registrar y el plazo se cierra el domingo a
> medianoche. Después no vas a poder marcarlas ni reportar novedades.

Reusa el conteo de `pendientes` que la página ya calcula con `tieneDiaPendiente`. La
condición de día se resuelve con `diaActual()`, que ya existe y devuelve el día ISO en hora
de Colombia. Es solo pantalla: ninguna regla nueva, ningún estado nuevo.

## La bandeja de vencidas sin registrar

Donde el área ve lo que se le venció y decide qué hacer. Va en `/cumplimiento`, en un
bloque plegable arriba de la lista de la semana, visible solo si hay algo:

> ⚠️ **N actividades vencidas sin registrar** — de semanas anteriores. No se pueden
> registrar (el plazo venció), pero sí reprogramar para hacerlas.

Por cada una: descripción, responsables, la semana en que se venció, y **un botón
"Reprogramar"** con el desplegable de semanas que ya usa `/tareas` (`programacionAbierta`
para no ofrecer una semana cuya programación también cerró).

Reprogramar llama a `reprogramarActividad(id, anio, semana)`, que ya existe: crea la
actividad nueva y deja la vencida como está. La guarda `origenId @unique` impide
reprogramar dos veces la misma. Una vez reprogramada, la vencida sale de la bandeja
(tiene `derivada`), así que la bandeja tiende a vaciarse.

Autorización: la acción es de área sobre su propia área (`puedeMutarArea`), y **no** pasa
por `bloqueadaActividad`, porque justamente se trata de una actividad de semana vencida.
Lo que sí valida es que la actividad esté en `SIN_REGISTRAR` — así el bypass del plazo
queda acotado a este caso y no abre la puerta a editar cualquier semana cerrada.

## Cómo se ve en los informes

- **`/resumen`**: un cuadro más, "Sin registrar", junto a los seis que ya hay
  (`conteoEstadoActividades` gana su sexta clave). El **porcentaje no cambia**:
  `fraccionFila` devuelve 0 para `SIN_REGISTRAR`, igual que hoy para `PENDIENTE`.
- **`etiquetaEstado`**: `'SIN_REGISTRAR' → 'Sin registrar'`. Hoy `NO_CUMPLIDA` y
  `REPROGRAMADA` comparten "No se hizo"; este es un rótulo propio porque dice otra cosa.
- **Chip**: `chip-sinregistrar` con un par de tokens nuevos en `globals.css`, en gris
  neutro — ausencia de dato, no falla. Los cinco chips actuales usan colores con carga
  (verde cumplida, ámbar parcial, rojo no cumplida); el gris lo distingue a propósito.
- **`ordenEstadoCumplimiento`**: van al final de la lista de tarjetas, después de las
  cumplidas: no hay nada que hacer con ellas en esa pantalla.
- **Excel de cumplimiento y respaldo a Drive**: se exportan con estado "Sin registrar" y
  medida vacía. Hoy las PENDIENTE no se exportan y por eso la omisión no queda en ningún
  registro; exportarlas es parte del valor de este cambio.
- **`/consulta`** y `trabajoRegistrado`: `SIN_REGISTRAR` **no** cuenta como trabajada, así
  que una solicitud entre áreas que termine así sigue fuera de "Mis solicitudes" por
  `solicitudSinSalida` (ya desplegado) — pero ahora además con un estado que lo explica.

## Pruebas

- **Dominio**: `quedoSinRegistrar` (semana pasada/en curso/futura, ya cerrada, otros
  estados); `fraccionFila` devuelve 0 para `SIN_REGISTRAR` (el % no se mueve);
  `conteoEstadoActividades` cuenta la sexta clave; `etiquetaEstado` y
  `ordenEstadoCumplimiento` con el valor nuevo; `filasCumplimiento` exporta la fila con
  estado "Sin registrar" y medida vacía.
- **Ensayo en seco** de la pasada retroactiva contra producción, con respaldo previo, y
  verificación posterior: que las 257 queden `SIN_REGISTRAR` + `cerrada`, que ninguna otra
  fila cambie, y que el porcentaje de una semana pasada dé **exactamente el mismo número
  que antes** (es la comprobación que demuestra que la historia no se movió).
- **Navegador**, contra un schema aislado con fixture mínimo: que el aviso aparezca sábado
  y domingo y no el resto de la semana; que la bandeja liste una vencida y su botón
  reprogramar cree la actividad en la semana destino dejando la original intacta; y que
  reprogramar dos veces no duplique.

## Fuera de alcance

- Cambiar el plazo de cumplimiento o darle días de gracia.
- Permitir que las áreas registren retroactivamente una semana cerrada.
- Avisos fuera de la app (correo, WhatsApp): no hay canal y sería otro proyecto.
- Reprogramación en lote (seleccionar varias y mandarlas juntas). Si la bandeja resulta
  incómoda con muchas filas, se agrega después.

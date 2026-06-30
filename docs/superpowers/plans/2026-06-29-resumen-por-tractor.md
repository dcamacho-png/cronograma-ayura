# Tabla resumen por tractor Implementation Plan

> ✅ **COMPLETADO** — implementado, revisado (MERGE) y desplegado a producción (commits 6e4e461 + 7e038df, deploy cronograma-ayura-ntm6zt0im).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Mostrar en `/programar`, solo para áreas de maquinaria, una tabla de solo lectura tractor × día (espejo del cronograma) con la actividad y el responsable de cada tractor por día.

**Architecture:** Un componente presentacional nuevo (Server Component, sin estado ni acciones) que recibe las actividades ya cargadas por la página, las agrupa por `maquinaId` y arma una cuadrícula tractor (filas) × día (columnas). Se integra en `page.tsx` debajo del cronograma visible, condicionado a `esMaquinaria`. No toca la exportación (imagen/PDF).

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Tailwind.

## Global Constraints

- Componente/RSC: se verifica con **typecheck fiable** + ejecución en vivo; **sin tests unitarios** (no hay lógica de dominio nueva), igual que otros planes de UI del repo.
- Typecheck FIABLE (el `npx tsc --noEmit` directo da falso-verde por `.next` corrupto):
  ```
  printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
  npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
  rm -f tsconfig.check.json
  ```
  Sin salida = sin errores en `src/`. NO commitear `tsconfig.check.json`.
- Solo lectura: sin formularios, sin server actions, sin `'use client'`.
- Solo tractores **usados esa semana**; actividades **sin tractor** se omiten; **no** se incluye en imagen ni PDF (el bloque `#grilla-export` no se toca).
- Estilo consistente con `src/app/programar/grilla-semana.tsx` (tabla `border-collapse`, bordes `border-borde`, cabezado `bg-arena`, celdas de actividad `bg-green-50`, paleta cálida).

---

### Task 1: Componente `GrillaTractor` + integración en Programar

**Files:**
- Create: `src/app/programar/grilla-tractor.tsx`
- Modify: `src/app/programar/page.tsx` (import nuevo + render tras el cronograma visible)

**Interfaces:**
- Consumes: `actividadesCronograma` (ya existe en `page.tsx`, son filas de `listarActividades` que incluyen `responsable`, `maquina`, el escalar `maquinaId`, `descripcion`, `turno`, `dia`) y `fechas: Date[]` (las 7 fechas de la semana, ya en `page.tsx`); `esMaquinaria: boolean` (ya en `page.tsx`).
- Produces: `GrillaTractor({ fechas, actividades }): JSX.Element | null` — devuelve `null` si ningún tractor tiene actividades esa semana.

- [x] **Step 1: Crear el componente**

Crear `src/app/programar/grilla-tractor.tsx` con exactamente este contenido:

```tsx
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function fmtFecha(f: Date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(f)
}

type ActividadTractor = {
  id: string
  dia: number
  descripcion: string
  turno: string
  maquinaId: string | null
  maquina: { nombre: string } | null
  responsable: { nombre: string }
}

// Resumen de solo lectura: una fila por tractor usado esta semana, columnas Lun–Dom,
// con la(s) actividad(es) y el responsable de cada tractor por día. Inverso del cronograma.
export function GrillaTractor({
  fechas,
  actividades,
}: {
  fechas: Date[]
  actividades: ActividadTractor[]
}) {
  // Solo actividades con tractor; agrupar por maquinaId (mostrando el nombre).
  const tractores = new Map<string, { nombre: string; actividades: ActividadTractor[] }>()
  for (const a of actividades) {
    if (!a.maquinaId || !a.maquina) continue
    const g = tractores.get(a.maquinaId) ?? { nombre: a.maquina.nombre, actividades: [] }
    g.actividades.push(a)
    tractores.set(a.maquinaId, g)
  }
  if (tractores.size === 0) return null
  const filas = [...tractores.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-bosque">🚜 Resumen por tractor</h2>
      <div className="overflow-x-auto rounded-xl border border-borde bg-white text-tinta">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-borde bg-arena p-2 text-left">Tractor</th>
              {DIAS.map((d, i) => (
                <th key={d} className="border border-borde bg-arena p-2 text-left">
                  {d}
                  <div className="text-xs font-normal text-tierra">{fechas[i] ? fmtFecha(fechas[i]) : ''}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => (
              <tr key={t.nombre}>
                <td className="border border-borde p-2 font-medium">🚜 {t.nombre}</td>
                {DIAS.map((_, i) => {
                  const dia = i + 1
                  const celdas = t.actividades.filter((a) => a.dia === dia)
                  return (
                    <td key={dia} className="border border-borde p-2 align-top">
                      {celdas.map((a) => (
                        <div key={a.id} className="mb-1 rounded-lg bg-green-50 p-1">
                          <div>{a.descripcion}</div>
                          <div className="text-xs text-tierra">{a.responsable.nombre}</div>
                          {a.turno && <div className="text-xs text-tierra">{a.turno}</div>}
                        </div>
                      ))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Importar el componente en `page.tsx`**

En `src/app/programar/page.tsx`, junto a los imports de componentes de la carpeta (debajo de `import { BotonDescargarImagen } from './boton-descargar-imagen'`, línea 18), añadir:

```ts
import { GrillaTractor } from './grilla-tractor'
```

- [x] **Step 3: Renderizar la tabla tras el cronograma visible**

En `src/app/programar/page.tsx`, el cronograma visible termina con este bloque (≈ líneas 184-195):

```tsx
      <div className="mb-6">
        <GrillaSemana
          areaNombre={areaActual.nombre}
          anio={anio}
          semana={semana}
          fechas={fechas}
          responsables={responsablesActivos}
          actividades={actividadesCronograma}
          turnoEditable={futura}
          esMaquinaria={esMaquinaria}
        />
      </div>
```

Inmediatamente **después** de ese `</div>` de cierre y **antes** del comentario `{/* Grilla SOLO para exportar como imagen: ... */}`, insertar:

```tsx
      {esMaquinaria && (
        <GrillaTractor fechas={fechas} actividades={actividadesCronograma} />
      )}
```

- [x] **Step 4: Typecheck fiable**

Run:
```bash
printf '{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }\n' > tsconfig.check.json
npx tsc --noEmit -p tsconfig.check.json 2>&1 | grep -E "^src/"
rm -f tsconfig.check.json
```
Expected: sin salida (cero errores en `src/`). En particular, `actividadesCronograma` debe ser asignable a `ActividadTractor[]` (las filas de Prisma incluyen `maquinaId`, `maquina`, `responsable`, `descripcion`, `turno`, `dia`).

- [x] **Step 5: Suite de tests sigue verde**

Run: `npm test`
Expected: PASS (no se añadieron tests; nada roto).

- [x] **Step 6: Verificación manual**

Run: `npm run dev` y abrir `/programar` en un **área de maquinaria** con una semana que tenga actividades con tractor.
Verificar:
- Debajo del cronograma aparece "🚜 Resumen por tractor" con una fila por tractor **usado** esa semana (ordenados por nombre).
- En cada celda (tractor, día) está la actividad + responsable correctos; varios turnos del mismo tractor/día se apilan; días sin actividad quedan vacíos.
- Tractores no usados **no** aparecen; actividades **sin** tractor no aparecen.
- En un área **no** de maquinaria, la tabla **no** se muestra.
- La imagen descargada y el PDF **no cambian** (la tabla no se incluye).
Si no hay datos a mano, dejar constancia y validar en el deploy.

- [x] **Step 7: Commit**

```bash
git add src/app/programar/grilla-tractor.tsx src/app/programar/page.tsx
git commit -m "feat(programar): tabla resumen por tractor (solo lectura, solo maquinaria)"
```

---

## Notas de cierre

- Solo pantalla: el bloque oculto `#grilla-export` y la ruta del PDF no se tocan, así que imagen y PDF quedan idénticos.
- Despliegue: tras revisar, seguir el flujo habitual de Vercel (ver memoria de despliegue). El build de Vercel regenera `.next` limpio y corre el typecheck real.

# Lotes / Potreros (Fase 1) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Catálogo de lotes (260, sembrados de `prisma/lotes.json`) y, en los formularios donde hoy se elige finca, elegir un **lote** (agrupado por finca) del que se deduce la finca, enlazando la actividad/tarea al lote. Un lote por actividad (multi-lote = Fase 2).

**Architecture:** Server Components + Server Actions + Prisma. `Lote` con relación a `Finca`; `Actividad ↔ Lote` muchos-a-muchos; `Tarea.loteId`. Se conserva `fincaId` (derivado del lote). Un componente server `SelectLote` reutilizable agrupa por finca con `<optgroup>`.

**Tech Stack:** Next.js 16 · TypeScript · Tailwind v4 · Prisma 6.

**Pruebas:** sin dominio puro nuevo; build + e2e contra la base + curl. Reiniciar `npm run dev` tras la migración.

---

## Task F1 — Esquema Lote + relaciones
**Files:** Modify `prisma/schema.prisma`.

- [ ] Agregar el modelo y relaciones; migrar.

```prisma
model Lote {
  id          String      @id @default(cuid())
  nombre      String      @unique
  hectareas   Float?
  tipoPasto   String?
  fincaId     String
  finca       Finca       @relation(fields: [fincaId], references: [id])
  actividades Actividad[]
  tareas      Tarea[]
  @@index([fincaId])
}
```
En `Finca` agregar: `lotes       Lote[]`
En `Actividad` agregar: `lotes      Lote[]`
En `Tarea` agregar: `loteId     String?` y `lote       Lote?   @relation(fields: [loteId], references: [id])`

Migrar (aditivo): `npx prisma migrate dev --name lotes` → `npx prisma validate`. Si pide reset/confirmación, DETENERSE (BLOCKED). Commit `feat: esquema Lote + relaciones (potreros)`.

---

## Task F2 — Repositorio + seed de 260 lotes
**Files:** Modify `src/datos/repositorio.ts`, `prisma/seed.ts`. (`prisma/lotes.json` ya existe.)

- [ ] Repo: `listarLotes`, `crearLote`, `eliminarLote`, `crearActividadDesdeLotes`; cambiar `crearTarea` y `asignarTarea` a usar `loteId`; `listarActividades` incluye `lotes`. Seed: sembrar lotes de `prisma/lotes.json`.

Detalle en el prompt del subagente (firmas exactas). Commit `feat: repositorio de lotes + seed (260) y derivación de finca`.

---

## Task F3 — SelectLote + formularios de Programar
**Files:** Create `src/app/_componentes/select-lote.tsx`; Modify `src/app/programar/page.tsx`, `src/app/programar/acciones.ts`.

- [ ] Componente `SelectLote` (optgroups por finca). En Programar: el form "Agregar actividad" y el form "Asignar tarea" usan `SelectLote` en vez del select de finca; `crearActividadAccion` usa `crearActividadDesdeLotes`; `asignarTareaAccion` pasa `loteId`. Commit.

---

## Task F4 — Formulario de Tareas
**Files:** Modify `src/app/tareas/page.tsx`, `src/app/tareas/acciones.ts`.

- [ ] El form "Nueva tarea" usa `SelectLote` (opcional) en vez del select de finca; `crearTareaAccion` pasa `loteId`. Commit.

---

## Task F5 — Configuración "Lotes" + mostrar lote
**Files:** Modify `src/app/configuracion/page.tsx`, `src/app/configuracion/acciones.ts`, `src/app/cumplimiento/page.tsx`.

- [ ] Sección "Lotes / Potreros" (agregar/eliminar). En Cumplimiento, mostrar el lote de la actividad. Commit.

---

## Task F6 — Verificación
- [ ] Reiniciar dev; `npm test` (41) + `npm run build`; `npm run db:seed` (incluye 260 lotes); e2e (crear actividad con lote → finca derivada + lote enlazado); curl Programar/Tareas/Configuración.

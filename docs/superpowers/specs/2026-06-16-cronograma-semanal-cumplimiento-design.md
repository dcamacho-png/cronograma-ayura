# Diseño — Cronograma Semanal con Seguimiento de Cumplimiento

**Fecha:** 2026-06-16
**Autora / contexto:** Equipo de coordinación, Ayurá S.A.S (fincas en los Llanos)
**Estado:** Aprobado para pasar a plan de implementación

---

## 1. Problema

Hoy el equipo hace un cronograma semanal sencillo (en Excel) con **responsable,
horario y actividad** por área de producción. El cronograma actual ya tiene
columnas de "% CUM" y "%", pero **quedan casi siempre vacías**: no hay una forma
cómoda de registrar y luego *ver* qué se cumplió, qué se reprogramó y qué cambió
durante la semana. Esto impide:

- Saber qué % de lo propuesto realmente se ejecutó.
- Identificar qué hay que reprogramar.
- Detectar y dejar registro de los cambios de la semana.
- Hacer una evaluación de coordinación mes a mes.

## 2. Objetivo

Una **app web en español** donde cada coordinador **programa la semana de su
área**, **marca el cumplimiento** día a día, y obtiene **resúmenes semanales y
mensuales muy visuales**. Requisito central: **los resultados deben entenderse
de un vistazo** (semáforos de color, gráficas simples, números grandes), no
tablas que toca interpretar. Todo queda guardado como histórico para ver
tendencias.

## 3. Alcance y usuarios

- **Usuarios:** solo coordinadores (grupo pequeño, ~uno por área). Los
  trabajadores **no** entran a la app.
- **Conexión:** estable (oficina/casa). **No** se requiere modo offline.
- **Dispositivo:** se usa desde el navegador en PC y celular (diseño
  responsive). **No** hay app nativa.

## 4. Conceptos base (modelo de datos)

- **Área** — maíz, riego, maquinaria, ganadería ceba, nelore. *Editable.* Es la
  dimensión principal de organización: cada coordinador entra a su área.
- **Finca** — Entremontes, Acajure, Normandia, … *Editable.* Funciona como
  **etiqueta** de la actividad (no como nivel jerárquico).
- **Responsable** — el trabajador asignado a la actividad. Pertenece a un área.
- **Máquina** — solo para el área de maquinaria (con su operario oficial).
- **Motivo** — catálogo editable de causas de no cumplimiento / cambio: clima,
  daño de máquina, falta de personal, falta de insumos, cambio de prioridad,
  otro.
- **Actividad** — la pieza central:
  - Semana (año + número de semana) · día (lun–dom) · área · finca · responsable
  - Descripción · turno/horario
  - **Estado:** Pendiente · ✅ Cumplida · 🟡 Parcial · 🔴 No cumplida · 🔄 Reprogramada
  - **Motivo** (obligatorio si Parcial / No cumplida / Reprogramada)
  - Nota corta (opcional)

### Maquinaria (caso especial)

Las actividades del área de maquinaria llevan campos adicionales:

- **Máquina** + operario de turno
- **Área de la tarea** → a qué área de producción le sirve el trabajo (maíz,
  pastos/ganadería, riego…). Permite evaluar cuánto trabajó maquinaria *para
  cada área*.
- **H.R** (horas) y **ha** (hectáreas)
- **Plan B** (actividad alternativa)

## 5. Pantallas

1. **Programar semana** — grilla días × responsables del área; agregar/editar
   actividades. Botón **"duplicar semana anterior"** para no empezar de cero.
2. **Registrar cumplimiento** — la misma grilla; al cerrar el día/semana se marca
   estado + motivo de cada actividad.
3. **Resumen semanal** 📅
   - % cumplido del área (semáforo + número grande).
   - 🔄 Lista de actividades que se cambiaron/reprogramaron, con su motivo.
   - ⭐ **Ranking de responsables**: top 3 y los 3 más bajos, por **% de
     cumplimiento** (el % de SUS actividades asignadas que cumplió). Escala de
     estrellas.
4. **Tablero mensual** 📊
   - % de cumplimiento **por área** (barras con semáforo).
   - **Tendencia semana a semana** (gráfica de línea).
   - Motivos más frecuentes del mes.
5. **Configuración** — editar áreas, fincas, responsables, máquinas y catálogo de
   motivos.

## 6. Cómo se calcula el cumplimiento

- **% de cumplimiento** (de un conjunto de actividades): se pondera por estado.
  - Cumplida = 100 %, Parcial = 50 %, No cumplida = 0 %.
  - **Reprogramada** no penaliza el período actual (se cuenta aparte como
    "cambio"); la actividad reaparece reprogramada en su nueva fecha.
  - Pendiente (aún no evaluada) no entra en el cálculo.
- **Ranking de responsables** (semanal): % de cumplimiento de cada responsable
  sobre SUS actividades evaluadas. Top 3 más alto y 3 más bajo.
- **Por área (mensual):** promedio de cumplimiento de las actividades del área en
  el mes.
- **Tendencia:** % de cumplimiento por cada semana del mes.

## 7. Arquitectura (Opción A — app web con base de datos)

- **Frontend:** React / Next.js, responsive (PC y celular). UI en español.
- **Base de datos + autenticación:** Supabase (Postgres) — guarda el histórico y
  maneja el acceso de los coordinadores (email/contraseña).
- **Hosting:** Vercel (frontend) + Supabase (datos). Ambos con plan gratuito para
  empezar.

### Unidades / módulos (límites claros)

- **Catálogos** (áreas, fincas, responsables, máquinas, motivos) — CRUD simple.
- **Programación semanal** — crear/editar actividades de una semana; duplicar
  semana.
- **Seguimiento** — marcar estado + motivo de cada actividad.
- **Métricas** — funciones puras que reciben actividades y devuelven %, ranking y
  tendencias (testeables de forma aislada, sin tocar UI ni base de datos).
- **Tableros** — pantallas que consumen el módulo de métricas y lo muestran de
  forma visual.

## 8. Fuera de alcance (YAGNI)

- Acceso de trabajadores (solo coordinadores).
- Modo sin internet (offline).
- App nativa de celular.
- Importación automática del Excel actual (se evaluará después; la carga inicial
  se hace en la app).

## 9. Forma de trabajo

Construcción **incremental** con puntos de revisión: primero programar + marcar
cumplimiento, luego resumen semanal y ranking, luego tableros mensuales. En cada
parte se prueba contra la realidad del campo y se reestructura si hace falta. Los
cambios grandes de estructura (p. ej. pasar a organización por finca, o dar
acceso a trabajadores) se conversan cuando surjan.

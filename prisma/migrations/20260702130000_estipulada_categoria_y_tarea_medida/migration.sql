-- Categoría estándar/maquinaria en el catálogo (registros actuales = maquinaria).
ALTER TABLE "ActividadEstipulada" ADD COLUMN "maquinaria" BOOLEAN NOT NULL DEFAULT true;

-- Medida planeada por lote (JSON loteId→valor) + unidad, en la tarea.
ALTER TABLE "Tarea" ADD COLUMN "medidaPorLote" JSONB;
ALTER TABLE "Tarea" ADD COLUMN "unidad" TEXT;

-- Actividades estándar (catálogo separado). ON CONFLICT: idempotente por nombre.
INSERT INTO "ActividadEstipulada" ("id", "nombre", "unidad", "maquinaria") VALUES
  (gen_random_uuid()::text, 'Apoyo fertilizacion', 'jornales', false),
  (gen_random_uuid()::text, 'Fumigacion malezas', 'jornales', false),
  (gen_random_uuid()::text, 'Fumigacion espartillo', 'jornales', false),
  (gen_random_uuid()::text, 'Decepada de espartillo', 'jornales', false),
  (gen_random_uuid()::text, 'Limpieza de cerca', 'jornales', false),
  (gen_random_uuid()::text, 'Arreglo de cerca', 'jornales', false),
  (gen_random_uuid()::text, 'Acarreo sal y concentrados', 'jornales', false),
  (gen_random_uuid()::text, 'Acarreo sal', 'jornales', false),
  (gen_random_uuid()::text, 'Orden y aseo', 'jornales', false),
  (gen_random_uuid()::text, 'Arreglo fuga de agua', 'jornales', false),
  (gen_random_uuid()::text, 'Mantenimiento bebederos', 'jornales', false),
  (gen_random_uuid()::text, 'Limpieza bebederos', 'jornales', false),
  (gen_random_uuid()::text, 'Limpieza arborizacion', 'jornales', false),
  (gen_random_uuid()::text, 'Fumigacion arborizacion', 'jornales', false),
  (gen_random_uuid()::text, 'Guadaña', 'jornales', false),
  (gen_random_uuid()::text, 'Mantenimiento jardin', 'jornales', false)
ON CONFLICT ("nombre") DO NOTHING;

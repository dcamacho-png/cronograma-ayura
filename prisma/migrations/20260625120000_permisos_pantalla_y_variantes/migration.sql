ALTER TABLE "Usuario" ADD COLUMN "pantallas" TEXT;
ALTER TABLE "Area" ADD COLUMN "maqTareas" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Area" ADD COLUMN "maqProgramar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Area" ADD COLUMN "maqCumplimiento" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Area" ADD COLUMN "maqResumen" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Area"
   SET "maqTareas" = true, "maqProgramar" = true, "maqCumplimiento" = true, "maqResumen" = true
 WHERE lower("nombre") LIKE '%maquinaria%';

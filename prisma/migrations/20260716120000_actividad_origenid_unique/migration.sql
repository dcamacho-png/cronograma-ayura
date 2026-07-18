-- Una actividad solo puede reprogramarse una vez: origenId único.
-- NOTA: si en producción existieran duplicados (misma actividad reprogramada dos
-- veces por una carrera previa), este índice fallará. Comprobar antes de desplegar:
--   SELECT "origenId", COUNT(*) FROM "Actividad"
--   WHERE "origenId" IS NOT NULL GROUP BY "origenId" HAVING COUNT(*) > 1;
-- (Postgres permite múltiples NULL en un índice único, así que las actividades sin
--  reprogramación no se ven afectadas.)

-- CreateIndex
CREATE UNIQUE INDEX "Actividad_origenId_key" ON "Actividad"("origenId");

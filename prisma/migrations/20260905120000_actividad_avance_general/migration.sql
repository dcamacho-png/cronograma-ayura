-- Bitácora de avance día a día para actividades SIN potreros (taller, movimientos,
-- coordinación, biodigestor…): lista JSON [{ dia, cantidad, maquinaId, centroCosto,
-- responsableId, observacion }]. Equivalente de "avancePorLote" cuando no hay lote.
ALTER TABLE "Actividad" ADD COLUMN "avanceGeneral" JSONB;

-- Avance por lote en actividades parciales: mapa JSON { loteId: { dia, maquinaId, cantidad } }
ALTER TABLE "Actividad" ADD COLUMN "avancePorLote" JSONB;

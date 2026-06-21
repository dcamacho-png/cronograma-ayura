-- Potreros donde realmente se realizó la actividad (parcial/reprogramada), ids de lote
ALTER TABLE "Actividad" ADD COLUMN "lotesHechos" JSONB;

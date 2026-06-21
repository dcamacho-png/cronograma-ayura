-- Bultos por lote (mapa JSON { loteId: cantidad }) en tareas y actividades
ALTER TABLE "Tarea" ADD COLUMN "bultosPorLote" JSONB;
ALTER TABLE "Actividad" ADD COLUMN "bultosPorLote" JSONB;

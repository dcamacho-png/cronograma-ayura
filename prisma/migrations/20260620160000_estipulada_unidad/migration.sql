-- Unidad de medida por actividad de maquinaria (ha | hora | kg)
ALTER TABLE "ActividadEstipulada" ADD COLUMN "unidad" TEXT NOT NULL DEFAULT 'ha';

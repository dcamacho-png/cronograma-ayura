-- Potrero retirado: sale de los selectores conservando su historial.
-- Aditiva y con TRUE por defecto: al desplegar nada cambia de comportamiento.
ALTER TABLE "Lote" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

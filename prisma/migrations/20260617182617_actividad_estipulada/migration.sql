-- CreateTable
CREATE TABLE "ActividadEstipulada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ActividadEstipulada_nombre_key" ON "ActividadEstipulada"("nombre");

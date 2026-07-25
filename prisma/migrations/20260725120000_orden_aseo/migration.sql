-- CreateTable
CREATE TABLE "OrdenAseo" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "semana" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "responsableId" TEXT NOT NULL,

    CONSTRAINT "OrdenAseo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrdenAseo_anio_semana_idx" ON "OrdenAseo"("anio", "semana");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenAseo_anio_semana_dia_responsableId_key" ON "OrdenAseo"("anio", "semana", "dia", "responsableId");

-- AddForeignKey
ALTER TABLE "OrdenAseo" ADD CONSTRAINT "OrdenAseo_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Responsable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

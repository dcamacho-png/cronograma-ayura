-- CreateTable
CREATE TABLE "NovedadResponsable" (
    "id" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "horario" TEXT,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovedadResponsable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovedadResponsable_responsableId_idx" ON "NovedadResponsable"("responsableId");

-- AddForeignKey
ALTER TABLE "NovedadResponsable" ADD CONSTRAINT "NovedadResponsable_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Responsable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

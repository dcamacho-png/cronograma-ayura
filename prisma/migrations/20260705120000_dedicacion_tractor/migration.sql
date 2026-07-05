-- CreateTable
CREATE TABLE "DedicacionTractor" (
    "id" TEXT NOT NULL,
    "maquinaId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "semana" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,

    CONSTRAINT "DedicacionTractor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DedicacionTractor_maquinaId_anio_semana_dia_key" ON "DedicacionTractor"("maquinaId", "anio", "semana", "dia");

-- AddForeignKey
ALTER TABLE "DedicacionTractor" ADD CONSTRAINT "DedicacionTractor_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DedicacionTractor" ADD CONSTRAINT "DedicacionTractor_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

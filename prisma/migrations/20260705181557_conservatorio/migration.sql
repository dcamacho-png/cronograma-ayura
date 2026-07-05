-- CreateTable
CREATE TABLE "NotaConservatorio" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "hablado" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "habladaEn" TIMESTAMP(3),
    "areaId" TEXT NOT NULL,
    "fincaId" TEXT,
    "loteId" TEXT,

    CONSTRAINT "NotaConservatorio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotaConservatorio_areaId_hablado_idx" ON "NotaConservatorio"("areaId", "hablado");

-- AddForeignKey
ALTER TABLE "NotaConservatorio" ADD CONSTRAINT "NotaConservatorio_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaConservatorio" ADD CONSTRAINT "NotaConservatorio_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaConservatorio" ADD CONSTRAINT "NotaConservatorio_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

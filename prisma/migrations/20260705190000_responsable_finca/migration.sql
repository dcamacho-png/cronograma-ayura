-- AlterTable
ALTER TABLE "Responsable" ADD COLUMN "fincaId" TEXT;

-- AddForeignKey
ALTER TABLE "Responsable" ADD CONSTRAINT "Responsable_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

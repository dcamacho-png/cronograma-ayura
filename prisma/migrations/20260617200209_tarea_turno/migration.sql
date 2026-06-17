-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tarea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "descripcion" TEXT NOT NULL,
    "turno" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "anioSel" INTEGER,
    "semanaSel" INTEGER,
    "areaId" TEXT NOT NULL,
    "fincaId" TEXT,
    "loteId" TEXT,
    CONSTRAINT "Tarea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tarea_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tarea_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Tarea" ("anioSel", "areaId", "descripcion", "estado", "fincaId", "id", "loteId", "semanaSel") SELECT "anioSel", "areaId", "descripcion", "estado", "fincaId", "id", "loteId", "semanaSel" FROM "Tarea";
DROP TABLE "Tarea";
ALTER TABLE "new_Tarea" RENAME TO "Tarea";
CREATE INDEX "Tarea_areaId_estado_idx" ON "Tarea"("areaId", "estado");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

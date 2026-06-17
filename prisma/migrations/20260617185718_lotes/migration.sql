-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "hectareas" REAL,
    "tipoPasto" TEXT,
    "fincaId" TEXT NOT NULL,
    CONSTRAINT "Lote_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ActividadToLote" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ActividadToLote_A_fkey" FOREIGN KEY ("A") REFERENCES "Actividad" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ActividadToLote_B_fkey" FOREIGN KEY ("B") REFERENCES "Lote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tarea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "descripcion" TEXT NOT NULL,
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
INSERT INTO "new_Tarea" ("anioSel", "areaId", "descripcion", "estado", "fincaId", "id", "semanaSel") SELECT "anioSel", "areaId", "descripcion", "estado", "fincaId", "id", "semanaSel" FROM "Tarea";
DROP TABLE "Tarea";
ALTER TABLE "new_Tarea" RENAME TO "Tarea";
CREATE INDEX "Tarea_areaId_estado_idx" ON "Tarea"("areaId", "estado");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Lote_nombre_key" ON "Lote"("nombre");

-- CreateIndex
CREATE INDEX "Lote_fincaId_idx" ON "Lote"("fincaId");

-- CreateIndex
CREATE UNIQUE INDEX "_ActividadToLote_AB_unique" ON "_ActividadToLote"("A", "B");

-- CreateIndex
CREATE INDEX "_ActividadToLote_B_index" ON "_ActividadToLote"("B");

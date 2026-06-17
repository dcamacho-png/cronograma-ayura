-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Actividad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anio" INTEGER NOT NULL,
    "semana" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "turno" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "nota" TEXT,
    "vecesReprogramada" INTEGER NOT NULL DEFAULT 0,
    "areaId" TEXT NOT NULL,
    "fincaId" TEXT,
    "responsableId" TEXT NOT NULL,
    "motivoId" TEXT,
    "origenId" TEXT,
    "maquinaId" TEXT,
    "tareaId" TEXT,
    "areaTareaId" TEXT,
    "horas" REAL,
    "hectareas" REAL,
    "planB" TEXT,
    CONSTRAINT "Actividad_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Actividad_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Actividad_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Responsable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Actividad_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "Motivo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Actividad_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "Actividad" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Actividad_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Actividad_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Actividad_areaTareaId_fkey" FOREIGN KEY ("areaTareaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Actividad" ("anio", "areaId", "areaTareaId", "descripcion", "dia", "estado", "fincaId", "hectareas", "horas", "id", "maquinaId", "motivoId", "nota", "origenId", "planB", "responsableId", "semana", "tareaId", "turno", "vecesReprogramada") SELECT "anio", "areaId", "areaTareaId", "descripcion", "dia", "estado", "fincaId", "hectareas", "horas", "id", "maquinaId", "motivoId", "nota", "origenId", "planB", "responsableId", "semana", "tareaId", "turno", "vecesReprogramada" FROM "Actividad";
DROP TABLE "Actividad";
ALTER TABLE "new_Actividad" RENAME TO "Actividad";
CREATE INDEX "Actividad_anio_semana_areaId_idx" ON "Actividad"("anio", "semana", "areaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

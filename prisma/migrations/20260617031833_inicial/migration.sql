-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Finca" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Responsable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    CONSTRAINT "Responsable_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Maquina" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "operario" TEXT
);

-- CreateTable
CREATE TABLE "Motivo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Actividad" (
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
    "fincaId" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "motivoId" TEXT,
    "origenId" TEXT,
    "maquinaId" TEXT,
    "areaTareaId" TEXT,
    "horas" REAL,
    "hectareas" REAL,
    "planB" TEXT,
    CONSTRAINT "Actividad_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Actividad_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Actividad_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Responsable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Actividad_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "Motivo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Actividad_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "Actividad" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Actividad_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Actividad_areaTareaId_fkey" FOREIGN KEY ("areaTareaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_nombre_key" ON "Area"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Finca_nombre_key" ON "Finca"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Motivo_nombre_key" ON "Motivo"("nombre");

-- CreateIndex
CREATE INDEX "Actividad_anio_semana_areaId_idx" ON "Actividad"("anio", "semana", "areaId");

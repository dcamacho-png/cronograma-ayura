-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'AREA',
    "areaId" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finca" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Finca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Responsable" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Responsable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maquina" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Maquina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motivo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Motivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" TEXT NOT NULL,
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
    "horas" DOUBLE PRECISION,
    "hectareas" DOUBLE PRECISION,
    "haFaltante" DOUBLE PRECISION,
    "planB" TEXT,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "turno" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "anioSel" INTEGER,
    "semanaSel" INTEGER,
    "vecesReprogramada" INTEGER NOT NULL DEFAULT 0,
    "areaId" TEXT NOT NULL,
    "solicitadaPorAreaId" TEXT,
    "fincaId" TEXT,
    "loteId" TEXT,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActividadEstipulada" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "ActividadEstipulada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "hectareas" DOUBLE PRECISION,
    "tipoPasto" TEXT,
    "fincaId" TEXT NOT NULL,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ActividadToLote" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ActividadToLote_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TareaLotesMulti" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TareaLotesMulti_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_nombre_key" ON "Area"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_usuario_key" ON "Usuario"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "Finca_nombre_key" ON "Finca"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Motivo_nombre_key" ON "Motivo"("nombre");

-- CreateIndex
CREATE INDEX "Actividad_anio_semana_areaId_idx" ON "Actividad"("anio", "semana", "areaId");

-- CreateIndex
CREATE INDEX "Tarea_areaId_estado_idx" ON "Tarea"("areaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "ActividadEstipulada_nombre_key" ON "ActividadEstipulada"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_nombre_key" ON "Lote"("nombre");

-- CreateIndex
CREATE INDEX "Lote_fincaId_idx" ON "Lote"("fincaId");

-- CreateIndex
CREATE INDEX "_ActividadToLote_B_index" ON "_ActividadToLote"("B");

-- CreateIndex
CREATE INDEX "_TareaLotesMulti_B_index" ON "_TareaLotesMulti"("B");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responsable" ADD CONSTRAINT "Responsable_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Responsable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "Motivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "Actividad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_areaTareaId_fkey" FOREIGN KEY ("areaTareaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_solicitadaPorAreaId_fkey" FOREIGN KEY ("solicitadaPorAreaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_fincaId_fkey" FOREIGN KEY ("fincaId") REFERENCES "Finca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActividadToLote" ADD CONSTRAINT "_ActividadToLote_A_fkey" FOREIGN KEY ("A") REFERENCES "Actividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActividadToLote" ADD CONSTRAINT "_ActividadToLote_B_fkey" FOREIGN KEY ("B") REFERENCES "Lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TareaLotesMulti" ADD CONSTRAINT "_TareaLotesMulti_A_fkey" FOREIGN KEY ("A") REFERENCES "Lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TareaLotesMulti" ADD CONSTRAINT "_TareaLotesMulti_B_fkey" FOREIGN KEY ("B") REFERENCES "Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;


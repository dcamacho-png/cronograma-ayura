-- CreateTable
CREATE TABLE "_TareaLotesMulti" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TareaLotesMulti_A_fkey" FOREIGN KEY ("A") REFERENCES "Lote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TareaLotesMulti_B_fkey" FOREIGN KEY ("B") REFERENCES "Tarea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_TareaLotesMulti_AB_unique" ON "_TareaLotesMulti"("A", "B");

-- CreateIndex
CREATE INDEX "_TareaLotesMulti_B_index" ON "_TareaLotesMulti"("B");

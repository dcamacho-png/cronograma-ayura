-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Maquina" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL
);
INSERT INTO "new_Maquina" ("id", "nombre") SELECT "id", "nombre" FROM "Maquina";
DROP TABLE "Maquina";
ALTER TABLE "new_Maquina" RENAME TO "Maquina";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

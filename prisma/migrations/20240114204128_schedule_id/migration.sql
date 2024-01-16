-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "costPerHour" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Schedule" ("costPerHour", "createdAt", "createdBy", "deadline", "id", "source", "updatedAt", "updatedBy") SELECT "costPerHour", "createdAt", "createdBy", "deadline", "id", "source", "updatedAt", "updatedBy" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

/*
  Warnings:

  - The primary key for the `Timeline` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `id` to the `Timeline` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Timeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "display" TEXT,
    "ditch" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "section" TEXT,
    "scheduleId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "start" DATETIME,
    "stop" DATETIME,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Timeline" ("createdAt", "createdBy", "date", "display", "ditch", "hours", "position", "scheduleId", "section", "start", "stop", "updatedAt", "updatedBy", "userId") SELECT "createdAt", "createdBy", "date", "display", "ditch", "hours", "position", "scheduleId", "section", "start", "stop", "updatedAt", "updatedBy", "userId" FROM "Timeline";
DROP TABLE "Timeline";
ALTER TABLE "new_Timeline" RENAME TO "Timeline";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

/*
  Warnings:

  - The primary key for the `UserSchedule` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `portId` to the `Timeline` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Timeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "order" INTEGER,
    "date" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "display" TEXT,
    "portId" TEXT NOT NULL,
    "ditch" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "entry" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "first" BOOLEAN,
    "crossover" BOOLEAN,
    "last" BOOLEAN,
    "hours" REAL NOT NULL,
    "start" DATETIME,
    "stop" DATETIME,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Timeline" ("crossover", "date", "display", "ditch", "entry", "first", "hours", "id", "last", "order", "position", "scheduleId", "section", "start", "stop", "updatedAt", "updatedBy", "userId") SELECT "crossover", "date", "display", "ditch", "entry", "first", "hours", "id", "last", "order", "position", "scheduleId", "section", "start", "stop", "updatedAt", "updatedBy", "userId" FROM "Timeline";
DROP TABLE "Timeline";
ALTER TABLE "new_Timeline" RENAME TO "Timeline";
DROP TABLE IF EXISTS "new_UserSchedule"
CREATE TABLE "new_UserSchedule" (
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "start" DATETIME,
    "stop" DATETIME,
    "first" BOOLEAN,
    "crossover" BOOLEAN,
    "last" BOOLEAN,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "scheduleId", "portId"),
    CONSTRAINT "UserSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSchedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSchedule_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserSchedule" ("crossover", "first", "hours", "last", "portId", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId") SELECT "crossover", "first", "hours", "last", "portId", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId" FROM "UserSchedule";
DROP TABLE "UserSchedule";
ALTER TABLE "new_UserSchedule" RENAME TO "UserSchedule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

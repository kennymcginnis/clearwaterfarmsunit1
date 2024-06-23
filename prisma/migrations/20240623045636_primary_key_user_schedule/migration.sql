/*
  Warnings:

  - The primary key for the `UserSchedule` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `id` on table `UserSchedule` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ditch" INTEGER NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "head" INTEGER NOT NULL DEFAULT 70,
    "start" DATETIME,
    "stop" DATETIME,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSchedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserSchedule" ("ditch", "head", "hours", "id", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId") SELECT "ditch", "head", "hours", "id", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId" FROM "UserSchedule";
DROP TABLE "UserSchedule";
ALTER TABLE "new_UserSchedule" RENAME TO "UserSchedule";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

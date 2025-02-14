/*
  Warnings:

  - The primary key for the `UserSchedule` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `acknowledgeCrossover` on the `UserSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `acknowledgeFirst` on the `UserSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `requestsTraining` on the `UserSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `volunteerCrossover` on the `UserSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `volunteerFirst` on the `UserSchedule` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,updatedAt]` on the table `UserAudit` will be added. If there are existing duplicate values, this will fail.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
DROP TABLE IF EXISTS "new_UserSchedule";
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
    "firstId" TEXT,
    "crossoverId" TEXT,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "scheduleId", "portId"),
    CONSTRAINT "UserSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSchedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSchedule_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserSchedule" ("crossover", "crossoverId", "first", "firstId", "hours", "last", "portId", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId") SELECT "crossover", "crossoverId", "first", "firstId", "hours", "last", "portId", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId" FROM "UserSchedule";
DROP TABLE "UserSchedule";
ALTER TABLE "new_UserSchedule" RENAME TO "UserSchedule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserAudit_userId_updatedAt_key" ON "UserAudit"("userId", "updatedAt");

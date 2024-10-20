/*
  Warnings:

  - You are about to drop the column `head` on the `UserSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `UserSchedule` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSchedule" (
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "start" DATETIME,
    "stop" DATETIME,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "portId", "scheduleId"),
    CONSTRAINT "UserSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSchedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSchedule_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UserSchedule" ("portId", "hours", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId") SELECT "portId", "hours", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId" FROM "UserSchedule";
DROP TABLE "UserSchedule";
ALTER TABLE "new_UserSchedule" RENAME TO "UserSchedule";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

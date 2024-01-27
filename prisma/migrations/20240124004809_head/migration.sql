-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSchedule" (
    "userId" TEXT NOT NULL,
    "ditch" INTEGER NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "start" DATETIME,
    "stop" DATETIME,
    "hours" REAL NOT NULL,
    "head" INTEGER NOT NULL DEFAULT 70,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "ditch", "scheduleId"),
    CONSTRAINT "UserSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSchedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserSchedule" ("createdAt", "createdBy", "ditch", "hours", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId") SELECT "createdAt", "createdBy", "ditch", "hours", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId" FROM "UserSchedule";
DROP TABLE "UserSchedule";
ALTER TABLE "new_UserSchedule" RENAME TO "UserSchedule";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

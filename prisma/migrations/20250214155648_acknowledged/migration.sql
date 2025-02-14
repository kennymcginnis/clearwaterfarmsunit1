DROP TABLE "Crossover";
CREATE TABLE "Crossover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "ditch" INTEGER NOT NULL,
    "entry" TEXT NOT NULL,
    "duty" TEXT NOT NULL,
    "userId" TEXT,
    "volunteerId" TEXT,
    "dutyStart" DATETIME,
    "dutyNotes" TEXT,
    "acknowledged" BOOLEAN,
    "requestsTraining" BOOLEAN,
    "hours" REAL NOT NULL DEFAULT 0,
    "start" DATETIME,
    "stop" DATETIME,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Crossover_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Crossover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Crossover_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "UserSchedule" ADD COLUMN "firstId" TEXT;
ALTER TABLE "UserSchedule" ADD COLUMN "crossoverId" TEXT;
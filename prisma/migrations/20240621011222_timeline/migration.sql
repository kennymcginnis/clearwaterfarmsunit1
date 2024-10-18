-- CreateTable
CREATE TABLE "Timeline" (
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
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "ditch", "scheduleId")
);

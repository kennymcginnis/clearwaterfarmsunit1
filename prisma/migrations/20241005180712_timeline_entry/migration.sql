DROP TABLE "Timeline";
CREATE TABLE "Timeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "order" INTEGER,
    "date" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "display" TEXT,
    "ditch" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "entry" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "start" DATETIME,
    "stop" DATETIME,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);

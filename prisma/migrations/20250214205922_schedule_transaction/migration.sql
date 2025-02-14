-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "quantity" REAL,
    "rate" INTEGER,
    "note" TEXT,
    "userId" TEXT,
    "scheduleId" TEXT,
    "ditch" INTEGER,
    "waterStart" DATETIME,
    "emailed" BOOLEAN DEFAULT false,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transactions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transactions" ("credit", "date", "debit", "ditch", "emailed", "id", "note", "quantity", "rate", "scheduleId", "updatedAt", "updatedBy", "userId", "waterStart") SELECT "credit", "date", "debit", "ditch", "emailed", "id", "note", "quantity", "rate", "scheduleId", "updatedAt", "updatedBy", "userId", "waterStart" FROM "Transactions";
DROP TABLE "Transactions";
ALTER TABLE "new_Transactions" RENAME TO "Transactions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

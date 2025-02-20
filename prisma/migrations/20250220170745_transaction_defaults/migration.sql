/*
  Warnings:

  - Made the column `userId` on table `Transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'Irrigation',
    "note" TEXT NOT NULL DEFAULT '',
    "emailed" BOOLEAN NOT NULL DEFAULT false,
    "scheduleId" TEXT,
    "quantity" REAL,
    "rate" INTEGER,
    "ditch" INTEGER,
    "waterStart" DATETIME,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transactions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transactions" ("credit", "date", "debit", "ditch", "emailed", "id", "note", "quantity", "rate", "scheduleId", "updatedAt", "updatedBy", "userId", "waterStart") SELECT "credit", "date", "debit", "ditch", coalesce("emailed", false) AS "emailed", "id", coalesce("note", '') AS "note", "quantity", "rate", "scheduleId", "updatedAt", "updatedBy", "userId", "waterStart" FROM "Transactions";
DROP TABLE "Transactions";
ALTER TABLE "new_Transactions" RENAME TO "Transactions";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "display" TEXT,
    "member" TEXT,
    "quickbooks" TEXT,
    "stripeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trained" BOOLEAN NOT NULL DEFAULT false,
    "emailSubject" TEXT NOT NULL DEFAULT 'Neighbor',
    "primaryEmail" TEXT NOT NULL DEFAULT 'missing',
    "secondarySubject" TEXT,
    "secondaryEmail" TEXT,
    "defaultHours" REAL NOT NULL DEFAULT 0,
    "restricted" BOOLEAN,
    "restriction" TEXT,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "defaultHours", "display", "emailSubject", "id", "member", "primaryEmail", "quickbooks", "restricted", "restriction", "secondaryEmail", "secondarySubject", "stripeId", "trained", "updatedAt", "updatedBy", "username") SELECT "active", "defaultHours", "display", coalesce("emailSubject", 'Neighbor') AS "emailSubject", "id", "member", coalesce("primaryEmail", 'missing') AS "primaryEmail", "quickbooks", "restricted", "restriction", "secondaryEmail", "secondarySubject", "stripeId", "trained", "updatedAt", "updatedBy", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

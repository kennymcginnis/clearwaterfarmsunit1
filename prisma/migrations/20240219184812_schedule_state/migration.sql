/*
  Warnings:

  - You are about to drop the column `closed` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `open` on the `Schedule` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "deadline" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "costPerHour" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Schedule" ("costPerHour", "createdAt", "createdBy", "date", "deadline", "id", "source", "updatedAt", "updatedBy") SELECT "costPerHour", "createdAt", "createdBy", "date", "deadline", "id", "source", "updatedAt", "updatedBy" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE TABLE "new_UserPhone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPhone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UserPhone" ("createdAt", "createdBy", "id", "number", "type", "updatedAt", "updatedBy", "userId") SELECT "createdAt", "createdBy", "id", "number", "type", "updatedAt", "updatedBy", "userId" FROM "UserPhone";
DROP TABLE "UserPhone";
ALTER TABLE "new_UserPhone" RENAME TO "UserPhone";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

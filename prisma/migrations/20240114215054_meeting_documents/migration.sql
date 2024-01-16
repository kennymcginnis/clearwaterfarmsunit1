/*
  Warnings:

  - You are about to drop the column `documentId` on the `Meeting` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Meeting" ("createdAt", "createdBy", "date", "id", "updatedAt", "updatedBy") SELECT "createdAt", "createdBy", "date", "id", "updatedAt", "updatedBy" FROM "Meeting";
DROP TABLE "Meeting";
ALTER TABLE "new_Meeting" RENAME TO "Meeting";
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" BLOB NOT NULL,
    "meetingId" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("content", "createdAt", "createdBy", "id", "title", "type", "updatedAt", "updatedBy") SELECT "content", "createdAt", "createdBy", "id", "title", "type", "updatedAt", "updatedBy" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

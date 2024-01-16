/*
  Warnings:

  - You are about to drop the `Connection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `depositDate` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `UserImage` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `UserImage` table. All the data in the column will be lost.
  - The primary key for the `UserSchedule` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `updatedAt` to the `Port` table without a default value. This is not possible if the table is not empty.
  - Added the required column `costPerHour` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ditch` to the `UserSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Connection_providerName_providerId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Connection";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" BLOB NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "comment" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT NOT NULL,
    "blob" BLOB NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentImage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "orangewood" TEXT NOT NULL,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "defaultHours" INTEGER NOT NULL DEFAULT 0,
    "defaultHead" INTEGER NOT NULL DEFAULT 70,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "orangewood", "updatedAt", "username") SELECT "createdAt", "email", "id", "name", "orangewood", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_Port" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ditch" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "entry" TEXT,
    "userId" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Port_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Port" ("ditch", "entry", "id", "position", "userId") SELECT "ditch", "entry", "id", "position", "userId" FROM "Port";
DROP TABLE "Port";
ALTER TABLE "new_Port" RENAME TO "Port";
CREATE TABLE "new_Deposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL,
    "userId" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Deposit" ("amount", "createdAt", "id", "note", "updatedAt", "userId") SELECT "amount", "createdAt", "id", "note", "updatedAt", "userId" FROM "Deposit";
DROP TABLE "Deposit";
ALTER TABLE "new_Deposit" RENAME TO "Deposit";
CREATE TABLE "new_Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "deadline" DATETIME NOT NULL,
    "costPerHour" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Schedule" ("deadline", "id", "source") SELECT "deadline", "id", "source" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE TABLE "new_UserImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT NOT NULL,
    "blob" BLOB NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "UserImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserImage" ("altText", "blob", "contentType", "id", "userId") SELECT "altText", "blob", "contentType", "id", "userId" FROM "UserImage";
DROP TABLE "UserImage";
ALTER TABLE "new_UserImage" RENAME TO "UserImage";
CREATE UNIQUE INDEX "UserImage_userId_key" ON "UserImage"("userId");
CREATE TABLE "new_UserSchedule" (
    "userId" TEXT NOT NULL,
    "ditch" INTEGER NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "hours" DECIMAL NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "ditch", "scheduleId"),
    CONSTRAINT "UserSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSchedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserSchedule" ("createdAt", "hours", "scheduleId", "updatedAt", "userId") SELECT "createdAt", "hours", "scheduleId", "updatedAt", "userId" FROM "UserSchedule";
DROP TABLE "UserSchedule";
ALTER TABLE "new_UserSchedule" RENAME TO "UserSchedule";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "DocumentImage_documentId_idx" ON "DocumentImage"("documentId");

/*
  Warnings:

  - You are about to drop the column `createdAt` on the `DocumentImage` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `DocumentImage` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `UserImage` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Permission` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Transactions` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Transactions` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ParcelAndLot` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `ParcelAndLot` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Timeline` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Timeline` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `UserAddress` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `UserAddress` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `UserPhone` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `UserPhone` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `UserSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `UserSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Document` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT NOT NULL,
    "blob" BLOB NOT NULL,
    "documentId" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentImage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DocumentImage" ("altText", "blob", "contentType", "documentId", "id", "updatedAt", "updatedBy") SELECT "altText", "blob", "contentType", "documentId", "id", "updatedAt", "updatedBy" FROM "DocumentImage";
DROP TABLE "DocumentImage";
ALTER TABLE "new_DocumentImage" RENAME TO "DocumentImage";
CREATE INDEX "DocumentImage_documentId_idx" ON "DocumentImage"("documentId");
CREATE TABLE "new_UserImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT NOT NULL,
    "blob" BLOB NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserImage" ("altText", "blob", "contentType", "id", "updatedAt", "userId") SELECT "altText", "blob", "contentType", "id", "updatedAt", "userId" FROM "UserImage";
DROP TABLE "UserImage";
ALTER TABLE "new_UserImage" RENAME TO "UserImage";
CREATE UNIQUE INDEX "UserImage_userId_key" ON "UserImage"("userId");
CREATE TABLE "new_Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "comment" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Comment" ("comment", "id", "updatedAt", "updatedBy") SELECT "comment", "id", "updatedAt", "updatedBy" FROM "Comment";
DROP TABLE "Comment";
ALTER TABLE "new_Comment" RENAME TO "Comment";
CREATE TABLE "new_Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "access" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Permission" ("access", "action", "description", "entity", "id", "updatedAt") SELECT "access", "action", "description", "entity", "id", "updatedAt" FROM "Permission";
DROP TABLE "Permission";
ALTER TABLE "new_Permission" RENAME TO "Permission";
CREATE UNIQUE INDEX "Permission_action_entity_access_key" ON "Permission"("action", "entity", "access");
CREATE TABLE "new_Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "deadline" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "costPerHour" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "start" DATETIME,
    "stop" DATETIME,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Schedule" ("costPerHour", "date", "deadline", "id", "source", "start", "state", "stop", "updatedAt", "updatedBy") SELECT "costPerHour", "date", "deadline", "id", "source", "start", "state", "stop", "updatedAt", "updatedBy" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expirationDate" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("expirationDate", "id", "updatedAt", "userId") SELECT "expirationDate", "id", "updatedAt", "userId" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
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
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transactions" ("credit", "date", "debit", "ditch", "id", "note", "quantity", "rate", "scheduleId", "updatedAt", "updatedBy", "userId") SELECT "credit", "date", "debit", "ditch", "id", "note", "quantity", "rate", "scheduleId", "updatedAt", "updatedBy", "userId" FROM "Transactions";
DROP TABLE "Transactions";
ALTER TABLE "new_Transactions" RENAME TO "Transactions";
CREATE TABLE "new_ParcelAndLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "addressId" TEXT NOT NULL,
    "parcel" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParcelAndLot_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ParcelAndLot" ("addressId", "id", "lot", "parcel", "updatedAt", "updatedBy") SELECT "addressId", "id", "lot", "parcel", "updatedAt", "updatedBy" FROM "ParcelAndLot";
DROP TABLE "ParcelAndLot";
ALTER TABLE "new_ParcelAndLot" RENAME TO "ParcelAndLot";
CREATE TABLE "new_Timeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Timeline" ("date", "display", "ditch", "hours", "id", "position", "scheduleId", "section", "start", "stop", "updatedAt", "updatedBy", "userId") SELECT "date", "display", "ditch", "hours", "id", "position", "scheduleId", "section", "start", "stop", "updatedAt", "updatedBy", "userId" FROM "Timeline";
DROP TABLE "Timeline";
ALTER TABLE "new_Timeline" RENAME TO "Timeline";
CREATE TABLE "new_UserAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAddress_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserAddress" ("addressId", "id", "updatedAt", "updatedBy", "userId") SELECT "addressId", "id", "updatedAt", "updatedBy", "userId" FROM "UserAddress";
DROP TABLE "UserAddress";
ALTER TABLE "new_UserAddress" RENAME TO "UserAddress";
CREATE INDEX "UserAddress_userId_addressId_idx" ON "UserAddress"("userId", "addressId");
CREATE TABLE "new_Address" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Address" ("address", "id", "updatedAt", "updatedBy") SELECT "address", "id", "updatedAt", "updatedBy" FROM "Address";
DROP TABLE "Address";
ALTER TABLE "new_Address" RENAME TO "Address";
CREATE UNIQUE INDEX "Address_address_key" ON "Address"("address");
CREATE TABLE "new_Port" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ditch" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "section" TEXT,
    "entry" TEXT,
    "userId" TEXT,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Port_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Port" ("ditch", "entry", "id", "position", "section", "updatedAt", "updatedBy", "userId") SELECT "ditch", "entry", "id", "position", "section", "updatedAt", "updatedBy", "userId" FROM "Port";
DROP TABLE "Port";
ALTER TABLE "new_Port" RENAME TO "Port";
CREATE TABLE "new_Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Role" ("description", "id", "name", "updatedAt") SELECT "description", "id", "name", "updatedAt" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "display" TEXT,
    "member" TEXT,
    "quickbooks" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "primaryEmail" TEXT,
    "secondaryEmail" TEXT,
    "defaultHours" REAL NOT NULL DEFAULT 0,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "restriction" TEXT,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "defaultHours", "display", "id", "member", "primaryEmail", "quickbooks", "restricted", "restriction", "secondaryEmail", "updatedAt", "updatedBy", "username") SELECT "active", "defaultHours", "display", "id", "member", "primaryEmail", "quickbooks", "restricted", "restriction", "secondaryEmail", "updatedAt", "updatedBy", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_primaryEmail_key" ON "User"("primaryEmail");
CREATE TABLE "new_UserPhone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPhone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UserPhone" ("id", "number", "primary", "type", "updatedAt", "updatedBy", "userId") SELECT "id", "number", "primary", "type", "updatedAt", "updatedBy", "userId" FROM "UserPhone";
DROP TABLE "UserPhone";
ALTER TABLE "new_UserPhone" RENAME TO "UserPhone";
CREATE TABLE "new_UserSchedule" (
    "userId" TEXT NOT NULL,
    "ditch" INTEGER NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "head" INTEGER NOT NULL DEFAULT 70,
    "start" DATETIME,
    "stop" DATETIME,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "ditch", "scheduleId"),
    CONSTRAINT "UserSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSchedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserSchedule" ("ditch", "head", "hours", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId") SELECT "ditch", "head", "hours", "scheduleId", "start", "stop", "updatedAt", "updatedBy", "userId" FROM "UserSchedule";
DROP TABLE "UserSchedule";
ALTER TABLE "new_UserSchedule" RENAME TO "UserSchedule";
CREATE TABLE "new_Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Meeting" ("date", "id", "updatedAt", "updatedBy") SELECT "date", "id", "updatedAt", "updatedBy" FROM "Meeting";
DROP TABLE "Meeting";
ALTER TABLE "new_Meeting" RENAME TO "Meeting";
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" BLOB NOT NULL,
    "meetingId" TEXT,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("content", "id", "meetingId", "title", "type", "updatedAt", "updatedBy") SELECT "content", "id", "meetingId", "title", "type", "updatedAt", "updatedBy" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

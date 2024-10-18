/*
  Warnings:

  - You are about to drop the column `restrictionNote` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "member" TEXT,
    "primaryEmail" TEXT,
    "secondaryEmail" TEXT,
    "defaultHours" REAL NOT NULL DEFAULT 0,
    "defaultHead" INTEGER NOT NULL DEFAULT 70,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "restriction" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "createdBy", "defaultHead", "defaultHours", "id", "member", "primaryEmail", "restricted", "secondaryEmail", "updatedAt", "updatedBy", "username") SELECT "createdAt", "createdBy", "defaultHead", "defaultHours", "id", "member", "primaryEmail", "restricted", "secondaryEmail", "updatedAt", "updatedBy", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_primaryEmail_key" ON "User"("primaryEmail");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "display" TEXT,
    "member" TEXT,
    "quickbooks" TEXT,
    "stripeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "emailSubject" TEXT,
    "primaryEmail" TEXT,
    "secondarySubject" TEXT,
    "secondaryEmail" TEXT,
    "defaultHours" REAL NOT NULL DEFAULT 0,
    "restricted" BOOLEAN,
    "restriction" TEXT,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "defaultHours", "display", "emailSubject", "id", "member", "primaryEmail", "quickbooks", "restricted", "restriction", "secondaryEmail", "secondarySubject", "stripeId", "updatedAt", "updatedBy", "username") SELECT "active", "defaultHours", "display", "emailSubject", "id", "member", "primaryEmail", "quickbooks", "restricted", "restriction", "secondaryEmail", "secondarySubject", "stripeId", "updatedAt", "updatedBy", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_primaryEmail_key" ON "User"("primaryEmail");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

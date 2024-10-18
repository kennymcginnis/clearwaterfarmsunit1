-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "display" TEXT,
    "member" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "primaryEmail" TEXT,
    "secondaryEmail" TEXT,
    "defaultHours" REAL NOT NULL DEFAULT 0,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "restriction" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "createdBy", "defaultHours", "display", "id", "member", "primaryEmail", "restricted", "restriction", "secondaryEmail", "updatedAt", "updatedBy", "username") SELECT "createdAt", "createdBy", "defaultHours", "display", "id", "member", "primaryEmail", "restricted", "restriction", "secondaryEmail", "updatedAt", "updatedBy", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_primaryEmail_key" ON "User"("primaryEmail");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

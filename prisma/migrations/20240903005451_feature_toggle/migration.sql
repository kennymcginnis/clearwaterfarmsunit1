/*
  Warnings:

  - You are about to drop the `Content` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ContentState` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Content";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ContentState";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "FeatureToggle" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserAudit" (
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'Admin',
    "updatedAt" DATETIME NOT NULL
);

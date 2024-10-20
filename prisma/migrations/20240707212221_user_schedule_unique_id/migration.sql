/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `UserSchedule` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserSchedule" ADD COLUMN "id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserSchedule_id_key" ON "UserSchedule"("id");

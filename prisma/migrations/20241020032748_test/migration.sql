-- AlterTable
ALTER TABLE "Timeline" ADD COLUMN "crossover" BOOLEAN;
ALTER TABLE "Timeline" ADD COLUMN "first" BOOLEAN;
ALTER TABLE "Timeline" ADD COLUMN "last" BOOLEAN;

-- AlterTable
ALTER TABLE "UserSchedule" ADD COLUMN "crossover" BOOLEAN;
ALTER TABLE "UserSchedule" ADD COLUMN "first" BOOLEAN;
ALTER TABLE "UserSchedule" ADD COLUMN "last" BOOLEAN;

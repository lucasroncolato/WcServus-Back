-- CreateEnum
CREATE TYPE "ServiceTemplateRecurrenceType" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY');

-- AlterEnum
ALTER TYPE "ScheduleSlotStatus" ADD VALUE IF NOT EXISTS 'EMPTY';
ALTER TYPE "ScheduleSlotStatus" ADD VALUE IF NOT EXISTS 'FILLED';
ALTER TYPE "ScheduleSlotStatus" ADD VALUE IF NOT EXISTS 'SUBSTITUTE_PENDING';
ALTER TYPE "ScheduleSlotStatus" ADD VALUE IF NOT EXISTS 'REPLACED';
ALTER TYPE "ScheduleSlotStatus" ADD VALUE IF NOT EXISTS 'LOCKED';

-- CreateEnum
CREATE TYPE "ScheduleSlotConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "WorshipService"
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canceled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ServiceTemplate" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "WorshipServiceType" NOT NULL,
  "recurrenceType" "ServiceTemplateRecurrenceType" NOT NULL DEFAULT 'WEEKLY',
  "weekday" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "generateAheadDays" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTemplateSlot" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "ministryId" TEXT NOT NULL,
  "teamId" TEXT,
  "responsibilityId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "requiredTalentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceTemplateSlot_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ScheduleSlot"
  ADD COLUMN "teamId" TEXT,
  ADD COLUMN "templateSlotId" TEXT,
  ADD COLUMN "confirmationStatus" "ScheduleSlotConfirmationStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill confirmation (status backfill moved to a subsequent migration
-- because PostgreSQL does not allow using newly added enum labels in the
-- same transaction where they are introduced).
UPDATE "ScheduleSlot"
SET "confirmationStatus" = 'CONFIRMED'
WHERE "status" = 'CONFIRMED';

UPDATE "ScheduleSlot"
SET "confirmationStatus" = 'DECLINED'
WHERE "status" = 'DECLINED';

-- CreateIndex
CREATE INDEX "WorshipService_templateId_idx" ON "WorshipService"("templateId");
CREATE INDEX "ServiceTemplate_churchId_active_idx" ON "ServiceTemplate"("churchId", "active");
CREATE INDEX "ServiceTemplate_churchId_recurrenceType_idx" ON "ServiceTemplate"("churchId", "recurrenceType");
CREATE INDEX "ServiceTemplateSlot_templateId_idx" ON "ServiceTemplateSlot"("templateId");
CREATE INDEX "ServiceTemplateSlot_ministryId_idx" ON "ServiceTemplateSlot"("ministryId");
CREATE INDEX "ServiceTemplateSlot_teamId_idx" ON "ServiceTemplateSlot"("teamId");
CREATE INDEX "ServiceTemplateSlot_responsibilityId_idx" ON "ServiceTemplateSlot"("responsibilityId");
CREATE INDEX "ScheduleSlot_teamId_idx" ON "ScheduleSlot"("teamId");
CREATE INDEX "ScheduleSlot_templateSlotId_idx" ON "ScheduleSlot"("templateSlotId");

-- AddForeignKey
ALTER TABLE "WorshipService" ADD CONSTRAINT "WorshipService_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ServiceTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceTemplate" ADD CONSTRAINT "ServiceTemplate_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceTemplateSlot" ADD CONSTRAINT "ServiceTemplateSlot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ServiceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceTemplateSlot" ADD CONSTRAINT "ServiceTemplateSlot_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceTemplateSlot" ADD CONSTRAINT "ServiceTemplateSlot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceTemplateSlot" ADD CONSTRAINT "ServiceTemplateSlot_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "MinistryResponsibility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_templateSlotId_fkey" FOREIGN KEY ("templateSlotId") REFERENCES "ServiceTemplateSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

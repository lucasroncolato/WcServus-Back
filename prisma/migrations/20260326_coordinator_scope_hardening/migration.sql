-- Coordinator scope hardening: servant approval flow, pastoral weekly follow-up,
-- daily devotional and monthly fasting tracking.

-- CreateEnum
CREATE TYPE "ServantApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DevotionalStatus" AS ENUM ('DONE', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "MonthlyFastingStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Servant"
  ADD COLUMN "approvalStatus" "ServantApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "approvalRequestedByUserId" TEXT,
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "approvalUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "approvalNotes" TEXT;

-- CreateTable
CREATE TABLE "PastoralWeeklyFollowUp" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "responsibleUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastoralWeeklyFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDevotional" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "devotionalDate" TIMESTAMP(3) NOT NULL,
    "status" "DevotionalStatus" NOT NULL DEFAULT 'DONE',
    "notes" TEXT,
    "registeredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyDevotional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyFasting" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "referenceMonth" TIMESTAMP(3) NOT NULL,
    "status" "MonthlyFastingStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "registeredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyFasting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Servant_approvalStatus_idx" ON "Servant"("approvalStatus");

-- CreateIndex
CREATE INDEX "Servant_approvalRequestedByUserId_idx" ON "Servant"("approvalRequestedByUserId");

-- CreateIndex
CREATE INDEX "Servant_approvedByUserId_idx" ON "Servant"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PastoralWeeklyFollowUp_servantId_sectorId_weekStartDate_key" ON "PastoralWeeklyFollowUp"("servantId", "sectorId", "weekStartDate");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_weekStartDate_idx" ON "PastoralWeeklyFollowUp"("weekStartDate");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_servantId_weekStartDate_idx" ON "PastoralWeeklyFollowUp"("servantId", "weekStartDate");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_sectorId_weekStartDate_idx" ON "PastoralWeeklyFollowUp"("sectorId", "weekStartDate");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_scheduleId_idx" ON "PastoralWeeklyFollowUp"("scheduleId");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_responsibleUserId_idx" ON "PastoralWeeklyFollowUp"("responsibleUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyDevotional_servantId_devotionalDate_key" ON "DailyDevotional"("servantId", "devotionalDate");

-- CreateIndex
CREATE INDEX "DailyDevotional_devotionalDate_idx" ON "DailyDevotional"("devotionalDate");

-- CreateIndex
CREATE INDEX "DailyDevotional_servantId_devotionalDate_idx" ON "DailyDevotional"("servantId", "devotionalDate");

-- CreateIndex
CREATE INDEX "DailyDevotional_registeredByUserId_idx" ON "DailyDevotional"("registeredByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyFasting_servantId_referenceMonth_key" ON "MonthlyFasting"("servantId", "referenceMonth");

-- CreateIndex
CREATE INDEX "MonthlyFasting_referenceMonth_idx" ON "MonthlyFasting"("referenceMonth");

-- CreateIndex
CREATE INDEX "MonthlyFasting_servantId_referenceMonth_idx" ON "MonthlyFasting"("servantId", "referenceMonth");

-- CreateIndex
CREATE INDEX "MonthlyFasting_registeredByUserId_idx" ON "MonthlyFasting"("registeredByUserId");

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_approvalRequestedByUserId_fkey" FOREIGN KEY ("approvalRequestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDevotional" ADD CONSTRAINT "DailyDevotional_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDevotional" ADD CONSTRAINT "DailyDevotional_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyFasting" ADD CONSTRAINT "MonthlyFasting_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyFasting" ADD CONSTRAINT "MonthlyFasting_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "PastoralPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PastoralReasonType" AS ENUM ('ABSENCE', 'NO_SHOW', 'INACTIVITY', 'PERSONAL', 'TRAINING', 'JOURNEY_SIGNAL', 'SCHEDULE_SIGNAL', 'REQUEST_HELP', 'OTHER');

-- CreateEnum
CREATE TYPE "PastoralAlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PastoralAlertSource" AS ENUM ('ATTENDANCE', 'SCHEDULE', 'JOURNEY', 'MANUAL', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "PastoralNoteVisibility" AS ENUM ('LEADERS_ONLY');

-- CreateEnum
CREATE TYPE "PastoralFollowUpStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "PastoralVisit"
ADD COLUMN     "assignedToUserId" TEXT,
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "priority" "PastoralPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "reasonType" "PastoralReasonType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "PastoralAlert"
ADD COLUMN     "alertType" TEXT NOT NULL DEFAULT 'GENERIC',
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "severity" "PastoralAlertSeverity" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "source" "PastoralAlertSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceRefId" TEXT;

-- CreateTable
CREATE TABLE "PastoralNote" (
    "id" TEXT NOT NULL,
    "pastoralVisitId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "visibility" "PastoralNoteVisibility" NOT NULL DEFAULT 'LEADERS_ONLY',
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "PastoralNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastoralFollowUp" (
    "id" TEXT NOT NULL,
    "pastoralVisitId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "PastoralFollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "PastoralFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PastoralVisit_priority_idx" ON "PastoralVisit"("priority");
CREATE INDEX "PastoralVisit_reasonType_idx" ON "PastoralVisit"("reasonType");
CREATE INDEX "PastoralVisit_assignedToUserId_idx" ON "PastoralVisit"("assignedToUserId");
CREATE INDEX "PastoralVisit_nextFollowUpAt_idx" ON "PastoralVisit"("nextFollowUpAt");

CREATE INDEX "PastoralAlert_severity_idx" ON "PastoralAlert"("severity");
CREATE INDEX "PastoralAlert_source_idx" ON "PastoralAlert"("source");
CREATE INDEX "PastoralAlert_createdAt_idx" ON "PastoralAlert"("createdAt");
CREATE INDEX "PastoralAlert_dedupeKey_idx" ON "PastoralAlert"("dedupeKey");

CREATE INDEX "PastoralNote_pastoralVisitId_createdAt_idx" ON "PastoralNote"("pastoralVisitId", "createdAt");
CREATE INDEX "PastoralNote_churchId_idx" ON "PastoralNote"("churchId");
CREATE INDEX "PastoralNote_authorUserId_idx" ON "PastoralNote"("authorUserId");
CREATE INDEX "PastoralNote_deletedAt_idx" ON "PastoralNote"("deletedAt");

CREATE INDEX "PastoralFollowUp_pastoralVisitId_scheduledAt_idx" ON "PastoralFollowUp"("pastoralVisitId", "scheduledAt");
CREATE INDEX "PastoralFollowUp_status_scheduledAt_idx" ON "PastoralFollowUp"("status", "scheduledAt");
CREATE INDEX "PastoralFollowUp_churchId_idx" ON "PastoralFollowUp"("churchId");
CREATE INDEX "PastoralFollowUp_createdByUserId_idx" ON "PastoralFollowUp"("createdByUserId");
CREATE INDEX "PastoralFollowUp_completedByUserId_idx" ON "PastoralFollowUp"("completedByUserId");
CREATE INDEX "PastoralFollowUp_deletedAt_idx" ON "PastoralFollowUp"("deletedAt");

-- AddForeignKey
ALTER TABLE "PastoralVisit" ADD CONSTRAINT "PastoralVisit_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralNote" ADD CONSTRAINT "PastoralNote_pastoralVisitId_fkey" FOREIGN KEY ("pastoralVisitId") REFERENCES "PastoralVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PastoralNote" ADD CONSTRAINT "PastoralNote_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PastoralNote" ADD CONSTRAINT "PastoralNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralFollowUp" ADD CONSTRAINT "PastoralFollowUp_pastoralVisitId_fkey" FOREIGN KEY ("pastoralVisitId") REFERENCES "PastoralVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PastoralFollowUp" ADD CONSTRAINT "PastoralFollowUp_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PastoralFollowUp" ADD CONSTRAINT "PastoralFollowUp_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PastoralFollowUp" ADD CONSTRAINT "PastoralFollowUp_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

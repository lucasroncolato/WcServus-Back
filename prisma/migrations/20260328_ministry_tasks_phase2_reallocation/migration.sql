-- Ministry tasks phase 2: reassignment and smart reallocation

CREATE TYPE "MinistryTaskReallocationMode" AS ENUM (
  'MANUAL',
  'AUTO_EQUAL_DISTRIBUTION',
  'AUTO_BEST_MATCH',
  'UNASSIGN'
);

CREATE TYPE "MinistryTaskReallocationStatus" AS ENUM (
  'NONE',
  'PENDING_REALLOCATION',
  'REASSIGNED',
  'UNASSIGNED',
  'CANCELLED'
);

CREATE TYPE "MinistryTaskAssignmentChangeType" AS ENUM (
  'ASSIGN',
  'REASSIGN_MANUAL',
  'REASSIGN_AUTO',
  'UNASSIGN'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_REASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_REALLOCATION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_REALLOCATED_AUTOMATICALLY';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_REALLOCATED_MANUALLY';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_UNASSIGNED_AFTER_SCALE_CHANGE';

ALTER TABLE "MinistryTaskTemplate"
  ADD COLUMN "reallocationMode" "MinistryTaskReallocationMode" NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "MinistryTaskOccurrence"
  ADD COLUMN "originAssignedServantId" TEXT,
  ADD COLUMN "reallocationMode" "MinistryTaskReallocationMode",
  ADD COLUMN "reallocationStatus" "MinistryTaskReallocationStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "lastReassignedAt" TIMESTAMP(3),
  ADD COLUMN "lastReassignedBy" TEXT;

UPDATE "MinistryTaskOccurrence"
SET "originAssignedServantId" = "assignedServantId"
WHERE "assignedServantId" IS NOT NULL AND "originAssignedServantId" IS NULL;

CREATE TABLE "MinistryTaskOccurrenceAssignmentHistory" (
  "id" TEXT NOT NULL,
  "occurrenceId" TEXT NOT NULL,
  "fromServantId" TEXT,
  "toServantId" TEXT,
  "changedBy" TEXT,
  "changeType" "MinistryTaskAssignmentChangeType" NOT NULL,
  "preserveProgress" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MinistryTaskOccurrenceAssignmentHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MinistryTaskOccurrence"
  ADD CONSTRAINT "MinistryTaskOccurrence_originAssignedServantId_fkey"
  FOREIGN KEY ("originAssignedServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrence"
  ADD CONSTRAINT "MinistryTaskOccurrence_lastReassignedBy_fkey"
  FOREIGN KEY ("lastReassignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrenceAssignmentHistory"
  ADD CONSTRAINT "MinistryTaskOccurrenceAssignmentHistory_occurrenceId_fkey"
  FOREIGN KEY ("occurrenceId") REFERENCES "MinistryTaskOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrenceAssignmentHistory"
  ADD CONSTRAINT "MinistryTaskOccurrenceAssignmentHistory_fromServantId_fkey"
  FOREIGN KEY ("fromServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrenceAssignmentHistory"
  ADD CONSTRAINT "MinistryTaskOccurrenceAssignmentHistory_toServantId_fkey"
  FOREIGN KEY ("toServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrenceAssignmentHistory"
  ADD CONSTRAINT "MinistryTaskOccurrenceAssignmentHistory_changedBy_fkey"
  FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MinistryTaskOccurrence_reallocationStatus_scheduledFor_idx"
  ON "MinistryTaskOccurrence"("reallocationStatus", "scheduledFor");

CREATE INDEX "MinistryTaskOccurrence_originAssignedServantId_idx"
  ON "MinistryTaskOccurrence"("originAssignedServantId");

CREATE INDEX "MinistryTaskOccurrence_lastReassignedBy_idx"
  ON "MinistryTaskOccurrence"("lastReassignedBy");

CREATE INDEX "MinistryTaskOccurrenceAssignmentHistory_occurrenceId_createdAt_idx"
  ON "MinistryTaskOccurrenceAssignmentHistory"("occurrenceId", "createdAt");

CREATE INDEX "MinistryTaskOccurrenceAssignmentHistory_fromServantId_idx"
  ON "MinistryTaskOccurrenceAssignmentHistory"("fromServantId");

CREATE INDEX "MinistryTaskOccurrenceAssignmentHistory_toServantId_idx"
  ON "MinistryTaskOccurrenceAssignmentHistory"("toServantId");

CREATE INDEX "MinistryTaskOccurrenceAssignmentHistory_changedBy_idx"
  ON "MinistryTaskOccurrenceAssignmentHistory"("changedBy");

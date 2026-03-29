-- Ministry tasks phase 3: operational maturity

CREATE TYPE "MinistryTaskAssigneeRole" AS ENUM ('PRIMARY', 'SUPPORT', 'REVIEWER');
CREATE TYPE "MinistryTaskOccurrencePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "MinistryTaskOccurrenceCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_ASSIGNEE_ADDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_ASSIGNEE_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_OVERDUE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_RECURRING_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_DUE_SOON';

ALTER TABLE "MinistryTaskOccurrence"
  ADD COLUMN "dueAt" TIMESTAMP(3),
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "slaMinutes" INTEGER,
  ADD COLUMN "priority" "MinistryTaskOccurrencePriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "criticality" "MinistryTaskOccurrenceCriticality" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "lastProgressAt" TIMESTAMP(3);

CREATE TABLE "MinistryTaskOccurrenceAssignee" (
  "id" TEXT NOT NULL,
  "occurrenceId" TEXT NOT NULL,
  "servantId" TEXT NOT NULL,
  "role" "MinistryTaskAssigneeRole" NOT NULL DEFAULT 'SUPPORT',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "removedAt" TIMESTAMP(3),
  "removedBy" TEXT,
  CONSTRAINT "MinistryTaskOccurrenceAssignee_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MinistryTaskOccurrenceAssignee"
  ADD CONSTRAINT "MinistryTaskOccurrenceAssignee_occurrenceId_fkey"
  FOREIGN KEY ("occurrenceId") REFERENCES "MinistryTaskOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrenceAssignee"
  ADD CONSTRAINT "MinistryTaskOccurrenceAssignee_servantId_fkey"
  FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrenceAssignee"
  ADD CONSTRAINT "MinistryTaskOccurrenceAssignee_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MinistryTaskOccurrenceAssignee_occurrenceId_servantId_role_key"
  ON "MinistryTaskOccurrenceAssignee"("occurrenceId", "servantId", "role");

CREATE INDEX "MinistryTaskOccurrence_dueAt_status_idx" ON "MinistryTaskOccurrence"("dueAt", "status");
CREATE INDEX "MinistryTaskOccurrence_priority_criticality_status_idx"
  ON "MinistryTaskOccurrence"("priority", "criticality", "status");
CREATE INDEX "MinistryTaskOccurrenceAssignee_occurrenceId_active_role_idx"
  ON "MinistryTaskOccurrenceAssignee"("occurrenceId", "active", "role");
CREATE INDEX "MinistryTaskOccurrenceAssignee_servantId_active_idx"
  ON "MinistryTaskOccurrenceAssignee"("servantId", "active");
CREATE INDEX "MinistryTaskOccurrenceAssignee_removedAt_idx"
  ON "MinistryTaskOccurrenceAssignee"("removedAt");

-- Backfill primary assignee from legacy occurrence.assignedServantId
INSERT INTO "MinistryTaskOccurrenceAssignee" ("id", "occurrenceId", "servantId", "role", "active", "createdAt")
SELECT ('mta-primary-' || o."id"), o."id", o."assignedServantId", 'PRIMARY', true, CURRENT_TIMESTAMP
FROM "MinistryTaskOccurrence" o
WHERE o."assignedServantId" IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM "MinistryTaskOccurrenceAssignee" a
  WHERE a."occurrenceId" = o."id"
    AND a."servantId" = o."assignedServantId"
    AND a."role" = 'PRIMARY'
);

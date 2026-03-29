-- Ministry tasks module

CREATE TYPE "MinistryTaskRecurrenceType" AS ENUM (
  'EVERY_SERVICE',
  'WEEKLY',
  'MONTHLY',
  'FIRST_SERVICE_OF_MONTH',
  'LAST_SERVICE_OF_MONTH',
  'CUSTOM',
  'MANUAL'
);

CREATE TYPE "MinistryTaskAssigneeMode" AS ENUM ('OPTIONAL', 'REQUIRED');

CREATE TYPE "MinistryTaskOccurrenceStatus" AS ENUM (
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'CANCELLED'
);

CREATE TYPE "MinistryTaskChecklistItemStatus" AS ENUM (
  'PENDING',
  'DONE',
  'NOT_APPLICABLE'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_TEMPLATE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_TEMPLATE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_OCCURRENCE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_PROGRESS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MINISTRY_TASK_CANCELLED';

CREATE TABLE "MinistryTaskTemplate" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "ministryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "recurrenceType" "MinistryTaskRecurrenceType" NOT NULL DEFAULT 'MANUAL',
  "recurrenceConfig" JSONB,
  "linkedToServiceType" "WorshipServiceType",
  "active" BOOLEAN NOT NULL DEFAULT true,
  "assigneeMode" "MinistryTaskAssigneeMode" NOT NULL DEFAULT 'OPTIONAL',
  "maxAssignmentsPerServantPerMonth" INTEGER,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedBy" TEXT,
  CONSTRAINT "MinistryTaskTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MinistryTaskTemplateChecklistItem" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 1,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MinistryTaskTemplateChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MinistryTaskOccurrence" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "templateId" TEXT NOT NULL,
  "ministryId" TEXT NOT NULL,
  "serviceId" TEXT,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "assignedServantId" TEXT,
  "status" "MinistryTaskOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedBy" TEXT,
  CONSTRAINT "MinistryTaskOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MinistryTaskOccurrenceChecklistItem" (
  "id" TEXT NOT NULL,
  "occurrenceId" TEXT NOT NULL,
  "templateChecklistItemId" TEXT,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 1,
  "status" "MinistryTaskChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
  "checkedAt" TIMESTAMP(3),
  "checkedBy" TEXT,
  "notes" TEXT,
  CONSTRAINT "MinistryTaskOccurrenceChecklistItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MinistryTaskTemplate"
  ADD CONSTRAINT "MinistryTaskTemplate_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskTemplate"
  ADD CONSTRAINT "MinistryTaskTemplate_ministryId_fkey"
  FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskTemplate"
  ADD CONSTRAINT "MinistryTaskTemplate_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskTemplateChecklistItem"
  ADD CONSTRAINT "MinistryTaskTemplateChecklistItem_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "MinistryTaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrence"
  ADD CONSTRAINT "MinistryTaskOccurrence_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrence"
  ADD CONSTRAINT "MinistryTaskOccurrence_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "MinistryTaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrence"
  ADD CONSTRAINT "MinistryTaskOccurrence_ministryId_fkey"
  FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrence"
  ADD CONSTRAINT "MinistryTaskOccurrence_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrence"
  ADD CONSTRAINT "MinistryTaskOccurrence_assignedServantId_fkey"
  FOREIGN KEY ("assignedServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrence"
  ADD CONSTRAINT "MinistryTaskOccurrence_completedBy_fkey"
  FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrenceChecklistItem"
  ADD CONSTRAINT "MinistryTaskOccurrenceChecklistItem_occurrenceId_fkey"
  FOREIGN KEY ("occurrenceId") REFERENCES "MinistryTaskOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrenceChecklistItem"
  ADD CONSTRAINT "MinistryTaskOccurrenceChecklistItem_templateChecklistItemId_fkey"
  FOREIGN KEY ("templateChecklistItemId") REFERENCES "MinistryTaskTemplateChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrenceChecklistItem"
  ADD CONSTRAINT "MinistryTaskOccurrenceChecklistItem_checkedBy_fkey"
  FOREIGN KEY ("checkedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MinistryTaskTemplate_churchId_idx" ON "MinistryTaskTemplate"("churchId");
CREATE INDEX "MinistryTaskTemplate_ministryId_active_idx" ON "MinistryTaskTemplate"("ministryId", "active");
CREATE INDEX "MinistryTaskTemplate_recurrenceType_active_idx" ON "MinistryTaskTemplate"("recurrenceType", "active");
CREATE INDEX "MinistryTaskTemplate_deletedAt_idx" ON "MinistryTaskTemplate"("deletedAt");

CREATE INDEX "MinistryTaskTemplateChecklistItem_templateId_position_idx"
  ON "MinistryTaskTemplateChecklistItem"("templateId", "position");

CREATE INDEX "MinistryTaskOccurrence_churchId_idx" ON "MinistryTaskOccurrence"("churchId");
CREATE INDEX "MinistryTaskOccurrence_templateId_scheduledFor_idx" ON "MinistryTaskOccurrence"("templateId", "scheduledFor");
CREATE INDEX "MinistryTaskOccurrence_ministryId_status_scheduledFor_idx" ON "MinistryTaskOccurrence"("ministryId", "status", "scheduledFor");
CREATE INDEX "MinistryTaskOccurrence_serviceId_idx" ON "MinistryTaskOccurrence"("serviceId");
CREATE INDEX "MinistryTaskOccurrence_assignedServantId_scheduledFor_idx" ON "MinistryTaskOccurrence"("assignedServantId", "scheduledFor");
CREATE INDEX "MinistryTaskOccurrence_deletedAt_idx" ON "MinistryTaskOccurrence"("deletedAt");

CREATE INDEX "MinistryTaskOccurrenceChecklistItem_occurrenceId_position_idx"
  ON "MinistryTaskOccurrenceChecklistItem"("occurrenceId", "position");
CREATE INDEX "MinistryTaskOccurrenceChecklistItem_templateChecklistItemId_idx"
  ON "MinistryTaskOccurrenceChecklistItem"("templateChecklistItemId");

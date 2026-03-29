-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('TIME', 'EVENT', 'CONDITION');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM (
  'TASK_MARK_OVERDUE',
  'TASK_NOTIFY_DUE_SOON',
  'TASK_NOTIFY_COORDINATOR_OVERDUE',
  'TASK_ALERT_UNASSIGNED',
  'SCHEDULE_ALERT_INCOMPLETE',
  'SCHEDULE_ALERT_UNCONFIRMED',
  'SCHEDULE_FOLLOWUP_DECLINED',
  'TRAINING_ALERT_PENDING',
  'TRACK_ALERT_STALLED',
  'TRACK_MARK_STAGNATED',
  'JOURNEY_REGISTER_EVENT'
);

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "churchId" TEXT;

-- CreateTable
CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "triggerType" "AutomationTriggerType" NOT NULL,
  "triggerConfig" JSONB,
  "actionType" "AutomationActionType" NOT NULL,
  "actionConfig" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_churchId_createdAt_idx" ON "AuditLog"("churchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRule_churchId_name_key" ON "AutomationRule"("churchId", "name");

-- CreateIndex
CREATE INDEX "AutomationRule_churchId_enabled_idx" ON "AutomationRule"("churchId", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRule_triggerType_enabled_idx" ON "AutomationRule"("triggerType", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRule_actionType_enabled_idx" ON "AutomationRule"("actionType", "enabled");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

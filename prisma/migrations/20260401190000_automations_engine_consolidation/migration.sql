-- CreateEnum
CREATE TYPE "AutomationRuleSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AutomationDedupeStrategy" AS ENUM ('BY_EVENT', 'BY_ENTITY_WINDOW', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('SUCCESS', 'SKIPPED', 'FAILED', 'PARTIAL_SUCCESS');

-- CreateEnum
CREATE TYPE "AutomationExecutionSkipReason" AS ENUM ('DEDUPE', 'COOLDOWN', 'RULE_DISABLED', 'CONDITION_FALSE', 'OUT_OF_SCOPE', 'MODULE_DISABLED');

-- CreateEnum
CREATE TYPE "AutomationSourceModule" AS ENUM ('ATTENDANCE', 'SCHEDULE', 'JOURNEY', 'PASTORAL', 'TASK', 'ANALYTICS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AutomationCheckpointStatus" AS ENUM ('OK', 'WARNING', 'ERROR');

-- AlterEnum
ALTER TYPE "AutomationTriggerType" ADD VALUE IF NOT EXISTS 'THRESHOLD';

-- AlterTable AutomationRule
ALTER TABLE "AutomationRule"
  ADD COLUMN "triggerKey" TEXT NOT NULL DEFAULT 'daily',
  ADD COLUMN "conditionConfig" JSONB,
  ADD COLUMN "cooldownMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dedupeStrategy" "AutomationDedupeStrategy" NOT NULL DEFAULT 'BY_EVENT',
  ADD COLUMN "severity" "AutomationRuleSeverity" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "updatedBy" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "AutomationRule"
  ALTER COLUMN "actionType" DROP NOT NULL;

-- AlterTable AutomationExecutionLog
ALTER TABLE "AutomationExecutionLog"
  ADD COLUMN "triggerType" "AutomationTriggerType",
  ADD COLUMN "triggerKey" TEXT,
  ADD COLUMN "sourceModule" "AutomationSourceModule" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "sourceRefId" TEXT,
  ADD COLUMN "skipReason" "AutomationExecutionSkipReason",
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "details" JSONB,
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- status convert string -> enum
ALTER TABLE "AutomationExecutionLog"
  ALTER COLUMN "status" TYPE "AutomationExecutionStatus"
  USING (
    CASE
      WHEN "status" = 'SUCCESS' THEN 'SUCCESS'::"AutomationExecutionStatus"
      WHEN "status" = 'FAILED' THEN 'FAILED'::"AutomationExecutionStatus"
      WHEN "status" = 'SKIPPED' THEN 'SKIPPED'::"AutomationExecutionStatus"
      WHEN "status" = 'PARTIAL_SUCCESS' THEN 'PARTIAL_SUCCESS'::"AutomationExecutionStatus"
      ELSE 'FAILED'::"AutomationExecutionStatus"
    END
  );

-- CreateTable AutomationCheckpoint
CREATE TABLE "AutomationCheckpoint" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "schedulerName" TEXT NOT NULL,
  "lastProcessedAt" TIMESTAMP(3),
  "lastProcessedCursor" TEXT,
  "status" "AutomationCheckpointStatus" NOT NULL DEFAULT 'OK',
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationCheckpoint_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "AutomationCheckpoint_churchId_schedulerName_key" ON "AutomationCheckpoint"("churchId", "schedulerName");
CREATE INDEX "AutomationCheckpoint_schedulerName_status_updatedAt_idx" ON "AutomationCheckpoint"("schedulerName", "status", "updatedAt");
CREATE INDEX "AutomationCheckpoint_churchId_status_idx" ON "AutomationCheckpoint"("churchId", "status");

CREATE INDEX "AutomationRule_churchId_triggerType_triggerKey_enabled_idx" ON "AutomationRule"("churchId", "triggerType", "triggerKey", "enabled");
CREATE INDEX "AutomationRule_churchId_deletedAt_idx" ON "AutomationRule"("churchId", "deletedAt");
CREATE INDEX "AutomationExecutionLog_churchId_status_executedAt_idx" ON "AutomationExecutionLog"("churchId", "status", "executedAt");
CREATE INDEX "AutomationExecutionLog_churchId_sourceModule_executedAt_idx" ON "AutomationExecutionLog"("churchId", "sourceModule", "executedAt");

-- FKs
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationCheckpoint" ADD CONSTRAINT "AutomationCheckpoint_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

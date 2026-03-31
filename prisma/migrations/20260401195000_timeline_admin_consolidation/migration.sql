-- CreateEnum
CREATE TYPE "TimelineCategory" AS ENUM ('SCHEDULE', 'ATTENDANCE', 'JOURNEY', 'PASTORAL', 'AUTOMATION', 'TRAINING', 'TASK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TimelineSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TimelineActorType" AS ENUM ('USER', 'SYSTEM', 'AUTOMATION');

-- AlterTable
ALTER TABLE "TimelineEntry"
  ADD COLUMN "actorType" "TimelineActorType" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "actorName" TEXT,
  ADD COLUMN "category" "TimelineCategory" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'TIMELINE_SYSTEM_EVENT',
  ADD COLUMN "severity" "TimelineSeverity" NOT NULL DEFAULT 'INFO',
  ADD COLUMN "message" TEXT,
  ADD COLUMN "subjectType" TEXT,
  ADD COLUMN "subjectId" TEXT,
  ADD COLUMN "relatedEntityType" TEXT,
  ADD COLUMN "relatedEntityId" TEXT,
  ADD COLUMN "dedupeKey" TEXT;

-- Indexes
CREATE INDEX "TimelineEntry_churchId_category_occurredAt_idx" ON "TimelineEntry"("churchId", "category", "occurredAt");
CREATE INDEX "TimelineEntry_churchId_severity_occurredAt_idx" ON "TimelineEntry"("churchId", "severity", "occurredAt");
CREATE INDEX "TimelineEntry_churchId_eventType_occurredAt_idx" ON "TimelineEntry"("churchId", "eventType", "occurredAt");
CREATE INDEX "TimelineEntry_churchId_subjectType_subjectId_occurredAt_idx" ON "TimelineEntry"("churchId", "subjectType", "subjectId", "occurredAt");
CREATE INDEX "TimelineEntry_churchId_dedupeKey_idx" ON "TimelineEntry"("churchId", "dedupeKey");

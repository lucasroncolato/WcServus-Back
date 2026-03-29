CREATE TYPE "JourneyLogType" AS ENUM (
  'SERVICE',
  'TASK',
  'CHECKLIST',
  'TRAINING',
  'TRACK',
  'EVENT',
  'SUBSTITUTE',
  'HELP',
  'MILESTONE'
);

CREATE TABLE "ServantJourney" (
  "id" TEXT NOT NULL,
  "servantId" TEXT NOT NULL,
  "churchId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "totalServices" INTEGER NOT NULL DEFAULT 0,
  "totalTasksCompleted" INTEGER NOT NULL DEFAULT 0,
  "totalTrainingsCompleted" INTEGER NOT NULL DEFAULT 0,
  "totalEventsServed" INTEGER NOT NULL DEFAULT 0,
  "monthsServing" INTEGER NOT NULL DEFAULT 0,
  "lastActivityAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServantJourney_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JourneyMilestone" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "category" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JourneyMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServantMilestone" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "servantId" TEXT NOT NULL,
  "milestoneId" TEXT NOT NULL,
  "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServantMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JourneyLog" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "servantId" TEXT NOT NULL,
  "type" "JourneyLogType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "referenceId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JourneyLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServantJourney_servantId_key" ON "ServantJourney"("servantId");
CREATE INDEX "ServantJourney_churchId_idx" ON "ServantJourney"("churchId");
CREATE INDEX "ServantJourney_startedAt_idx" ON "ServantJourney"("startedAt");

CREATE UNIQUE INDEX "JourneyMilestone_code_key" ON "JourneyMilestone"("code");
CREATE INDEX "JourneyMilestone_churchId_category_idx" ON "JourneyMilestone"("churchId", "category");

CREATE UNIQUE INDEX "ServantMilestone_servantId_milestoneId_key" ON "ServantMilestone"("servantId", "milestoneId");
CREATE INDEX "ServantMilestone_churchId_achievedAt_idx" ON "ServantMilestone"("churchId", "achievedAt");
CREATE INDEX "ServantMilestone_servantId_achievedAt_idx" ON "ServantMilestone"("servantId", "achievedAt");

CREATE INDEX "JourneyLog_churchId_occurredAt_idx" ON "JourneyLog"("churchId", "occurredAt");
CREATE INDEX "JourneyLog_servantId_occurredAt_idx" ON "JourneyLog"("servantId", "occurredAt");
CREATE INDEX "JourneyLog_type_occurredAt_idx" ON "JourneyLog"("type", "occurredAt");
CREATE INDEX "JourneyLog_referenceId_idx" ON "JourneyLog"("referenceId");

ALTER TABLE "ServantJourney"
  ADD CONSTRAINT "ServantJourney_servantId_fkey"
  FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantJourney"
  ADD CONSTRAINT "ServantJourney_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JourneyMilestone"
  ADD CONSTRAINT "JourneyMilestone_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServantMilestone"
  ADD CONSTRAINT "ServantMilestone_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServantMilestone"
  ADD CONSTRAINT "ServantMilestone_servantId_fkey"
  FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantMilestone"
  ADD CONSTRAINT "ServantMilestone_milestoneId_fkey"
  FOREIGN KEY ("milestoneId") REFERENCES "JourneyMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JourneyLog"
  ADD CONSTRAINT "JourneyLog_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JourneyLog"
  ADD CONSTRAINT "JourneyLog_servantId_fkey"
  FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

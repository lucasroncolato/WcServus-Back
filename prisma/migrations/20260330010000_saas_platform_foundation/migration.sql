-- CreateEnum
CREATE TYPE "ChurchModuleKey" AS ENUM ('ANALYTICS', 'AUTOMATIONS', 'TIMELINE', 'REPORTS', 'NOTIFICATIONS', 'TASKS', 'SCHEDULES', 'JOURNEY');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "TimelineScope" AS ENUM ('CHURCH', 'MINISTRY', 'SERVANT');

-- CreateEnum
CREATE TYPE "TimelineEntryType" AS ENUM (
  'SERVICE_COMPLETED',
  'TASK_COMPLETED',
  'TRAINING_COMPLETED',
  'TRACK_PROGRESS',
  'SCHEDULE_PUBLISHED',
  'TASK_OVERDUE',
  'AUTOMATION_TRIGGERED',
  'CHURCH_MILESTONE',
  'MINISTRY_EVENT',
  'PASTORAL_ALERT',
  'GENERIC_EVENT'
);

-- CreateTable
CREATE TABLE "ChurchSettings" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "locale" TEXT NOT NULL DEFAULT 'pt-BR',
  "operationalWeekStartsOn" INTEGER NOT NULL DEFAULT 1,
  "defaultJourneyEnabled" BOOLEAN NOT NULL DEFAULT true,
  "requireScheduleConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChurchSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchBranding" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "logoUrl" TEXT,
  "primaryColor" TEXT DEFAULT '#1D4ED8',
  "secondaryColor" TEXT DEFAULT '#0F172A',
  "accentColor" TEXT DEFAULT '#16A34A',
  "welcomeMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChurchBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchModule" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "moduleKey" "ChurchModuleKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChurchModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchAutomationPreference" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "overdueGraceDays" INTEGER NOT NULL DEFAULT 0,
  "stalledTrackDays" INTEGER NOT NULL DEFAULT 30,
  "noServiceAlertDays" INTEGER NOT NULL DEFAULT 45,
  "incompleteScheduleWindowHrs" INTEGER NOT NULL DEFAULT 48,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChurchAutomationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEntry" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "ministryId" TEXT,
  "servantId" TEXT,
  "actorUserId" TEXT,
  "scope" "TimelineScope" NOT NULL,
  "type" "TimelineEntryType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "link" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecutionLog" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "interval" "PlanInterval" NOT NULL DEFAULT 'MONTHLY',
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "maxServants" INTEGER,
  "maxUsers" INTEGER,
  "maxMinistries" INTEGER,
  "modules" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "trialEndsAt" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchPlan" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "limitsSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChurchPlan_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ChurchSettings_churchId_key" ON "ChurchSettings"("churchId");
CREATE INDEX "ChurchSettings_churchId_idx" ON "ChurchSettings"("churchId");
CREATE UNIQUE INDEX "ChurchBranding_churchId_key" ON "ChurchBranding"("churchId");
CREATE INDEX "ChurchBranding_churchId_idx" ON "ChurchBranding"("churchId");
CREATE UNIQUE INDEX "ChurchModule_churchId_moduleKey_key" ON "ChurchModule"("churchId", "moduleKey");
CREATE INDEX "ChurchModule_churchId_enabled_idx" ON "ChurchModule"("churchId", "enabled");
CREATE UNIQUE INDEX "ChurchAutomationPreference_churchId_key" ON "ChurchAutomationPreference"("churchId");
CREATE INDEX "ChurchAutomationPreference_churchId_idx" ON "ChurchAutomationPreference"("churchId");
CREATE INDEX "TimelineEntry_churchId_occurredAt_idx" ON "TimelineEntry"("churchId", "occurredAt");
CREATE INDEX "TimelineEntry_scope_occurredAt_idx" ON "TimelineEntry"("scope", "occurredAt");
CREATE INDEX "TimelineEntry_ministryId_occurredAt_idx" ON "TimelineEntry"("ministryId", "occurredAt");
CREATE INDEX "TimelineEntry_servantId_occurredAt_idx" ON "TimelineEntry"("servantId", "occurredAt");
CREATE UNIQUE INDEX "AutomationExecutionLog_churchId_dedupeKey_key" ON "AutomationExecutionLog"("churchId", "dedupeKey");
CREATE INDEX "AutomationExecutionLog_churchId_createdAt_idx" ON "AutomationExecutionLog"("churchId", "createdAt");
CREATE INDEX "AutomationExecutionLog_ruleId_createdAt_idx" ON "AutomationExecutionLog"("ruleId", "createdAt");
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");
CREATE INDEX "Plan_active_idx" ON "Plan"("active");
CREATE INDEX "Subscription_churchId_status_idx" ON "Subscription"("churchId", "status");
CREATE INDEX "Subscription_planId_status_idx" ON "Subscription"("planId", "status");
CREATE UNIQUE INDEX "ChurchPlan_churchId_key" ON "ChurchPlan"("churchId");
CREATE INDEX "ChurchPlan_planId_status_idx" ON "ChurchPlan"("planId", "status");

-- Foreign keys
ALTER TABLE "ChurchSettings" ADD CONSTRAINT "ChurchSettings_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChurchBranding" ADD CONSTRAINT "ChurchBranding_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChurchModule" ADD CONSTRAINT "ChurchModule_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChurchAutomationPreference" ADD CONSTRAINT "ChurchAutomationPreference_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChurchPlan" ADD CONSTRAINT "ChurchPlan_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChurchPlan" ADD CONSTRAINT "ChurchPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
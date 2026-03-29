-- Phase 4: Gamification + Growth Tracks + Advanced Analytics foundations

CREATE TYPE "GamificationActionType" AS ENUM (
  'ATTENDANCE_CONFIRMED',
  'TASK_COMPLETED',
  'CHECKLIST_PERFECT',
  'TASK_BEFORE_DUE',
  'WORSHIP_SERVICE_PARTICIPATION',
  'TRAINING_COMPLETED',
  'HELPED_OTHER_TEAM',
  'EXTRA_TASK_ASSUMED',
  'MONTH_WITHOUT_ABSENCE',
  'TEAM_LEADERSHIP',
  'SPECIAL_EVENT',
  'MANUAL'
);

CREATE TYPE "AchievementType" AS ENUM (
  'TASKS_COMPLETED',
  'ATTENDANCE_STREAK',
  'MINISTRY_TIME',
  'TRAINING_COMPLETED',
  'LEADERSHIP',
  'CROSS_TEAM_HELP',
  'CRITICAL_TASK_COMPLETED',
  'NO_DELAY_STREAK',
  'CHECKLIST_PERFECT',
  'SPECIAL_EVENT',
  'MULTI_MINISTRY',
  'MANUAL'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GAMIFICATION_POINTS_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GAMIFICATION_LEVEL_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GAMIFICATION_ACHIEVEMENT_UNLOCKED';

CREATE TABLE "ServantLevelDefinition" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "name" TEXT NOT NULL,
  "threshold" INTEGER NOT NULL,
  "levelOrder" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServantLevelDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PointRule" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "actionType" "GamificationActionType" NOT NULL,
  "points" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PointRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServantPointLog" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "servantId" TEXT NOT NULL,
  "ministryId" TEXT,
  "actionType" "GamificationActionType" NOT NULL,
  "points" INTEGER NOT NULL,
  "referenceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServantPointLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServantGamificationProfile" (
  "servantId" TEXT NOT NULL,
  "churchId" TEXT,
  "totalPoints" INTEGER NOT NULL DEFAULT 0,
  "currentLevel" TEXT,
  "currentLevelOrder" INTEGER NOT NULL DEFAULT 0,
  "achievementsUnlocked" INTEGER NOT NULL DEFAULT 0,
  "attendanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rankingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServantGamificationProfile_pkey" PRIMARY KEY ("servantId")
);

CREATE TABLE "Achievement" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "type" "AchievementType" NOT NULL,
  "pointsBonus" INTEGER NOT NULL DEFAULT 0,
  "criteria" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServantAchievement" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "servantId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "progressValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unlockedBy" TEXT,
  "metadata" JSONB,
  CONSTRAINT "ServantAchievement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GrowthTrack" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "ministryId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthTrack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GrowthTrackStep" (
  "id" TEXT NOT NULL,
  "growthTrackId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "stepOrder" INTEGER NOT NULL,
  "criteria" JSONB,
  "manualReview" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthTrackStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServantGrowthProgress" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "servantId" TEXT NOT NULL,
  "growthTrackId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "progressValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "verifiedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServantGrowthProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServantRankingSnapshot" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "ministryId" TEXT,
  "servantId" TEXT NOT NULL,
  "referenceMonth" TIMESTAMP(3) NOT NULL,
  "totalPoints" INTEGER NOT NULL,
  "positionChurch" INTEGER,
  "positionMinistry" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServantRankingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServantMonthlyStats" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "ministryId" TEXT,
  "servantId" TEXT NOT NULL,
  "referenceMonth" TIMESTAMP(3) NOT NULL,
  "attendanceConfirmed" INTEGER NOT NULL DEFAULT 0,
  "absences" INTEGER NOT NULL DEFAULT 0,
  "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
  "tasksOverdue" INTEGER NOT NULL DEFAULT 0,
  "checklistPerfect" INTEGER NOT NULL DEFAULT 0,
  "pointsEarned" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServantMonthlyStats_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ServantLevelDefinition"
  ADD CONSTRAINT "ServantLevelDefinition_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PointRule"
  ADD CONSTRAINT "PointRule_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServantPointLog"
  ADD CONSTRAINT "ServantPointLog_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServantPointLog"
  ADD CONSTRAINT "ServantPointLog_servantId_fkey"
  FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantPointLog"
  ADD CONSTRAINT "ServantPointLog_ministryId_fkey"
  FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServantGamificationProfile"
  ADD CONSTRAINT "ServantGamificationProfile_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServantGamificationProfile"
  ADD CONSTRAINT "ServantGamificationProfile_servantId_fkey"
  FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Achievement"
  ADD CONSTRAINT "Achievement_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Achievement"
  ADD CONSTRAINT "Achievement_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServantAchievement"
  ADD CONSTRAINT "ServantAchievement_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServantAchievement"
  ADD CONSTRAINT "ServantAchievement_servantId_fkey"
  FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantAchievement"
  ADD CONSTRAINT "ServantAchievement_achievementId_fkey"
  FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantAchievement"
  ADD CONSTRAINT "ServantAchievement_unlockedBy_fkey"
  FOREIGN KEY ("unlockedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GrowthTrack"
  ADD CONSTRAINT "GrowthTrack_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrowthTrack"
  ADD CONSTRAINT "GrowthTrack_ministryId_fkey"
  FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrowthTrack"
  ADD CONSTRAINT "GrowthTrack_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GrowthTrackStep"
  ADD CONSTRAINT "GrowthTrackStep_growthTrackId_fkey"
  FOREIGN KEY ("growthTrackId") REFERENCES "GrowthTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthTrackStep"
  ADD CONSTRAINT "GrowthTrackStep_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServantGrowthProgress"
  ADD CONSTRAINT "ServantGrowthProgress_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServantGrowthProgress"
  ADD CONSTRAINT "ServantGrowthProgress_servantId_fkey"
  FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantGrowthProgress"
  ADD CONSTRAINT "ServantGrowthProgress_growthTrackId_fkey"
  FOREIGN KEY ("growthTrackId") REFERENCES "GrowthTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantGrowthProgress"
  ADD CONSTRAINT "ServantGrowthProgress_stepId_fkey"
  FOREIGN KEY ("stepId") REFERENCES "GrowthTrackStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantGrowthProgress"
  ADD CONSTRAINT "ServantGrowthProgress_verifiedBy_fkey"
  FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServantRankingSnapshot"
  ADD CONSTRAINT "ServantRankingSnapshot_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServantRankingSnapshot"
  ADD CONSTRAINT "ServantRankingSnapshot_ministryId_fkey"
  FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServantRankingSnapshot"
  ADD CONSTRAINT "ServantRankingSnapshot_servantId_fkey"
  FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServantMonthlyStats"
  ADD CONSTRAINT "ServantMonthlyStats_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServantMonthlyStats"
  ADD CONSTRAINT "ServantMonthlyStats_ministryId_fkey"
  FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServantMonthlyStats"
  ADD CONSTRAINT "ServantMonthlyStats_servantId_fkey"
  FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PointRule_churchId_actionType_key" ON "PointRule"("churchId", "actionType");
CREATE UNIQUE INDEX "Achievement_churchId_code_key" ON "Achievement"("churchId", "code");
CREATE UNIQUE INDEX "ServantAchievement_servantId_achievementId_key" ON "ServantAchievement"("servantId", "achievementId");
CREATE UNIQUE INDEX "GrowthTrackStep_growthTrackId_stepOrder_key" ON "GrowthTrackStep"("growthTrackId", "stepOrder");
CREATE UNIQUE INDEX "ServantGrowthProgress_servantId_stepId_key" ON "ServantGrowthProgress"("servantId", "stepId");
CREATE UNIQUE INDEX "ServantRankingSnapshot_servantId_referenceMonth_ministryId_key" ON "ServantRankingSnapshot"("servantId", "referenceMonth", "ministryId");
CREATE UNIQUE INDEX "ServantMonthlyStats_servantId_referenceMonth_ministryId_key" ON "ServantMonthlyStats"("servantId", "referenceMonth", "ministryId");

CREATE INDEX "ServantLevelDefinition_churchId_active_idx" ON "ServantLevelDefinition"("churchId", "active");
CREATE INDEX "ServantLevelDefinition_threshold_idx" ON "ServantLevelDefinition"("threshold");
CREATE INDEX "ServantLevelDefinition_levelOrder_idx" ON "ServantLevelDefinition"("levelOrder");
CREATE INDEX "PointRule_actionType_active_idx" ON "PointRule"("actionType", "active");
CREATE INDEX "ServantPointLog_churchId_createdAt_idx" ON "ServantPointLog"("churchId", "createdAt");
CREATE INDEX "ServantPointLog_servantId_createdAt_idx" ON "ServantPointLog"("servantId", "createdAt");
CREATE INDEX "ServantPointLog_ministryId_createdAt_idx" ON "ServantPointLog"("ministryId", "createdAt");
CREATE INDEX "ServantPointLog_actionType_createdAt_idx" ON "ServantPointLog"("actionType", "createdAt");
CREATE INDEX "ServantPointLog_referenceId_idx" ON "ServantPointLog"("referenceId");
CREATE INDEX "ServantGamificationProfile_churchId_totalPoints_idx" ON "ServantGamificationProfile"("churchId", "totalPoints");
CREATE INDEX "ServantGamificationProfile_currentLevelOrder_totalPoints_idx" ON "ServantGamificationProfile"("currentLevelOrder", "totalPoints");
CREATE INDEX "Achievement_churchId_active_idx" ON "Achievement"("churchId", "active");
CREATE INDEX "Achievement_type_active_idx" ON "Achievement"("type", "active");
CREATE INDEX "ServantAchievement_churchId_unlockedAt_idx" ON "ServantAchievement"("churchId", "unlockedAt");
CREATE INDEX "ServantAchievement_servantId_unlockedAt_idx" ON "ServantAchievement"("servantId", "unlockedAt");
CREATE INDEX "GrowthTrack_churchId_active_idx" ON "GrowthTrack"("churchId", "active");
CREATE INDEX "GrowthTrack_ministryId_active_idx" ON "GrowthTrack"("ministryId", "active");
CREATE INDEX "GrowthTrackStep_growthTrackId_idx" ON "GrowthTrackStep"("growthTrackId");
CREATE INDEX "ServantGrowthProgress_churchId_servantId_idx" ON "ServantGrowthProgress"("churchId", "servantId");
CREATE INDEX "ServantGrowthProgress_growthTrackId_completed_idx" ON "ServantGrowthProgress"("growthTrackId", "completed");
CREATE INDEX "ServantRankingSnapshot_churchId_referenceMonth_positionChurch_idx" ON "ServantRankingSnapshot"("churchId", "referenceMonth", "positionChurch");
CREATE INDEX "ServantRankingSnapshot_ministryId_referenceMonth_positionMinistry_idx" ON "ServantRankingSnapshot"("ministryId", "referenceMonth", "positionMinistry");
CREATE INDEX "ServantMonthlyStats_churchId_referenceMonth_idx" ON "ServantMonthlyStats"("churchId", "referenceMonth");
CREATE INDEX "ServantMonthlyStats_ministryId_referenceMonth_idx" ON "ServantMonthlyStats"("ministryId", "referenceMonth");

-- Default level definitions (global)
INSERT INTO "ServantLevelDefinition" ("id", "churchId", "name", "threshold", "levelOrder", "active", "createdAt", "updatedAt") VALUES
('lvl-01', NULL, 'Iniciante', 0, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('lvl-02', NULL, 'Servo', 200, 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('lvl-03', NULL, 'Servo Experiente', 600, 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('lvl-04', NULL, 'Servo Fiel', 1200, 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('lvl-05', NULL, 'Lider em Treinamento', 2000, 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('lvl-06', NULL, 'Lider', 3500, 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('lvl-07', NULL, 'Coordenador', 6000, 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('lvl-08', NULL, 'Referencia Ministerial', 10000, 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "PointRule" ("id", "churchId", "actionType", "points", "active", "createdAt", "updatedAt") VALUES
('pr-attendance', NULL, 'ATTENDANCE_CONFIRMED', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pr-task-completed', NULL, 'TASK_COMPLETED', 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pr-checklist-perfect', NULL, 'CHECKLIST_PERFECT', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pr-task-before-due', NULL, 'TASK_BEFORE_DUE', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pr-service-participation', NULL, 'WORSHIP_SERVICE_PARTICIPATION', 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pr-training-completed', NULL, 'TRAINING_COMPLETED', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pr-helped-team', NULL, 'HELPED_OTHER_TEAM', 12, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pr-extra-task', NULL, 'EXTRA_TASK_ASSUMED', 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pr-month-no-absence', NULL, 'MONTH_WITHOUT_ABSENCE', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pr-leadership', NULL, 'TEAM_LEADERSHIP', 25, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pr-special-event', NULL, 'SPECIAL_EVENT', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

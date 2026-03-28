-- Enterprise architecture phase 1

-- 1) Slot lifecycle enum
ALTER TYPE "ScheduleSlotStatus" RENAME TO "ScheduleSlotStatus_old";
CREATE TYPE "ScheduleSlotStatus" AS ENUM (
  'OPEN',
  'ASSIGNED',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'DECLINED',
  'NO_SHOW',
  'COMPLETED',
  'SWAPPED'
);

ALTER TABLE "ScheduleSlot"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ScheduleSlotStatus"
  USING (
    CASE
      WHEN "status"::text = 'PENDING' THEN 'PENDING_CONFIRMATION'
      WHEN "status"::text = 'CONFLICT' THEN 'DECLINED'
      WHEN "status"::text = 'CANCELLED' THEN 'DECLINED'
      ELSE "status"::text
    END
  )::"ScheduleSlotStatus",
  ALTER COLUMN "status" SET DEFAULT 'OPEN';

DROP TYPE "ScheduleSlotStatus_old";

-- 2) New enums
CREATE TYPE "ScheduleVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_ROLE_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_LOGIN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SCHEDULE_PUBLISH';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SLOT_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SLOT_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SLOT_DECLINED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SLOT_NO_SHOW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SLOT_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SLOT_SWAPPED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_REGISTERED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASTORAL_ACTION';

-- 3) Church and tenancy fields
CREATE TABLE "Church" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "state" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Church_pkey" PRIMARY KEY ("id")
);

-- 4) Soft-delete and churchId columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Ministry" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "Ministry" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Ministry" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Servant" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "Servant" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Servant" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "WorshipService" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "WorshipService" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "WorshipService" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "ScheduleSlot" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "ScheduleSlot" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ScheduleSlot" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "PastoralVisit" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "PastoralVisit" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "PastoralVisit" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "PastoralWeeklyFollowUp" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "PastoralWeeklyFollowUp" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "PastoralWeeklyFollowUp" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "PastoralAlert" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "PastoralAlert" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "PastoralAlert" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "churchId" TEXT;

-- 5) Responsibility fields
ALTER TABLE "MinistryResponsibility" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "MinistryResponsibility" ADD COLUMN IF NOT EXISTS "requiredTraining" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MinistryResponsibility" ADD COLUMN IF NOT EXISTS "requiredAptitude" "Aptitude";
ALTER TABLE "MinistryResponsibility" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "MinistryResponsibility" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

UPDATE "MinistryResponsibility"
SET "name" = COALESCE(NULLIF("name", ''), "title")
WHERE "name" IS NULL OR "name" = '';

-- 6) Schedule versioning tables
CREATE TABLE "ScheduleVersion" (
  "id" TEXT NOT NULL,
  "worshipServiceId" TEXT NOT NULL,
  "churchId" TEXT,
  "versionNumber" INTEGER NOT NULL,
  "status" "ScheduleVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleVersionSlot" (
  "id" TEXT NOT NULL,
  "scheduleVersionId" TEXT NOT NULL,
  "ministryId" TEXT NOT NULL,
  "responsibilityId" TEXT,
  "assignedServantId" TEXT,
  "status" "ScheduleSlotStatus" NOT NULL DEFAULT 'OPEN',
  "position" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleVersionSlot_pkey" PRIMARY KEY ("id")
);

-- 7) Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorshipService" ADD CONSTRAINT "WorshipService_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PastoralVisit" ADD CONSTRAINT "PastoralVisit_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PastoralAlert" ADD CONSTRAINT "PastoralAlert_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_worshipServiceId_fkey" FOREIGN KEY ("worshipServiceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleVersionSlot" ADD CONSTRAINT "ScheduleVersionSlot_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleVersionSlot" ADD CONSTRAINT "ScheduleVersionSlot_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleVersionSlot" ADD CONSTRAINT "ScheduleVersionSlot_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "MinistryResponsibility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleVersionSlot" ADD CONSTRAINT "ScheduleVersionSlot_assignedServantId_fkey" FOREIGN KEY ("assignedServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8) Indexes
CREATE INDEX IF NOT EXISTS "Church_active_idx" ON "Church"("active");
CREATE INDEX IF NOT EXISTS "Church_name_idx" ON "Church"("name");

CREATE INDEX IF NOT EXISTS "User_churchId_idx" ON "User"("churchId");
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX IF NOT EXISTS "Ministry_churchId_idx" ON "Ministry"("churchId");
CREATE INDEX IF NOT EXISTS "Ministry_deletedAt_idx" ON "Ministry"("deletedAt");
CREATE INDEX IF NOT EXISTS "Team_churchId_idx" ON "Team"("churchId");
CREATE INDEX IF NOT EXISTS "Team_deletedAt_idx" ON "Team"("deletedAt");
CREATE INDEX IF NOT EXISTS "Servant_churchId_idx" ON "Servant"("churchId");
CREATE INDEX IF NOT EXISTS "Servant_deletedAt_idx" ON "Servant"("deletedAt");
CREATE INDEX IF NOT EXISTS "WorshipService_churchId_idx" ON "WorshipService"("churchId");
CREATE INDEX IF NOT EXISTS "WorshipService_deletedAt_idx" ON "WorshipService"("deletedAt");
CREATE INDEX IF NOT EXISTS "Schedule_churchId_idx" ON "Schedule"("churchId");
CREATE INDEX IF NOT EXISTS "Schedule_deletedAt_idx" ON "Schedule"("deletedAt");
CREATE INDEX IF NOT EXISTS "ScheduleSlot_churchId_idx" ON "ScheduleSlot"("churchId");
CREATE INDEX IF NOT EXISTS "ScheduleSlot_deletedAt_idx" ON "ScheduleSlot"("deletedAt");
CREATE INDEX IF NOT EXISTS "Attendance_churchId_idx" ON "Attendance"("churchId");
CREATE INDEX IF NOT EXISTS "Attendance_deletedAt_idx" ON "Attendance"("deletedAt");
CREATE INDEX IF NOT EXISTS "PastoralVisit_churchId_idx" ON "PastoralVisit"("churchId");
CREATE INDEX IF NOT EXISTS "PastoralVisit_deletedAt_idx" ON "PastoralVisit"("deletedAt");
CREATE INDEX IF NOT EXISTS "PastoralWeeklyFollowUp_churchId_idx" ON "PastoralWeeklyFollowUp"("churchId");
CREATE INDEX IF NOT EXISTS "PastoralWeeklyFollowUp_deletedAt_idx" ON "PastoralWeeklyFollowUp"("deletedAt");
CREATE INDEX IF NOT EXISTS "PastoralAlert_churchId_idx" ON "PastoralAlert"("churchId");
CREATE INDEX IF NOT EXISTS "PastoralAlert_deletedAt_idx" ON "PastoralAlert"("deletedAt");
CREATE INDEX IF NOT EXISTS "Notification_churchId_idx" ON "Notification"("churchId");

CREATE INDEX IF NOT EXISTS "MinistryResponsibility_requiredAptitude_idx" ON "MinistryResponsibility"("requiredAptitude");
CREATE INDEX IF NOT EXISTS "MinistryResponsibility_deletedAt_idx" ON "MinistryResponsibility"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleVersion_worshipServiceId_versionNumber_key" ON "ScheduleVersion"("worshipServiceId", "versionNumber");
CREATE INDEX IF NOT EXISTS "ScheduleVersion_worshipServiceId_status_idx" ON "ScheduleVersion"("worshipServiceId", "status");
CREATE INDEX IF NOT EXISTS "ScheduleVersion_churchId_idx" ON "ScheduleVersion"("churchId");
CREATE INDEX IF NOT EXISTS "ScheduleVersionSlot_scheduleVersionId_position_idx" ON "ScheduleVersionSlot"("scheduleVersionId", "position");
CREATE INDEX IF NOT EXISTS "ScheduleVersionSlot_ministryId_idx" ON "ScheduleVersionSlot"("ministryId");
CREATE INDEX IF NOT EXISTS "ScheduleVersionSlot_responsibilityId_idx" ON "ScheduleVersionSlot"("responsibilityId");
CREATE INDEX IF NOT EXISTS "ScheduleVersionSlot_assignedServantId_idx" ON "ScheduleVersionSlot"("assignedServantId");

-- 9) Tenancy backfill with first active church
INSERT INTO "Church" ("id", "name", "city", "state", "active", "createdAt", "updatedAt")
SELECT 'default_church', 'Igreja Principal', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Church");

UPDATE "User" SET "churchId" = COALESCE("churchId", 'default_church');
UPDATE "Ministry" SET "churchId" = COALESCE("churchId", 'default_church');
UPDATE "Team" t SET "churchId" = COALESCE(t."churchId", m."churchId") FROM "Ministry" m WHERE t."ministryId" = m."id";
UPDATE "Servant" s SET "churchId" = COALESCE(s."churchId", m."churchId") FROM "Ministry" m WHERE s."mainMinistryId" = m."id";
UPDATE "WorshipService" SET "churchId" = COALESCE("churchId", 'default_church');
UPDATE "Schedule" s SET "churchId" = COALESCE(s."churchId", m."churchId") FROM "Ministry" m WHERE s."ministryId" = m."id";
UPDATE "ScheduleSlot" s SET "churchId" = COALESCE(s."churchId", m."churchId") FROM "Ministry" m WHERE s."ministryId" = m."id";
UPDATE "Attendance" a SET "churchId" = COALESCE(a."churchId", ws."churchId") FROM "WorshipService" ws WHERE a."serviceId" = ws."id";
UPDATE "PastoralVisit" pv SET "churchId" = COALESCE(pv."churchId", s."churchId") FROM "Servant" s WHERE pv."servantId" = s."id";
UPDATE "PastoralWeeklyFollowUp" pwf SET "churchId" = COALESCE(pwf."churchId", m."churchId") FROM "Ministry" m WHERE pwf."ministryId" = m."id";
UPDATE "PastoralAlert" pa SET "churchId" = COALESCE(pa."churchId", s."churchId") FROM "Servant" s WHERE pa."servantId" = s."id";
UPDATE "Notification" n SET "churchId" = COALESCE(n."churchId", u."churchId") FROM "User" u WHERE n."userId" = u."id";

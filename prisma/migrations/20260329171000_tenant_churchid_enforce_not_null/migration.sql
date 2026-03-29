-- Phase B: enforce NOT NULL and tenant indexes for churchId

ALTER TABLE "User" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "Ministry" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "Team" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "Servant" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "WorshipService" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "ScheduleVersion" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "Schedule" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "ScheduleSlot" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "Attendance" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "PastoralVisit" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "PastoralWeeklyFollowUp" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "PastoralAlert" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "MinistryTaskTemplate" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "MinistryTaskOccurrence" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "Notification" ALTER COLUMN "churchId" SET NOT NULL;

DO $$
BEGIN
  IF to_regclass('"ServantJourney"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "ServantJourney" ALTER COLUMN "churchId" SET NOT NULL';
  END IF;
  IF to_regclass('"JourneyMilestone"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "JourneyMilestone" ALTER COLUMN "churchId" SET NOT NULL';
  END IF;
  IF to_regclass('"ServantMilestone"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "ServantMilestone" ALTER COLUMN "churchId" SET NOT NULL';
  END IF;
  IF to_regclass('"JourneyLog"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "JourneyLog" ALTER COLUMN "churchId" SET NOT NULL';
  END IF;
  IF to_regclass('"GrowthTrack"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "GrowthTrack" ALTER COLUMN "churchId" SET NOT NULL';
  END IF;
  IF to_regclass('"ServantGrowthProgress"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "ServantGrowthProgress" ALTER COLUMN "churchId" SET NOT NULL';
  END IF;
  IF to_regclass('"ServantMonthlyStats"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "ServantMonthlyStats" ALTER COLUMN "churchId" SET NOT NULL';
  END IF;
END
$$;

-- Reinforce tenant indexes
CREATE INDEX IF NOT EXISTS "User_churchId_role_status_idx" ON "User"("churchId", "role", "status");
CREATE INDEX IF NOT EXISTS "Servant_churchId_status_idx" ON "Servant"("churchId", "status");
CREATE INDEX IF NOT EXISTS "Schedule_churchId_serviceId_idx" ON "Schedule"("churchId", "serviceId");
CREATE INDEX IF NOT EXISTS "ScheduleSlot_churchId_serviceId_idx" ON "ScheduleSlot"("churchId", "serviceId");
CREATE INDEX IF NOT EXISTS "Attendance_churchId_serviceId_idx" ON "Attendance"("churchId", "serviceId");
CREATE INDEX IF NOT EXISTS "PastoralVisit_churchId_status_idx" ON "PastoralVisit"("churchId", "status");
CREATE INDEX IF NOT EXISTS "MinistryTaskOccurrence_churchId_status_idx" ON "MinistryTaskOccurrence"("churchId", "status");

-- Reinforce FK behavior for mandatory tenant ownership
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_churchId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ministry" DROP CONSTRAINT IF EXISTS "Ministry_churchId_fkey";
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_churchId_fkey";
ALTER TABLE "Team" ADD CONSTRAINT "Team_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Servant" DROP CONSTRAINT IF EXISTS "Servant_churchId_fkey";
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorshipService" DROP CONSTRAINT IF EXISTS "WorshipService_churchId_fkey";
ALTER TABLE "WorshipService" ADD CONSTRAINT "WorshipService_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Schedule" DROP CONSTRAINT IF EXISTS "Schedule_churchId_fkey";
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleSlot" DROP CONSTRAINT IF EXISTS "ScheduleSlot_churchId_fkey";
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_churchId_fkey";
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PastoralVisit" DROP CONSTRAINT IF EXISTS "PastoralVisit_churchId_fkey";
ALTER TABLE "PastoralVisit" ADD CONSTRAINT "PastoralVisit_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PastoralWeeklyFollowUp" DROP CONSTRAINT IF EXISTS "PastoralWeeklyFollowUp_churchId_fkey";
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PastoralAlert" DROP CONSTRAINT IF EXISTS "PastoralAlert_churchId_fkey";
ALTER TABLE "PastoralAlert" ADD CONSTRAINT "PastoralAlert_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskTemplate" DROP CONSTRAINT IF EXISTS "MinistryTaskTemplate_churchId_fkey";
ALTER TABLE "MinistryTaskTemplate" ADD CONSTRAINT "MinistryTaskTemplate_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MinistryTaskOccurrence" DROP CONSTRAINT IF EXISTS "MinistryTaskOccurrence_churchId_fkey";
ALTER TABLE "MinistryTaskOccurrence" ADD CONSTRAINT "MinistryTaskOccurrence_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_churchId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

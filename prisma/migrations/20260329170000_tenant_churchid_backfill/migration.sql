-- Phase A: tenant backfill for churchId
-- Safety: do not delete data; infer churchId from nearest canonical relation.

INSERT INTO "Church" ("id", "name", "active", "createdAt", "updatedAt")
SELECT 'church-default', 'Igreja Padrao (Backfill)', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Church");

-- User
UPDATE "User" u
SET "churchId" = COALESCE(
  (SELECT s."churchId" FROM "Servant" s WHERE s."id" = u."servantId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE u."churchId" IS NULL;

-- Ministry
UPDATE "Ministry" m
SET "churchId" = COALESCE(
  (SELECT u."churchId" FROM "User" u WHERE u."id" = m."coordinatorUserId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE m."churchId" IS NULL;

-- Team
UPDATE "Team" t
SET "churchId" = COALESCE(
  (SELECT m."churchId" FROM "Ministry" m WHERE m."id" = t."ministryId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE t."churchId" IS NULL;

-- Servant
UPDATE "Servant" s
SET "churchId" = COALESCE(
  (SELECT t."churchId" FROM "Team" t WHERE t."id" = s."teamId"),
  (SELECT m."churchId" FROM "Ministry" m WHERE m."id" = s."mainMinistryId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE s."churchId" IS NULL;

-- WorshipService
UPDATE "WorshipService" ws
SET "churchId" = COALESCE(
  (SELECT sc."churchId" FROM "Schedule" sc WHERE sc."serviceId" = ws."id" AND sc."churchId" IS NOT NULL LIMIT 1),
  (SELECT m."churchId" FROM "Schedule" sc JOIN "Ministry" m ON m."id" = sc."ministryId" WHERE sc."serviceId" = ws."id" AND m."churchId" IS NOT NULL LIMIT 1),
  (SELECT s."churchId" FROM "Schedule" sc JOIN "Servant" s ON s."id" = sc."servantId" WHERE sc."serviceId" = ws."id" AND s."churchId" IS NOT NULL LIMIT 1),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE ws."churchId" IS NULL;

-- ScheduleVersion
UPDATE "ScheduleVersion" sv
SET "churchId" = COALESCE(
  (SELECT ws."churchId" FROM "WorshipService" ws WHERE ws."id" = sv."worshipServiceId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE sv."churchId" IS NULL;

-- Schedule
UPDATE "Schedule" sc
SET "churchId" = COALESCE(
  (SELECT ws."churchId" FROM "WorshipService" ws WHERE ws."id" = sc."serviceId"),
  (SELECT m."churchId" FROM "Ministry" m WHERE m."id" = sc."ministryId"),
  (SELECT s."churchId" FROM "Servant" s WHERE s."id" = sc."servantId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE sc."churchId" IS NULL;

-- ScheduleSlot
UPDATE "ScheduleSlot" ss
SET "churchId" = COALESCE(
  (SELECT sc."churchId" FROM "Schedule" sc WHERE sc."id" = ss."scheduleId"),
  (SELECT ws."churchId" FROM "WorshipService" ws WHERE ws."id" = ss."serviceId"),
  (SELECT m."churchId" FROM "Ministry" m WHERE m."id" = ss."ministryId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE ss."churchId" IS NULL;

-- Attendance
UPDATE "Attendance" a
SET "churchId" = COALESCE(
  (SELECT ws."churchId" FROM "WorshipService" ws WHERE ws."id" = a."serviceId"),
  (SELECT s."churchId" FROM "Servant" s WHERE s."id" = a."servantId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE a."churchId" IS NULL;

-- Pastoral entities
UPDATE "PastoralVisit" pv
SET "churchId" = COALESCE(
  (SELECT s."churchId" FROM "Servant" s WHERE s."id" = pv."servantId"),
  (SELECT u."churchId" FROM "User" u WHERE u."id" = pv."createdByUserId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE pv."churchId" IS NULL;

UPDATE "PastoralWeeklyFollowUp" pwf
SET "churchId" = COALESCE(
  (SELECT s."churchId" FROM "Servant" s WHERE s."id" = pwf."servantId"),
  (SELECT m."churchId" FROM "Ministry" m WHERE m."id" = pwf."ministryId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE pwf."churchId" IS NULL;

UPDATE "PastoralAlert" pa
SET "churchId" = COALESCE(
  (SELECT s."churchId" FROM "Servant" s WHERE s."id" = pa."servantId"),
  (SELECT u."churchId" FROM "User" u WHERE u."id" = pa."createdByUserId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE pa."churchId" IS NULL;

-- Ministry tasks
UPDATE "MinistryTaskTemplate" mt
SET "churchId" = COALESCE(
  (SELECT m."churchId" FROM "Ministry" m WHERE m."id" = mt."ministryId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE mt."churchId" IS NULL;

UPDATE "MinistryTaskOccurrence" mo
SET "churchId" = COALESCE(
  (SELECT mt."churchId" FROM "MinistryTaskTemplate" mt WHERE mt."id" = mo."templateId"),
  (SELECT m."churchId" FROM "Ministry" m WHERE m."id" = mo."ministryId"),
  (SELECT ws."churchId" FROM "WorshipService" ws WHERE ws."id" = mo."serviceId"),
  (SELECT s."churchId" FROM "Servant" s WHERE s."id" = mo."assignedServantId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE mo."churchId" IS NULL;

-- Journey
DO $$
BEGIN
  IF to_regclass('"ServantJourney"') IS NOT NULL THEN
    EXECUTE '
      UPDATE "ServantJourney" sj
      SET "churchId" = COALESCE((SELECT s."churchId" FROM "Servant" s WHERE s."id" = sj."servantId"), (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1))
      WHERE sj."churchId" IS NULL';
  END IF;

  IF to_regclass('"JourneyMilestone"') IS NOT NULL THEN
    EXECUTE '
      UPDATE "JourneyMilestone" jm
      SET "churchId" = COALESCE((SELECT sm."churchId" FROM "ServantMilestone" sm WHERE sm."milestoneId" = jm."id" AND sm."churchId" IS NOT NULL LIMIT 1), (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1))
      WHERE jm."churchId" IS NULL';
  END IF;

  IF to_regclass('"ServantMilestone"') IS NOT NULL THEN
    EXECUTE '
      UPDATE "ServantMilestone" sm
      SET "churchId" = COALESCE((SELECT s."churchId" FROM "Servant" s WHERE s."id" = sm."servantId"), (SELECT jm."churchId" FROM "JourneyMilestone" jm WHERE jm."id" = sm."milestoneId"), (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1))
      WHERE sm."churchId" IS NULL';
  END IF;

  IF to_regclass('"JourneyLog"') IS NOT NULL THEN
    EXECUTE '
      UPDATE "JourneyLog" jl
      SET "churchId" = COALESCE((SELECT s."churchId" FROM "Servant" s WHERE s."id" = jl."servantId"), (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1))
      WHERE jl."churchId" IS NULL';
  END IF;
END
$$;

-- Growth
DO $$
BEGIN
  IF to_regclass('"GrowthTrack"') IS NOT NULL THEN
    EXECUTE '
      UPDATE "GrowthTrack" gt
      SET "churchId" = COALESCE((SELECT m."churchId" FROM "Ministry" m WHERE m."id" = gt."ministryId"), (SELECT u."churchId" FROM "User" u WHERE u."id" = gt."createdBy"), (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1))
      WHERE gt."churchId" IS NULL';
  END IF;

  IF to_regclass('"ServantGrowthProgress"') IS NOT NULL THEN
    EXECUTE '
      UPDATE "ServantGrowthProgress" sgp
      SET "churchId" = COALESCE((SELECT s."churchId" FROM "Servant" s WHERE s."id" = sgp."servantId"), (SELECT gt."churchId" FROM "GrowthTrack" gt WHERE gt."id" = sgp."growthTrackId"), (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1))
      WHERE sgp."churchId" IS NULL';
  END IF;

  IF to_regclass('"ServantMonthlyStats"') IS NOT NULL THEN
    EXECUTE '
      UPDATE "ServantMonthlyStats" sms
      SET "churchId" = COALESCE((SELECT s."churchId" FROM "Servant" s WHERE s."id" = sms."servantId"), (SELECT m."churchId" FROM "Ministry" m WHERE m."id" = sms."ministryId"), (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1))
      WHERE sms."churchId" IS NULL';
  END IF;
END
$$;

-- Notifications
UPDATE "Notification" n
SET "churchId" = COALESCE(
  (SELECT u."churchId" FROM "User" u WHERE u."id" = n."userId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE n."churchId" IS NULL;

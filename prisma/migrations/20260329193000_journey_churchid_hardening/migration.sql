-- Ensure journey module is tenant-hardened after legacy optional columns migration.

UPDATE "ServantJourney" sj
SET "churchId" = COALESCE(
  (SELECT s."churchId" FROM "Servant" s WHERE s."id" = sj."servantId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE sj."churchId" IS NULL;

UPDATE "ServantMilestone" sm
SET "churchId" = COALESCE(
  (SELECT s."churchId" FROM "Servant" s WHERE s."id" = sm."servantId"),
  (SELECT jm."churchId" FROM "JourneyMilestone" jm WHERE jm."id" = sm."milestoneId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE sm."churchId" IS NULL;

UPDATE "JourneyMilestone" jm
SET "churchId" = COALESCE(
  (SELECT sm."churchId" FROM "ServantMilestone" sm WHERE sm."milestoneId" = jm."id" AND sm."churchId" IS NOT NULL LIMIT 1),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE jm."churchId" IS NULL;

UPDATE "JourneyLog" jl
SET "churchId" = COALESCE(
  (SELECT s."churchId" FROM "Servant" s WHERE s."id" = jl."servantId"),
  (SELECT c."id" FROM "Church" c ORDER BY c."createdAt" ASC LIMIT 1)
)
WHERE jl."churchId" IS NULL;

ALTER TABLE "ServantJourney" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "JourneyMilestone" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "ServantMilestone" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "JourneyLog" ALTER COLUMN "churchId" SET NOT NULL;

ALTER TABLE "ServantJourney" DROP CONSTRAINT IF EXISTS "ServantJourney_churchId_fkey";
ALTER TABLE "JourneyMilestone" DROP CONSTRAINT IF EXISTS "JourneyMilestone_churchId_fkey";
ALTER TABLE "ServantMilestone" DROP CONSTRAINT IF EXISTS "ServantMilestone_churchId_fkey";
ALTER TABLE "JourneyLog" DROP CONSTRAINT IF EXISTS "JourneyLog_churchId_fkey";

ALTER TABLE "ServantJourney"
  ADD CONSTRAINT "ServantJourney_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JourneyMilestone"
  ADD CONSTRAINT "JourneyMilestone_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServantMilestone"
  ADD CONSTRAINT "ServantMilestone_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JourneyLog"
  ADD CONSTRAINT "JourneyLog_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

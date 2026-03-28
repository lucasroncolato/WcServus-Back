-- Full domain migration: Sector -> Ministry
ALTER TYPE "UserScope" RENAME VALUE 'SETOR' TO 'MINISTRY';

ALTER TABLE "Sector" RENAME TO "Ministry";
ALTER TABLE "ServantSector" RENAME TO "ServantMinistry";
ALTER TABLE "UserScopeBinding" RENAME TO "UserMinistryBinding";

ALTER TABLE "Team" RENAME COLUMN "sectorId" TO "ministryId";
ALTER TABLE "Servant" RENAME COLUMN "mainSectorId" TO "mainMinistryId";
ALTER TABLE "Schedule" RENAME COLUMN "sectorId" TO "ministryId";
ALTER TABLE "ScheduleSlot" RENAME COLUMN "sectorId" TO "ministryId";
ALTER TABLE "PastoralWeeklyFollowUp" RENAME COLUMN "sectorId" TO "ministryId";
ALTER TABLE "ServantMinistry" RENAME COLUMN "sectorId" TO "ministryId";
ALTER TABLE "UserMinistryBinding" RENAME COLUMN "sectorId" TO "ministryId";

-- Repoint foreign keys to canonical names
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_sectorId_fkey";
ALTER TABLE "Team" ADD CONSTRAINT "Team_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Servant" DROP CONSTRAINT IF EXISTS "Servant_mainSectorId_fkey";
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_mainMinistryId_fkey" FOREIGN KEY ("mainMinistryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Schedule" DROP CONSTRAINT IF EXISTS "Schedule_sectorId_fkey";
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleSlot" DROP CONSTRAINT IF EXISTS "ScheduleSlot_sectorId_fkey";
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PastoralWeeklyFollowUp" DROP CONSTRAINT IF EXISTS "PastoralWeeklyFollowUp_sectorId_fkey";
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServantMinistry" DROP CONSTRAINT IF EXISTS "ServantSector_sectorId_fkey";
ALTER TABLE "ServantMinistry" ADD CONSTRAINT "ServantMinistry_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMinistryBinding" DROP CONSTRAINT IF EXISTS "UserScopeBinding_sectorId_fkey";
ALTER TABLE "UserMinistryBinding" ADD CONSTRAINT "UserMinistryBinding_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MinistryResponsibility already uses ministryId, just repoint FK if needed
ALTER TABLE "MinistryResponsibility" DROP CONSTRAINT IF EXISTS "MinistryResponsibility_ministryId_fkey";
ALTER TABLE "MinistryResponsibility" ADD CONSTRAINT "MinistryResponsibility_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate/rename major indexes and constraints to canonical names
DROP INDEX IF EXISTS "Team_sectorId_idx";
DROP INDEX IF EXISTS "Team_sectorId_name_key";
CREATE INDEX IF NOT EXISTS "Team_ministryId_idx" ON "Team"("ministryId");
CREATE UNIQUE INDEX IF NOT EXISTS "Team_ministryId_name_key" ON "Team"("ministryId", "name");

DROP INDEX IF EXISTS "Servant_mainSectorId_idx";
CREATE INDEX IF NOT EXISTS "Servant_mainMinistryId_idx" ON "Servant"("mainMinistryId");

DROP INDEX IF EXISTS "Schedule_sectorId_idx";
DROP INDEX IF EXISTS "Schedule_serviceId_servantId_sectorId_key";
CREATE INDEX IF NOT EXISTS "Schedule_ministryId_idx" ON "Schedule"("ministryId");
CREATE UNIQUE INDEX IF NOT EXISTS "Schedule_serviceId_servantId_ministryId_key" ON "Schedule"("serviceId", "servantId", "ministryId");

DROP INDEX IF EXISTS "ScheduleSlot_serviceId_sectorId_idx";
DROP INDEX IF EXISTS "ScheduleSlot_serviceId_sectorId_functionName_position_key";
CREATE INDEX IF NOT EXISTS "ScheduleSlot_serviceId_ministryId_idx" ON "ScheduleSlot"("serviceId", "ministryId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleSlot_serviceId_ministryId_functionName_position_key" ON "ScheduleSlot"("serviceId", "ministryId", "functionName", "position");

DROP INDEX IF EXISTS "PastoralWeeklyFollowUp_servantId_sectorId_weekStartDate_key";
DROP INDEX IF EXISTS "PastoralWeeklyFollowUp_sectorId_weekStartDate_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "PastoralWeeklyFollowUp_servantId_ministryId_weekStartDate_key" ON "PastoralWeeklyFollowUp"("servantId", "ministryId", "weekStartDate");
CREATE INDEX IF NOT EXISTS "PastoralWeeklyFollowUp_ministryId_weekStartDate_idx" ON "PastoralWeeklyFollowUp"("ministryId", "weekStartDate");

DROP INDEX IF EXISTS "ServantSector_servantId_sectorId_key";
DROP INDEX IF EXISTS "ServantSector_sectorId_idx";
DROP INDEX IF EXISTS "ServantSector_sectorId_trainingStatus_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "ServantMinistry_servantId_ministryId_key" ON "ServantMinistry"("servantId", "ministryId");
CREATE INDEX IF NOT EXISTS "ServantMinistry_ministryId_idx" ON "ServantMinistry"("ministryId");
CREATE INDEX IF NOT EXISTS "ServantMinistry_ministryId_trainingStatus_idx" ON "ServantMinistry"("ministryId", "trainingStatus");

DROP INDEX IF EXISTS "UserScopeBinding_sectorId_idx";
DROP INDEX IF EXISTS "UserScopeBinding_userId_sectorId_teamId_key";
DROP INDEX IF EXISTS "UserScopeBinding_userId_sectorId_teamName_key";
CREATE INDEX IF NOT EXISTS "UserMinistryBinding_ministryId_idx" ON "UserMinistryBinding"("ministryId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserMinistryBinding_userId_ministryId_teamId_key" ON "UserMinistryBinding"("userId", "ministryId", "teamId");

-- Domain evolution: remove LIDER role, add talents review workflow,
-- support channel, ministry responsibilities and servant rewards.

-- Role migration (remove LIDER safely)
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PASTOR', 'COORDENADOR', 'SERVO');
UPDATE "User" SET "role" = 'COORDENADOR' WHERE "role"::text = 'LIDER';
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";

-- CreateEnum
CREATE TYPE "TalentReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_ADMIN_REVIEW', 'ADMIN_CONFIRMED_REJECTION', 'ADMIN_REVERSED_REJECTION');

-- CreateEnum
CREATE TYPE "SupportRequestType" AS ENUM ('GERAL', 'DADOS', 'AUTORIZACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('ABERTO', 'EM_ANALISE', 'RESOLVIDO');

-- CreateEnum
CREATE TYPE "RewardSource" AS ENUM ('DEVOTIONAL_DAILY', 'FASTING_MONTHLY', 'ATTENDANCE_PRESENT', 'SCHEDULE_CONFIRMED', 'TASK_COMPLETED', 'MANUAL');

-- AlterTable
ALTER TABLE "Talent"
  ADD COLUMN "reviewStatus" "TalentReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "rejectedByUserId" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNotes" TEXT;

UPDATE "Talent"
SET "reviewStatus" = 'PENDING_ADMIN_REVIEW'
WHERE "stage" = 'REPROVADO';

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "type" "SupportRequestType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'ABERTO',
    "authorUserId" TEXT NOT NULL,
    "handledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryResponsibility" (
    "id" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "activity" TEXT,
    "functionName" TEXT,
    "description" TEXT,
    "responsibleServantId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistryResponsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantReward" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "source" "RewardSource" NOT NULL,
    "points" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "grantedByUserId" TEXT,
    "rewardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServantReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Talent_reviewStatus_idx" ON "Talent"("reviewStatus");
CREATE INDEX "Talent_rejectedByUserId_idx" ON "Talent"("rejectedByUserId");
CREATE INDEX "Talent_reviewedByUserId_idx" ON "Talent"("reviewedByUserId");

CREATE INDEX "SupportRequest_authorUserId_createdAt_idx" ON "SupportRequest"("authorUserId", "createdAt");
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");
CREATE INDEX "SupportRequest_type_createdAt_idx" ON "SupportRequest"("type", "createdAt");

CREATE INDEX "MinistryResponsibility_ministryId_active_idx" ON "MinistryResponsibility"("ministryId", "active");
CREATE INDEX "MinistryResponsibility_responsibleServantId_idx" ON "MinistryResponsibility"("responsibleServantId");

CREATE INDEX "ServantReward_servantId_rewardedAt_idx" ON "ServantReward"("servantId", "rewardedAt");
CREATE INDEX "ServantReward_source_rewardedAt_idx" ON "ServantReward"("source", "rewardedAt");
CREATE INDEX "ServantReward_grantedByUserId_idx" ON "ServantReward"("grantedByUserId");
CREATE UNIQUE INDEX "ServantReward_servantId_source_referenceId_key" ON "ServantReward"("servantId", "source", "referenceId");

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryResponsibility" ADD CONSTRAINT "MinistryResponsibility_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MinistryResponsibility" ADD CONSTRAINT "MinistryResponsibility_responsibleServantId_fkey" FOREIGN KEY ("responsibleServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServantReward" ADD CONSTRAINT "ServantReward_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantReward" ADD CONSTRAINT "ServantReward_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

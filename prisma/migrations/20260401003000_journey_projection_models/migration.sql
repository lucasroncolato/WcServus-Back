-- Journey projection models
CREATE TYPE "JourneyNextStepPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "JourneyNextStepStatus" AS ENUM ('OPEN', 'DONE', 'DISMISSED');

CREATE TABLE "JourneyIndicatorSnapshot" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "servantId" TEXT NOT NULL,
  "windowDays" INTEGER NOT NULL,
  "constancyScore" INTEGER NOT NULL DEFAULT 0,
  "readinessScore" INTEGER NOT NULL DEFAULT 0,
  "responsivenessScore" INTEGER NOT NULL DEFAULT 0,
  "punctualityScore" INTEGER NOT NULL DEFAULT 0,
  "engagementScore" INTEGER NOT NULL DEFAULT 0,
  "continuityScore" INTEGER NOT NULL DEFAULT 0,
  "formationScore" INTEGER NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JourneyIndicatorSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JourneyNextStep" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "servantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "priority" "JourneyNextStepPriority" NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "JourneyNextStepStatus" NOT NULL DEFAULT 'OPEN',
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "JourneyNextStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JourneyIndicatorSnapshot_servantId_windowDays_key" ON "JourneyIndicatorSnapshot"("servantId", "windowDays");
CREATE INDEX "JourneyIndicatorSnapshot_churchId_generatedAt_idx" ON "JourneyIndicatorSnapshot"("churchId", "generatedAt");
CREATE INDEX "JourneyIndicatorSnapshot_servantId_generatedAt_idx" ON "JourneyIndicatorSnapshot"("servantId", "generatedAt");

CREATE UNIQUE INDEX "JourneyNextStep_servantId_type_status_key" ON "JourneyNextStep"("servantId", "type", "status");
CREATE INDEX "JourneyNextStep_churchId_status_priority_idx" ON "JourneyNextStep"("churchId", "status", "priority");
CREATE INDEX "JourneyNextStep_servantId_status_priority_idx" ON "JourneyNextStep"("servantId", "status", "priority");

ALTER TABLE "JourneyIndicatorSnapshot" ADD CONSTRAINT "JourneyIndicatorSnapshot_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JourneyIndicatorSnapshot" ADD CONSTRAINT "JourneyIndicatorSnapshot_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JourneyNextStep" ADD CONSTRAINT "JourneyNextStep_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JourneyNextStep" ADD CONSTRAINT "JourneyNextStep_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

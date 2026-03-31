CREATE TYPE "JourneyProjectionCheckpointStatus" AS ENUM ('OK', 'WARNING', 'ERROR');

CREATE TABLE "JourneyProjectionCheckpoint" (
  "id" TEXT NOT NULL,
  "churchId" TEXT,
  "servantId" TEXT,
  "projectorName" TEXT NOT NULL,
  "lastProcessedAt" TIMESTAMP(3),
  "lastProcessedEventKey" TEXT,
  "lastReconciledAt" TIMESTAMP(3),
  "status" "JourneyProjectionCheckpointStatus" NOT NULL DEFAULT 'OK',
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JourneyProjectionCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JourneyProjectionCheckpoint_projectorName_status_updatedAt_idx" ON "JourneyProjectionCheckpoint"("projectorName", "status", "updatedAt");
CREATE INDEX "JourneyProjectionCheckpoint_churchId_status_idx" ON "JourneyProjectionCheckpoint"("churchId", "status");
CREATE INDEX "JourneyProjectionCheckpoint_servantId_status_idx" ON "JourneyProjectionCheckpoint"("servantId", "status");
CREATE INDEX "JourneyProjectionCheckpoint_lastReconciledAt_idx" ON "JourneyProjectionCheckpoint"("lastReconciledAt");

ALTER TABLE "JourneyProjectionCheckpoint" ADD CONSTRAINT "JourneyProjectionCheckpoint_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JourneyProjectionCheckpoint" ADD CONSTRAINT "JourneyProjectionCheckpoint_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

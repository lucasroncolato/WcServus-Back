ALTER TABLE "ServantSector"
  ADD COLUMN "trainingStatus" "TrainingStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "trainingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "trainingReviewedByUserId" TEXT,
  ADD COLUMN "trainingNotes" TEXT;

UPDATE "ServantSector" ss
SET
  "trainingStatus" = CASE
    WHEN s."trainingStatus" = 'COMPLETED' THEN 'COMPLETED'::"TrainingStatus"
    ELSE 'PENDING'::"TrainingStatus"
  END,
  "trainingCompletedAt" = CASE
    WHEN s."trainingStatus" = 'COMPLETED' THEN NOW()
    ELSE NULL
  END
FROM "Servant" s
WHERE s."id" = ss."servantId";

ALTER TABLE "ServantSector"
  ADD CONSTRAINT "ServantSector_trainingReviewedByUserId_fkey"
  FOREIGN KEY ("trainingReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ServantSector_sectorId_trainingStatus_idx"
  ON "ServantSector"("sectorId", "trainingStatus");

CREATE INDEX "ServantSector_trainingReviewedByUserId_idx"
  ON "ServantSector"("trainingReviewedByUserId");

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('PENDING', 'COMPLETED');

-- AlterTable
ALTER TABLE "Servant" ADD COLUMN     "trainingStatus" "TrainingStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "ServantSector" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServantSector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServantSector_sectorId_idx" ON "ServantSector"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "ServantSector_servantId_sectorId_key" ON "ServantSector"("servantId", "sectorId");

-- CreateIndex
CREATE INDEX "Servant_trainingStatus_idx" ON "Servant"("trainingStatus");

-- AddForeignKey
ALTER TABLE "ServantSector" ADD CONSTRAINT "ServantSector_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantSector" ADD CONSTRAINT "ServantSector_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

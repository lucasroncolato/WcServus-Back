-- CreateEnum
CREATE TYPE "ScheduleResponseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "Schedule"
ADD COLUMN "declineReason" TEXT,
ADD COLUMN "responseAt" TIMESTAMP(3),
ADD COLUMN "responseStatus" "ScheduleResponseStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "ScheduleResponseHistory" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "responseStatus" "ScheduleResponseStatus" NOT NULL,
    "declineReason" TEXT,
    "respondedByUserId" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleResponseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantAvailability" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "shift" "Shift" NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServantAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schedule_responseStatus_idx" ON "Schedule"("responseStatus");

-- CreateIndex
CREATE INDEX "ScheduleResponseHistory_scheduleId_respondedAt_idx" ON "ScheduleResponseHistory"("scheduleId", "respondedAt");

-- CreateIndex
CREATE INDEX "ScheduleResponseHistory_respondedByUserId_idx" ON "ScheduleResponseHistory"("respondedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ServantAvailability_servantId_dayOfWeek_shift_key" ON "ServantAvailability"("servantId", "dayOfWeek", "shift");

-- CreateIndex
CREATE INDEX "ServantAvailability_servantId_idx" ON "ServantAvailability"("servantId");

-- AddForeignKey
ALTER TABLE "ScheduleResponseHistory" ADD CONSTRAINT "ScheduleResponseHistory_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleResponseHistory" ADD CONSTRAINT "ScheduleResponseHistory_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantAvailability" ADD CONSTRAINT "ServantAvailability_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

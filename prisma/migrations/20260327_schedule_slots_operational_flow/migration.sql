-- Escalas v2: slots por funcao/vaga + historico contextual

CREATE TYPE "ScheduleSlotStatus" AS ENUM (
  'OPEN',
  'ASSIGNED',
  'PENDING',
  'CONFIRMED',
  'CONFLICT',
  'SWAPPED',
  'CANCELLED'
);

CREATE TYPE "ScheduleSlotChangeType" AS ENUM (
  'ASSIGNMENT',
  'REPLACEMENT',
  'ABSENCE_REPLACEMENT',
  'FILL_OPEN_SLOT',
  'AUTO_GENERATED',
  'STATUS_UPDATE'
);

CREATE TABLE "ScheduleSlot" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "sectorId" TEXT NOT NULL,
  "scheduleId" TEXT,
  "responsibilityId" TEXT,
  "functionName" TEXT NOT NULL,
  "slotLabel" TEXT,
  "position" INTEGER NOT NULL DEFAULT 1,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "requiredTraining" BOOLEAN NOT NULL DEFAULT true,
  "blocked" BOOLEAN NOT NULL DEFAULT false,
  "blockedReason" TEXT,
  "status" "ScheduleSlotStatus" NOT NULL DEFAULT 'OPEN',
  "assignedServantId" TEXT,
  "assignedByUserId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleSlotChange" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "changeType" "ScheduleSlotChangeType" NOT NULL,
  "fromServantId" TEXT,
  "toServantId" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "performedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScheduleSlotChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleSlot_serviceId_sectorId_functionName_position_key"
  ON "ScheduleSlot"("serviceId", "sectorId", "functionName", "position");

CREATE INDEX "ScheduleSlot_serviceId_sectorId_idx" ON "ScheduleSlot"("serviceId", "sectorId");
CREATE INDEX "ScheduleSlot_status_idx" ON "ScheduleSlot"("status");
CREATE INDEX "ScheduleSlot_assignedServantId_idx" ON "ScheduleSlot"("assignedServantId");
CREATE INDEX "ScheduleSlot_responsibilityId_idx" ON "ScheduleSlot"("responsibilityId");
CREATE INDEX "ScheduleSlot_scheduleId_idx" ON "ScheduleSlot"("scheduleId");

CREATE INDEX "ScheduleSlotChange_slotId_createdAt_idx" ON "ScheduleSlotChange"("slotId", "createdAt");
CREATE INDEX "ScheduleSlotChange_changeType_createdAt_idx" ON "ScheduleSlotChange"("changeType", "createdAt");
CREATE INDEX "ScheduleSlotChange_performedByUserId_idx" ON "ScheduleSlotChange"("performedByUserId");

ALTER TABLE "ScheduleSlot"
  ADD CONSTRAINT "ScheduleSlot_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleSlot"
  ADD CONSTRAINT "ScheduleSlot_sectorId_fkey"
  FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleSlot"
  ADD CONSTRAINT "ScheduleSlot_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScheduleSlot"
  ADD CONSTRAINT "ScheduleSlot_responsibilityId_fkey"
  FOREIGN KEY ("responsibilityId") REFERENCES "MinistryResponsibility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScheduleSlot"
  ADD CONSTRAINT "ScheduleSlot_assignedServantId_fkey"
  FOREIGN KEY ("assignedServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScheduleSlot"
  ADD CONSTRAINT "ScheduleSlot_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScheduleSlotChange"
  ADD CONSTRAINT "ScheduleSlotChange_slotId_fkey"
  FOREIGN KEY ("slotId") REFERENCES "ScheduleSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleSlotChange"
  ADD CONSTRAINT "ScheduleSlotChange_performedByUserId_fkey"
  FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

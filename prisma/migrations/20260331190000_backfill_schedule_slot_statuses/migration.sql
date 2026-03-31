-- Backfill ScheduleSlot status values after enum expansion
UPDATE "ScheduleSlot"
SET "status" = 'EMPTY'
WHERE "status" = 'OPEN';

UPDATE "ScheduleSlot"
SET "status" = 'FILLED'
WHERE "status" IN ('ASSIGNED', 'PENDING_CONFIRMATION');

UPDATE "ScheduleSlot"
SET "status" = 'REPLACED'
WHERE "status" = 'SWAPPED';

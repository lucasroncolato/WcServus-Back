-- Hardening de conflito de escala: um servo por culto e por slot de culto.
CREATE UNIQUE INDEX "Schedule_serviceId_servantId_key" ON "Schedule"("serviceId", "servantId");
CREATE UNIQUE INDEX "ScheduleSlot_serviceId_assignedServantId_key" ON "ScheduleSlot"("serviceId", "assignedServantId");

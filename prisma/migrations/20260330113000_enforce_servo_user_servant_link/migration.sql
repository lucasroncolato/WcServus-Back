-- Enforce canonical identity invariant:
-- Every SERVO user must be linked to a servant.
ALTER TABLE "User"
  ADD CONSTRAINT "User_servo_requires_servant_ck"
  CHECK ("role" <> 'SERVO' OR "servantId" IS NOT NULL);

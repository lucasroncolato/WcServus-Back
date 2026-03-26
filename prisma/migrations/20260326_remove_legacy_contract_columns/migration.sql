-- Final canonical-contract cleanup.
-- Run only after all application instances are deployed with canonical-only payload/response handling.

BEGIN;

-- 1) Remove deprecated user-level legacy alias.
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "sectorTeam";

-- 2) Remove deprecated scope-binding legacy team name.
ALTER TABLE "UserScopeBinding"
  DROP COLUMN IF EXISTS "teamName";

-- 3) Remove deprecated servant legacy class-group mirror.
ALTER TABLE "Servant"
  DROP COLUMN IF EXISTS "classGroup";

-- 4) Remove deprecated schedule legacy class-group mirror.
ALTER TABLE "Schedule"
  DROP COLUMN IF EXISTS "classGroup";

COMMIT;

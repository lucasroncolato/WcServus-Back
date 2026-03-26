DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TeamStatus') THEN
    CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "description" TEXT,
  "sectorId" TEXT NOT NULL,
  "leaderUserId" TEXT,
  "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Team_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Team_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "Servant"
  ADD COLUMN IF NOT EXISTS "teamId" TEXT;

ALTER TABLE "UserScopeBinding"
  ADD COLUMN IF NOT EXISTS "teamId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Servant_teamId_fkey'
      AND table_name = 'Servant'
  ) THEN
    ALTER TABLE "Servant"
      ADD CONSTRAINT "Servant_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'UserScopeBinding_teamId_fkey'
      AND table_name = 'UserScopeBinding'
  ) THEN
    ALTER TABLE "UserScopeBinding"
      ADD CONSTRAINT "UserScopeBinding_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Team_sectorId_idx" ON "Team"("sectorId");
CREATE INDEX IF NOT EXISTS "Team_leaderUserId_idx" ON "Team"("leaderUserId");
CREATE INDEX IF NOT EXISTS "Team_status_idx" ON "Team"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "Team_sectorId_name_key" ON "Team"("sectorId", "name");
CREATE INDEX IF NOT EXISTS "Servant_teamId_idx" ON "Servant"("teamId");
CREATE INDEX IF NOT EXISTS "UserScopeBinding_teamId_idx" ON "UserScopeBinding"("teamId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserScopeBinding_userId_sectorId_teamId_key"
  ON "UserScopeBinding"("userId", "sectorId", "teamId");

WITH servant_team_candidates AS (
  SELECT DISTINCT
    s."mainSectorId" AS "sectorId",
    BTRIM(s."classGroup") AS "teamName"
  FROM "Servant" s
  WHERE s."mainSectorId" IS NOT NULL
    AND s."classGroup" IS NOT NULL
    AND BTRIM(s."classGroup") <> ''
),
scope_team_candidates AS (
  SELECT DISTINCT
    usb."sectorId",
    BTRIM(usb."teamName") AS "teamName"
  FROM "UserScopeBinding" usb
  WHERE usb."sectorId" IS NOT NULL
    AND usb."teamName" IS NOT NULL
    AND BTRIM(usb."teamName") <> ''
),
user_team_candidates AS (
  SELECT DISTINCT
    COALESCE(s."mainSectorId", ss."sectorId") AS "sectorId",
    BTRIM(u."sectorTeam") AS "teamName"
  FROM "User" u
  LEFT JOIN "Servant" s ON s."id" = u."servantId"
  LEFT JOIN LATERAL (
    SELECT sx."sectorId"
    FROM "ServantSector" sx
    WHERE sx."servantId" = u."servantId"
    ORDER BY sx."createdAt" ASC
    LIMIT 1
  ) ss ON TRUE
  WHERE u."sectorTeam" IS NOT NULL
    AND BTRIM(u."sectorTeam") <> ''
),
all_candidates AS (
  SELECT * FROM servant_team_candidates
  UNION
  SELECT * FROM scope_team_candidates
  UNION
  SELECT * FROM user_team_candidates
)
INSERT INTO "Team" ("id", "name", "slug", "sectorId", "status", "createdAt", "updatedAt")
SELECT
  CONCAT('team_', SUBSTRING(MD5(CONCAT(ac."sectorId", ':', LOWER(ac."teamName"))) FROM 1 FOR 20)) AS "id",
  ac."teamName" AS "name",
  LOWER(REGEXP_REPLACE(ac."teamName", '[^a-zA-Z0-9]+', '-', 'g')) AS "slug",
  ac."sectorId",
  'ACTIVE'::"TeamStatus",
  NOW(),
  NOW()
FROM all_candidates ac
WHERE ac."sectorId" IS NOT NULL
  AND ac."teamName" IS NOT NULL
  AND ac."teamName" <> ''
ON CONFLICT ("sectorId", "name") DO NOTHING;

UPDATE "Servant" s
SET "teamId" = t."id"
FROM "Team" t
WHERE s."teamId" IS NULL
  AND s."mainSectorId" = t."sectorId"
  AND s."classGroup" IS NOT NULL
  AND BTRIM(s."classGroup") = t."name";

UPDATE "UserScopeBinding" usb
SET "teamId" = t."id"
FROM "Team" t
WHERE usb."teamId" IS NULL
  AND usb."sectorId" = t."sectorId"
  AND usb."teamName" IS NOT NULL
  AND BTRIM(usb."teamName") = t."name";

UPDATE "UserScopeBinding" usb
SET "teamId" = t."id",
    "sectorId" = COALESCE(usb."sectorId", t."sectorId")
FROM "User" u
JOIN "Servant" s ON s."id" = u."servantId"
JOIN "Team" t ON t."sectorId" = s."mainSectorId"
WHERE usb."userId" = u."id"
  AND usb."teamId" IS NULL
  AND usb."teamName" IS NULL
  AND usb."sectorId" IS NULL
  AND u."scope" = 'EQUIPE'
  AND u."sectorTeam" IS NOT NULL
  AND BTRIM(u."sectorTeam") = t."name";


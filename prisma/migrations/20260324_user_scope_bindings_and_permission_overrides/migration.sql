ALTER TYPE "UserScope" ADD VALUE IF NOT EXISTS 'SELF';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermissionEffect') THEN
    CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "UserScopeBinding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sectorId" TEXT,
  "teamName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserScopeBinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserScopeBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserScopeBinding_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UserPermissionOverride" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,
  "effect" "PermissionEffect" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserScopeBinding_userId_sectorId_teamName_key"
  ON "UserScopeBinding" ("userId", "sectorId", "teamName");

CREATE INDEX IF NOT EXISTS "UserScopeBinding_userId_idx" ON "UserScopeBinding" ("userId");
CREATE INDEX IF NOT EXISTS "UserScopeBinding_sectorId_idx" ON "UserScopeBinding" ("sectorId");
CREATE INDEX IF NOT EXISTS "UserScopeBinding_teamName_idx" ON "UserScopeBinding" ("teamName");

CREATE UNIQUE INDEX IF NOT EXISTS "UserPermissionOverride_userId_permissionKey_key"
  ON "UserPermissionOverride" ("userId", "permissionKey");

CREATE INDEX IF NOT EXISTS "UserPermissionOverride_userId_idx" ON "UserPermissionOverride" ("userId");
CREATE INDEX IF NOT EXISTS "UserPermissionOverride_permissionKey_idx" ON "UserPermissionOverride" ("permissionKey");
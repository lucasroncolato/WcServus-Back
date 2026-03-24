CREATE TABLE IF NOT EXISTS "NotificationSystemSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationSystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationSystemSetting_key_key"
  ON "NotificationSystemSetting" ("key");
CREATE INDEX IF NOT EXISTS "NotificationSystemSetting_key_idx"
  ON "NotificationSystemSetting" ("key");

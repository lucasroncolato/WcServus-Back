DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'WHATSAPP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('SUCCESS', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRYING', 'SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationProvider" AS ENUM ('MOCK', 'META_CLOUD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "NotificationTemplate" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "provider" "NotificationProvider" DEFAULT 'MOCK',
  "name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "variables" JSONB,
  "status" "NotificationTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationTemplate_eventKey_channel_key"
  ON "NotificationTemplate" ("eventKey", "channel");
CREATE INDEX IF NOT EXISTS "NotificationTemplate_channel_status_idx"
  ON "NotificationTemplate" ("channel", "status");

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "servantId" TEXT,
  "channel" "NotificationChannel" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationPreference_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_channel_key"
  ON "NotificationPreference" ("userId", "channel");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_servantId_channel_key"
  ON "NotificationPreference" ("servantId", "channel");
CREATE INDEX IF NOT EXISTS "NotificationPreference_channel_enabled_idx"
  ON "NotificationPreference" ("channel", "enabled");

CREATE TABLE IF NOT EXISTS "NotificationQueue" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
  "provider" "NotificationProvider" NOT NULL DEFAULT 'MOCK',
  "status" "NotificationQueueStatus" NOT NULL DEFAULT 'PENDING',
  "userId" TEXT,
  "servantId" TEXT,
  "recipientPhone" TEXT NOT NULL,
  "recipientName" TEXT,
  "templateId" TEXT,
  "payload" JSONB,
  "renderedMessage" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationQueue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "NotificationQueue_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "NotificationQueue_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NotificationQueue_channel_status_nextRetryAt_idx"
  ON "NotificationQueue" ("channel", "status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "NotificationQueue_userId_createdAt_idx"
  ON "NotificationQueue" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationQueue_servantId_createdAt_idx"
  ON "NotificationQueue" ("servantId", "createdAt");

CREATE TABLE IF NOT EXISTS "NotificationLog" (
  "id" TEXT NOT NULL,
  "queueId" TEXT,
  "eventKey" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
  "provider" "NotificationProvider" NOT NULL DEFAULT 'MOCK',
  "status" "NotificationDeliveryStatus" NOT NULL,
  "userId" TEXT,
  "servantId" TEXT,
  "recipientPhone" TEXT NOT NULL,
  "templateId" TEXT,
  "payload" JSONB,
  "providerMessageId" TEXT,
  "error" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationLog_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "NotificationQueue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "NotificationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "NotificationLog_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NotificationLog_createdAt_idx"
  ON "NotificationLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "NotificationLog_status_channel_idx"
  ON "NotificationLog" ("status", "channel");
CREATE INDEX IF NOT EXISTS "NotificationLog_eventKey_createdAt_idx"
  ON "NotificationLog" ("eventKey", "createdAt");

-- CreateTable
CREATE TABLE "ChurchAnalyticsSnapshot" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "windowKey" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "summary" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChurchAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryAnalyticsSnapshot" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "ministryId" TEXT NOT NULL,
  "windowKey" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "summary" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MinistryAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAnalyticsSnapshot" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "windowKey" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "summary" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantOperationalSnapshot" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "servantId" TEXT NOT NULL,
  "windowKey" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "summary" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServantOperationalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cas_uq_scope_period" ON "ChurchAnalyticsSnapshot"("churchId", "windowKey", "periodStart", "periodEnd");
CREATE INDEX "cas_idx_scope_gen" ON "ChurchAnalyticsSnapshot"("churchId", "windowKey", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "mas_uq_scope_period" ON "MinistryAnalyticsSnapshot"("churchId", "ministryId", "windowKey", "periodStart", "periodEnd");
CREATE INDEX "mas_idx_scope_gen" ON "MinistryAnalyticsSnapshot"("churchId", "ministryId", "windowKey", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tas_uq_scope_period" ON "TeamAnalyticsSnapshot"("churchId", "teamId", "windowKey", "periodStart", "periodEnd");
CREATE INDEX "tas_idx_scope_gen" ON "TeamAnalyticsSnapshot"("churchId", "teamId", "windowKey", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sos_uq_scope_period" ON "ServantOperationalSnapshot"("churchId", "servantId", "windowKey", "periodStart", "periodEnd");
CREATE INDEX "sos_idx_scope_gen" ON "ServantOperationalSnapshot"("churchId", "servantId", "windowKey", "generatedAt");

-- AddForeignKey
ALTER TABLE "ChurchAnalyticsSnapshot" ADD CONSTRAINT "ChurchAnalyticsSnapshot_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MinistryAnalyticsSnapshot" ADD CONSTRAINT "MinistryAnalyticsSnapshot_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MinistryAnalyticsSnapshot" ADD CONSTRAINT "MinistryAnalyticsSnapshot_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamAnalyticsSnapshot" ADD CONSTRAINT "TeamAnalyticsSnapshot_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamAnalyticsSnapshot" ADD CONSTRAINT "TeamAnalyticsSnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantOperationalSnapshot" ADD CONSTRAINT "ServantOperationalSnapshot_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServantOperationalSnapshot" ADD CONSTRAINT "ServantOperationalSnapshot_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

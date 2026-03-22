ALTER TABLE "User"
ADD COLUMN "servantId" TEXT;

CREATE UNIQUE INDEX "User_servantId_key" ON "User"("servantId");
CREATE INDEX "User_servantId_idx" ON "User"("servantId");

ALTER TABLE "User"
ADD CONSTRAINT "User_servantId_fkey"
FOREIGN KEY ("servantId") REFERENCES "Servant"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

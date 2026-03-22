-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PASTOR', 'COORDENADOR', 'LIDER', 'APOIO');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MASCULINO', 'FEMININO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ServantStatus" AS ENUM ('RECRUTAMENTO', 'RECICLAGEM', 'ATIVO', 'INATIVO', 'AFASTADO');

-- CreateEnum
CREATE TYPE "Aptitude" AS ENUM ('SOCIAL', 'OPERACIONAL', 'TECNICO', 'APOIO', 'LIDERANCA');

-- CreateEnum
CREATE TYPE "WorshipServiceType" AS ENUM ('DOMINGO', 'QUINTA', 'ESPECIAL', 'CEIA', 'VIGILIA', 'CONGRESSO');

-- CreateEnum
CREATE TYPE "WorshipServiceStatus" AS ENUM ('PLANEJADO', 'CONFIRMADO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('ASSIGNED', 'CONFIRMED', 'SWAPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENTE', 'FALTA', 'FALTA_JUSTIFICADA');

-- CreateEnum
CREATE TYPE "PastoralVisitStatus" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA');

-- CreateEnum
CREATE TYPE "TalentStage" AS ENUM ('RECRUTA', 'EM_TREINAMENTO', 'EM_AVALIACAO', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'VISIT_RESOLVED', 'SCHEDULE_SWAP', 'DELETE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "phone" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "popText" TEXT,
    "coordinatorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "gender" "Gender",
    "birthDate" TIMESTAMP(3),
    "status" "ServantStatus" NOT NULL DEFAULT 'RECRUTAMENTO',
    "aptitude" "Aptitude",
    "classGroup" TEXT,
    "mainSectorId" TEXT,
    "notes" TEXT,
    "joinedAt" TIMESTAMP(3),
    "consecutiveAbsences" INTEGER NOT NULL DEFAULT 0,
    "monthlyAbsences" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantStatusHistory" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "fromStatus" "ServantStatus",
    "toStatus" "ServantStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServantStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorshipService" (
    "id" TEXT NOT NULL,
    "type" "WorshipServiceType" NOT NULL,
    "title" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "notes" TEXT,
    "status" "WorshipServiceStatus" NOT NULL DEFAULT 'PLANEJADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorshipService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "classGroup" TEXT,
    "assignedByUserId" TEXT NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSwapHistory" (
    "id" TEXT NOT NULL,
    "fromScheduleId" TEXT NOT NULL,
    "toScheduleId" TEXT NOT NULL,
    "reason" TEXT,
    "swappedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleSwapHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "justification" TEXT,
    "notes" TEXT,
    "registeredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastoralVisit" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PastoralVisitStatus" NOT NULL DEFAULT 'ABERTA',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastoralVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastoralAlert" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "trigger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "resolvedByUserId" TEXT,

    CONSTRAINT "PastoralAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talent" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "stage" "TalentStage" NOT NULL,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Talent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_name_key" ON "Sector"("name");

-- CreateIndex
CREATE INDEX "Sector_coordinatorUserId_idx" ON "Sector"("coordinatorUserId");

-- CreateIndex
CREATE INDEX "Servant_name_idx" ON "Servant"("name");

-- CreateIndex
CREATE INDEX "Servant_status_idx" ON "Servant"("status");

-- CreateIndex
CREATE INDEX "Servant_mainSectorId_idx" ON "Servant"("mainSectorId");

-- CreateIndex
CREATE INDEX "ServantStatusHistory_servantId_createdAt_idx" ON "ServantStatusHistory"("servantId", "createdAt");

-- CreateIndex
CREATE INDEX "WorshipService_serviceDate_idx" ON "WorshipService"("serviceDate");

-- CreateIndex
CREATE INDEX "WorshipService_type_idx" ON "WorshipService"("type");

-- CreateIndex
CREATE UNIQUE INDEX "WorshipService_serviceDate_startTime_title_key" ON "WorshipService"("serviceDate", "startTime", "title");

-- CreateIndex
CREATE INDEX "Schedule_serviceId_idx" ON "Schedule"("serviceId");

-- CreateIndex
CREATE INDEX "Schedule_servantId_idx" ON "Schedule"("servantId");

-- CreateIndex
CREATE INDEX "Schedule_sectorId_idx" ON "Schedule"("sectorId");

-- CreateIndex
CREATE INDEX "Schedule_status_idx" ON "Schedule"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_serviceId_servantId_sectorId_key" ON "Schedule"("serviceId", "servantId", "sectorId");

-- CreateIndex
CREATE INDEX "ScheduleSwapHistory_createdAt_idx" ON "ScheduleSwapHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ScheduleSwapHistory_swappedByUserId_idx" ON "ScheduleSwapHistory"("swappedByUserId");

-- CreateIndex
CREATE INDEX "Attendance_serviceId_idx" ON "Attendance"("serviceId");

-- CreateIndex
CREATE INDEX "Attendance_servantId_idx" ON "Attendance"("servantId");

-- CreateIndex
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_serviceId_servantId_key" ON "Attendance"("serviceId", "servantId");

-- CreateIndex
CREATE INDEX "PastoralVisit_servantId_idx" ON "PastoralVisit"("servantId");

-- CreateIndex
CREATE INDEX "PastoralVisit_status_idx" ON "PastoralVisit"("status");

-- CreateIndex
CREATE INDEX "PastoralVisit_openedAt_idx" ON "PastoralVisit"("openedAt");

-- CreateIndex
CREATE INDEX "PastoralAlert_servantId_idx" ON "PastoralAlert"("servantId");

-- CreateIndex
CREATE INDEX "PastoralAlert_status_idx" ON "PastoralAlert"("status");

-- CreateIndex
CREATE INDEX "Talent_servantId_idx" ON "Talent"("servantId");

-- CreateIndex
CREATE INDEX "Talent_stage_idx" ON "Talent"("stage");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sector" ADD CONSTRAINT "Sector_coordinatorUserId_fkey" FOREIGN KEY ("coordinatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_mainSectorId_fkey" FOREIGN KEY ("mainSectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantStatusHistory" ADD CONSTRAINT "ServantStatusHistory_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSwapHistory" ADD CONSTRAINT "ScheduleSwapHistory_fromScheduleId_fkey" FOREIGN KEY ("fromScheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSwapHistory" ADD CONSTRAINT "ScheduleSwapHistory_toScheduleId_fkey" FOREIGN KEY ("toScheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSwapHistory" ADD CONSTRAINT "ScheduleSwapHistory_swappedByUserId_fkey" FOREIGN KEY ("swappedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralVisit" ADD CONSTRAINT "PastoralVisit_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralVisit" ADD CONSTRAINT "PastoralVisit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralVisit" ADD CONSTRAINT "PastoralVisit_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralAlert" ADD CONSTRAINT "PastoralAlert_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralAlert" ADD CONSTRAINT "PastoralAlert_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralAlert" ADD CONSTRAINT "PastoralAlert_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


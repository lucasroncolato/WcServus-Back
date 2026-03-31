-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PASTOR', 'COORDENADOR', 'SERVO');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserScope" AS ENUM ('GLOBAL', 'MINISTRY', 'EQUIPE', 'SELF');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MASCULINO', 'FEMININO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ServantStatus" AS ENUM ('RECRUTAMENTO', 'RECICLAGEM', 'ATIVO', 'INATIVO', 'AFASTADO');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ServantApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Aptitude" AS ENUM ('SOCIAL', 'OPERACIONAL', 'TECNICO', 'APOIO', 'LIDERANCA');

-- CreateEnum
CREATE TYPE "WorshipServiceType" AS ENUM ('DOMINGO', 'QUINTA', 'ESPECIAL', 'CEIA', 'VIGILIA', 'CONGRESSO');

-- CreateEnum
CREATE TYPE "ServiceTemplateRecurrenceType" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "WorshipServiceStatus" AS ENUM ('PLANEJADO', 'CONFIRMADO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('ASSIGNED', 'CONFIRMED', 'SWAPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleResponseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ScheduleSlotStatus" AS ENUM ('OPEN', 'ASSIGNED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'DECLINED', 'NO_SHOW', 'COMPLETED', 'SWAPPED', 'EMPTY', 'FILLED', 'SUBSTITUTE_PENDING', 'REPLACED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ScheduleSlotConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ScheduleVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScheduleSlotChangeType" AS ENUM ('ASSIGNMENT', 'REPLACEMENT', 'ABSENCE_REPLACEMENT', 'FILL_OPEN_SLOT', 'AUTO_GENERATED', 'STATUS_UPDATE');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENTE', 'FALTA', 'FALTA_JUSTIFICADA');

-- CreateEnum
CREATE TYPE "PastoralVisitStatus" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA');

-- CreateEnum
CREATE TYPE "DevotionalStatus" AS ENUM ('DONE', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "MonthlyFastingStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TalentStage" AS ENUM ('RECRUTA', 'EM_TREINAMENTO', 'EM_AVALIACAO', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "TalentReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_ADMIN_REVIEW', 'ADMIN_CONFIRMED_REJECTION', 'ADMIN_REVERSED_REJECTION');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'VISIT_RESOLVED', 'SCHEDULE_SWAP', 'CREATE_SERVANT', 'UPDATE_SERVANT', 'CREATE_MINISTRY', 'UPDATE_MINISTRY', 'GENERATE_SCHEDULE', 'ASSIGN', 'SWAP', 'FILL', 'RESOLVE_PASTORAL_PENDING', 'TRAINING_CHANGE', 'USER_SCOPE_CHANGE', 'USER_ROLE_CHANGE', 'USER_LOGIN', 'USER_LOGOUT', 'SCHEDULE_PUBLISH', 'SLOT_ASSIGNED', 'SLOT_CONFIRMED', 'SLOT_DECLINED', 'SLOT_NO_SHOW', 'SLOT_COMPLETED', 'SLOT_SWAPPED', 'ATTENDANCE_REGISTERED', 'PASTORAL_ACTION', 'MINISTRY_TASK_TEMPLATE_CREATED', 'MINISTRY_TASK_TEMPLATE_UPDATED', 'MINISTRY_TASK_OCCURRENCE_CREATED', 'MINISTRY_TASK_ASSIGNED', 'MINISTRY_TASK_PROGRESS_UPDATED', 'MINISTRY_TASK_COMPLETED', 'MINISTRY_TASK_CANCELLED', 'MINISTRY_TASK_REASSIGNED', 'MINISTRY_TASK_REALLOCATION_REQUESTED', 'MINISTRY_TASK_REALLOCATED_AUTOMATICALLY', 'MINISTRY_TASK_REALLOCATED_MANUALLY', 'MINISTRY_TASK_UNASSIGNED_AFTER_SCALE_CHANGE', 'MINISTRY_TASK_ASSIGNEE_ADDED', 'MINISTRY_TASK_ASSIGNEE_REMOVED', 'MINISTRY_TASK_OVERDUE', 'MINISTRY_TASK_RECURRING_GENERATED', 'MINISTRY_TASK_DUE_SOON', 'GAMIFICATION_POINTS_GRANTED', 'GAMIFICATION_LEVEL_UPDATED', 'GAMIFICATION_ACHIEVEMENT_UNLOCKED', 'DELETE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRYING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationProvider" AS ENUM ('MOCK', 'META_CLOUD');

-- CreateEnum
CREATE TYPE "SupportRequestType" AS ENUM ('GERAL', 'DADOS', 'AUTORIZACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('ABERTO', 'EM_ANALISE', 'RESOLVIDO');

-- CreateEnum
CREATE TYPE "MinistryTaskRecurrenceType" AS ENUM ('EVERY_SERVICE', 'WEEKLY', 'MONTHLY', 'FIRST_SERVICE_OF_MONTH', 'LAST_SERVICE_OF_MONTH', 'CUSTOM', 'MANUAL');

-- CreateEnum
CREATE TYPE "MinistryTaskAssigneeMode" AS ENUM ('OPTIONAL', 'REQUIRED');

-- CreateEnum
CREATE TYPE "MinistryTaskOccurrenceStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MinistryTaskChecklistItemStatus" AS ENUM ('PENDING', 'DONE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "MinistryTaskReallocationMode" AS ENUM ('MANUAL', 'AUTO_EQUAL_DISTRIBUTION', 'AUTO_BEST_MATCH', 'UNASSIGN');

-- CreateEnum
CREATE TYPE "MinistryTaskReallocationStatus" AS ENUM ('NONE', 'PENDING_REALLOCATION', 'REASSIGNED', 'UNASSIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MinistryTaskAssignmentChangeType" AS ENUM ('ASSIGN', 'REASSIGN_MANUAL', 'REASSIGN_AUTO', 'UNASSIGN');

-- CreateEnum
CREATE TYPE "MinistryTaskAssigneeRole" AS ENUM ('PRIMARY', 'SUPPORT', 'REVIEWER');

-- CreateEnum
CREATE TYPE "MinistryTaskOccurrencePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "MinistryTaskOccurrenceCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "JourneyLogType" AS ENUM ('SERVICE', 'TASK', 'CHECKLIST', 'TRAINING', 'TRACK', 'EVENT', 'SUBSTITUTE', 'HELP', 'MILESTONE');

-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('TIME', 'EVENT', 'CONDITION');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('TASK_MARK_OVERDUE', 'TASK_NOTIFY_DUE_SOON', 'TASK_NOTIFY_COORDINATOR_OVERDUE', 'TASK_ALERT_UNASSIGNED', 'SCHEDULE_ALERT_INCOMPLETE', 'SCHEDULE_ALERT_UNCONFIRMED', 'SCHEDULE_FOLLOWUP_DECLINED', 'TRAINING_ALERT_PENDING', 'TRACK_ALERT_STALLED', 'TRACK_MARK_STAGNATED', 'JOURNEY_REGISTER_EVENT');

-- CreateEnum
CREATE TYPE "ChurchModuleKey" AS ENUM ('ANALYTICS', 'AUTOMATIONS', 'TIMELINE', 'REPORTS', 'NOTIFICATIONS', 'TASKS', 'SCHEDULES', 'JOURNEY');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "TimelineScope" AS ENUM ('CHURCH', 'MINISTRY', 'SERVANT');

-- CreateEnum
CREATE TYPE "TimelineEntryType" AS ENUM ('SERVICE_COMPLETED', 'TASK_COMPLETED', 'TRAINING_COMPLETED', 'TRACK_PROGRESS', 'SCHEDULE_PUBLISHED', 'TASK_OVERDUE', 'AUTOMATION_TRIGGERED', 'CHURCH_MILESTONE', 'MINISTRY_EVENT', 'PASTORAL_ALERT', 'GENERIC_EVENT');

-- CreateTable
CREATE TABLE "Church" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Church_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "scope" "UserScope" NOT NULL DEFAULT 'GLOBAL',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "servantId" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "churchId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
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
CREATE TABLE "Ministry" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "popText" TEXT,
    "coordinatorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Ministry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "ministryId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "leaderUserId" TEXT,
    "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "gender" "Gender",
    "birthDate" TIMESTAMP(3),
    "status" "ServantStatus" NOT NULL DEFAULT 'RECRUTAMENTO',
    "trainingStatus" "TrainingStatus" NOT NULL DEFAULT 'PENDING',
    "approvalStatus" "ServantApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "approvalRequestedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvalUpdatedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "aptitude" "Aptitude",
    "mainMinistryId" TEXT,
    "teamId" TEXT,
    "churchId" TEXT NOT NULL,
    "notes" TEXT,
    "joinedAt" TIMESTAMP(3),
    "consecutiveAbsences" INTEGER NOT NULL DEFAULT 0,
    "monthlyAbsences" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Servant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantMinistry" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "trainingStatus" "TrainingStatus" NOT NULL DEFAULT 'PENDING',
    "trainingCompletedAt" TIMESTAMP(3),
    "trainingReviewedByUserId" TEXT,
    "trainingNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServantMinistry_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "ServiceTemplate" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorshipServiceType" NOT NULL,
    "recurrenceType" "ServiceTemplateRecurrenceType" NOT NULL DEFAULT 'WEEKLY',
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "generateAheadDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorshipService" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "templateId" TEXT,
    "type" "WorshipServiceType" NOT NULL,
    "title" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "canceled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" "WorshipServiceStatus" NOT NULL DEFAULT 'PLANEJADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "WorshipService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTemplateSlot" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "teamId" TEXT,
    "responsibilityId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "requiredTalentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTemplateSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleVersion" (
    "id" TEXT NOT NULL,
    "worshipServiceId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ScheduleVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleVersionSlot" (
    "id" TEXT NOT NULL,
    "scheduleVersionId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "responsibilityId" TEXT,
    "assignedServantId" TEXT,
    "status" "ScheduleSlotStatus" NOT NULL DEFAULT 'OPEN',
    "position" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleVersionSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'ASSIGNED',
    "responseStatus" "ScheduleResponseStatus" NOT NULL DEFAULT 'PENDING',
    "responseAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "teamId" TEXT,
    "churchId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "templateSlotId" TEXT,
    "responsibilityId" TEXT,
    "functionName" TEXT NOT NULL,
    "slotLabel" TEXT,
    "position" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "requiredTraining" BOOLEAN NOT NULL DEFAULT true,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "status" "ScheduleSlotStatus" NOT NULL DEFAULT 'OPEN',
    "confirmationStatus" "ScheduleSlotConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "assignedServantId" TEXT,
    "assignedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSlotChange" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "changeType" "ScheduleSlotChangeType" NOT NULL,
    "fromServantId" TEXT,
    "toServantId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "performedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleSlotChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleResponseHistory" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "responseStatus" "ScheduleResponseStatus" NOT NULL,
    "declineReason" TEXT,
    "respondedByUserId" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleResponseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantAvailability" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "shift" "Shift" NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServantAvailability_pkey" PRIMARY KEY ("id")
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
    "churchId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "justification" TEXT,
    "notes" TEXT,
    "registeredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastoralVisit" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PastoralVisitStatus" NOT NULL DEFAULT 'ABERTA',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "PastoralVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastoralWeeklyFollowUp" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "responsibleUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "PastoralWeeklyFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDevotional" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "devotionalDate" TIMESTAMP(3) NOT NULL,
    "status" "DevotionalStatus" NOT NULL DEFAULT 'DONE',
    "notes" TEXT,
    "registeredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyDevotional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyFasting" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "referenceMonth" TIMESTAMP(3) NOT NULL,
    "status" "MonthlyFastingStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "registeredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyFasting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastoralAlert" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "trigger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "resolvedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "PastoralAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talent" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "stage" "TalentStage" NOT NULL,
    "reviewStatus" "TalentReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "rejectionReason" TEXT,
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Talent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "type" "SupportRequestType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'ABERTO',
    "authorUserId" TEXT NOT NULL,
    "handledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryResponsibility" (
    "id" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "name" TEXT,
    "title" TEXT NOT NULL,
    "activity" TEXT,
    "functionName" TEXT,
    "description" TEXT,
    "requiredTraining" BOOLEAN NOT NULL DEFAULT false,
    "requiredAptitude" "Aptitude",
    "responsibleServantId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistryResponsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryTaskTemplate" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "recurrenceType" "MinistryTaskRecurrenceType" NOT NULL DEFAULT 'MANUAL',
    "recurrenceConfig" JSONB,
    "linkedToServiceType" "WorshipServiceType",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assigneeMode" "MinistryTaskAssigneeMode" NOT NULL DEFAULT 'OPTIONAL',
    "reallocationMode" "MinistryTaskReallocationMode" NOT NULL DEFAULT 'MANUAL',
    "maxAssignmentsPerServantPerMonth" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "MinistryTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryTaskTemplateChecklistItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinistryTaskTemplateChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryTaskOccurrence" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "serviceId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "assignedServantId" TEXT,
    "originAssignedServantId" TEXT,
    "status" "MinistryTaskOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "reallocationMode" "MinistryTaskReallocationMode",
    "reallocationStatus" "MinistryTaskReallocationStatus" NOT NULL DEFAULT 'NONE',
    "lastReassignedAt" TIMESTAMP(3),
    "lastReassignedBy" TEXT,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "slaMinutes" INTEGER,
    "priority" "MinistryTaskOccurrencePriority" NOT NULL DEFAULT 'MEDIUM',
    "criticality" "MinistryTaskOccurrenceCriticality" NOT NULL DEFAULT 'MEDIUM',
    "lastProgressAt" TIMESTAMP(3),
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "MinistryTaskOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryTaskOccurrenceAssignee" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "role" "MinistryTaskAssigneeRole" NOT NULL DEFAULT 'SUPPORT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedBy" TEXT,

    CONSTRAINT "MinistryTaskOccurrenceAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryTaskOccurrenceAssignmentHistory" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "fromServantId" TEXT,
    "toServantId" TEXT,
    "changedBy" TEXT,
    "changeType" "MinistryTaskAssignmentChangeType" NOT NULL,
    "preserveProgress" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinistryTaskOccurrenceAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryTaskOccurrenceChecklistItem" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "templateChecklistItemId" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "MinistryTaskChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "checkedAt" TIMESTAMP(3),
    "checkedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "MinistryTaskOccurrenceChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantJourney" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "totalServices" INTEGER NOT NULL DEFAULT 0,
    "totalTasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalTrainingsCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalEventsServed" INTEGER NOT NULL DEFAULT 0,
    "monthsServing" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServantJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyMilestone" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantMilestone" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServantMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyLog" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "type" "JourneyLogType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthTrack" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "ministryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthTrackStep" (
    "id" TEXT NOT NULL,
    "growthTrackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stepOrder" INTEGER NOT NULL,
    "criteria" JSONB,
    "manualReview" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthTrackStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantGrowthProgress" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "growthTrackId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "progressValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "verifiedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServantGrowthProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantMonthlyStats" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "ministryId" TEXT,
    "servantId" TEXT NOT NULL,
    "referenceMonth" TIMESTAMP(3) NOT NULL,
    "attendanceConfirmed" INTEGER NOT NULL DEFAULT 0,
    "absences" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksOverdue" INTEGER NOT NULL DEFAULT 0,
    "checklistPerfect" INTEGER NOT NULL DEFAULT 0,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServantMonthlyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "churchId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "AutomationTriggerType" NOT NULL,
    "triggerConfig" JSONB,
    "actionType" "AutomationActionType" NOT NULL,
    "actionConfig" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecutionLog" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEntry" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "ministryId" TEXT,
    "servantId" TEXT,
    "actorUserId" TEXT,
    "scope" "TimelineScope" NOT NULL,
    "type" "TimelineEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "link" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchSettings" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "operationalWeekStartsOn" INTEGER NOT NULL DEFAULT 1,
    "defaultJourneyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requireScheduleConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurchSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchBranding" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#1D4ED8',
    "secondaryColor" TEXT DEFAULT '#0F172A',
    "accentColor" TEXT DEFAULT '#16A34A',
    "welcomeMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurchBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchModule" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "moduleKey" "ChurchModuleKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurchModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchAutomationPreference" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "overdueGraceDays" INTEGER NOT NULL DEFAULT 0,
    "stalledTrackDays" INTEGER NOT NULL DEFAULT 30,
    "noServiceAlertDays" INTEGER NOT NULL DEFAULT 45,
    "incompleteScheduleWindowHrs" INTEGER NOT NULL DEFAULT 48,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurchAutomationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "interval" "PlanInterval" NOT NULL DEFAULT 'MONTHLY',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "maxServants" INTEGER,
    "maxUsers" INTEGER,
    "maxMinistries" INTEGER,
    "modules" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchPlan" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "limitsSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurchPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMinistryBinding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ministryId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMinistryBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
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

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "servantId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationQueue" (
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

    CONSTRAINT "NotificationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
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

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Church_active_idx" ON "Church"("active");

-- CreateIndex
CREATE INDEX "Church_name_idx" ON "Church"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_servantId_key" ON "User"("servantId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_scope_idx" ON "User"("scope");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_servantId_idx" ON "User"("servantId");

-- CreateIndex
CREATE INDEX "User_churchId_idx" ON "User"("churchId");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ministry_name_key" ON "Ministry"("name");

-- CreateIndex
CREATE INDEX "Ministry_coordinatorUserId_idx" ON "Ministry"("coordinatorUserId");

-- CreateIndex
CREATE INDEX "Ministry_churchId_idx" ON "Ministry"("churchId");

-- CreateIndex
CREATE INDEX "Ministry_deletedAt_idx" ON "Ministry"("deletedAt");

-- CreateIndex
CREATE INDEX "Team_ministryId_idx" ON "Team"("ministryId");

-- CreateIndex
CREATE INDEX "Team_leaderUserId_idx" ON "Team"("leaderUserId");

-- CreateIndex
CREATE INDEX "Team_status_idx" ON "Team"("status");

-- CreateIndex
CREATE INDEX "Team_churchId_idx" ON "Team"("churchId");

-- CreateIndex
CREATE INDEX "Team_deletedAt_idx" ON "Team"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Team_ministryId_name_key" ON "Team"("ministryId", "name");

-- CreateIndex
CREATE INDEX "Servant_name_idx" ON "Servant"("name");

-- CreateIndex
CREATE INDEX "Servant_status_idx" ON "Servant"("status");

-- CreateIndex
CREATE INDEX "Servant_trainingStatus_idx" ON "Servant"("trainingStatus");

-- CreateIndex
CREATE INDEX "Servant_approvalStatus_idx" ON "Servant"("approvalStatus");

-- CreateIndex
CREATE INDEX "Servant_approvalRequestedByUserId_idx" ON "Servant"("approvalRequestedByUserId");

-- CreateIndex
CREATE INDEX "Servant_approvedByUserId_idx" ON "Servant"("approvedByUserId");

-- CreateIndex
CREATE INDEX "Servant_mainMinistryId_idx" ON "Servant"("mainMinistryId");

-- CreateIndex
CREATE INDEX "Servant_teamId_idx" ON "Servant"("teamId");

-- CreateIndex
CREATE INDEX "Servant_churchId_idx" ON "Servant"("churchId");

-- CreateIndex
CREATE INDEX "Servant_deletedAt_idx" ON "Servant"("deletedAt");

-- CreateIndex
CREATE INDEX "ServantMinistry_ministryId_idx" ON "ServantMinistry"("ministryId");

-- CreateIndex
CREATE INDEX "ServantMinistry_ministryId_trainingStatus_idx" ON "ServantMinistry"("ministryId", "trainingStatus");

-- CreateIndex
CREATE INDEX "ServantMinistry_trainingReviewedByUserId_idx" ON "ServantMinistry"("trainingReviewedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ServantMinistry_servantId_ministryId_key" ON "ServantMinistry"("servantId", "ministryId");

-- CreateIndex
CREATE INDEX "ServantStatusHistory_servantId_createdAt_idx" ON "ServantStatusHistory"("servantId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceTemplate_churchId_active_idx" ON "ServiceTemplate"("churchId", "active");

-- CreateIndex
CREATE INDEX "ServiceTemplate_churchId_recurrenceType_idx" ON "ServiceTemplate"("churchId", "recurrenceType");

-- CreateIndex
CREATE INDEX "WorshipService_serviceDate_idx" ON "WorshipService"("serviceDate");

-- CreateIndex
CREATE INDEX "WorshipService_type_idx" ON "WorshipService"("type");

-- CreateIndex
CREATE INDEX "WorshipService_churchId_idx" ON "WorshipService"("churchId");

-- CreateIndex
CREATE INDEX "WorshipService_templateId_idx" ON "WorshipService"("templateId");

-- CreateIndex
CREATE INDEX "WorshipService_deletedAt_idx" ON "WorshipService"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorshipService_serviceDate_startTime_title_key" ON "WorshipService"("serviceDate", "startTime", "title");

-- CreateIndex
CREATE INDEX "ServiceTemplateSlot_templateId_idx" ON "ServiceTemplateSlot"("templateId");

-- CreateIndex
CREATE INDEX "ServiceTemplateSlot_ministryId_idx" ON "ServiceTemplateSlot"("ministryId");

-- CreateIndex
CREATE INDEX "ServiceTemplateSlot_teamId_idx" ON "ServiceTemplateSlot"("teamId");

-- CreateIndex
CREATE INDEX "ServiceTemplateSlot_responsibilityId_idx" ON "ServiceTemplateSlot"("responsibilityId");

-- CreateIndex
CREATE INDEX "ScheduleVersion_worshipServiceId_status_idx" ON "ScheduleVersion"("worshipServiceId", "status");

-- CreateIndex
CREATE INDEX "ScheduleVersion_churchId_idx" ON "ScheduleVersion"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleVersion_worshipServiceId_versionNumber_key" ON "ScheduleVersion"("worshipServiceId", "versionNumber");

-- CreateIndex
CREATE INDEX "ScheduleVersionSlot_scheduleVersionId_position_idx" ON "ScheduleVersionSlot"("scheduleVersionId", "position");

-- CreateIndex
CREATE INDEX "ScheduleVersionSlot_ministryId_idx" ON "ScheduleVersionSlot"("ministryId");

-- CreateIndex
CREATE INDEX "ScheduleVersionSlot_responsibilityId_idx" ON "ScheduleVersionSlot"("responsibilityId");

-- CreateIndex
CREATE INDEX "ScheduleVersionSlot_assignedServantId_idx" ON "ScheduleVersionSlot"("assignedServantId");

-- CreateIndex
CREATE INDEX "Schedule_serviceId_idx" ON "Schedule"("serviceId");

-- CreateIndex
CREATE INDEX "Schedule_servantId_idx" ON "Schedule"("servantId");

-- CreateIndex
CREATE INDEX "Schedule_ministryId_idx" ON "Schedule"("ministryId");

-- CreateIndex
CREATE INDEX "Schedule_status_idx" ON "Schedule"("status");

-- CreateIndex
CREATE INDEX "Schedule_responseStatus_idx" ON "Schedule"("responseStatus");

-- CreateIndex
CREATE INDEX "Schedule_churchId_idx" ON "Schedule"("churchId");

-- CreateIndex
CREATE INDEX "Schedule_deletedAt_idx" ON "Schedule"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_serviceId_servantId_ministryId_key" ON "Schedule"("serviceId", "servantId", "ministryId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_serviceId_ministryId_idx" ON "ScheduleSlot"("serviceId", "ministryId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_teamId_idx" ON "ScheduleSlot"("teamId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_status_idx" ON "ScheduleSlot"("status");

-- CreateIndex
CREATE INDEX "ScheduleSlot_assignedServantId_idx" ON "ScheduleSlot"("assignedServantId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_responsibilityId_idx" ON "ScheduleSlot"("responsibilityId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_scheduleId_idx" ON "ScheduleSlot"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_templateSlotId_idx" ON "ScheduleSlot"("templateSlotId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_churchId_idx" ON "ScheduleSlot"("churchId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_deletedAt_idx" ON "ScheduleSlot"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleSlot_serviceId_ministryId_functionName_position_key" ON "ScheduleSlot"("serviceId", "ministryId", "functionName", "position");

-- CreateIndex
CREATE INDEX "ScheduleSlotChange_slotId_createdAt_idx" ON "ScheduleSlotChange"("slotId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleSlotChange_changeType_createdAt_idx" ON "ScheduleSlotChange"("changeType", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleSlotChange_performedByUserId_idx" ON "ScheduleSlotChange"("performedByUserId");

-- CreateIndex
CREATE INDEX "ScheduleResponseHistory_scheduleId_respondedAt_idx" ON "ScheduleResponseHistory"("scheduleId", "respondedAt");

-- CreateIndex
CREATE INDEX "ScheduleResponseHistory_respondedByUserId_idx" ON "ScheduleResponseHistory"("respondedByUserId");

-- CreateIndex
CREATE INDEX "ServantAvailability_servantId_idx" ON "ServantAvailability"("servantId");

-- CreateIndex
CREATE UNIQUE INDEX "ServantAvailability_servantId_dayOfWeek_shift_key" ON "ServantAvailability"("servantId", "dayOfWeek", "shift");

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
CREATE INDEX "Attendance_churchId_idx" ON "Attendance"("churchId");

-- CreateIndex
CREATE INDEX "Attendance_deletedAt_idx" ON "Attendance"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_serviceId_servantId_key" ON "Attendance"("serviceId", "servantId");

-- CreateIndex
CREATE INDEX "PastoralVisit_servantId_idx" ON "PastoralVisit"("servantId");

-- CreateIndex
CREATE INDEX "PastoralVisit_status_idx" ON "PastoralVisit"("status");

-- CreateIndex
CREATE INDEX "PastoralVisit_openedAt_idx" ON "PastoralVisit"("openedAt");

-- CreateIndex
CREATE INDEX "PastoralVisit_churchId_idx" ON "PastoralVisit"("churchId");

-- CreateIndex
CREATE INDEX "PastoralVisit_deletedAt_idx" ON "PastoralVisit"("deletedAt");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_weekStartDate_idx" ON "PastoralWeeklyFollowUp"("weekStartDate");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_servantId_weekStartDate_idx" ON "PastoralWeeklyFollowUp"("servantId", "weekStartDate");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_ministryId_weekStartDate_idx" ON "PastoralWeeklyFollowUp"("ministryId", "weekStartDate");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_scheduleId_idx" ON "PastoralWeeklyFollowUp"("scheduleId");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_responsibleUserId_idx" ON "PastoralWeeklyFollowUp"("responsibleUserId");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_churchId_idx" ON "PastoralWeeklyFollowUp"("churchId");

-- CreateIndex
CREATE INDEX "PastoralWeeklyFollowUp_deletedAt_idx" ON "PastoralWeeklyFollowUp"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PastoralWeeklyFollowUp_servantId_ministryId_weekStartDate_key" ON "PastoralWeeklyFollowUp"("servantId", "ministryId", "weekStartDate");

-- CreateIndex
CREATE INDEX "DailyDevotional_devotionalDate_idx" ON "DailyDevotional"("devotionalDate");

-- CreateIndex
CREATE INDEX "DailyDevotional_servantId_devotionalDate_idx" ON "DailyDevotional"("servantId", "devotionalDate");

-- CreateIndex
CREATE INDEX "DailyDevotional_registeredByUserId_idx" ON "DailyDevotional"("registeredByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyDevotional_servantId_devotionalDate_key" ON "DailyDevotional"("servantId", "devotionalDate");

-- CreateIndex
CREATE INDEX "MonthlyFasting_referenceMonth_idx" ON "MonthlyFasting"("referenceMonth");

-- CreateIndex
CREATE INDEX "MonthlyFasting_servantId_referenceMonth_idx" ON "MonthlyFasting"("servantId", "referenceMonth");

-- CreateIndex
CREATE INDEX "MonthlyFasting_registeredByUserId_idx" ON "MonthlyFasting"("registeredByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyFasting_servantId_referenceMonth_key" ON "MonthlyFasting"("servantId", "referenceMonth");

-- CreateIndex
CREATE INDEX "PastoralAlert_servantId_idx" ON "PastoralAlert"("servantId");

-- CreateIndex
CREATE INDEX "PastoralAlert_status_idx" ON "PastoralAlert"("status");

-- CreateIndex
CREATE INDEX "PastoralAlert_churchId_idx" ON "PastoralAlert"("churchId");

-- CreateIndex
CREATE INDEX "PastoralAlert_deletedAt_idx" ON "PastoralAlert"("deletedAt");

-- CreateIndex
CREATE INDEX "Talent_servantId_idx" ON "Talent"("servantId");

-- CreateIndex
CREATE INDEX "Talent_stage_idx" ON "Talent"("stage");

-- CreateIndex
CREATE INDEX "Talent_reviewStatus_idx" ON "Talent"("reviewStatus");

-- CreateIndex
CREATE INDEX "Talent_rejectedByUserId_idx" ON "Talent"("rejectedByUserId");

-- CreateIndex
CREATE INDEX "Talent_reviewedByUserId_idx" ON "Talent"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "SupportRequest_authorUserId_createdAt_idx" ON "SupportRequest"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_type_createdAt_idx" ON "SupportRequest"("type", "createdAt");

-- CreateIndex
CREATE INDEX "MinistryResponsibility_ministryId_active_idx" ON "MinistryResponsibility"("ministryId", "active");

-- CreateIndex
CREATE INDEX "MinistryResponsibility_responsibleServantId_idx" ON "MinistryResponsibility"("responsibleServantId");

-- CreateIndex
CREATE INDEX "MinistryResponsibility_requiredAptitude_idx" ON "MinistryResponsibility"("requiredAptitude");

-- CreateIndex
CREATE INDEX "MinistryResponsibility_deletedAt_idx" ON "MinistryResponsibility"("deletedAt");

-- CreateIndex
CREATE INDEX "MinistryTaskTemplate_churchId_idx" ON "MinistryTaskTemplate"("churchId");

-- CreateIndex
CREATE INDEX "MinistryTaskTemplate_ministryId_active_idx" ON "MinistryTaskTemplate"("ministryId", "active");

-- CreateIndex
CREATE INDEX "MinistryTaskTemplate_recurrenceType_active_idx" ON "MinistryTaskTemplate"("recurrenceType", "active");

-- CreateIndex
CREATE INDEX "MinistryTaskTemplate_deletedAt_idx" ON "MinistryTaskTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "MinistryTaskTemplateChecklistItem_templateId_position_idx" ON "MinistryTaskTemplateChecklistItem"("templateId", "position");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_churchId_idx" ON "MinistryTaskOccurrence"("churchId");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_templateId_scheduledFor_idx" ON "MinistryTaskOccurrence"("templateId", "scheduledFor");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_ministryId_status_scheduledFor_idx" ON "MinistryTaskOccurrence"("ministryId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_serviceId_idx" ON "MinistryTaskOccurrence"("serviceId");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_assignedServantId_scheduledFor_idx" ON "MinistryTaskOccurrence"("assignedServantId", "scheduledFor");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_reallocationStatus_scheduledFor_idx" ON "MinistryTaskOccurrence"("reallocationStatus", "scheduledFor");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_originAssignedServantId_idx" ON "MinistryTaskOccurrence"("originAssignedServantId");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_lastReassignedBy_idx" ON "MinistryTaskOccurrence"("lastReassignedBy");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_dueAt_status_idx" ON "MinistryTaskOccurrence"("dueAt", "status");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_priority_criticality_status_idx" ON "MinistryTaskOccurrence"("priority", "criticality", "status");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrence_deletedAt_idx" ON "MinistryTaskOccurrence"("deletedAt");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrenceAssignee_occurrenceId_active_role_idx" ON "MinistryTaskOccurrenceAssignee"("occurrenceId", "active", "role");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrenceAssignee_servantId_active_idx" ON "MinistryTaskOccurrenceAssignee"("servantId", "active");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrenceAssignee_removedAt_idx" ON "MinistryTaskOccurrenceAssignee"("removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MinistryTaskOccurrenceAssignee_occurrenceId_servantId_role_key" ON "MinistryTaskOccurrenceAssignee"("occurrenceId", "servantId", "role");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrenceAssignmentHistory_occurrenceId_create_idx" ON "MinistryTaskOccurrenceAssignmentHistory"("occurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrenceAssignmentHistory_fromServantId_idx" ON "MinistryTaskOccurrenceAssignmentHistory"("fromServantId");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrenceAssignmentHistory_toServantId_idx" ON "MinistryTaskOccurrenceAssignmentHistory"("toServantId");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrenceAssignmentHistory_changedBy_idx" ON "MinistryTaskOccurrenceAssignmentHistory"("changedBy");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrenceChecklistItem_occurrenceId_position_idx" ON "MinistryTaskOccurrenceChecklistItem"("occurrenceId", "position");

-- CreateIndex
CREATE INDEX "MinistryTaskOccurrenceChecklistItem_templateChecklistItemId_idx" ON "MinistryTaskOccurrenceChecklistItem"("templateChecklistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ServantJourney_servantId_key" ON "ServantJourney"("servantId");

-- CreateIndex
CREATE INDEX "ServantJourney_churchId_idx" ON "ServantJourney"("churchId");

-- CreateIndex
CREATE INDEX "ServantJourney_startedAt_idx" ON "ServantJourney"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyMilestone_code_key" ON "JourneyMilestone"("code");

-- CreateIndex
CREATE INDEX "JourneyMilestone_churchId_category_idx" ON "JourneyMilestone"("churchId", "category");

-- CreateIndex
CREATE INDEX "ServantMilestone_churchId_achievedAt_idx" ON "ServantMilestone"("churchId", "achievedAt");

-- CreateIndex
CREATE INDEX "ServantMilestone_servantId_achievedAt_idx" ON "ServantMilestone"("servantId", "achievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServantMilestone_servantId_milestoneId_key" ON "ServantMilestone"("servantId", "milestoneId");

-- CreateIndex
CREATE INDEX "JourneyLog_churchId_occurredAt_idx" ON "JourneyLog"("churchId", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyLog_servantId_occurredAt_idx" ON "JourneyLog"("servantId", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyLog_type_occurredAt_idx" ON "JourneyLog"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyLog_referenceId_idx" ON "JourneyLog"("referenceId");

-- CreateIndex
CREATE INDEX "GrowthTrack_churchId_active_idx" ON "GrowthTrack"("churchId", "active");

-- CreateIndex
CREATE INDEX "GrowthTrack_ministryId_active_idx" ON "GrowthTrack"("ministryId", "active");

-- CreateIndex
CREATE INDEX "GrowthTrackStep_growthTrackId_idx" ON "GrowthTrackStep"("growthTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthTrackStep_growthTrackId_stepOrder_key" ON "GrowthTrackStep"("growthTrackId", "stepOrder");

-- CreateIndex
CREATE INDEX "ServantGrowthProgress_churchId_servantId_idx" ON "ServantGrowthProgress"("churchId", "servantId");

-- CreateIndex
CREATE INDEX "ServantGrowthProgress_growthTrackId_completed_idx" ON "ServantGrowthProgress"("growthTrackId", "completed");

-- CreateIndex
CREATE UNIQUE INDEX "ServantGrowthProgress_servantId_stepId_key" ON "ServantGrowthProgress"("servantId", "stepId");

-- CreateIndex
CREATE INDEX "ServantMonthlyStats_churchId_referenceMonth_idx" ON "ServantMonthlyStats"("churchId", "referenceMonth");

-- CreateIndex
CREATE INDEX "ServantMonthlyStats_ministryId_referenceMonth_idx" ON "ServantMonthlyStats"("ministryId", "referenceMonth");

-- CreateIndex
CREATE UNIQUE INDEX "ServantMonthlyStats_servantId_referenceMonth_ministryId_key" ON "ServantMonthlyStats"("servantId", "referenceMonth", "ministryId");

-- CreateIndex
CREATE INDEX "AuditLog_churchId_createdAt_idx" ON "AuditLog"("churchId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AutomationRule_churchId_enabled_idx" ON "AutomationRule"("churchId", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRule_triggerType_enabled_idx" ON "AutomationRule"("triggerType", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRule_actionType_enabled_idx" ON "AutomationRule"("actionType", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRule_churchId_name_key" ON "AutomationRule"("churchId", "name");

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_churchId_createdAt_idx" ON "AutomationExecutionLog"("churchId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_ruleId_createdAt_idx" ON "AutomationExecutionLog"("ruleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationExecutionLog_churchId_dedupeKey_key" ON "AutomationExecutionLog"("churchId", "dedupeKey");

-- CreateIndex
CREATE INDEX "TimelineEntry_churchId_occurredAt_idx" ON "TimelineEntry"("churchId", "occurredAt");

-- CreateIndex
CREATE INDEX "TimelineEntry_scope_occurredAt_idx" ON "TimelineEntry"("scope", "occurredAt");

-- CreateIndex
CREATE INDEX "TimelineEntry_ministryId_occurredAt_idx" ON "TimelineEntry"("ministryId", "occurredAt");

-- CreateIndex
CREATE INDEX "TimelineEntry_servantId_occurredAt_idx" ON "TimelineEntry"("servantId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChurchSettings_churchId_key" ON "ChurchSettings"("churchId");

-- CreateIndex
CREATE INDEX "ChurchSettings_churchId_idx" ON "ChurchSettings"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "ChurchBranding_churchId_key" ON "ChurchBranding"("churchId");

-- CreateIndex
CREATE INDEX "ChurchBranding_churchId_idx" ON "ChurchBranding"("churchId");

-- CreateIndex
CREATE INDEX "ChurchModule_churchId_enabled_idx" ON "ChurchModule"("churchId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ChurchModule_churchId_moduleKey_key" ON "ChurchModule"("churchId", "moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChurchAutomationPreference_churchId_key" ON "ChurchAutomationPreference"("churchId");

-- CreateIndex
CREATE INDEX "ChurchAutomationPreference_churchId_idx" ON "ChurchAutomationPreference"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_active_idx" ON "Plan"("active");

-- CreateIndex
CREATE INDEX "Subscription_churchId_status_idx" ON "Subscription"("churchId", "status");

-- CreateIndex
CREATE INDEX "Subscription_planId_status_idx" ON "Subscription"("planId", "status");

-- CreateIndex
CREATE INDEX "ChurchPlan_planId_status_idx" ON "ChurchPlan"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChurchPlan_churchId_key" ON "ChurchPlan"("churchId");

-- CreateIndex
CREATE INDEX "UserMinistryBinding_userId_idx" ON "UserMinistryBinding"("userId");

-- CreateIndex
CREATE INDEX "UserMinistryBinding_ministryId_idx" ON "UserMinistryBinding"("ministryId");

-- CreateIndex
CREATE INDEX "UserMinistryBinding_teamId_idx" ON "UserMinistryBinding"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMinistryBinding_userId_ministryId_teamId_key" ON "UserMinistryBinding"("userId", "ministryId", "teamId");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_userId_idx" ON "UserPermissionOverride"("userId");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_permissionKey_idx" ON "UserPermissionOverride"("permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permissionKey_key" ON "UserPermissionOverride"("userId", "permissionKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_churchId_idx" ON "Notification"("churchId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_channel_status_idx" ON "NotificationTemplate"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_eventKey_channel_key" ON "NotificationTemplate"("eventKey", "channel");

-- CreateIndex
CREATE INDEX "NotificationPreference_channel_enabled_idx" ON "NotificationPreference"("channel", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_key" ON "NotificationPreference"("userId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_servantId_channel_key" ON "NotificationPreference"("servantId", "channel");

-- CreateIndex
CREATE INDEX "NotificationQueue_channel_status_nextRetryAt_idx" ON "NotificationQueue"("channel", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "NotificationQueue_userId_createdAt_idx" ON "NotificationQueue"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationQueue_servantId_createdAt_idx" ON "NotificationQueue"("servantId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_status_channel_idx" ON "NotificationLog"("status", "channel");

-- CreateIndex
CREATE INDEX "NotificationLog_eventKey_createdAt_idx" ON "NotificationLog"("eventKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSystemSetting_key_key" ON "NotificationSystemSetting"("key");

-- CreateIndex
CREATE INDEX "NotificationSystemSetting_key_idx" ON "NotificationSystemSetting"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_coordinatorUserId_fkey" FOREIGN KEY ("coordinatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_mainMinistryId_fkey" FOREIGN KEY ("mainMinistryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_approvalRequestedByUserId_fkey" FOREIGN KEY ("approvalRequestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantMinistry" ADD CONSTRAINT "ServantMinistry_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantMinistry" ADD CONSTRAINT "ServantMinistry_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantMinistry" ADD CONSTRAINT "ServantMinistry_trainingReviewedByUserId_fkey" FOREIGN KEY ("trainingReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantStatusHistory" ADD CONSTRAINT "ServantStatusHistory_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplate" ADD CONSTRAINT "ServiceTemplate_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorshipService" ADD CONSTRAINT "WorshipService_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorshipService" ADD CONSTRAINT "WorshipService_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ServiceTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplateSlot" ADD CONSTRAINT "ServiceTemplateSlot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ServiceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplateSlot" ADD CONSTRAINT "ServiceTemplateSlot_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplateSlot" ADD CONSTRAINT "ServiceTemplateSlot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplateSlot" ADD CONSTRAINT "ServiceTemplateSlot_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "MinistryResponsibility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_worshipServiceId_fkey" FOREIGN KEY ("worshipServiceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersionSlot" ADD CONSTRAINT "ScheduleVersionSlot_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersionSlot" ADD CONSTRAINT "ScheduleVersionSlot_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersionSlot" ADD CONSTRAINT "ScheduleVersionSlot_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "MinistryResponsibility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersionSlot" ADD CONSTRAINT "ScheduleVersionSlot_assignedServantId_fkey" FOREIGN KEY ("assignedServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_templateSlotId_fkey" FOREIGN KEY ("templateSlotId") REFERENCES "ServiceTemplateSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "MinistryResponsibility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_assignedServantId_fkey" FOREIGN KEY ("assignedServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlotChange" ADD CONSTRAINT "ScheduleSlotChange_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ScheduleSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlotChange" ADD CONSTRAINT "ScheduleSlotChange_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleResponseHistory" ADD CONSTRAINT "ScheduleResponseHistory_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleResponseHistory" ADD CONSTRAINT "ScheduleResponseHistory_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantAvailability" ADD CONSTRAINT "ServantAvailability_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSwapHistory" ADD CONSTRAINT "ScheduleSwapHistory_fromScheduleId_fkey" FOREIGN KEY ("fromScheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSwapHistory" ADD CONSTRAINT "ScheduleSwapHistory_toScheduleId_fkey" FOREIGN KEY ("toScheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSwapHistory" ADD CONSTRAINT "ScheduleSwapHistory_swappedByUserId_fkey" FOREIGN KEY ("swappedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralVisit" ADD CONSTRAINT "PastoralVisit_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralVisit" ADD CONSTRAINT "PastoralVisit_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralVisit" ADD CONSTRAINT "PastoralVisit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralVisit" ADD CONSTRAINT "PastoralVisit_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralWeeklyFollowUp" ADD CONSTRAINT "PastoralWeeklyFollowUp_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDevotional" ADD CONSTRAINT "DailyDevotional_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDevotional" ADD CONSTRAINT "DailyDevotional_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyFasting" ADD CONSTRAINT "MonthlyFasting_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyFasting" ADD CONSTRAINT "MonthlyFasting_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralAlert" ADD CONSTRAINT "PastoralAlert_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralAlert" ADD CONSTRAINT "PastoralAlert_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralAlert" ADD CONSTRAINT "PastoralAlert_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralAlert" ADD CONSTRAINT "PastoralAlert_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryResponsibility" ADD CONSTRAINT "MinistryResponsibility_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryResponsibility" ADD CONSTRAINT "MinistryResponsibility_responsibleServantId_fkey" FOREIGN KEY ("responsibleServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskTemplate" ADD CONSTRAINT "MinistryTaskTemplate_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskTemplate" ADD CONSTRAINT "MinistryTaskTemplate_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskTemplate" ADD CONSTRAINT "MinistryTaskTemplate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskTemplateChecklistItem" ADD CONSTRAINT "MinistryTaskTemplateChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MinistryTaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrence" ADD CONSTRAINT "MinistryTaskOccurrence_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrence" ADD CONSTRAINT "MinistryTaskOccurrence_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MinistryTaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrence" ADD CONSTRAINT "MinistryTaskOccurrence_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrence" ADD CONSTRAINT "MinistryTaskOccurrence_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrence" ADD CONSTRAINT "MinistryTaskOccurrence_assignedServantId_fkey" FOREIGN KEY ("assignedServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrence" ADD CONSTRAINT "MinistryTaskOccurrence_originAssignedServantId_fkey" FOREIGN KEY ("originAssignedServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrence" ADD CONSTRAINT "MinistryTaskOccurrence_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrence" ADD CONSTRAINT "MinistryTaskOccurrence_lastReassignedBy_fkey" FOREIGN KEY ("lastReassignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrenceAssignee" ADD CONSTRAINT "MinistryTaskOccurrenceAssignee_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "MinistryTaskOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrenceAssignee" ADD CONSTRAINT "MinistryTaskOccurrenceAssignee_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrenceAssignee" ADD CONSTRAINT "MinistryTaskOccurrenceAssignee_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrenceAssignmentHistory" ADD CONSTRAINT "MinistryTaskOccurrenceAssignmentHistory_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "MinistryTaskOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrenceAssignmentHistory" ADD CONSTRAINT "MinistryTaskOccurrenceAssignmentHistory_fromServantId_fkey" FOREIGN KEY ("fromServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrenceAssignmentHistory" ADD CONSTRAINT "MinistryTaskOccurrenceAssignmentHistory_toServantId_fkey" FOREIGN KEY ("toServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrenceAssignmentHistory" ADD CONSTRAINT "MinistryTaskOccurrenceAssignmentHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrenceChecklistItem" ADD CONSTRAINT "MinistryTaskOccurrenceChecklistItem_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "MinistryTaskOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrenceChecklistItem" ADD CONSTRAINT "MinistryTaskOccurrenceChecklistItem_templateChecklistItemI_fkey" FOREIGN KEY ("templateChecklistItemId") REFERENCES "MinistryTaskTemplateChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTaskOccurrenceChecklistItem" ADD CONSTRAINT "MinistryTaskOccurrenceChecklistItem_checkedBy_fkey" FOREIGN KEY ("checkedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantJourney" ADD CONSTRAINT "ServantJourney_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantJourney" ADD CONSTRAINT "ServantJourney_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyMilestone" ADD CONSTRAINT "JourneyMilestone_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantMilestone" ADD CONSTRAINT "ServantMilestone_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantMilestone" ADD CONSTRAINT "ServantMilestone_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantMilestone" ADD CONSTRAINT "ServantMilestone_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "JourneyMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyLog" ADD CONSTRAINT "JourneyLog_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyLog" ADD CONSTRAINT "JourneyLog_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthTrack" ADD CONSTRAINT "GrowthTrack_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthTrack" ADD CONSTRAINT "GrowthTrack_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthTrack" ADD CONSTRAINT "GrowthTrack_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthTrackStep" ADD CONSTRAINT "GrowthTrackStep_growthTrackId_fkey" FOREIGN KEY ("growthTrackId") REFERENCES "GrowthTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthTrackStep" ADD CONSTRAINT "GrowthTrackStep_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantGrowthProgress" ADD CONSTRAINT "ServantGrowthProgress_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantGrowthProgress" ADD CONSTRAINT "ServantGrowthProgress_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantGrowthProgress" ADD CONSTRAINT "ServantGrowthProgress_growthTrackId_fkey" FOREIGN KEY ("growthTrackId") REFERENCES "GrowthTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantGrowthProgress" ADD CONSTRAINT "ServantGrowthProgress_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "GrowthTrackStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantGrowthProgress" ADD CONSTRAINT "ServantGrowthProgress_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantMonthlyStats" ADD CONSTRAINT "ServantMonthlyStats_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantMonthlyStats" ADD CONSTRAINT "ServantMonthlyStats_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantMonthlyStats" ADD CONSTRAINT "ServantMonthlyStats_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchSettings" ADD CONSTRAINT "ChurchSettings_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchBranding" ADD CONSTRAINT "ChurchBranding_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchModule" ADD CONSTRAINT "ChurchModule_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchAutomationPreference" ADD CONSTRAINT "ChurchAutomationPreference_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchPlan" ADD CONSTRAINT "ChurchPlan_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchPlan" ADD CONSTRAINT "ChurchPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMinistryBinding" ADD CONSTRAINT "UserMinistryBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMinistryBinding" ADD CONSTRAINT "UserMinistryBinding_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMinistryBinding" ADD CONSTRAINT "UserMinistryBinding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationQueue" ADD CONSTRAINT "NotificationQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationQueue" ADD CONSTRAINT "NotificationQueue_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationQueue" ADD CONSTRAINT "NotificationQueue_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "NotificationQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;


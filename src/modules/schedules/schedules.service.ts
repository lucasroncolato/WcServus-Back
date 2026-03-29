import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AlertStatus,
  Aptitude,
  AttendanceStatus,
  AuditAction,
  PastoralVisitStatus,
  Prisma,
  Role,
  MinistryTaskReallocationMode,
  ScheduleResponseStatus,
  ScheduleSlotChangeType,
  ScheduleSlotStatus,
  ScheduleVersionStatus,
  ScheduleStatus,
  Shift,
  ServantApprovalStatus,
  ServantStatus,
  TeamStatus,
  TalentStage,
  TrainingStatus,
  WorshipServiceStatus,
} from '@prisma/client';
import {
  getSaoPauloWeekday,
  parseSaoPauloDateEnd,
  parseSaoPauloDateStart,
  resolvePlanningWindow,
} from 'src/common/utils/planning-window.utils';
import {
  assertServantAccess,
  getScheduleAccessWhere,
  resolveScopedMinistryIds,
} from 'src/common/auth/access-scope';
import { EventBusService } from 'src/common/events/event-bus.service';
import { AppCacheService } from 'src/common/cache/cache.service';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { EligibilityEngine } from './eligibility/eligibility.engine';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { DuplicateScheduleDto } from './dto/duplicate-schedule.dto';
import { GenerateMonthScheduleDto } from './dto/generate-month-schedule.dto';
import { GeneratePeriodScheduleDto } from './dto/generate-period-schedule.dto';
import { GenerateServiceScheduleDto } from './dto/generate-service-schedule.dto';
import { GenerateServicesScheduleDto } from './dto/generate-services-schedule.dto';
import { GenerateYearScheduleDto } from './dto/generate-year-schedule.dto';
import { AutoGenerateScheduleSlotsDto } from './dto/auto-generate-schedule-slots.dto';
import { AssignScheduleSlotDto } from './dto/assign-schedule-slot.dto';
import { ContextualSwapScheduleSlotDto } from './dto/contextual-swap-schedule-slot.dto';
import { ScheduleSlotSwapContextDto } from './dto/contextual-swap-schedule-slot.dto';
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';
import { ListSchedulesQueryDto } from './dto/list-schedules-query.dto';
import { ListEligibleScheduleServantsQueryDto } from './dto/list-eligible-schedule-servants-query.dto';
import { ListScheduleMobileContextQueryDto } from './dto/list-schedule-mobile-context-query.dto';
import { ListScheduleWorkspaceQueryDto } from './dto/list-schedule-workspace-query.dto';
import { ListSwapHistoryQueryDto } from './dto/list-swap-history-query.dto';
import { SwapScheduleDto } from './dto/swap-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleGenerationWeightsDto } from './dto/schedule-generation-weights.dto';
import { MinistryTasksService } from '../ministry-tasks/ministry-tasks.service';

type GenerationWeights = {
  monthlyLoad: number;
  recentSequence: number;
  recentAbsences: number;
  sectorAffinity: number;
};

type GenerationOptions = {
  mode?: 'generate-month' | 'generate-year' | 'generate-service' | 'generate-services' | 'generate-period';
  year: number;
  month?: number;
  serviceIds?: string[];
  weekdays?: number[];
  ministryIds?: string[];
  teamIds?: string[];
  respectFairnessRules?: boolean;
  dryRun?: boolean;
  force?: boolean;
  allowMultiMinistrySameService?: boolean;
  weights?: ScheduleGenerationWeightsDto;
};

type AssignSlotOptions = {
  auditAction?: AuditAction;
  auditMetadata?: Record<string, unknown>;
};

type EligibleCandidate = {
  servantId: string;
  teamId: string | null;
  ministryId: string;
  isMainSector: boolean;
  assignedCountMonth: number;
  consecutiveAssignments: number;
  lastAssignedAt: Date | null;
  absencesLast60d: number;
  score: number;
};

type GenerationAction =
  | 'CREATED'
  | 'UPDATED'
  | 'SKIPPED'
  | 'CONFLICT'
  | 'WOULD_CREATE'
  | 'WOULD_UPDATE';

type GenerationItem = {
  serviceId: string;
  ministryId: string;
  servantId?: string;
  scheduleId?: string;
  action: GenerationAction;
  score?: number;
  reason?: string;
};

const DEFAULT_GENERATION_WEIGHTS: GenerationWeights = {
  monthlyLoad: 0.6,
  recentSequence: 0.2,
  recentAbsences: 0.15,
  sectorAffinity: 0.05,
};

const WORKSPACE_CONTEXT_ERRORS = {
  outOfScope: 'You do not have permission for this ministry',
  coordinatorWithoutScope: 'Coordinator has no ministry scope configured',
  coordinatorMustChoose:
    'ministryId is required when coordinator has multiple ministries in scope',
  adminMustChoose: 'ministryId is required for workspace queries',
  roleWithoutWorkspacePermission: 'You do not have permission for workspace schedules',
} as const;

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eligibilityEngine: EligibilityEngine,
    private readonly eventBus: EventBusService = {
      emit: async () => undefined,
    } as unknown as EventBusService,
    private readonly ministryTasksService: MinistryTasksService = {
      reallocateFromRemovedServant: async () => null,
    } as unknown as MinistryTasksService,
    private readonly cacheService: AppCacheService = {
      get: () => null,
      set: () => undefined,
      del: () => undefined,
    } as unknown as AppCacheService,
    private readonly tenantIntegrity: TenantIntegrityService = {
      getActorChurchId: () => null,
      assertSameChurch: () => undefined,
      assertLinkIntegrity: () => undefined,
      assertActorChurch: () => '',
    } as unknown as TenantIntegrityService,
  ) {}

  async findAll(query: ListSchedulesQueryDto, actor: JwtPayload) {
    if (query.windowMode && !query.startDate) {
      throw new BadRequestException('startDate is required when windowMode is informed');
    }

    const { start, end } = resolvePlanningWindow({
      windowMode: query.windowMode,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const scopeWhere = await getScheduleAccessWhere(this.prisma, actor);
    const ministryId = query.ministryId;
    const queryWhere: Prisma.ScheduleWhereInput = {
      serviceId: query.serviceId,
      ministryId,
      servantId: query.servantId,
      service:
        start || end
          ? {
              serviceDate: {
                gte: start,
                lte: end,
              },
            }
          : undefined,
    };
    const where: Prisma.ScheduleWhereInput =
      scopeWhere !== undefined ? { AND: [queryWhere, scopeWhere] } : queryWhere;

    const schedules = await this.prisma.schedule.findMany({
      where,
      include:
        actor.role === Role.SERVO
          ? {
              service: true,
              ministry: true,
            }
          : {
              service: true,
              servant: true,
              ministry: true,
              assignedBy: {
                select: { id: true, name: true, email: true },
              },
            },
      orderBy: { createdAt: 'desc' },
    });

    const filteredByWeekday = query.weekdays?.length
      ? schedules.filter((schedule) => query.weekdays?.includes(getSaoPauloWeekday(schedule.service.serviceDate)))
      : schedules;

    if (actor.role === Role.SERVO) {
      return filteredByWeekday.map((schedule) => ({
        id: schedule.id,
        serviceId: schedule.serviceId,
        ministryId: schedule.ministryId,
        status: schedule.status,
        responseStatus: schedule.responseStatus,
        responseAt: schedule.responseAt,
        declineReason: schedule.declineReason,
        worshipServiceId: schedule.serviceId,
        worshipServiceTitle: schedule.service.title,
        service: schedule.service,
        ministry: schedule.ministry,
      }));
    }

    return filteredByWeekday.map((schedule) => this.toApiSchedule(schedule));
  }

  async listEligibleServants(query: ListEligibleScheduleServantsQueryDto, actor: JwtPayload) {
    const ministryId = query.ministryId;
    if (!ministryId) {
      throw new BadRequestException('ministryId is required');
    }
    const cacheKey = `eligible:${query.serviceId}:${ministryId}:${query.includeReasons ? 'all' : 'only'}:${actor.sub}`;
    const cached = this.cacheService.get<
      Array<{
        servantId: string;
        servantName: string;
        ministryId: string;
        ministryTrainingStatus: TrainingStatus;
        ministryTrainingCompletedAt: Date | null;
        eligible: boolean;
        reasons: string[];
        score: number;
        priority: 'LOW' | 'MEDIUM' | 'HIGH';
      }>
    >(cacheKey);
    if (cached) {
      return cached;
    }

    await this.assertCanManageMinistry(actor, ministryId);

    const service = await this.prisma.worshipService.findUnique({
      where: { id: query.serviceId },
      select: { id: true, serviceDate: true, startTime: true },
    });

    if (!service) {
      throw new NotFoundException('Worship service not found');
    }

    const weekday = getSaoPauloWeekday(service.serviceDate);
    const shift = this.resolveShiftFromStartTime(service.startTime);

    const servants = await this.prisma.servant.findMany({
      where: {
        OR: [{ mainMinistryId: ministryId }, { servantMinistries: { some: { ministryId } } }],
      },
      select: {
        id: true,
        name: true,
        status: true,
        trainingStatus: true,
        approvalStatus: true,
        mainMinistryId: true,
        servantMinistries: {
          where: { ministryId },
          select: { ministryId: true, trainingStatus: true, trainingCompletedAt: true },
        },
        availabilities: {
          where: {
            dayOfWeek: weekday,
            shift,
          },
          select: {
            available: true,
          },
        },
        talents: {
          take: 1,
          orderBy: { updatedAt: 'desc' },
          select: { stage: true },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const servantIds = servants.map((item) => item.id);
    const [conflicts, servantsWithPastoralPending] = await Promise.all([
      this.prisma.schedule.findMany({
        where: {
          serviceId: service.id,
          servantId: { in: servantIds },
        },
        select: { servantId: true, ministryId: true },
      }),
      this.getServantsWithActivePastoralPendencies(servantIds),
    ]);
    const conflictsByServant = new Map<string, Set<string>>();
    for (const item of conflicts) {
      const ministries = conflictsByServant.get(item.servantId) ?? new Set<string>();
      ministries.add(item.ministryId);
      conflictsByServant.set(item.servantId, ministries);
    }

    const evaluated = await Promise.all(servants.map(async (servant) => {
      const latestTalent = servant.talents[0];
      const conflictSectors = [...(conflictsByServant.get(servant.id) ?? new Set<string>())];
      const evaluation = await this.eligibilityEngine.evaluate({
        ministryId,
        servant: {
          id: servant.id,
          status: servant.status,
          approvalStatus: servant.approvalStatus,
          aptitude: null,
          trainingStatus: servant.trainingStatus,
          mainMinistryId: servant.mainMinistryId,
          servantMinistries: servant.servantMinistries,
        },
        hasPastoralPending: servantsWithPastoralPending.has(servant.id),
        unavailableAtServiceTime: servant.availabilities.some((availability) => !availability.available),
        conflictMinistryIds: conflictSectors,
        requiredAptitude: null,
      });

      const reasons = [...evaluation.reasons];
      if (latestTalent?.stage === TalentStage.REPROVADO) {
        reasons.push('TALENT_REJECTED');
      }

      return {
        servantId: servant.id,
        servantName: servant.name,
        ministryId,
        ministryTrainingStatus: this.resolveTrainingStatusForMinistry(servant, ministryId),
        ministryTrainingCompletedAt: this.resolveTrainingCompletedAtForMinistry(servant, ministryId),
        eligible: reasons.length === 0,
        reasons,
        score: evaluation.score ?? 0,
        priority: evaluation.priority ?? 'LOW',
      };
    }));

    const payload = query.includeReasons
      ? evaluated
      : evaluated.filter((item) => item.eligible);
    this.cacheService.set(cacheKey, payload, 15_000);
    return payload;
  }

  async mobileContext(query: ListScheduleMobileContextQueryDto, actor: JwtPayload) {
    const daysAhead = query.daysAhead ?? 30;
    const ministryId = query.ministryId;

    const allowedSectorIds = await this.resolveAllowedMinistryIds(
      actor,
      ministryId ? [ministryId] : undefined,
    );

    const [ministries, teams, services] = await Promise.all([
      this.prisma.ministry.findMany({
        where: { id: { in: allowedSectorIds } },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.team.findMany({
        where: { ministryId: { in: allowedSectorIds }, status: TeamStatus.ACTIVE },
        select: { id: true, name: true, ministryId: true },
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.worshipService.findMany({
        where: {
          serviceDate: {
            gte: new Date(),
            lte: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000),
          },
          status: { in: [WorshipServiceStatus.PLANEJADO, WorshipServiceStatus.CONFIRMADO] },
        },
        select: {
          id: true,
          title: true,
          type: true,
          serviceDate: true,
          startTime: true,
          status: true,
        },
        orderBy: [{ serviceDate: 'asc' }, { startTime: 'asc' }],
      }),
    ]);

    const suggestedMinistryId = ministryId ?? ministries[0]?.id;

    const eligibleServants =
      query.serviceId && suggestedMinistryId
        ? await this.listEligibleServants(
            {
              serviceId: query.serviceId,
              ministryId: suggestedMinistryId,
              includeReasons: query.includeIneligibilityReasons ?? true,
            },
            actor,
          )
        : [];

    return {
      filters: {
        daysAhead,
        ministryId: suggestedMinistryId ?? null,
        serviceId: query.serviceId ?? null,
      },
      ministries: ministries.map((ministry) => ({
        id: ministry.id,
        ministryId: ministry.id,
        name: ministry.name,
        ministryName: ministry.name,
      })),
      teams: teams.map((team) => ({
        ...team,
        ministryId: team.ministryId,
      })),
      services,
      servants: eligibleServants,
      shifts: Object.values(Shift),
      notes: {
        eligibleServantsRequires: ['serviceId', 'ministryId'],
      },
    };
  }

  operationModes() {
    return {
      modes: [
        {
          key: 'PLAN_PERIOD',
          title: 'Planejar periodo',
          description: 'Visao consolidada com resumo operacional do periodo e status por culto.',
        },
        {
          key: 'BUILD_SERVICE',
          title: 'Montar culto',
          description: 'Montagem manual por funcao/vaga, com elegibilidade explicita por servo.',
        },
        {
          key: 'ADJUST_ASSIGNMENTS',
          title: 'Ajustar escala',
          description: 'Troca/substituicao/fill contextualizado em vaga especifica.',
        },
      ],
    };
  }

  async periodSummary(query: ListScheduleWorkspaceQueryDto, actor: JwtPayload) {
    const statuses = await this.servicesOperationalStatus(query, actor);
    const summary = {
      totalServices: statuses.length,
      withoutSchedule: 0,
      pending: 0,
      confirmed: 0,
      conflict: 0,
      swapped: 0,
      incomplete: 0,
      cancelled: 0,
      missingSlots: 0,
      needsSwap: 0,
      alerts: [] as string[],
    };

    for (const item of statuses) {
      if (item.operationalStatus === 'SEM_ESCALA') {
        summary.withoutSchedule += 1;
      }
      if (item.operationalStatus === 'PENDENTE') {
        summary.pending += 1;
      }
      if (item.operationalStatus === 'CONFIRMADA') {
        summary.confirmed += 1;
      }
      if (item.operationalStatus === 'COM_CONFLITO') {
        summary.conflict += 1;
      }
      if (item.operationalStatus === 'TROCADA') {
        summary.swapped += 1;
      }
      if (item.operationalStatus === 'INCOMPLETA') {
        summary.incomplete += 1;
      }
      if (item.operationalStatus === 'CANCELADA') {
        summary.cancelled += 1;
      }
      summary.missingSlots += item.missingRequiredSlots;
      if (item.needsSwap) {
        summary.needsSwap += 1;
      }
      for (const alert of item.alerts) {
        summary.alerts.push(`${item.service.title}: ${alert}`);
      }
    }

    return summary;
  }

  async servicesOperationalStatus(query: ListScheduleWorkspaceQueryDto, actor: JwtPayload) {
    const { services, allowedSectorIds } = await this.resolveWorkspaceContext(query, actor);
    if (!services.length) {
      return [];
    }

    const [slots, schedules] = await Promise.all([
      this.prisma.scheduleSlot.findMany({
        where: {
          serviceId: { in: services.map((service) => service.id) },
          ministryId: { in: allowedSectorIds },
        },
      }),
      this.prisma.schedule.findMany({
        where: {
          serviceId: { in: services.map((service) => service.id) },
          ministryId: { in: allowedSectorIds },
        },
      }),
    ]);

    return services.map((service) => {
      const serviceSlots = slots.filter((slot) => slot.serviceId === service.id);
      const serviceSchedules = schedules.filter((schedule) => schedule.serviceId === service.id);
      const evaluation = this.evaluateServiceOperationalStatus(
        service.status,
        serviceSlots,
        serviceSchedules,
      );

      return {
        service: {
          id: service.id,
          title: service.title,
          type: service.type,
          serviceDate: service.serviceDate,
          startTime: service.startTime,
          status: service.status,
        },
        operationalStatus: evaluation.operationalStatus,
        missingRequiredSlots: evaluation.missingRequiredSlots,
        pendingCount: evaluation.pendingCount,
        conflictCount: evaluation.conflictCount,
        needsSwap: evaluation.needsSwap,
        alerts: evaluation.alerts,
      };
    });
  }

  async serviceBoard(serviceId: string, query: ListScheduleWorkspaceQueryDto, actor: JwtPayload) {
    const ministryId = await this.resolveWorkspaceMinistryId(query, actor);
    const cacheKey = `schedule-board:${serviceId}:${ministryId}:${actor.sub}`;
    const cached = this.cacheService.get<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const service = await this.prisma.worshipService.findUnique({
      where: { id: serviceId },
      select: { id: true, title: true, type: true, serviceDate: true, startTime: true, status: true },
    });
    if (!service) {
      throw new NotFoundException('Worship service not found');
    }

    const [slots, schedules] = await Promise.all([
      this.prisma.scheduleSlot.findMany({
        where: { serviceId, ministryId },
        include: {
          responsibility: { select: { id: true, title: true, functionName: true } },
          assignedServant: { select: { id: true, name: true, status: true, trainingStatus: true } },
        },
        orderBy: [{ functionName: 'asc' }, { position: 'asc' }],
      }),
      this.prisma.schedule.findMany({
        where: { serviceId, ministryId },
        include: {
          servant: { select: { id: true, name: true, status: true, trainingStatus: true } },
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
    ]);

    const evaluation = this.evaluateServiceOperationalStatus(service.status, slots, schedules);
    const slotsView = await Promise.all(
      slots.map(async (slot) => ({
        id: slot.id,
        functionName: slot.functionName,
        slotLabel: slot.slotLabel,
        position: slot.position,
        required: slot.required,
        requiredTraining: slot.requiredTraining,
        blocked: slot.blocked,
        blockedReason: slot.blockedReason,
        status: slot.status,
        assignedServant: slot.assignedServant
          ? {
              id: slot.assignedServant.id,
              name: slot.assignedServant.name,
            }
          : null,
        responsibility: slot.responsibility,
        eligibleServants: await this.listSlotEligibility(serviceId, ministryId, slot),
      })),
    );

    const board = {
      service,
      ministryId: ministryId,
      operationalStatus: evaluation.operationalStatus,
      summary: {
        missingRequiredSlots: evaluation.missingRequiredSlots,
        pendingCount: evaluation.pendingCount,
        conflictCount: evaluation.conflictCount,
        needsSwap: evaluation.needsSwap,
        alerts: evaluation.alerts,
      },
      slots: slotsView,
      legacyAssignments: schedules.map((schedule) => this.toApiSchedule(schedule)),
    };
    this.cacheService.set(cacheKey, board, 20_000);
    return board;
  }

  async createSlot(serviceId: string, dto: CreateScheduleSlotDto, actor: JwtPayload) {
    const ministryId = dto.ministryId;
    if (!ministryId) {
      throw new BadRequestException('ministryId is required');
    }

    await this.assertCanManageMinistry(actor, ministryId);
    await this.ensureServiceExists(serviceId);
    await this.ensureResponsibilityMatchesSector(dto.responsibilityId, ministryId);
    const responsibility = dto.responsibilityId
      ? await this.prisma.ministryResponsibility.findUnique({
          where: { id: dto.responsibilityId },
          select: { requiredTraining: true, name: true, title: true },
        })
      : null;

    const slot = await this.prisma.scheduleSlot.create({
      data: {
        serviceId,
        ministryId,
        churchId: this.requireActorChurch(actor),
        responsibilityId: dto.responsibilityId,
        functionName: dto.functionName.trim(),
        slotLabel: dto.slotLabel,
        position: dto.position ?? 1,
        required: dto.required ?? true,
        requiredTraining: dto.requiredTraining ?? responsibility?.requiredTraining ?? true,
        blocked: dto.blocked ?? false,
        blockedReason: dto.blockedReason,
        notes: dto.notes,
      },
      include: {
        assignedServant: { select: { id: true, name: true } },
        responsibility: { select: { id: true, title: true, functionName: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'ScheduleSlot',
      entityId: slot.id,
      userId: actor.sub,
      metadata: {
        serviceId,
        ministryId,
        functionName: slot.functionName,
        position: slot.position,
      },
    });

    this.invalidateSchedulingCaches(serviceId, ministryId);
    return slot;
  }

  async listVersions(serviceId: string, _actor: JwtPayload) {
    await this.ensureServiceExists(serviceId);
    return this.prisma.scheduleVersion.findMany({
      where: { worshipServiceId: serviceId },
      include: {
        createdByUser: { select: { id: true, name: true } },
      },
      orderBy: [{ versionNumber: 'desc' }],
    });
  }

  async createDraftVersion(serviceId: string, actor: JwtPayload) {
    const slots = await this.prisma.scheduleSlot.findMany({
      where: { serviceId },
      orderBy: [{ functionName: 'asc' }, { position: 'asc' }],
    });
    if (slots.length === 0) {
      throw new BadRequestException('No schedule slots found for this service');
    }

    const service = await this.prisma.worshipService.findUnique({
      where: { id: serviceId },
      select: { id: true, churchId: true },
    });
    if (!service) {
      throw new NotFoundException('Worship service not found');
    }

    const last = await this.prisma.scheduleVersion.findFirst({
      where: { worshipServiceId: serviceId },
      orderBy: [{ versionNumber: 'desc' }],
      select: { versionNumber: true },
    });

    const version = await this.prisma.scheduleVersion.create({
      data: {
        worshipServiceId: serviceId,
        churchId: service.churchId,
        versionNumber: (last?.versionNumber ?? 0) + 1,
        status: ScheduleVersionStatus.DRAFT,
        createdBy: actor.sub,
        slots: {
          create: slots.map((slot) => ({
            ministryId: slot.ministryId,
            responsibilityId: slot.responsibilityId,
            assignedServantId: slot.assignedServantId,
            status: slot.status,
            position: slot.position,
          })),
        },
      },
      include: { slots: true },
    });

    await this.eventBus.emit({
      name: 'SCHEDULE_GENERATED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: service.churchId,
      payload: {
        serviceId,
        scheduleVersionId: version.id,
        versionNumber: version.versionNumber,
      },
    });

    return version;
  }

  async publishVersion(versionId: string, actor: JwtPayload) {
    const version = await this.prisma.scheduleVersion.findUnique({
      where: { id: versionId },
      include: { worshipService: { select: { id: true, churchId: true } } },
    });
    if (!version) {
      throw new NotFoundException('Schedule version not found');
    }

    const published = await this.prisma.$transaction(async (tx) => {
      await tx.scheduleVersion.updateMany({
        where: {
          worshipServiceId: version.worshipServiceId,
          status: ScheduleVersionStatus.PUBLISHED,
        },
        data: { status: ScheduleVersionStatus.ARCHIVED },
      });

      return tx.scheduleVersion.update({
        where: { id: versionId },
        data: { status: ScheduleVersionStatus.PUBLISHED },
      });
    });

    await this.auditService.log({
      action: AuditAction.SCHEDULE_PUBLISH,
      entity: 'ScheduleVersion',
      entityId: versionId,
      userId: actor.sub,
      metadata: {
        worshipServiceId: version.worshipServiceId,
        versionNumber: version.versionNumber,
      },
    });

    return published;
  }

  async assignSlot(
    slotId: string,
    dto: AssignScheduleSlotDto,
    actor: JwtPayload,
    options?: AssignSlotOptions,
  ) {
    const slot = await this.prisma.scheduleSlot.findUnique({
      where: { id: slotId },
      include: { service: true },
    });
    if (!slot) {
      throw new NotFoundException('Schedule slot not found');
    }

    await this.assertCanManageMinistry(actor, slot.ministryId);
    const eligibility = await this.evaluateServantEligibilityForSlot(
      slot.serviceId,
      slot.ministryId,
      dto.servantId,
      slot,
    );
    if (!eligibility.eligible) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Servant is not eligible for this slot',
        reasons: eligibility.reasons,
      });
    }

    const isIdempotentRepeat =
      slot.assignedServantId === dto.servantId &&
      (slot.status === ScheduleSlotStatus.ASSIGNED ||
        slot.status === ScheduleSlotStatus.PENDING_CONFIRMATION ||
        slot.status === ScheduleSlotStatus.CONFIRMED);
    if (isIdempotentRepeat) {
      return this.prisma.scheduleSlot.findUnique({
        where: { id: slot.id },
        include: {
          assignedServant: { select: { id: true, name: true } },
          responsibility: { select: { id: true, title: true, functionName: true } },
        },
      });
    }

    const previousServantId = slot.assignedServantId;
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedSlot = await tx.scheduleSlot.update({
        where: { id: slotId },
        data: {
          assignedServantId: dto.servantId,
          assignedByUserId: actor.sub,
          status: ScheduleSlotStatus.PENDING_CONFIRMATION,
          blocked: false,
          blockedReason: null,
        },
      });

      const schedule = await tx.schedule.upsert({
        where: {
          serviceId_servantId_ministryId: {
            serviceId: slot.serviceId,
            servantId: dto.servantId,
            ministryId: slot.ministryId,
          },
        },
        update: {
          churchId: slot.churchId,
          status: ScheduleStatus.ASSIGNED,
          responseStatus: ScheduleResponseStatus.PENDING,
          responseAt: null,
          declineReason: null,
          assignedByUserId: actor.sub,
        },
        create: {
          serviceId: slot.serviceId,
          servantId: dto.servantId,
          ministryId: slot.ministryId,
          churchId: slot.churchId,
          assignedByUserId: actor.sub,
          status: ScheduleStatus.ASSIGNED,
          responseStatus: ScheduleResponseStatus.PENDING,
        },
      });

      await tx.scheduleSlot.update({
        where: { id: slotId },
        data: { scheduleId: schedule.id },
      });

      await tx.scheduleSlotChange.create({
        data: {
          slotId,
          changeType: ScheduleSlotChangeType.ASSIGNMENT,
          fromServantId: previousServantId,
          toServantId: dto.servantId,
          reason: dto.reason,
          performedByUserId: actor.sub,
          metadata: {
            serviceId: slot.serviceId,
            ministryId: slot.ministryId,
          },
        },
      });

      if (previousServantId && previousServantId !== dto.servantId) {
        const hasOtherSlots = await tx.scheduleSlot.count({
          where: {
            serviceId: slot.serviceId,
            ministryId: slot.ministryId,
            assignedServantId: previousServantId,
            NOT: { id: slotId },
          },
        });
        if (hasOtherSlots === 0) {
          await tx.schedule.deleteMany({
            where: {
              serviceId: slot.serviceId,
              ministryId: slot.ministryId,
              servantId: previousServantId,
            },
          });
        }
      }

      return updatedSlot;
    });

    await this.auditService.log({
      action: options?.auditAction ?? AuditAction.SLOT_ASSIGNED,
      entity: 'ScheduleSlot',
      entityId: slotId,
      userId: actor.sub,
      metadata: {
        action: 'ASSIGN_SLOT',
        servantId: dto.servantId,
        ...(options?.auditMetadata ?? {}),
      },
    });

    await this.eventBus.emit({
      name: 'SLOT_ASSIGNED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: slot.churchId,
      payload: {
        slotId,
        serviceId: slot.serviceId,
        ministryId: slot.ministryId,
        servantId: dto.servantId,
      },
    });

    this.invalidateSchedulingCaches(slot.serviceId, slot.ministryId);

    return this.prisma.scheduleSlot.findUnique({
      where: { id: updated.id },
      include: {
        assignedServant: { select: { id: true, name: true } },
        responsibility: { select: { id: true, title: true, functionName: true } },
      },
    });
  }

  async contextualSwapSlot(slotId: string, dto: ContextualSwapScheduleSlotDto, actor: JwtPayload) {
    return this.swapOrFillSlot(slotId, dto, actor, false);
  }

  async fillSlot(slotId: string, dto: ContextualSwapScheduleSlotDto, actor: JwtPayload) {
    return this.swapOrFillSlot(slotId, dto, actor, true);
  }

  async autoGenerateExplained(dto: AutoGenerateScheduleSlotsDto, actor: JwtPayload) {
    const ministryId = dto.ministryId;
    if (!ministryId) {
      throw new BadRequestException('ministryId is required');
    }
    await this.assertCanManageMinistry(actor, ministryId);
    await this.ensureServiceExists(dto.serviceId);

    const slots = await this.prisma.scheduleSlot.findMany({
      where: {
        serviceId: dto.serviceId,
        ministryId,
        ...(dto.functionNames?.length ? { functionName: { in: dto.functionNames } } : {}),
        ...(dto.responsibilityIds?.length
          ? { responsibilityId: { in: dto.responsibilityIds } }
          : {}),
      },
      orderBy: [{ functionName: 'asc' }, { position: 'asc' }],
    });

    const criteria = {
      ministryId: ministryId,
      serviceId: dto.serviceId,
      rules: [
        'status ativo',
        'aprovacao ministerial',
        'treinamento concluido no ministerio da vaga',
        'disponibilidade por horario',
        'sem conflito de escala no culto',
        'compatibilidade basica por funcao/talento',
      ],
      source: 'AUTO_GENERATION_V2',
    };

    const results: Array<Record<string, unknown>> = [];
    const usedServants = new Set<string>();
    const targetSlots = slots.filter((slot) => slot.status === ScheduleSlotStatus.OPEN || !slot.assignedServantId);

    for (const slot of targetSlots) {
      const eligible = await this.listSlotEligibility(dto.serviceId, ministryId, slot);
      const candidate = [...eligible]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .find(
        (item) => item.eligible && !usedServants.has(item.servantId),
      );

      if (!candidate) {
        results.push({
          slotId: slot.id,
          functionName: slot.functionName,
          action: 'SKIPPED',
          reason: 'NO_ELIGIBLE_SERVANT',
        });
        continue;
      }

      usedServants.add(candidate.servantId);
      await this.assignSlot(
        slot.id,
        { servantId: candidate.servantId, reason: 'AUTO_GENERATED' },
        actor,
        {
          auditAction: AuditAction.ASSIGN,
          auditMetadata: { source: 'AUTO_GENERATED' },
        },
      );
      await this.prisma.scheduleSlotChange.create({
        data: {
          slotId: slot.id,
          changeType: ScheduleSlotChangeType.AUTO_GENERATED,
          fromServantId: slot.assignedServantId,
          toServantId: candidate.servantId,
          reason: 'Automatic assignment with explained criteria',
          performedByUserId: actor.sub,
          metadata: { criteria },
        },
      });

      results.push({
        slotId: slot.id,
        functionName: slot.functionName,
        action: 'ASSIGNED',
        servantId: candidate.servantId,
        servantName: candidate.servantName,
      });
    }

    await this.auditService.log({
      action: AuditAction.GENERATE_SCHEDULE,
      entity: 'ScheduleSlotAutoGeneration',
      entityId: `${dto.serviceId}:${ministryId}`,
      userId: actor.sub,
      metadata: {
        serviceId: dto.serviceId,
        ministryId,
        processedSlots: targetSlots.length,
        assignedCount: results.filter((item) => item.action === 'ASSIGNED').length,
        skippedCount: results.filter((item) => item.action === 'SKIPPED').length,
      },
    });

    return {
      criteria,
      processedSlots: targetSlots.length,
      details: results,
    };
  }

  async create(dto: CreateScheduleDto, actor: JwtPayload) {
    const actorChurchId = this.tenantIntegrity.assertActorChurch(actor);
    const ministryId = dto.ministryId;
    if (!ministryId) {
      throw new BadRequestException('ministryId is required');
    }
    await this.assertCanManageMinistry(actor, ministryId);
    await assertServantAccess(this.prisma, actor, dto.servantId);

    await this.validateScheduleInput(dto.serviceId, ministryId, dto.servantId, actor);
    await this.ensureNoConflict(dto.serviceId, dto.servantId, ministryId);

    const schedule = await this.prisma.schedule.create({
      data: {
        serviceId: dto.serviceId,
        ministryId,
        servantId: dto.servantId,
        assignedByUserId: actor.sub,
        churchId: actorChurchId,
      },
      include: {
        service: true,
        servant: true,
        ministry: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.ASSIGN,
      entity: 'Schedule',
      entityId: schedule.id,
      userId: actor.sub,
      metadata: dto as unknown as Record<string, unknown>,
    });

    await this.notifyScheduleEvent(
      schedule.servantId,
      'SCHEDULE_ASSIGNED',
      'Nova escala atribuida',
      `Voce foi escalado para ${schedule.service.title}.`,
      {
        scheduleId: schedule.id,
        serviceId: schedule.serviceId,
        ministryId: schedule.ministryId,
      },
    );

    return this.toApiSchedule(schedule);
  }

  async generateMonth(dto: GenerateMonthScheduleDto, actor: JwtPayload) {
    if (dto.ministryIds?.length) {
      for (const ministryId of dto.ministryIds) {
        await this.assertCanManageMinistry(actor, ministryId);
      }
    }

    const start = new Date(Date.UTC(dto.year, dto.month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(dto.year, dto.month, 0, 23, 59, 59));

    return this.generateBetween(start, end, actor, {
      mode: 'generate-month',
      year: dto.year,
      month: dto.month,
      ministryIds: dto.ministryIds,
      teamIds: dto.teamIds,
      dryRun: dto.dryRun,
      force: dto.force,
      allowMultiMinistrySameService: dto.allowMultiMinistrySameService,
      weights: dto.weights,
    });
  }

  async generatePeriod(dto: GeneratePeriodScheduleDto, actor: JwtPayload) {
    if (dto.ministryIds?.length) {
      for (const ministryId of dto.ministryIds) {
        await this.assertCanManageMinistry(actor, ministryId);
      }
    }

    const start = parseSaoPauloDateStart(dto.startDate);
    const end = parseSaoPauloDateEnd(dto.endDate);

    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('endDate must be greater than or equal to startDate');
    }

    return this.generateBetween(start, end, actor, {
      mode: 'generate-period',
      year: Number(dto.startDate.slice(0, 4)),
      weekdays: dto.weekdays,
      ministryIds: dto.ministryIds,
      teamIds: dto.teamIds,
      respectFairnessRules: dto.respectFairnessRules,
      dryRun: dto.dryRun,
      force: dto.force,
      allowMultiMinistrySameService: dto.allowMultiMinistrySameService,
      weights: dto.weights,
    });
  }

  async generateService(dto: GenerateServiceScheduleDto, actor: JwtPayload) {
    if (dto.ministryIds?.length) {
      for (const ministryId of dto.ministryIds) {
        await this.assertCanManageMinistry(actor, ministryId);
      }
    }

    const service = await this.prisma.worshipService.findUnique({
      where: { id: dto.serviceId },
      select: { id: true, serviceDate: true },
    });

    if (!service) {
      throw new NotFoundException('Worship service not found');
    }

    const serviceDate = new Date(service.serviceDate);
    const start = new Date(Date.UTC(serviceDate.getUTCFullYear(), serviceDate.getUTCMonth(), serviceDate.getUTCDate(), 0, 0, 0));
    const end = new Date(Date.UTC(serviceDate.getUTCFullYear(), serviceDate.getUTCMonth(), serviceDate.getUTCDate(), 23, 59, 59));

    return this.generateBetween(start, end, actor, {
      mode: 'generate-service',
      year: serviceDate.getUTCFullYear(),
      month: serviceDate.getUTCMonth() + 1,
      serviceIds: [service.id],
      ministryIds: dto.ministryIds,
      teamIds: dto.teamIds,
      dryRun: dto.dryRun,
      force: dto.force,
      allowMultiMinistrySameService: dto.allowMultiMinistrySameService,
      weights: dto.weights,
    });
  }

  async generateServices(dto: GenerateServicesScheduleDto, actor: JwtPayload) {
    const serviceIds = [...new Set((dto.serviceIds ?? []).map((value) => value.trim()).filter(Boolean))];
    const requestedSectorIds = [
      ...new Set([...(dto.ministryIds ?? []), ...(dto.ministryIds ?? [])].map((value) => value.trim()).filter(Boolean)),
    ];

    if (!serviceIds.length) {
      throw new BadRequestException('At least one serviceId must be provided');
    }

    if (requestedSectorIds.length) {
      for (const ministryId of requestedSectorIds) {
        await this.assertCanManageMinistry(actor, ministryId);
      }
    }

    const services = await this.prisma.worshipService.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, serviceDate: true },
      orderBy: [{ serviceDate: 'asc' }, { id: 'asc' }],
    });

    if (!services.length) {
      throw new NotFoundException('No worship services found for the provided serviceIds');
    }

    const foundIds = new Set(services.map((service) => service.id));
    const missingServiceId = serviceIds.find((id) => !foundIds.has(id));
    if (missingServiceId) {
      throw new NotFoundException(`Worship service not found: ${missingServiceId}`);
    }

    const startServiceDate = services[0].serviceDate;
    const endServiceDate = services[services.length - 1].serviceDate;
    const start = new Date(
      Date.UTC(
        startServiceDate.getUTCFullYear(),
        startServiceDate.getUTCMonth(),
        startServiceDate.getUTCDate(),
        0,
        0,
        0,
      ),
    );
    const end = new Date(
      Date.UTC(
        endServiceDate.getUTCFullYear(),
        endServiceDate.getUTCMonth(),
        endServiceDate.getUTCDate(),
        23,
        59,
        59,
      ),
    );

    return this.generateBetween(start, end, actor, {
      mode: 'generate-services',
      year: startServiceDate.getUTCFullYear(),
      serviceIds,
      ministryIds: requestedSectorIds.length ? requestedSectorIds : undefined,
      teamIds: dto.teamIds,
      dryRun: dto.dryRun,
      force: dto.force,
      allowMultiMinistrySameService: dto.allowMultiMinistrySameService,
      weights: dto.weights,
    });
  }

  async generateYear(dto: GenerateYearScheduleDto, actor: JwtPayload) {
    if (dto.ministryIds?.length) {
      for (const ministryId of dto.ministryIds) {
        await this.assertCanManageMinistry(actor, ministryId);
      }
    }

    const start = new Date(Date.UTC(dto.year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(dto.year, 11, 31, 23, 59, 59));

    return this.generateBetween(start, end, actor, {
      mode: 'generate-year',
      year: dto.year,
      ministryIds: dto.ministryIds,
      teamIds: dto.teamIds,
      dryRun: dto.dryRun,
      force: dto.force,
      allowMultiMinistrySameService: dto.allowMultiMinistrySameService,
      weights: dto.weights,
    });
  }

  async swap(dto: SwapScheduleDto, actor: JwtPayload) {
    const scheduleInclude = {
      service: true,
      servant: true,
      ministry: true,
    } as const;

    const isSimpleSwap = dto.scheduleId !== undefined || dto.servantId !== undefined;

    if (isSimpleSwap) {
      if (!dto.scheduleId || !dto.servantId) {
        throw new BadRequestException('Payload must include scheduleId and servantId');
      }

      const current = await this.prisma.schedule.findUnique({
        where: { id: dto.scheduleId },
        include: scheduleInclude,
      });

      if (!current) {
        throw new NotFoundException('Schedule not found');
      }

      await this.assertCanManageSchedule(actor, current.id);
      await assertServantAccess(this.prisma, actor, dto.servantId);
      await this.ensureServantEligibleForSector(dto.servantId, current.ministryId, current.serviceId);
      if (current.servantId === dto.servantId) {
        return this.toApiSchedule(current);
      }

      const conflict = await this.prisma.schedule.findFirst({
        where: {
          serviceId: current.serviceId,
          servantId: dto.servantId,
          NOT: { id: current.id },
        },
        select: { id: true },
      });

      if (conflict) {
        throw new ConflictException('Servant is already assigned to this worship service');
      }

      const updated = await this.prisma.schedule.update({
        where: { id: current.id },
        data: {
          servantId: dto.servantId,
          status: ScheduleStatus.SWAPPED,
        },
        include: scheduleInclude,
      });

      await this.prisma.scheduleSwapHistory.create({
        data: {
          fromScheduleId: current.id,
          toScheduleId: updated.id,
          reason: dto.reason,
          swappedByUserId: actor.sub,
        },
      });

      await this.auditService.log({
        action: AuditAction.SWAP,
        entity: 'Schedule',
        entityId: current.id,
        userId: actor.sub,
        metadata: {
          scheduleId: current.id,
          previousServantId: current.servantId,
          servantId: dto.servantId,
          reason: dto.reason,
        },
      });

      await this.notifyScheduleEvent(
        updated.servantId,
        'SCHEDULE_SWAPPED',
        'Escala alterada',
        `Sua escala foi alterada para ${updated.service.title}.`,
        {
          scheduleId: updated.id,
          previousServantId: current.servantId,
          newServantId: updated.servantId,
        },
      );

      this.invalidateSchedulingCaches(updated.serviceId, updated.ministryId);

      return this.toApiSchedule(updated);
    }

    if (!dto.fromScheduleId || !dto.toScheduleId) {
      throw new BadRequestException(
        'Payload must include either scheduleId+servantId or fromScheduleId+toScheduleId',
      );
    }

    if (dto.fromScheduleId === dto.toScheduleId) {
      throw new BadRequestException('Schedules must be different for swap');
    }

    const [from, to] = await Promise.all([
      this.prisma.schedule.findUnique({
        where: { id: dto.fromScheduleId },
        include: { service: true, servant: true, ministry: true },
      }),
      this.prisma.schedule.findUnique({
        where: { id: dto.toScheduleId },
        include: { service: true, servant: true, ministry: true },
      }),
    ]);

    if (!from || !to) {
      throw new NotFoundException('One or more schedules were not found');
    }

    await this.assertCanManageSchedule(actor, from.id);
    await this.assertCanManageSchedule(actor, to.id);

    if (from.serviceId !== to.serviceId) {
      throw new BadRequestException('Swap must happen inside the same worship service');
    }

    await this.ensureServantEligibleForSector(to.servantId, from.ministryId, from.serviceId);
    await this.ensureServantEligibleForSector(from.servantId, to.ministryId, to.serviceId);

    const hasConflictFrom = await this.prisma.schedule.findFirst({
      where: {
        serviceId: from.serviceId,
        ministryId: from.ministryId,
        servantId: to.servantId,
        NOT: { id: from.id },
      },
      select: { id: true },
    });

    const hasConflictTo = await this.prisma.schedule.findFirst({
      where: {
        serviceId: to.serviceId,
        ministryId: to.ministryId,
        servantId: from.servantId,
        NOT: { id: to.id },
      },
      select: { id: true },
    });

    if (hasConflictFrom || hasConflictTo) {
      throw new BadRequestException('Swap creates a ministry conflict');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedFrom = await tx.schedule.update({
        where: { id: from.id },
        data: { servantId: to.servantId, status: ScheduleStatus.SWAPPED },
        include: scheduleInclude,
      });

      const updatedTo = await tx.schedule.update({
        where: { id: to.id },
        data: { servantId: from.servantId, status: ScheduleStatus.SWAPPED },
        include: scheduleInclude,
      });

      await tx.scheduleSwapHistory.create({
        data: {
          fromScheduleId: from.id,
          toScheduleId: to.id,
          reason: dto.reason,
          swappedByUserId: actor.sub,
        },
      });

      return {
        fromSchedule: this.toApiSchedule(updatedFrom),
        toSchedule: this.toApiSchedule(updatedTo),
      };
    });

    await this.auditService.log({
      action: AuditAction.SWAP,
      entity: 'ScheduleSwap',
      entityId: from.id,
      userId: actor.sub,
      metadata: {
        fromScheduleId: from.id,
        toScheduleId: to.id,
        reason: dto.reason,
      },
    });

    await this.notifyScheduleEvent(
      result.fromSchedule.servantId,
      'SCHEDULE_SWAPPED',
      'Troca de escala concluida',
      'Sua escala foi atualizada por uma troca.',
      {
        fromScheduleId: from.id,
        toScheduleId: to.id,
      },
    );
    await this.notifyScheduleEvent(
      result.toSchedule.servantId,
      'SCHEDULE_SWAPPED',
      'Troca de escala concluida',
      'Sua escala foi atualizada por uma troca.',
      {
        fromScheduleId: from.id,
        toScheduleId: to.id,
      },
    );

    this.invalidateSchedulingCaches(from.serviceId, from.ministryId);
    this.invalidateSchedulingCaches(to.serviceId, to.ministryId);

    return result;
  }

  async update(id: string, dto: UpdateScheduleDto, actor: JwtPayload) {
    await this.assertCanManageSchedule(actor, id);

    const existing = await this.prisma.schedule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Schedule not found');
    }

    if (
      dto.servantId === undefined &&
      dto.ministryId === undefined &&
      dto.teamId === undefined &&
      dto.status === undefined
    ) {
      throw new BadRequestException('Nothing to update in schedule');
    }
    const nextServantId = dto.servantId ?? existing.servantId;
    const nextSectorId = dto.ministryId ?? existing.ministryId;

    if (dto.servantId !== undefined) {
      await assertServantAccess(this.prisma, actor, dto.servantId);
    }

    if (dto.ministryId !== undefined) {
      await this.assertCanManageMinistry(actor, nextSectorId);
    }

    await this.ensureServantEligibleForSector(nextServantId, nextSectorId, existing.serviceId);

    const conflict = await this.prisma.schedule.findFirst({
      where: {
        serviceId: existing.serviceId,
        servantId: nextServantId,
        NOT: { id },
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ConflictException('Servant is already assigned to this worship service');
    }

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: {
        servantId: dto.servantId,
        ministryId: dto.ministryId,
        status: dto.status,
      },
      include: {
        service: true,
        servant: true,
        ministry: true,
      },
    });

    await this.auditService.log({
      action: dto.status !== undefined ? AuditAction.STATUS_CHANGE : AuditAction.UPDATE,
      entity: 'Schedule',
      entityId: id,
      userId: actor.sub,
      metadata: dto as unknown as Record<string, unknown>,
    });

    await this.notifyScheduleEvent(
      updated.servantId,
      dto.status !== undefined ? 'SCHEDULE_STATUS_CHANGED' : 'SCHEDULE_UPDATED',
      dto.status !== undefined ? 'Status da escala alterado' : 'Escala atualizada',
      `Sua escala em ${updated.service.title} foi atualizada.`,
      {
        scheduleId: updated.id,
        status: updated.status,
      },
    );

    let ministryTasksReallocation: unknown = null;
    if (dto.servantId !== undefined && dto.servantId !== existing.servantId) {
      ministryTasksReallocation = await this.ministryTasksService.reallocateFromRemovedServant(
        {
          serviceId: existing.serviceId,
          removedServantId: existing.servantId,
          mode: dto.ministryTaskReallocationMode ?? MinistryTaskReallocationMode.UNASSIGN,
          manualAssignments: dto.ministryTaskManualAssignments,
          reason:
            dto.ministryTaskReallocationReason ??
            'Triggered by schedule responsible change',
        },
        actor,
      );
    }

    return { ...this.toApiSchedule(updated), ministryTasksReallocation };
  }

  async duplicate(scheduleId: string, dto: DuplicateScheduleDto, actor: JwtPayload) {
    const source = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        service: true,
      },
    });

    if (!source) {
      throw new NotFoundException('Source schedule not found');
    }

    await this.assertCanManageSchedule(actor, source.id);
    await this.assertCanManageMinistry(actor, source.ministryId);
    await assertServantAccess(this.prisma, actor, source.servantId);

    const targetService = await this.prisma.worshipService.findUnique({
      where: { id: dto.worshipServiceId },
      select: { id: true },
    });

    if (!targetService) {
      throw new NotFoundException('Target worship service not found');
    }

    await this.ensureServantEligibleForSector(source.servantId, source.ministryId, dto.worshipServiceId);

    const conflict = await this.prisma.schedule.findFirst({
      where: {
        serviceId: dto.worshipServiceId,
        servantId: source.servantId,
        ministryId: source.ministryId,
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ConflictException('A schedule already exists for this servant and ministry in target service');
    }

    const duplicated = await this.prisma.schedule.create({
      data: {
        serviceId: dto.worshipServiceId,
        servantId: source.servantId,
        ministryId: source.ministryId,
        churchId: source.churchId,
        status: ScheduleStatus.ASSIGNED,
        assignedByUserId: actor.sub,
      },
      include: {
        service: true,
        servant: true,
        ministry: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'ScheduleDuplicate',
      entityId: duplicated.id,
      userId: actor.sub,
      metadata: {
        sourceScheduleId: source.id,
        targetWorshipServiceId: dto.worshipServiceId,
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'Schedule',
      entityId: source.id,
      userId: actor.sub,
      metadata: {
        type: 'DUPLICATED',
        duplicatedScheduleId: duplicated.id,
        targetWorshipServiceId: dto.worshipServiceId,
      },
    });

    await this.notifyScheduleEvent(
      duplicated.servantId,
      'SCHEDULE_DUPLICATED',
      'Escala duplicada para novo culto',
      `Voce recebeu uma nova escala em ${duplicated.service.title}.`,
      {
        scheduleId: duplicated.id,
        sourceScheduleId: source.id,
      },
    );

    return this.toApiSchedule(duplicated);
  }

  async swapHistory(query: ListSwapHistoryQueryDto, actor: JwtPayload) {
    const scopeWhere = await this.getSwapHistoryWhere(actor);
    const filterWhere: Prisma.ScheduleSwapHistoryWhereInput = {
      swappedByUserId: query.swappedByUserId,
      fromSchedule:
        query.serviceId || query.ministryId
          ? {
              serviceId: query.serviceId,
              ministryId: query.ministryId,
            }
          : undefined,
    };
    const where: Prisma.ScheduleSwapHistoryWhereInput =
      scopeWhere !== undefined ? { AND: [filterWhere, scopeWhere] } : filterWhere;

    const records = await this.prisma.scheduleSwapHistory.findMany({
      where,
      include: {
        swappedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        fromSchedule: {
          include: { servant: true, ministry: true, service: true },
        },
        toSchedule: {
          include: { servant: true, ministry: true, service: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 100,
    });

    return records.map((item) => {
      const message =
        item.reason ??
        `Troca de escala realizada por ${item.swappedBy.name} em ${item.createdAt.toISOString()}`;

      return {
        id: item.id,
        scheduleId: item.fromScheduleId,
        type: 'SWAPPED' as const,
        message,
        description: message,
        createdAt: item.createdAt,
      };
    });
  }

  async history(scheduleId: string, actor: JwtPayload) {
    await this.assertCanManageSchedule(actor, scheduleId);

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const [swapRecords, auditRecords] = await Promise.all([
      this.prisma.scheduleSwapHistory.findMany({
        where: {
          OR: [{ fromScheduleId: scheduleId }, { toScheduleId: scheduleId }],
        },
        include: {
          swappedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      this.prisma.auditLog.findMany({
        where: {
          entityId: scheduleId,
          entity: { in: ['Schedule', 'ScheduleDuplicate'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
    ]);

    const swapEvents = swapRecords.map((item) => {
      const message =
        item.reason ??
        `Troca de escala realizada por ${item.swappedBy.name} em ${item.createdAt.toISOString()}`;

      return {
        id: `swap-${item.id}`,
        scheduleId,
        type: 'SWAPPED' as const,
        message,
        description: message,
        createdAt: item.createdAt,
      };
    });

    const auditEvents = auditRecords.map((item) => {
      const isDuplicatedEvent =
        item.entity === 'ScheduleDuplicate' || (item.metadata as { type?: string } | null)?.type === 'DUPLICATED';

      const type = isDuplicatedEvent
        ? ('DUPLICATED' as const)
        : item.action === AuditAction.CREATE
          ? ('CREATED' as const)
          : item.action === AuditAction.UPDATE
            ? ('UPDATED' as const)
            : item.action === AuditAction.STATUS_CHANGE
              ? ('STATUS_CHANGED' as const)
              : ('UPDATED' as const);

      const message =
        type === 'DUPLICATED'
          ? 'Escala duplicada.'
          : type === 'CREATED'
          ? 'Escala criada.'
          : type === 'STATUS_CHANGED'
            ? 'Status da escala alterado.'
            : 'Escala atualizada.';

      return {
        id: `audit-${item.id}`,
        scheduleId,
        type,
        message,
        description: message,
        createdAt: item.createdAt,
      };
    });

    return [...swapEvents, ...auditEvents].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private async generateBetween(
    start: Date,
    end: Date,
    actor: JwtPayload,
    options: GenerationOptions,
  ) {
    const respectFairnessRules = options.respectFairnessRules !== false;
    const dryRun = options.dryRun === true;
    const force = options.force === true;
    const allowMultiMinistrySameService = options.allowMultiMinistrySameService === true;
    const weights = this.normalizeGenerationWeights(options.weights);

    const scopedSectorIds = await this.resolveAllowedMinistryIds(actor, options.ministryIds);
    const teamFilter = await this.resolveGenerationTeamFilter(options.teamIds);
    const teamSectorIds = [
      ...new Set(teamFilter.teams.map((team) => team.ministryId).filter((value): value is string => Boolean(value))),
    ];

    const targetSectorIds = teamSectorIds.length
      ? scopedSectorIds.filter((ministryId) => teamSectorIds.includes(ministryId))
      : scopedSectorIds;

    if (options.teamIds?.length && targetSectorIds.length === 0) {
      throw new ForbiddenException('You can only generate schedules for your allowed ministries');
    }

    const servicesInPeriod = await this.prisma.worshipService.findMany({
      where: {
        serviceDate: { gte: start, lte: end },
        status: { in: [WorshipServiceStatus.PLANEJADO, WorshipServiceStatus.CONFIRMADO] },
        id: options.serviceIds?.length ? { in: options.serviceIds } : undefined,
      },
      orderBy: [{ serviceDate: 'asc' }, { id: 'asc' }],
      select: { id: true, serviceDate: true, startTime: true },
    });

    const services = options.weekdays?.length
      ? servicesInPeriod.filter((service) => options.weekdays?.includes(getSaoPauloWeekday(service.serviceDate)))
      : servicesInPeriod;

    const result = {
      period: {
        year: options.year,
        ...(options.month ? { month: options.month } : {}),
      },
      dryRun,
      summary: {
        servicesEvaluated: services.length,
        slotsTotal: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        conflicts: 0,
        warnings: 0,
      },
      items: [] as GenerationItem[],
      warnings: [] as Array<{ code: string; serviceId: string; ministryId: string; message: string }>,
      weights,
    };

    if (services.length === 0) {
      return result;
    }

    const ministries = await this.prisma.ministry.findMany({
      where: { id: { in: targetSectorIds } },
      orderBy: [{ id: 'asc' }],
      select: { id: true, name: true },
    });

    if (ministries.length === 0) {
      return result;
    }

    result.summary.slotsTotal = services.length * ministries.length;

    const candidatesBySector = await this.buildEligibleCandidatesBySector(
      ministries.map((ministry) => ministry.id),
      teamFilter.teamIds,
    );
    const candidateIds = [...new Set([...candidatesBySector.values()].flat().map((item) => item.servantId))];
    const unavailableMap = await this.getServantUnavailableMap(candidateIds);

    const totalSlotsPerSector = new Map<string, number>();
    const hardCapBySector = new Map<string, number>();
    for (const ministry of ministries) {
      const totalSlots = services.length;
      const eligibleCount = Math.max(1, (candidatesBySector.get(ministry.id) ?? []).length);
      totalSlotsPerSector.set(ministry.id, totalSlots);
      hardCapBySector.set(ministry.id, Math.ceil(totalSlots / eligibleCount) + 1);
    }

    const assignedCountMonth = await this.getAssignedCountMap(start, end);
    const absencesLast60d = await this.getAbsencesLast60dMap(start, end);
    const { lastAssignedAtMap, lastServiceOrderMap } = await this.getHistoricalAssignmentMaps(start, end);

    const serviceOrder = new Map<string, number>();
    services.forEach((service, index) => {
      serviceOrder.set(service.id, index);
    });

    for (const service of services) {
      if (!dryRun) {
        await this.acquireServiceGenerationLock(service.id);
      }

      const existingSchedules = await this.prisma.schedule.findMany({
        where: { serviceId: service.id },
        orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            serviceId: true,
            ministryId: true,
            servantId: true,
          },
        });

      const assignedInServiceCount = new Map<string, number>();
      for (const schedule of existingSchedules) {
        assignedInServiceCount.set(
          schedule.servantId,
          (assignedInServiceCount.get(schedule.servantId) ?? 0) + 1,
        );
      }

      for (const ministry of ministries) {
          const existing = this.findExistingScheduleForSlot(existingSchedules, ministry.id);

        if (existing && !force) {
          result.summary.skipped += 1;
          result.items.push({
            serviceId: service.id,
            ministryId: ministry.id,
            servantId: existing.servantId,
            scheduleId: existing.id,
            action: 'SKIPPED',
            reason: 'manual_or_existing_schedule',
          });
          await this.logGenerationAudit(actor.sub, service.id, ministry.id, existing.servantId, {
            action: 'SKIPPED',
            reason: 'manual_or_existing_schedule',
            dryRun,
            force,
            weights,
          });
          continue;
        }

        const rawCandidates = candidatesBySector.get(ministry.id) ?? [];
        const serviceIndex = serviceOrder.get(service.id) ?? 0;
        const filtered = rawCandidates.filter((candidate) =>
          this.isCandidateAllowedInService(
            candidate.servantId,
            existing,
            assignedInServiceCount,
            allowMultiMinistrySameService,
          ) && this.isCandidateAvailableForService(candidate.servantId, service.serviceDate, service.startTime, unavailableMap),
        );

        if (filtered.length === 0) {
          this.pushNoEligibleWarning(result, service.id, ministry.id);
          await this.logGenerationAudit(actor.sub, service.id, ministry.id, undefined, {
            action: 'SKIPPED',
            reason: 'NO_ELIGIBLE_SERVANT',
            dryRun,
            force,
            weights,
          });
          continue;
        }

        const finalPool = respectFairnessRules
          ? this.applyFairnessBands(filtered, assignedCountMonth, hardCapBySector.get(ministry.id))
          : filtered;

        const eligibleCount = Math.max(1, rawCandidates.length);
        const targetMonth = Math.max(
          1,
          Math.ceil((totalSlotsPerSector.get(ministry.id) ?? services.length) / eligibleCount),
        );

        const scored: EligibleCandidate[] = finalPool.map((candidate) => {
          const candidateAssignedCount = assignedCountMonth.get(candidate.servantId) ?? 0;
          const lastAt = lastAssignedAtMap.get(candidate.servantId) ?? null;
          const lastIdx = lastServiceOrderMap.get(candidate.servantId);
          const diff = lastIdx === undefined ? Number.MAX_SAFE_INTEGER : serviceIndex - lastIdx;

          const recentSequenceScore = diff === 1 ? 0 : diff === 2 ? 0.5 : 1;
          const consecutiveAssignments = diff === 1 ? 2 : diff === 2 ? 1 : 0;
          const absenceCount = absencesLast60d.get(candidate.servantId) ?? 0;

          const monthlyLoadScore = 1 - Math.min(candidateAssignedCount / targetMonth, 1);
          const absenceScore = 1 - Math.min(absenceCount / 4, 1);
          const sectorAffinityScore = candidate.isMainSector ? 1 : 0.7;

          const score =
            weights.monthlyLoad * monthlyLoadScore +
            weights.recentSequence * recentSequenceScore +
            weights.recentAbsences * absenceScore +
            weights.sectorAffinity * sectorAffinityScore;

          return {
            servantId: candidate.servantId,
            teamId: candidate.teamId,
            ministryId: ministry.id,
            isMainSector: candidate.isMainSector,
            assignedCountMonth: candidateAssignedCount,
            consecutiveAssignments,
            lastAssignedAt: lastAt,
            absencesLast60d: absenceCount,
            score,
          };
        });

        this.sortScoredCandidates(scored);

        const winner = scored[0];
        const score = Number(winner.score.toFixed(4));

        if (!allowMultiMinistrySameService) {
          const serviceConflict = await this.prisma.schedule.findFirst({
            where: {
              serviceId: service.id,
              servantId: winner.servantId,
              ...(existing ? { NOT: { id: existing.id } } : {}),
            },
            select: { id: true },
          });

          if (serviceConflict) {
            result.summary.conflicts += 1;
            result.items.push({
              serviceId: service.id,
              ministryId: ministry.id,
              servantId: winner.servantId,
              action: dryRun ? 'WOULD_CREATE' : 'CONFLICT',
              reason: 'same_service_conflict',
              score,
            });
            await this.logGenerationAudit(actor.sub, service.id, ministry.id, winner.servantId, {
              action: 'CONFLICT',
              reason: 'same_service_conflict',
              score,
              dryRun,
              force,
              weights,
            });
            continue;
          }
        }

        if (dryRun) {
          result.items.push({
            serviceId: service.id,
            ministryId: ministry.id,
            servantId: winner.servantId,
            scheduleId: existing?.id,
            action: existing ? 'WOULD_UPDATE' : 'WOULD_CREATE',
            score,
            reason: 'best_score_priority_band',
          });
          this.updateInMemoryMetrics(
            existing?.servantId,
            winner.servantId,
            assignedInServiceCount,
            assignedCountMonth,
            lastAssignedAtMap,
            lastServiceOrderMap,
            serviceIndex,
            service.serviceDate,
          );
          continue;
        }

        if (existing) {
          const updatedSchedule = await this.prisma.schedule.update({
            where: { id: existing.id },
            data: {
              servantId: winner.servantId,
              status: ScheduleStatus.ASSIGNED,
            },
            select: { id: true },
          });
          await this.auditService.log({
            action: AuditAction.UPDATE,
            entity: 'Schedule',
            entityId: updatedSchedule.id,
            userId: actor.sub,
            metadata: {
              source: 'generation',
              mode: options.mode ?? 'generate-year',
              serviceId: service.id,
              ministryId: ministry.id,
              servantId: winner.servantId,
              score,
            },
          });
          result.summary.updated += 1;
          result.items.push({
            serviceId: service.id,
            ministryId: ministry.id,
            servantId: winner.servantId,
            scheduleId: existing.id,
            action: 'UPDATED',
            score,
            reason: 'best_score_priority_band',
          });
        } else {
          const created = await this.prisma.schedule.create({
            data: {
              serviceId: service.id,
              ministryId: ministry.id,
              servantId: winner.servantId,
              churchId: this.requireActorChurch(actor),
              status: ScheduleStatus.ASSIGNED,
              assignedByUserId: actor.sub,
            },
            select: { id: true },
          });
          await this.auditService.log({
            action: AuditAction.CREATE,
            entity: 'Schedule',
            entityId: created.id,
            userId: actor.sub,
            metadata: {
              source: 'generation',
              mode: options.mode ?? 'generate-year',
              serviceId: service.id,
              ministryId: ministry.id,
              servantId: winner.servantId,
              score,
            },
          });
          result.summary.created += 1;
          result.items.push({
            serviceId: service.id,
            ministryId: ministry.id,
            servantId: winner.servantId,
            scheduleId: created.id,
            action: 'CREATED',
            score,
            reason: 'best_score_priority_band',
          });
        }

        this.updateInMemoryMetrics(
          existing?.servantId,
          winner.servantId,
          assignedInServiceCount,
          assignedCountMonth,
          lastAssignedAtMap,
          lastServiceOrderMap,
          serviceIndex,
          service.serviceDate,
        );

        await this.logGenerationAudit(actor.sub, service.id, ministry.id, winner.servantId, {
          action: existing ? 'UPDATED' : 'CREATED',
          score,
          reason: 'best_score_priority_band',
          dryRun,
          force,
          weights,
        });
      }
    }

    await this.auditService.log({
      action: AuditAction.GENERATE_SCHEDULE,
      entity: 'ScheduleGeneration',
      entityId: `${start.toISOString()}_${end.toISOString()}`,
      userId: actor.sub,
      metadata: {
        mode: options.mode ?? 'generate-year',
        period: result.period,
        dryRun,
        force,
        respectFairnessRules,
        weekdays: options.weekdays,
        allowMultiMinistrySameService,
        teamIds: teamFilter.teamIds,
        ministryIds: targetSectorIds,
        summary: result.summary,
        weights,
      },
    });

    return {
      ...result,
      details: result.items,
    };
  }

  private normalizeGenerationWeights(weights?: ScheduleGenerationWeightsDto): GenerationWeights {
    const merged = { ...DEFAULT_GENERATION_WEIGHTS, ...(weights ?? {}) };
    const sum =
      merged.monthlyLoad + merged.recentSequence + merged.recentAbsences + merged.sectorAffinity;
    if (sum <= 0) {
      return DEFAULT_GENERATION_WEIGHTS;
    }
    return {
      monthlyLoad: merged.monthlyLoad / sum,
      recentSequence: merged.recentSequence / sum,
      recentAbsences: merged.recentAbsences / sum,
      sectorAffinity: merged.sectorAffinity / sum,
    };
  }

  private applyFairnessBands<T extends { servantId: string }>(
    candidates: T[],
    assignedCountMonth: Map<string, number>,
    hardCap?: number,
  ) {
    const minAssigned = Math.min(
      ...candidates.map((candidate) => assignedCountMonth.get(candidate.servantId) ?? 0),
    );

    const priorityBand = candidates.filter(
      (candidate) => (assignedCountMonth.get(candidate.servantId) ?? 0) <= minAssigned + 1,
    );
    const pool = priorityBand.length > 0 ? priorityBand : candidates;

    const maxAllowed = hardCap ?? Number.MAX_SAFE_INTEGER;
    const underCap = pool.filter((candidate) => (assignedCountMonth.get(candidate.servantId) ?? 0) < maxAllowed);
    return (underCap.length > 0 ? underCap : pool) as T[];
  }

  private sortScoredCandidates(candidates: EligibleCandidate[]) {
    candidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.assignedCountMonth !== b.assignedCountMonth) {
        return a.assignedCountMonth - b.assignedCountMonth;
      }
      const aTs = a.lastAssignedAt ? a.lastAssignedAt.getTime() : 0;
      const bTs = b.lastAssignedAt ? b.lastAssignedAt.getTime() : 0;
      if (aTs !== bTs) {
        return aTs - bTs;
      }
      if (a.consecutiveAssignments !== b.consecutiveAssignments) {
        return a.consecutiveAssignments - b.consecutiveAssignments;
      }
      return a.servantId.localeCompare(b.servantId);
    });
  }

  private async buildEligibleCandidatesBySector(
    ministryIds: string[],
    teamIds: string[],
  ) {
    const servants = await this.prisma.servant.findMany({
      where: {
        status: ServantStatus.ATIVO,
        approvalStatus: ServantApprovalStatus.APPROVED,
        talents: {
          none: {
            stage: TalentStage.REPROVADO,
          },
        },
        pastoralVisits: {
          none: {
            status: { in: [PastoralVisitStatus.ABERTA, PastoralVisitStatus.EM_ANDAMENTO] },
          },
        },
        pastoralAlerts: {
          none: {
            status: AlertStatus.OPEN,
          },
        },
        teamId: teamIds.length ? { in: teamIds } : undefined,
        OR: [{ mainMinistryId: { in: ministryIds } }, { servantMinistries: { some: { ministryId: { in: ministryIds } } } }],
      },
      select: {
        id: true,
        trainingStatus: true,
        teamId: true,
        team: {
          select: {
            name: true,
          },
        },
        mainMinistryId: true,
        servantMinistries: {
          where: { ministryId: { in: ministryIds } },
          select: { ministryId: true, trainingStatus: true, trainingCompletedAt: true },
        },
      },
      orderBy: [{ id: 'asc' }],
    });

    const map = new Map<
      string,
      Array<{ servantId: string; teamId: string | null; isMainSector: boolean }>
    >();
    for (const ministryId of ministryIds) {
      map.set(ministryId, []);
    }

    for (const servant of servants) {
      for (const ministryId of ministryIds) {
        const belongsToSector =
          servant.mainMinistryId === ministryId ||
          servant.servantMinistries.some((servantMinistry) => servantMinistry.ministryId === ministryId);
        if (!belongsToSector) {
          continue;
        }
        if (!this.hasCompletedTrainingForMinistry(servant, ministryId)) {
          continue;
        }
        map.get(ministryId)?.push({
          servantId: servant.id,
          teamId: servant.teamId ?? null,
          isMainSector: servant.mainMinistryId === ministryId,
        });
        }
    }

    for (const [ministryId, candidates] of map) {
      candidates.sort((a, b) => a.servantId.localeCompare(b.servantId));
      map.set(ministryId, candidates);
    }

    return map;
  }

  private async getAssignedCountMap(start: Date, end: Date) {
    const schedules = await this.prisma.schedule.findMany({
      where: { service: { serviceDate: { gte: start, lte: end } } },
      select: { servantId: true },
    });

    const map = new Map<string, number>();
    for (const item of schedules) {
      map.set(item.servantId, (map.get(item.servantId) ?? 0) + 1);
    }
    return map;
  }

  private async getAbsencesLast60dMap(start: Date, end: Date) {
    const absencesStart = new Date(start);
    absencesStart.setUTCDate(absencesStart.getUTCDate() - 60);

    const records = await this.prisma.attendance.findMany({
      where: {
        status: { in: [AttendanceStatus.FALTA, AttendanceStatus.FALTA_JUSTIFICADA] },
        service: {
          serviceDate: { gte: absencesStart, lte: end },
        },
      },
      select: { servantId: true },
    });

    const map = new Map<string, number>();
    for (const item of records) {
      map.set(item.servantId, (map.get(item.servantId) ?? 0) + 1);
    }
    return map;
  }

  private async getHistoricalAssignmentMaps(start: Date, end: Date) {
    const [allServices, historicalSchedules] = await Promise.all([
      this.prisma.worshipService.findMany({
        where: { serviceDate: { lte: end } },
        orderBy: [{ serviceDate: 'asc' }, { id: 'asc' }],
        select: { id: true },
      }),
      this.prisma.schedule.findMany({
        where: { service: { serviceDate: { lt: start } } },
        include: {
          service: {
            select: { id: true, serviceDate: true },
          },
        },
        orderBy: [{ service: { serviceDate: 'asc' } }, { id: 'asc' }],
      }),
    ]);

    const serviceOrder = new Map<string, number>();
    allServices.forEach((service, index) => {
      serviceOrder.set(service.id, index);
    });

    const lastAssignedAtMap = new Map<string, Date>();
    const lastServiceOrderMap = new Map<string, number>();

    for (const schedule of historicalSchedules) {
      lastAssignedAtMap.set(schedule.servantId, schedule.service.serviceDate);
      const order = serviceOrder.get(schedule.serviceId);
      if (order !== undefined) {
        lastServiceOrderMap.set(schedule.servantId, order);
      }
    }

    return { lastAssignedAtMap, lastServiceOrderMap };
  }

  private async acquireServiceGenerationLock(serviceId: string) {
    try {
      await this.prisma.$executeRaw`SELECT pg_advisory_lock(hashtext(${`schedule:${serviceId}`}))`;
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext(${`schedule:${serviceId}`}))`;
    } catch {
      // Best-effort lock. If DB does not support advisory lock, generation still follows unique constraints.
    }
  }

  private findExistingScheduleForSlot(
    existingSchedules: Array<{
      id: string;
      ministryId: string;
      servantId: string;
    }>,
    ministryId: string,
  ) {
    return existingSchedules.find((item) => item.ministryId === ministryId);
  }

  private async resolveGenerationTeamFilter(teamIds?: string[]) {
    const normalizedTeamIds = [...new Set((teamIds ?? []).map((value) => value.trim()).filter(Boolean))];

    if (normalizedTeamIds.length === 0) {
      return {
        teamIds: [] as string[],
        teams: [] as Array<{ id: string; name: string; ministryId: string }>,
      };
    }

    const teams = await this.prisma.team.findMany({
      where: { id: { in: normalizedTeamIds } },
      select: { id: true, name: true, ministryId: true },
    });

    if (teams.length !== normalizedTeamIds.length) {
      throw new BadRequestException('One or more teamIds are invalid');
    }

    return {
      teamIds: normalizedTeamIds,
      teams,
    };
  }

  private isCandidateAllowedInService(
    servantId: string,
    existing: { servantId: string } | undefined,
    assignedInServiceCount: Map<string, number>,
    allowMultiMinistrySameService: boolean,
  ) {
    if (allowMultiMinistrySameService) {
      return true;
    }

    const currentCount = assignedInServiceCount.get(servantId) ?? 0;
    if (currentCount === 0) {
      return true;
    }

    return existing?.servantId === servantId;
  }

  private isCandidateAvailableForService(
    servantId: string,
    serviceDate: Date,
    startTime: string,
    unavailableMap: Set<string>,
  ) {
    const weekday = getSaoPauloWeekday(serviceDate);
    const shift = this.resolveShiftFromStartTime(startTime);
    return !unavailableMap.has(`${servantId}:${weekday}:${shift}`);
  }

  private async getServantUnavailableMap(servantIds: string[]) {
    if (!servantIds.length) {
      return new Set<string>();
    }

    const records = await this.prisma.servantAvailability.findMany({
      where: {
        servantId: { in: servantIds },
        available: false,
      },
      select: { servantId: true, dayOfWeek: true, shift: true },
    });

    return new Set(records.map((item) => `${item.servantId}:${item.dayOfWeek}:${item.shift}`));
  }

  private updateInMemoryMetrics(
    previousServantId: string | undefined,
    newServantId: string,
    assignedInServiceCount: Map<string, number>,
    assignedCountMonth: Map<string, number>,
    lastAssignedAtMap: Map<string, Date>,
    lastServiceOrderMap: Map<string, number>,
    serviceOrder: number,
    serviceDate: Date,
  ) {
    if (previousServantId && previousServantId !== newServantId) {
      assignedCountMonth.set(
        previousServantId,
        Math.max(0, (assignedCountMonth.get(previousServantId) ?? 0) - 1),
      );
      const oldCount = assignedInServiceCount.get(previousServantId) ?? 0;
      assignedInServiceCount.set(previousServantId, Math.max(0, oldCount - 1));
    }

    if (!previousServantId || previousServantId !== newServantId) {
      assignedCountMonth.set(newServantId, (assignedCountMonth.get(newServantId) ?? 0) + 1);
      assignedInServiceCount.set(newServantId, (assignedInServiceCount.get(newServantId) ?? 0) + 1);
    }

    lastAssignedAtMap.set(newServantId, serviceDate);
    lastServiceOrderMap.set(newServantId, serviceOrder);
  }

  private pushNoEligibleWarning(
    result: {
      summary: { skipped: number; warnings: number };
      warnings: Array<{ code: string; serviceId: string; ministryId: string; message: string }>;
    },
    serviceId: string,
    ministryId: string,
  ) {
    result.summary.warnings += 1;
    result.summary.skipped += 1;
    result.warnings.push({
      code: 'NO_ELIGIBLE_SERVANT',
      serviceId,
      ministryId,
      message: 'Nenhum servo elegivel encontrado.',
    });
  }

  private async logGenerationAudit(
    userId: string,
    serviceId: string,
    ministryId: string,
    servantId: string | undefined,
    payload: Record<string, unknown>,
  ) {
    await this.auditService.log({
      action:
        payload.action === 'CREATED'
          ? AuditAction.CREATE
          : payload.action === 'UPDATED'
            ? AuditAction.UPDATE
            : AuditAction.STATUS_CHANGE,
      entity: 'ScheduleGenerationDecision',
      entityId: `${serviceId}:${ministryId}:${servantId ?? 'none'}`,
      userId,
      metadata: {
        serviceId,
        ministryId,
        servantId,
        ...payload,
      },
    });
  }

  private async validateScheduleInput(
    serviceId: string,
    ministryId: string,
    servantId: string,
    actor: JwtPayload,
  ) {
    const [service, ministry, servant] = await Promise.all([
      this.prisma.worshipService.findUnique({
        where: { id: serviceId },
        select: { id: true, churchId: true },
      }),
      this.prisma.ministry.findUnique({
        where: { id: ministryId },
        select: { id: true, churchId: true },
      }),
      this.prisma.servant.findUnique({
        where: { id: servantId },
        select: { id: true, churchId: true },
      }),
    ]);

    if (!service) {
      throw new NotFoundException('Worship service not found');
    }

    if (!ministry) {
      throw new NotFoundException('Ministry not found');
    }
    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    this.tenantIntegrity.assertLinkIntegrity(actor, [
      { churchId: service.churchId, name: 'Worship service' },
      { churchId: ministry.churchId, name: 'Ministry' },
      { churchId: servant.churchId, name: 'Servant' },
    ]);

    await this.ensureServantEligibleForSector(servantId, ministryId, serviceId);
  }

  private async ensureNoConflict(serviceId: string, servantId: string, ministryId: string) {
    const serviceConflict = await this.prisma.schedule.findFirst({
      where: { serviceId, servantId },
      select: { id: true },
    });

    if (serviceConflict) {
      throw new BadRequestException('Servant is already assigned to this worship service');
    }

    const sectorConflict = await this.prisma.schedule.findFirst({
      where: { serviceId, ministryId, servantId },
      select: { id: true },
    });

    if (sectorConflict) {
      throw new BadRequestException('Servant is already assigned in this ministry for the service');
    }
  }

  private resolveTrainingStatusForMinistry(
    servant: {
      trainingStatus: TrainingStatus;
      mainMinistryId?: string | null;
      servantMinistries?: Array<{ ministryId: string; trainingStatus?: TrainingStatus | null }>;
    },
    ministryId: string,
  ) {
    const sectorLink = servant.servantMinistries?.find((relation) => relation.ministryId === ministryId);
    if (sectorLink?.trainingStatus) {
      return sectorLink.trainingStatus;
    }
    if (servant.mainMinistryId === ministryId) {
      return servant.trainingStatus;
    }
    return TrainingStatus.PENDING;
  }

  private resolveTrainingCompletedAtForMinistry(
    servant: {
      servantMinistries?: Array<{ ministryId: string; trainingCompletedAt?: Date | null }>;
    },
    ministryId: string,
  ) {
    return (
      servant.servantMinistries?.find((relation) => relation.ministryId === ministryId)
        ?.trainingCompletedAt ?? null
    );
  }

  private hasCompletedTrainingForMinistry(
    servant: {
      trainingStatus: TrainingStatus;
      mainMinistryId?: string | null;
      servantMinistries?: Array<{ ministryId: string; trainingStatus?: TrainingStatus | null }>;
    },
    ministryId: string,
  ) {
    return this.resolveTrainingStatusForMinistry(servant, ministryId) === TrainingStatus.COMPLETED;
  }

  private async ensureServantEligibleForSector(servantId: string, ministryId: string, serviceId?: string) {
    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: {
        id: true,
        status: true,
        trainingStatus: true,
        approvalStatus: true,
        mainMinistryId: true,
        servantMinistries: {
          where: { ministryId },
          select: { id: true, ministryId: true, trainingStatus: true, trainingCompletedAt: true },
        },
        talents: {
          take: 1,
          orderBy: { updatedAt: 'desc' },
          select: { stage: true },
        },
      },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }
    if (await this.hasActivePastoralPending(servant.id)) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Servo com pendencia pastoral ativa nao pode ser escalado.',
        details: {
          servantId: servant.id,
          reason: 'PASTORAL_PENDING',
        },
        reasons: ['PASTORAL_PENDING'],
      });
    }

    if (servant.status !== ServantStatus.ATIVO) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Servo em treinamento ou inativo nao pode ser escalado.',
        details: {
          servantId: servant.id,
          status: servant.status,
          trainingStatus: servant.trainingStatus,
        },
      });
    }

    if (!this.hasCompletedTrainingForMinistry(servant, ministryId)) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Servo ainda nao concluiu o treinamento deste ministerio.',
        details: {
          servantId: servant.id,
          ministryId: ministryId,
          ministryTrainingStatus: this.resolveTrainingStatusForMinistry(servant, ministryId),
          reason: 'MINISTRY_TRAINING_NOT_COMPLETED',
        },
        reasons: ['MINISTRY_TRAINING_NOT_COMPLETED'],
      });
    }

    if (servant.approvalStatus !== ServantApprovalStatus.APPROVED) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Servo ainda nao foi aprovado para atuar no ministerio.',
        details: {
          servantId: servant.id,
          approvalStatus: servant.approvalStatus,
        },
      });
    }

    const latestTalent = servant.talents[0];
    if (latestTalent?.stage === TalentStage.REPROVADO) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Servo com talento reprovado pendente de reavaliacao administrativa.',
        details: {
          servantId: servant.id,
          stage: latestTalent.stage,
        },
      });
    }

    const belongsToSector =
      servant.mainMinistryId === ministryId || servant.servantMinistries.length > 0;

    if (!belongsToSector) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Servo em treinamento ou inativo nao pode ser escalado.',
        details: {
          servantId: servant.id,
          status: servant.status,
          trainingStatus: servant.trainingStatus,
          ministryId,
          reason: 'SERVANT_NOT_IN_SECTOR',
        },
      });
    }

    if (serviceId) {
      const service = await this.prisma.worshipService.findUnique({
        where: { id: serviceId },
        select: { id: true, serviceDate: true, startTime: true },
      });

      if (!service) {
        throw new NotFoundException('Worship service not found');
      }

      const weekday = getSaoPauloWeekday(service.serviceDate);
      const shift = this.resolveShiftFromStartTime(service.startTime);
      const unavailability = await this.prisma.servantAvailability.findFirst({
        where: {
          servantId,
          dayOfWeek: weekday,
          shift,
          available: false,
        },
        select: { id: true },
      });

      if (unavailability) {
        throw new UnprocessableEntityException({
          code: 'SERVANT_NOT_ELIGIBLE',
          message: 'Servo indisponivel para o horario do culto.',
          details: {
            servantId,
            serviceId,
            weekday,
            shift,
          },
        });
      }
    }
  }

  private async resolveWorkspaceContext(query: ListScheduleWorkspaceQueryDto, actor: JwtPayload) {
    const start = query.startDate
      ? parseSaoPauloDateStart(query.startDate)
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 0, 0, 0));
    const end = query.endDate
      ? parseSaoPauloDateEnd(query.endDate)
      : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59));

    const scopedSectorId = await this.resolveWorkspaceMinistryId(query, actor);
    const allowedSectorIds = [scopedSectorId];

    const services = await this.prisma.worshipService.findMany({
      where: {
        serviceDate: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        serviceDate: true,
        startTime: true,
        status: true,
      },
      orderBy: [{ serviceDate: 'asc' }, { startTime: 'asc' }],
    });

    return { start, end, allowedSectorIds, services };
  }

  private async resolveWorkspaceMinistryId(query: ListScheduleWorkspaceQueryDto, actor: JwtPayload) {
    const requestedSectorId = (query.ministryId ?? '').trim();
    if (requestedSectorId) {
      const allowedForRequested = await this.resolveAllowedMinistryIds(actor, [requestedSectorId]);
      if (!allowedForRequested.includes(requestedSectorId)) {
        throw new ForbiddenException(WORKSPACE_CONTEXT_ERRORS.outOfScope);
      }
      return requestedSectorId;
    }

    const allowedSectorIds = await this.resolveAllowedMinistryIds(actor);
    if (actor.role === Role.COORDENADOR) {
      if (allowedSectorIds.length === 1) {
        return allowedSectorIds[0];
      }
      if (allowedSectorIds.length === 0) {
        throw new ForbiddenException(WORKSPACE_CONTEXT_ERRORS.coordinatorWithoutScope);
      }
      throw new BadRequestException(WORKSPACE_CONTEXT_ERRORS.coordinatorMustChoose);
    }

    if (
      actor.role === Role.ADMIN ||
      actor.role === Role.SUPER_ADMIN ||
      actor.role === Role.PASTOR
    ) {
      throw new BadRequestException(WORKSPACE_CONTEXT_ERRORS.adminMustChoose);
    }

    throw new ForbiddenException(WORKSPACE_CONTEXT_ERRORS.roleWithoutWorkspacePermission);
  }

  private evaluateServiceOperationalStatus(
    serviceStatus: WorshipServiceStatus,
    slots: Array<{
      status: ScheduleSlotStatus;
      required: boolean;
      assignedServantId: string | null;
      blocked: boolean;
    }>,
    schedules: Array<{
      status: ScheduleStatus;
      responseStatus: ScheduleResponseStatus;
      servantId: string;
      ministryId: string;
    }>,
  ) {
    const alerts: string[] = [];

    if (serviceStatus === WorshipServiceStatus.CANCELADO) {
      return {
        operationalStatus: 'CANCELADA',
        missingRequiredSlots: 0,
        pendingCount: 0,
        conflictCount: 0,
        needsSwap: false,
        alerts,
      };
    }

    const hasSlots = slots.length > 0;
    const hasSchedules = schedules.length > 0;
    if (!hasSlots && !hasSchedules) {
      return {
        operationalStatus: 'SEM_ESCALA',
        missingRequiredSlots: 0,
        pendingCount: 0,
        conflictCount: 0,
        needsSwap: false,
        alerts,
      };
    }

    const missingRequiredSlots = slots.filter(
      (slot) => slot.required && !slot.assignedServantId && !slot.blocked,
    ).length;

    const slotPending = slots.filter(
      (slot) => slot.status === ScheduleSlotStatus.PENDING_CONFIRMATION,
    ).length;
    const schedulePending = schedules.filter(
      (schedule) => schedule.responseStatus === ScheduleResponseStatus.PENDING,
    ).length;
    const pendingCount = slotPending + schedulePending;

    const slotDeclined = slots.filter((slot) => slot.status === ScheduleSlotStatus.DECLINED).length;
    const duplicateServants = new Set<string>();
    const seenServants = new Set<string>();
    for (const schedule of schedules) {
      const key = schedule.servantId;
      if (seenServants.has(key)) {
        duplicateServants.add(key);
      } else {
        seenServants.add(key);
      }
    }
    const conflictCount = slotDeclined + duplicateServants.size;
    if (conflictCount > 0) {
      alerts.push('Conflitos operacionais detectados para este culto.');
    }

    const hasSwap =
      slots.some((slot) => slot.status === ScheduleSlotStatus.SWAPPED) ||
      schedules.some((schedule) => schedule.status === ScheduleStatus.SWAPPED);
    const hasDeclined = schedules.some(
      (schedule) => schedule.responseStatus === ScheduleResponseStatus.DECLINED,
    );
    const needsSwap = hasDeclined || hasSwap;

    if (missingRequiredSlots > 0) {
      alerts.push(`Existem ${missingRequiredSlots} vaga(s) obrigatoria(s) sem preenchimento.`);
    }
    if (needsSwap) {
      alerts.push('Existem trocas/substituicoes pendentes de ajuste.');
    }

    let operationalStatus = 'CONFIRMADA';
    if (conflictCount > 0) {
      operationalStatus = 'COM_CONFLITO';
    } else if (missingRequiredSlots > 0) {
      operationalStatus = 'INCOMPLETA';
    } else if (needsSwap) {
      operationalStatus = 'TROCADA';
    } else if (pendingCount > 0) {
      operationalStatus = 'PENDENTE';
    }

    return {
      operationalStatus,
      missingRequiredSlots,
      pendingCount,
      conflictCount,
      needsSwap,
      alerts,
    };
  }

  private async listSlotEligibility(
    serviceId: string,
    ministryId: string,
    slot: {
      id: string;
      functionName: string;
      responsibilityId?: string | null;
      requiredTraining: boolean;
      blocked: boolean;
      blockedReason: string | null;
      assignedServantId?: string | null;
    },
  ) {
    const [service, servants] = await Promise.all([
      this.prisma.worshipService.findUnique({
        where: { id: serviceId },
        select: { id: true, serviceDate: true, startTime: true },
      }),
      this.prisma.servant.findMany({
        where: {
          OR: [{ mainMinistryId: ministryId }, { servantMinistries: { some: { ministryId } } }],
        },
        select: {
          id: true,
          name: true,
          status: true,
          trainingStatus: true,
          approvalStatus: true,
          aptitude: true,
          mainMinistryId: true,
          servantMinistries: {
            where: { ministryId },
            select: { ministryId: true, trainingStatus: true, trainingCompletedAt: true },
          },
        },
        orderBy: [{ name: 'asc' }],
      }),
    ]);
    if (!service) {
      throw new NotFoundException('Worship service not found');
    }

    const weekday = getSaoPauloWeekday(service.serviceDate);
    const shift = this.resolveShiftFromStartTime(service.startTime);

    const unavailability = await this.prisma.servantAvailability.findMany({
      where: {
        servantId: { in: servants.map((servant) => servant.id) },
        dayOfWeek: weekday,
        shift,
        available: false,
      },
      select: { servantId: true },
    });
    const unavailableSet = new Set(unavailability.map((item) => item.servantId));

    const servantIds = servants.map((servant) => servant.id);
    const [schedules, servantsWithPastoralPending] = await Promise.all([
      this.prisma.schedule.findMany({
        where: { serviceId, servantId: { in: servantIds } },
        select: { servantId: true, ministryId: true },
      }),
      this.getServantsWithActivePastoralPendencies(servantIds),
    ]);
    const conflictsByServant = new Map<string, Set<string>>();
    for (const schedule of schedules) {
      const ministries = conflictsByServant.get(schedule.servantId) ?? new Set<string>();
      ministries.add(schedule.ministryId);
      conflictsByServant.set(schedule.servantId, ministries);
    }
    const responsibility = slot.responsibilityId
      ? await this.prisma.ministryResponsibility.findUnique({
          where: { id: slot.responsibilityId },
          select: { requiredAptitude: true, requiredTraining: true },
        })
      : null;
    const requiredAptitude =
      responsibility?.requiredAptitude ?? this.mapFunctionToAptitude(slot.functionName);

    const effectiveRequiredTraining = responsibility?.requiredTraining ?? slot.requiredTraining;

    return Promise.all(servants.map(async (servant) => {
      const conflictSectors = [...(conflictsByServant.get(servant.id) ?? new Set<string>())];
      const evaluation = await this.eligibilityEngine.evaluate({
        ministryId,
        servant: {
          id: servant.id,
          status: servant.status,
          approvalStatus: servant.approvalStatus,
          aptitude: servant.aptitude,
          trainingStatus: servant.trainingStatus,
          mainMinistryId: servant.mainMinistryId,
          servantMinistries: servant.servantMinistries,
        },
        slot: {
          ...slot,
          requiredTraining: effectiveRequiredTraining,
        },
        hasPastoralPending: servantsWithPastoralPending.has(servant.id),
        unavailableAtServiceTime: unavailableSet.has(servant.id),
        conflictMinistryIds: conflictSectors,
        requiredAptitude,
      });

      return {
        servantId: servant.id,
        servantName: servant.name,
        ministryTrainingStatus: this.resolveTrainingStatusForMinistry(servant, ministryId),
        ministryTrainingCompletedAt: this.resolveTrainingCompletedAtForMinistry(servant, ministryId),
        eligible: evaluation.eligible,
        reasons: evaluation.reasons,
        score: evaluation.score ?? 0,
        priority: evaluation.priority ?? 'LOW',
      };
    }));
  }

  private async evaluateServantEligibilityForSlot(
    serviceId: string,
    ministryId: string,
    servantId: string,
    slot: {
      id: string;
      functionName: string;
      responsibilityId?: string | null;
      requiredTraining: boolean;
      blocked: boolean;
      blockedReason: string | null;
      assignedServantId?: string | null;
    },
  ) {
    const eligibilities = await this.listSlotEligibility(serviceId, ministryId, slot);
    const item = eligibilities.find((entry) => entry.servantId === servantId);
    if (!item) {
      return {
        eligible: false,
        reasons: ['OUTSIDE_MINISTRY'],
      };
    }

    return item;
  }

  private async ensureServiceExists(serviceId: string) {
    const service = await this.prisma.worshipService.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException('Worship service not found');
    }
  }

  private async ensureResponsibilityMatchesSector(responsibilityId: string | undefined, ministryId: string) {
    if (!responsibilityId) {
      return;
    }
    const responsibility = await this.prisma.ministryResponsibility.findUnique({
      where: { id: responsibilityId },
      select: { id: true, ministryId: true },
    });
    if (!responsibility) {
      throw new NotFoundException('Ministry responsibility not found');
    }
    if (responsibility.ministryId !== ministryId) {
      throw new BadRequestException('Responsibility does not belong to informed ministry');
    }
  }

  private async swapOrFillSlot(
    slotId: string,
    dto: ContextualSwapScheduleSlotDto,
    actor: JwtPayload,
    forceFill: boolean,
  ) {
    const slot = await this.prisma.scheduleSlot.findUnique({
      where: { id: slotId },
      include: {
        service: { select: { id: true } },
      },
    });
    if (!slot) {
      throw new NotFoundException('Schedule slot not found');
    }

    await this.assertCanManageMinistry(actor, slot.ministryId);
    if (!forceFill && !slot.assignedServantId) {
      throw new BadRequestException('Slot is not currently assigned. Use fill endpoint instead.');
    }
    if (slot.assignedServantId === dto.substituteServantId) {
      return this.prisma.scheduleSlot.findUnique({
        where: { id: slot.id },
        include: {
          assignedServant: { select: { id: true, name: true } },
          responsibility: { select: { id: true, title: true, functionName: true } },
        },
      });
    }

    const eligibility = await this.evaluateServantEligibilityForSlot(
      slot.serviceId,
      slot.ministryId,
      dto.substituteServantId,
      slot,
    );
    if (!eligibility.eligible) {
      throw new UnprocessableEntityException({
        code: 'SERVANT_NOT_ELIGIBLE',
        message: 'Substitute servant is not eligible for this slot',
        reasons: eligibility.reasons,
      });
    }

    const oldServantId = slot.assignedServantId;
    await this.assignSlot(slotId, { servantId: dto.substituteServantId, reason: dto.reason }, actor, {
      auditAction: forceFill ? AuditAction.FILL : AuditAction.SLOT_SWAPPED,
      auditMetadata: {
        context: dto.context,
        substituteServantId: dto.substituteServantId,
      },
    });
    const updated = await this.prisma.scheduleSlot.update({
      where: { id: slotId },
      data: {
        status: forceFill ? ScheduleSlotStatus.PENDING_CONFIRMATION : ScheduleSlotStatus.SWAPPED,
      },
    });

    const mappedChangeType =
      dto.context === ScheduleSlotSwapContextDto.ABSENCE_REPLACEMENT
        ? ScheduleSlotChangeType.ABSENCE_REPLACEMENT
        : dto.context === ScheduleSlotSwapContextDto.FILL_OPEN_SLOT
          ? ScheduleSlotChangeType.FILL_OPEN_SLOT
          : ScheduleSlotChangeType.REPLACEMENT;

    await this.prisma.scheduleSlotChange.create({
      data: {
        slotId,
        changeType: mappedChangeType,
        fromServantId: oldServantId,
        toServantId: dto.substituteServantId,
        reason: dto.reason,
        performedByUserId: actor.sub,
      },
    });

    if (!forceFill) {
      await this.eventBus.emit({
        name: 'SLOT_ASSIGNED',
        occurredAt: new Date(),
        actorUserId: actor.sub,
        churchId: slot.churchId,
        payload: {
          slotId,
          fromServantId: oldServantId,
          toServantId: dto.substituteServantId,
          context: dto.context,
        },
      });
    }

    this.invalidateSchedulingCaches(slot.serviceId, slot.ministryId);

    return this.prisma.scheduleSlot.findUnique({
      where: { id: updated.id },
      include: {
        assignedServant: { select: { id: true, name: true } },
        responsibility: { select: { id: true, title: true, functionName: true } },
      },
    });
  }

  private mapFunctionToAptitude(functionName: string): Aptitude | null {
    const normalized = functionName.toLowerCase();
    if (normalized.includes('tecn')) {
      return Aptitude.TECNICO;
    }
    if (normalized.includes('oper')) {
      return Aptitude.OPERACIONAL;
    }
    if (normalized.includes('social')) {
      return Aptitude.SOCIAL;
    }
    if (normalized.includes('apoio')) {
      return Aptitude.APOIO;
    }
    if (normalized.includes('lider')) {
      return Aptitude.LIDERANCA;
    }
    return null;
  }

  private async getServantsWithActivePastoralPendencies(servantIds: string[]) {
    if (!servantIds.length) {
      return new Set<string>();
    }

    const [visits, alerts] = await Promise.all([
      this.prisma.pastoralVisit.findMany({
        where: {
          servantId: { in: servantIds },
          status: { in: [PastoralVisitStatus.ABERTA, PastoralVisitStatus.EM_ANDAMENTO] },
        },
        select: { servantId: true },
        distinct: ['servantId'],
      }),
      this.prisma.pastoralAlert.findMany({
        where: {
          servantId: { in: servantIds },
          status: AlertStatus.OPEN,
        },
        select: { servantId: true },
        distinct: ['servantId'],
      }),
    ]);

    return new Set<string>([
      ...visits.map((item) => item.servantId),
      ...alerts.map((item) => item.servantId),
    ]);
  }

  private async hasActivePastoralPending(servantId: string) {
    const [openVisits, openAlerts] = await Promise.all([
      this.prisma.pastoralVisit.count({
        where: {
          servantId,
          status: { in: [PastoralVisitStatus.ABERTA, PastoralVisitStatus.EM_ANDAMENTO] },
        },
      }),
      this.prisma.pastoralAlert.count({
        where: {
          servantId,
          status: AlertStatus.OPEN,
        },
      }),
    ]);
    return openVisits > 0 || openAlerts > 0;
  }

  private resolveShiftFromStartTime(startTime: string): Shift {
    const hour = Number(startTime.split(':')[0] ?? 0);
    if (hour < 12) {
      return Shift.MORNING;
    }
    if (hour < 18) {
      return Shift.AFTERNOON;
    }
    return Shift.EVENING;
  }

  private async resolveAllowedMinistryIds(actor: JwtPayload, requestedSectorIds?: string[]) {
    const actorChurchId = this.tenantIntegrity.getActorChurchId(actor);
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
      if (requestedSectorIds?.length) {
        if (actorChurchId) {
          const rows = await this.prisma.ministry.findMany({
            where: { id: { in: requestedSectorIds } },
            select: { id: true, churchId: true },
          });
          rows.forEach((row) =>
            this.tenantIntegrity.assertSameChurch(actorChurchId, row.churchId, 'Ministry'),
          );
        }
        return [...new Set(requestedSectorIds)];
      }

      const allSectors = await this.prisma.ministry.findMany({
        where: actorChurchId ? { churchId: actorChurchId } : undefined,
        select: { id: true },
      });
      return allSectors.map((ministry) => ministry.id);
    }

    const allowed = await resolveScopedMinistryIds(this.prisma, actor);
    if (requestedSectorIds?.length) {
      const outOfScope = requestedSectorIds.some((id) => !allowed.includes(id));
      if (outOfScope) {
        throw new ForbiddenException('You can only generate schedules for your allowed ministries');
      }
      return [...new Set(requestedSectorIds)];
    }

    return allowed;
  }

  private async assertCanManageMinistry(actor: JwtPayload, ministryId: string) {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) {
      return;
    }

    if (actor.role === Role.COORDENADOR) {
      const allowedSectorIds = await resolveScopedMinistryIds(this.prisma, actor);
      if (!allowedSectorIds.includes(ministryId)) {
        throw new ForbiddenException({
          message: 'You do not have permission for this ministry',
          ministryId,
          allowedSectorIds,
        });
      }
      return;
    }

    throw new ForbiddenException('You do not have permission to manage schedules for this ministry');
  }

  private async assertCanManageSchedule(actor: JwtPayload, scheduleId: string) {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
      return;
    }

    if (actor.role !== Role.COORDENADOR) {
      throw new ForbiddenException('You do not have permission for this schedule');
    }

    const scopeWhere = await getScheduleAccessWhere(this.prisma, actor);
    const schedule = await this.prisma.schedule.findFirst({
      where: scopeWhere ? { AND: [{ id: scheduleId }, scopeWhere] } : { id: scheduleId },
      select: { id: true },
    });

    if (!schedule) {
      throw new ForbiddenException('You do not have permission for this schedule');
    }
  }

  private async getSwapHistoryWhere(actor: JwtPayload): Promise<Prisma.ScheduleSwapHistoryWhereInput | undefined> {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
      return undefined;
    }

    const scopeWhere = await getScheduleAccessWhere(this.prisma, actor);
    if (!scopeWhere) {
      return undefined;
    }

    return {
      OR: [{ fromSchedule: scopeWhere }, { toSchedule: scopeWhere }],
    };
  }

  private toApiSchedule<
    T extends {
      serviceId: string;
      service?: { title?: string } | null;
      servant?: {
        name?: string;
        teamId?: string | null;
        team?: { id?: string | null; name?: string | null } | null;
      } | null;
      ministry?: { name?: string } | null;
    },
  >(schedule: T) {
      const teamId = schedule.servant?.team?.id ?? schedule.servant?.teamId ?? null;
      const teamName = schedule.servant?.team?.name ?? null;

      return {
        ...schedule,
        worshipServiceId: schedule.serviceId,
        worshipServiceTitle: schedule.service?.title ?? null,
        servantName: schedule.servant?.name ?? null,
        sectorName: schedule.ministry?.name ?? null,
        ministryId: (schedule as { ministryId?: string }).ministryId ?? null,
        ministryName: schedule.ministry?.name ?? null,
        teamId,
        teamName,
      };
  }

  private async notifyScheduleEvent(
    servantId: string,
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.notificationsService.notifyServantLinkedUser(servantId, {
      type,
      title,
      message,
      link: '/schedules',
      metadata,
    });
  }

  private invalidateSchedulingCaches(serviceId: string, ministryId: string) {
    this.cacheService.del(`schedule-board:${serviceId}:${ministryId}`);
    this.cacheService.del(`eligible:${serviceId}:${ministryId}`);
  }

  private requireActorChurch(actor: JwtPayload) {
    if (!actor.churchId) {
      throw new ForbiddenException('Actor must be bound to a church context');
    }
    return actor.churchId;
  }
}






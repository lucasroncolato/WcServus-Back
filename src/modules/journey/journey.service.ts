import { Injectable } from '@nestjs/common';
import {
  JourneyLogType,
  JourneyNextStepStatus,
  MinistryTaskOccurrenceStatus,
  TrainingStatus,
} from '@prisma/client';
import {
  attendanceAbsenceStatuses,
  attendancePositiveStatuses,
  isAbsenceAttendanceStatus,
  isPositiveAttendanceStatus,
} from 'src/common/attendance/attendance-status.utils';
import { JOURNEY_MILESTONE_CATALOG } from 'src/common/journey/journey-milestone-catalog';
import { JOURNEY_NEXT_STEP_CATALOG } from 'src/common/journey/journey-next-step-catalog';
import { classifyJourneyLogTone } from 'src/common/journey/journey-policy';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListJourneyIndicatorsQueryDto } from './dto/list-journey-indicators.query.dto';
import { ListJourneyLogsQueryDto } from './dto/list-journey-logs.query.dto';

type Indicator = {
  key: string;
  name: string;
  progressPercent: number;
  level: 'INICIANTE' | 'EM_DESENVOLVIMENTO' | 'BOM' | 'MUITO_BOM' | 'REFERENCIA';
  description: string;
};

const DEFAULT_MOTIVATIONAL_MESSAGES = [
  'Continue firme.',
  'Seu servico tem valor.',
  'Voce esta crescendo.',
  'Pequenas coisas fazem grande diferenca.',
  'Servir e um privilegio.',
  'Deus ve o que ninguem ve.',
  'Voce tem sido fiel.',
  'Continue no caminho.',
];

@Injectable()
export class JourneyService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyJourney(servantId: string, churchId: string | null) {
    const [summary, milestones, logs, indicators, nextSteps] = await Promise.all([
      this.getSummary(servantId, churchId),
      this.getMilestones(servantId, churchId),
      this.getLogs(servantId, churchId),
      this.getIndicators(servantId, churchId, { windowDays: 30 }),
      this.getNextSteps(servantId, churchId),
    ]);

    return {
      summary,
      milestones,
      logs,
      indicators,
      visual: this.buildVisual(summary),
      symbolicState: this.buildVisual(summary),
      motivationalMessage: this.pickMotivationalMessage(summary, indicators),
      nextSteps,
    };
  }

  async getSummary(servantId: string, churchId: string | null) {
    await this.ensureJourney(servantId, churchId);
    await this.syncDefaultMilestones();
    await this.evaluateMilestones(servantId, churchId);

    const journey = await this.prisma.servantJourney.findUniqueOrThrow({
      where: { servantId },
    });
    const [ministriesCount, tracksCount, milestonesCount] = await Promise.all([
      this.prisma.servantMinistry.count({ where: { servantId } }),
      this.countCompletedTracks(servantId),
      this.prisma.servantMilestone.count({ where: { servantId } }),
    ]);

    return {
      startedAt: journey.startedAt,
      monthsServing: journey.monthsServing,
      ministriesCount,
      totalServices: journey.totalServices,
      totalTasksCompleted: journey.totalTasksCompleted,
      totalTrainingsCompleted: journey.totalTrainingsCompleted,
      totalEventsServed: journey.totalEventsServed,
      completedTracks: tracksCount,
      milestonesUnlocked: milestonesCount,
      lastActivityAt: journey.lastActivityAt,
      symbolicState: this.buildVisual({
        totalServices: journey.totalServices,
        totalTasksCompleted: journey.totalTasksCompleted,
        totalTrainingsCompleted: journey.totalTrainingsCompleted,
        monthsServing: journey.monthsServing,
      }),
    };
  }

  async getMilestones(servantId: string, churchId: string | null) {
    await this.ensureJourney(servantId, churchId);
    await this.syncDefaultMilestones();
    await this.evaluateMilestones(servantId, churchId);

    const unlocked = await this.prisma.servantMilestone.findMany({
      where: { servantId },
      include: {
        milestone: true,
      },
      orderBy: [{ achievedAt: 'desc' }],
    });

    return unlocked.map((item) => ({
      id: item.id,
      achievedAt: item.achievedAt,
      milestone: {
        id: item.milestone.id,
        code: item.milestone.code,
        name: item.milestone.name,
        description: item.milestone.description,
        icon: item.milestone.icon,
        category: item.milestone.category,
      },
    }));
  }

  async getLogs(servantId: string, churchId: string | null, query?: ListJourneyLogsQueryDto) {
    await this.ensureJourney(servantId, churchId);

    const logs = await this.prisma.journeyLog.findMany({
      where: {
        servantId,
        ...(query?.cursor
          ? {
              occurredAt: {
                lt: new Date(query.cursor),
              },
            }
          : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    const typed = logs.map((item) => ({
      ...item,
      tone: classifyJourneyLogTone(item.type),
    }));

    return typed.filter((item) => {
      if (query?.type && item.type !== query.type) return false;
      if (query?.tone && item.tone !== query.tone) return false;
      return true;
    });
  }

  async getIndicators(servantId: string, churchId: string | null, query?: ListJourneyIndicatorsQueryDto) {
    await this.ensureJourney(servantId, churchId);
    await this.refreshJourneyProjection(servantId, churchId);

    const windowDays = query?.windowDays ?? 30;
    const snapshot = await this.prisma.journeyIndicatorSnapshot.findUnique({
      where: {
        servantId_windowDays: {
          servantId,
          windowDays,
        },
      },
    });

    if (!snapshot) {
      return [];
    }

    const indicators: Indicator[] = [
      this.makeIndicator('constancy', 'Constancia', snapshot.constancyScore, 'Presenca e regularidade no servico.'),
      this.makeIndicator('readiness', 'Prontidao', snapshot.readinessScore, 'Preparo para servir nas proximas escalas.'),
      this.makeIndicator(
        'responsiveness',
        'Resposta as escalas',
        snapshot.responsivenessScore,
        'Agilidade e compromisso nas respostas de escala.',
      ),
      this.makeIndicator('punctuality', 'Pontualidade', snapshot.punctualityScore, 'Chegada no horario e constancia.'),
      this.makeIndicator('engagement', 'Engajamento', snapshot.engagementScore, 'Participacao ativa no ministerio.'),
      this.makeIndicator('continuity', 'Continuidade', snapshot.continuityScore, 'Regularidade e permanencia no servir.'),
      this.makeIndicator('formation', 'Formacao', snapshot.formationScore, 'Evolucao em treinamento e preparo.'),
    ];

    return indicators;
  }

  async getNextSteps(servantId: string, churchId: string | null) {
    await this.ensureJourney(servantId, churchId);
    await this.refreshJourneyProjection(servantId, churchId);
    const records = await this.prisma.journeyNextStep.findMany({
      where: {
        servantId,
        status: JourneyNextStepStatus.OPEN,
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 10,
    });

    return records.slice(0, 3);
  }

  async dismissNextStep(servantId: string, churchId: string | null, stepId: string) {
    await this.ensureJourney(servantId, churchId);
    const current = await this.prisma.journeyNextStep.findUnique({
      where: { id: stepId },
      select: { id: true, servantId: true, status: true },
    });
    if (!current || current.servantId !== servantId || current.status !== JourneyNextStepStatus.OPEN) {
      return { success: false };
    }
    await this.prisma.journeyNextStep.update({
      where: { id: stepId },
      data: {
        status: JourneyNextStepStatus.DISMISSED,
        resolvedAt: new Date(),
      },
    });
    return { success: true };
  }

  async registerJourneyEvent(input: {
    servantId: string;
    churchId: string | null;
    type: JourneyLogType;
    title: string;
    description?: string;
    referenceId?: string;
    occurredAt?: Date;
  }) {
    const resolvedChurchId = await this.ensureChurchForServant(input.servantId, input.churchId);
    await this.ensureJourney(input.servantId, resolvedChurchId);

    if (input.referenceId) {
      const existing = await this.prisma.journeyLog.findFirst({
        where: { servantId: input.servantId, referenceId: input.referenceId },
        select: { id: true },
      });
      if (existing) return existing;
    }

    const log = await this.prisma.journeyLog.create({
      data: {
        servantId: input.servantId,
        churchId: resolvedChurchId,
        type: input.type,
        title: input.title,
        description: input.description,
        referenceId: input.referenceId,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    await this.refreshJourneyProjection(input.servantId, resolvedChurchId);
    return log;
  }

  async refreshJourneyProjection(servantId: string, churchId: string | null) {
    await this.refreshJourney(servantId, churchId);
    await this.syncDefaultMilestones();
    await this.evaluateMilestones(servantId, churchId);
    await this.rebuildIndicatorSnapshots(servantId, churchId);
    await this.rebuildNextSteps(servantId, churchId);
  }

  private async ensureJourney(servantId: string, churchId: string | null) {
    const existing = await this.prisma.servantJourney.findUnique({
      where: { servantId },
      select: { servantId: true },
    });
    if (existing) return;

    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: { joinedAt: true, churchId: true },
    });
    if (!servant) return;

    const startedAt = servant.joinedAt ?? new Date();
    await this.prisma.servantJourney.create({
      data: {
        servantId,
        churchId: await this.ensureChurchForServant(servantId, servant.churchId ?? churchId),
        startedAt,
      },
    });
  }

  private async refreshJourney(servantId: string, churchId: string | null) {
    const [services, tasks, trainings, events, lastLog, servant] = await Promise.all([
      this.prisma.attendance.count({ where: { servantId, status: { in: attendancePositiveStatuses() } } }),
      this.prisma.ministryTaskOccurrence.count({
        where: { assignedServantId: servantId, status: MinistryTaskOccurrenceStatus.COMPLETED },
      }),
      this.prisma.servantMinistry.count({ where: { servantId, trainingStatus: TrainingStatus.COMPLETED } }),
      this.prisma.attendance.count({
        where: {
          servantId,
          status: { in: attendancePositiveStatuses() },
          service: {
            type: { in: ['ESPECIAL', 'CONGRESSO', 'VIGILIA'] },
          },
        },
      }),
      this.prisma.journeyLog.findFirst({
        where: { servantId },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        select: { occurredAt: true },
      }),
      this.prisma.servant.findUnique({
        where: { id: servantId },
        select: { joinedAt: true, churchId: true },
      }),
    ]);

    const startedAt = servant?.joinedAt ?? new Date();
    const monthsServing = this.monthsBetween(startedAt, new Date());

    await this.prisma.servantJourney.upsert({
      where: { servantId },
      create: {
        servantId,
        churchId: await this.ensureChurchForServant(servantId, servant?.churchId ?? churchId),
        startedAt,
        totalServices: services,
        totalTasksCompleted: tasks,
        totalTrainingsCompleted: trainings,
        totalEventsServed: events,
        monthsServing,
        lastActivityAt: lastLog?.occurredAt ?? startedAt,
      },
      update: {
        churchId: await this.ensureChurchForServant(servantId, servant?.churchId ?? churchId),
        startedAt,
        totalServices: services,
        totalTasksCompleted: tasks,
        totalTrainingsCompleted: trainings,
        totalEventsServed: events,
        monthsServing,
        lastActivityAt: lastLog?.occurredAt ?? undefined,
      },
    });
  }

  private async syncDefaultMilestones() {
    for (const item of JOURNEY_MILESTONE_CATALOG) {
      const exists = await this.prisma.journeyMilestone.findUnique({
        where: { code: item.code },
        select: { id: true },
      });
      if (exists) continue;
      const firstChurch = await this.prisma.church.findFirst({
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!firstChurch) continue;
      await this.prisma.journeyMilestone.create({
        data: {
          churchId: firstChurch.id,
          code: item.code,
          name: item.name,
          description: item.description,
          icon: item.icon,
          category: item.category,
        },
      });
    }
  }

  private async evaluateMilestones(servantId: string, churchId: string | null) {
    await this.refreshJourney(servantId, churchId);
    const [journey, tracksCompleted, consecutivePresence, helpCount, substituteCount, ministriesCount] = await Promise.all([
      this.prisma.servantJourney.findUnique({ where: { servantId } }),
      this.countCompletedTracks(servantId),
      this.countConsecutivePositiveAttendance(servantId),
      this.prisma.journeyLog.count({ where: { servantId, type: 'HELP' } }),
      this.prisma.journeyLog.count({ where: { servantId, type: 'SUBSTITUTE' } }),
      this.prisma.servantMinistry.count({ where: { servantId } }),
    ]);
    if (!journey) return;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [recentActivity30, recentActivity90, firstPositiveAttendance, firstConfirmedSchedule, extraServiceCount] =
      await Promise.all([
        this.prisma.attendance.count({
          where: {
            servantId,
            createdAt: { gte: thirtyDaysAgo },
            status: { in: attendancePositiveStatuses() },
          },
        }),
        this.prisma.attendance.count({
          where: {
            servantId,
            createdAt: { gte: ninetyDaysAgo },
            status: { in: attendancePositiveStatuses() },
          },
        }),
        this.prisma.attendance.findFirst({
          where: { servantId, status: { in: attendancePositiveStatuses() } },
          select: { id: true },
        }),
        this.prisma.scheduleResponseHistory.findFirst({
          where: { schedule: { servantId }, responseStatus: 'CONFIRMED' },
          select: { id: true },
        }),
        this.prisma.attendance.count({ where: { servantId, status: 'EXTRA_SERVICE' } }),
      ]);

    const conditionMap = new Map<string, boolean>([
      ['FIRST_ASSIGNMENT_ACCEPTED', Boolean(firstConfirmedSchedule)],
      ['FIRST_PRESENCE_CONFIRMED', Boolean(firstPositiveAttendance)],
      ['FOUR_CONSECUTIVE_PRESENCES', consecutivePresence >= 4],
      ['TRAINING_COMPLETED', journey.totalTrainingsCompleted >= 1],
      ['NEW_MINISTRY_SERVICE', ministriesCount > 1],
      ['RETURN_AFTER_GAP', await this.hasReturnAfterGap(servantId)],
      ['CONSISTENCY_30_DAYS', recentActivity30 >= 3],
      ['CONSISTENCY_90_DAYS', recentActivity90 >= 10],
      ['EXTRA_SERVICE_HELP', extraServiceCount >= 1],
      ['SUBSTITUTION_SUPPORT', substituteCount >= 1 || helpCount >= 1],
    ]);

    const milestones = await this.prisma.journeyMilestone.findMany({
      where: { code: { in: [...conditionMap.keys()] } },
    });

    for (const milestone of milestones) {
      if (!conditionMap.get(milestone.code)) continue;
      const already = await this.prisma.servantMilestone.findFirst({
        where: { servantId, milestoneId: milestone.id },
        select: { id: true },
      });
      if (already) continue;

      await this.prisma.servantMilestone.create({
        data: { servantId, milestoneId: milestone.id, churchId: journey.churchId },
      });

      await this.prisma.journeyLog.create({
        data: {
          servantId,
          churchId: journey.churchId,
          type: 'MILESTONE',
          title: `Marco conquistado: ${milestone.name}`,
          description: milestone.description ?? undefined,
          referenceId: `milestone:${milestone.code}:${servantId}`,
          occurredAt: new Date(),
        },
      });
    }
  }

  private async rebuildIndicatorSnapshots(servantId: string, churchId: string | null) {
    const resolvedChurchId = await this.ensureChurchForServant(servantId, churchId);
    for (const windowDays of [30, 60, 90]) {
      const snapshot = await this.computeIndicatorSnapshot(servantId, windowDays);
      await this.prisma.journeyIndicatorSnapshot.upsert({
        where: {
          servantId_windowDays: { servantId, windowDays },
        },
        create: {
          churchId: resolvedChurchId,
          servantId,
          windowDays,
          ...snapshot,
          generatedAt: new Date(),
        },
        update: {
          ...snapshot,
          generatedAt: new Date(),
        },
      });
    }
  }

  private async rebuildNextSteps(servantId: string, churchId: string | null) {
    const resolvedChurchId = await this.ensureChurchForServant(servantId, churchId);
    const [summary, indicators, recentLogs] = await Promise.all([
      this.getSummary(servantId, resolvedChurchId),
      this.getIndicators(servantId, resolvedChurchId, { windowDays: 30 }),
      this.prisma.journeyLog.findMany({
        where: { servantId },
        orderBy: [{ occurredAt: 'desc' }],
        take: 20,
      }),
    ]);

    const activeTypes = new Set<string>();
    const commitment = indicators.find((item) => item.key === 'constancy')?.progressPercent ?? 0;
    const punctuality = indicators.find((item) => item.key === 'punctuality')?.progressPercent ?? 100;
    const responsiveness = indicators.find((item) => item.key === 'responsiveness')?.progressPercent ?? 100;

    if (summary.totalTrainingsCompleted < 1) activeTypes.add('COMPLETE_TRAINING');
    if (responsiveness < 60) activeTypes.add('IMPROVE_RESPONSE');
    if (commitment < 55) activeTypes.add('RETAKE_CONSTANCY');
    if (punctuality < 60) activeTypes.add('IMPROVE_PUNCTUALITY');
    if (recentLogs.some((item) => item.type === 'EVENT')) activeTypes.add('TALK_TO_LEADERSHIP');

    const open = await this.prisma.journeyNextStep.findMany({
      where: {
        servantId,
        status: JourneyNextStepStatus.OPEN,
      },
      select: { id: true, type: true },
    });

    for (const item of open) {
      if (!activeTypes.has(item.type)) {
        await this.prisma.journeyNextStep.update({
          where: { id: item.id },
          data: {
            status: JourneyNextStepStatus.DONE,
            resolvedAt: new Date(),
          },
        });
      }
    }

    for (const type of activeTypes) {
      const catalog = JOURNEY_NEXT_STEP_CATALOG[type];
      if (!catalog) continue;
      const exists = open.some((item: { type: string }) => item.type === type);
      if (exists) continue;
      await this.prisma.journeyNextStep.create({
        data: {
          churchId: resolvedChurchId,
          servantId,
          type,
          priority: catalog.priority,
          title: catalog.title,
          description: catalog.description,
          source: catalog.source,
          status: JourneyNextStepStatus.OPEN,
        },
      });
    }
  }

  private async computeIndicatorSnapshot(servantId: string, windowDays: number) {
    const start = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const [attendances, schedules, tasksCompleted, trainingsCompleted, allAttendancesCount] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { servantId, createdAt: { gte: start } },
        select: { status: true },
      }),
      this.prisma.scheduleResponseHistory.findMany({
        where: { schedule: { servantId }, respondedAt: { gte: start } },
        select: { responseStatus: true },
      }),
      this.prisma.ministryTaskOccurrence.count({
        where: {
          assignedServantId: servantId,
          completedAt: { gte: start },
          status: MinistryTaskOccurrenceStatus.COMPLETED,
        },
      }),
      this.prisma.servantMinistry.count({
        where: {
          servantId,
          trainingStatus: TrainingStatus.COMPLETED,
        },
      }),
      this.prisma.attendance.count({ where: { servantId } }),
    ]);

    const positive = attendances.filter((item) => isPositiveAttendanceStatus(item.status)).length;
    const absence = attendances.filter((item) => isAbsenceAttendanceStatus(item.status)).length;
    const lateOrEarly = attendances.filter((item) => item.status === 'LATE' || item.status === 'LEFT_EARLY').length;
    const respondedConfirmed = schedules.filter((item) => item.responseStatus === 'CONFIRMED').length;
    const respondedDeclined = schedules.filter((item) => item.responseStatus === 'DECLINED').length;

    const totalAttendanceInWindow = positive + absence;
    const constancy = totalAttendanceInWindow > 0 ? Math.round((positive / totalAttendanceInWindow) * 100) : 0;
    const readiness = Math.max(0, Math.min(100, Math.round(constancy * 0.6 + trainingsCompleted * 8 + tasksCompleted * 4)));
    const responsivenessBase = respondedConfirmed + respondedDeclined;
    const responsiveness =
      responsivenessBase > 0 ? Math.round((respondedConfirmed / responsivenessBase) * 100) : 70;
    const punctuality = positive > 0 ? Math.max(0, Math.round(100 - (lateOrEarly / positive) * 100)) : 80;
    const engagement = Math.max(0, Math.min(100, Math.round(positive * 8 + tasksCompleted * 5)));
    const continuity = allAttendancesCount > 0 ? Math.max(0, Math.min(100, Math.round(constancy * 0.7 + 30))) : 0;
    const formation = Math.max(0, Math.min(100, trainingsCompleted * 25));

    return {
      constancyScore: constancy,
      readinessScore: readiness,
      responsivenessScore: responsiveness,
      punctualityScore: punctuality,
      engagementScore: engagement,
      continuityScore: continuity,
      formationScore: formation,
    };
  }

  private async countCompletedTracks(servantId: string) {
    const progress = await this.prisma.servantGrowthProgress.findMany({
      where: { servantId },
      select: { growthTrackId: true, completed: true },
    });
    const byTrack = new Map<string, { total: number; done: number }>();
    for (const item of progress) {
      const state = byTrack.get(item.growthTrackId) ?? { total: 0, done: 0 };
      state.total += 1;
      if (item.completed) state.done += 1;
      byTrack.set(item.growthTrackId, state);
    }
    return [...byTrack.values()].filter((item) => item.total > 0 && item.done >= item.total).length;
  }

  private makeIndicator(key: string, name: string, scoreInput: number, description: string): Indicator {
    const progressPercent = Math.max(0, Math.min(100, Math.round(scoreInput)));
    return {
      key,
      name,
      progressPercent,
      level: this.levelByScore(progressPercent),
      description,
    };
  }

  private levelByScore(score: number): Indicator['level'] {
    if (score >= 85) return 'REFERENCIA';
    if (score >= 70) return 'MUITO_BOM';
    if (score >= 50) return 'BOM';
    if (score >= 30) return 'EM_DESENVOLVIMENTO';
    return 'INICIANTE';
  }

  private buildVisual(summary: {
    totalServices: number;
    totalTasksCompleted: number;
    totalTrainingsCompleted: number;
    monthsServing: number;
  }) {
    const totalSeeds =
      summary.totalServices + summary.totalTasksCompleted + summary.totalTrainingsCompleted * 2 + summary.monthsServing;
    const stage =
      totalSeeds >= 120 ? 'arvore-frondosa' : totalSeeds >= 70 ? 'arvore-crescendo' : totalSeeds >= 25 ? 'broto' : 'semente';
    return {
      metaphor: 'sementes',
      totalSeeds,
      stage,
      stageLabel:
        stage === 'arvore-frondosa'
          ? 'Arvore frondosa'
          : stage === 'arvore-crescendo'
            ? 'Arvore crescendo'
            : stage === 'broto'
              ? 'Broto em desenvolvimento'
              : 'Semente em preparo',
    };
  }

  private pickMotivationalMessage(summary: { totalServices: number; totalTasksCompleted: number }, indicators: Indicator[]) {
    if (summary.totalServices + summary.totalTasksCompleted < 5) {
      return 'Pequenas coisas fazem grande diferenca.';
    }
    const growth = indicators.find((item) => item.key === 'readiness');
    if (growth?.level === 'REFERENCIA' || growth?.level === 'MUITO_BOM') {
      return 'Voce tem sido fiel.';
    }
    return DEFAULT_MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * DEFAULT_MOTIVATIONAL_MESSAGES.length)];
  }

  private async countConsecutivePositiveAttendance(servantId: string) {
    const rows = await this.prisma.attendance.findMany({
      where: { servantId },
      orderBy: [{ createdAt: 'desc' }],
      take: 20,
      select: { status: true },
    });

    let streak = 0;
    for (const row of rows) {
      if (!isPositiveAttendanceStatus(row.status)) break;
      streak += 1;
    }
    return streak;
  }

  private async hasReturnAfterGap(servantId: string) {
    const rows = await this.prisma.attendance.findMany({
      where: { servantId },
      orderBy: [{ createdAt: 'asc' }],
      select: { createdAt: true },
    });
    if (rows.length < 2) return false;
    for (let i = 1; i < rows.length; i += 1) {
      const gapMs = rows[i].createdAt.getTime() - rows[i - 1].createdAt.getTime();
      if (gapMs >= 45 * 24 * 60 * 60 * 1000) {
        return true;
      }
    }
    return false;
  }

  private monthsBetween(start: Date, end: Date) {
    const startYear = start.getUTCFullYear();
    const endYear = end.getUTCFullYear();
    const startMonth = start.getUTCMonth();
    const endMonth = end.getUTCMonth();
    const raw = (endYear - startYear) * 12 + (endMonth - startMonth);
    return Math.max(0, raw);
  }

  private async ensureChurchForServant(servantId: string, fallbackChurchId: string | null) {
    if (fallbackChurchId) {
      return fallbackChurchId;
    }
    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: { churchId: true },
    });
    if (servant?.churchId) {
      return servant.churchId;
    }
    const firstChurch = await this.prisma.church.findFirst({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!firstChurch) {
      throw new Error('No church found to resolve Journey tenant');
    }
    return firstChurch.id;
  }
}

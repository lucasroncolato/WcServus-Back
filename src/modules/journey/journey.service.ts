import { Injectable, OnModuleInit } from '@nestjs/common';
import { AttendanceStatus, MinistryTaskOccurrenceStatus, TrainingStatus } from '@prisma/client';
import { EventBusService } from 'src/common/events/event-bus.service';
import { PrismaService } from 'src/prisma/prisma.service';

type JourneyLogType =
  | 'SERVICE'
  | 'TASK'
  | 'CHECKLIST'
  | 'TRAINING'
  | 'TRACK'
  | 'EVENT'
  | 'SUBSTITUTE'
  | 'HELP'
  | 'MILESTONE';

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

const DEFAULT_MILESTONES: Array<{
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}> = [
  { code: 'FIRST_SERVICE', name: 'Primeiro servico', description: 'Serviu em um culto pela primeira vez.', icon: 'sparkles', category: 'SERVICO' },
  { code: 'TEN_SERVICES', name: '10 servicos', description: 'Alcancou 10 servicos em cultos.', icon: 'star', category: 'SERVICO' },
  { code: 'THREE_MONTHS_SERVING', name: '3 meses servindo', description: 'Completou 3 meses no ministerio.', icon: 'calendar', category: 'TEMPO' },
  { code: 'ONE_YEAR_SERVING', name: '1 ano servindo', description: 'Completou um ano no ministerio.', icon: 'badge-check', category: 'TEMPO' },
  { code: 'SIX_MONTHS_WITHOUT_ABSENCE', name: '6 meses sem falta', description: 'Manteve constancia sem registrar falta por 6 meses.', icon: 'calendar-check', category: 'CONSTANCIA' },
  { code: 'FIRST_TASK', name: 'Primeira tarefa', description: 'Concluiu a primeira tarefa ministerial.', icon: 'check', category: 'TAREFAS' },
  { code: 'TEN_TASKS', name: '10 tarefas', description: 'Concluiu 10 tarefas ministeriais.', icon: 'list-checks', category: 'TAREFAS' },
  { code: 'PERFECT_CHECKLIST', name: 'Checklist completo', description: 'Finalizou checklist de tarefa com excelencia.', icon: 'clipboard-check', category: 'TAREFAS' },
  { code: 'FIRST_TRAINING', name: 'Primeiro treinamento', description: 'Concluiu o primeiro treinamento.', icon: 'graduation-cap', category: 'TREINAMENTO' },
  { code: 'COMPLETED_TRACK', name: 'Trilha concluida', description: 'Concluiu uma trilha ministerial.', icon: 'route', category: 'TRILHAS' },
  { code: 'SERVED_EVENT', name: 'Serviu em evento', description: 'Participou de um evento especial.', icon: 'calendar-heart', category: 'EVENTOS' },
  { code: 'HELPED_OTHER_MINISTRY', name: 'Ajudou outro ministerio', description: 'Serviu apoiando outra equipe ministerial.', icon: 'handshake', category: 'APOIO' },
  { code: 'SUBSTITUTE_SOMEONE', name: 'Substituiu alguem', description: 'Aceitou uma substituicao para manter o servico.', icon: 'repeat', category: 'APOIO' },
];

@Injectable()
export class JourneyService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit() {
    this.eventBus.on('ATTENDANCE_REGISTERED', async (event) => {
      const status = String(event.payload.status ?? '');
      if (status !== AttendanceStatus.PRESENTE) return;
      const servantId = String(event.payload.servantId ?? '');
      const attendanceId = String(event.payload.attendanceId ?? '');
      if (!servantId || !attendanceId) return;

      await this.registerJourneyEvent({
        servantId,
        churchId: event.churchId ?? null,
        type: 'SERVICE',
        title: 'Serviu no culto',
        description: 'Presenca confirmada em culto.',
        referenceId: `attendance:${attendanceId}`,
        occurredAt: event.occurredAt,
      });
    });

    this.eventBus.on('MINISTRY_TASK_COMPLETED', async (event) => {
      const occurrenceId = String(event.payload.occurrenceId ?? '');
      if (!occurrenceId) return;
      const occurrence = await this.prisma.ministryTaskOccurrence.findUnique({
        where: { id: occurrenceId },
        select: { id: true, assignedServantId: true },
      });
      if (!occurrence?.assignedServantId) return;

      await this.registerJourneyEvent({
        servantId: occurrence.assignedServantId,
        churchId: event.churchId ?? null,
        type: 'TASK',
        title: 'Concluiu tarefa',
        description: 'Concluiu uma tarefa ministerial.',
        referenceId: `task:${occurrence.id}`,
        occurredAt: event.occurredAt,
      });
    });

    this.eventBus.on('MINISTRY_TASK_PROGRESS_UPDATED', async (event) => {
      const occurrenceId = String(event.payload.occurrenceId ?? '');
      const progressPercent = Number(event.payload.progressPercent ?? 0);
      if (!occurrenceId || progressPercent < 100) return;

      const occurrence = await this.prisma.ministryTaskOccurrence.findUnique({
        where: { id: occurrenceId },
        select: { id: true, assignedServantId: true },
      });
      if (!occurrence?.assignedServantId) return;

      await this.registerJourneyEvent({
        servantId: occurrence.assignedServantId,
        churchId: event.churchId ?? null,
        type: 'CHECKLIST',
        title: 'Completou checklist',
        description: 'Finalizou checklist de tarefa.',
        referenceId: `checklist:${occurrence.id}:100`,
        occurredAt: event.occurredAt,
      });
    });

    this.eventBus.on('TRAINING_COMPLETED', async (event) => {
      const servantId = String(event.payload.servantId ?? '');
      const ministryId = String(event.payload.ministryId ?? '');
      if (!servantId) return;

      await this.registerJourneyEvent({
        servantId,
        churchId: event.churchId ?? null,
        type: 'TRAINING',
        title: 'Concluiu treinamento',
        description: ministryId ? 'Treinamento ministerial concluido.' : 'Treinamento concluido.',
        referenceId: ministryId ? `training:${servantId}:${ministryId}` : `training:${servantId}`,
        occurredAt: event.occurredAt,
      });
    });

    this.eventBus.on('SLOT_ASSIGNED', async (event) => {
      const toServantId = String(event.payload.toServantId ?? '');
      const fromServantId = String(event.payload.fromServantId ?? '');
      const slotId = String(event.payload.slotId ?? '');
      const context = String(event.payload.context ?? '');

      if (toServantId && fromServantId && toServantId !== fromServantId) {
        await this.registerJourneyEvent({
          servantId: toServantId,
          churchId: event.churchId ?? null,
          type: 'SUBSTITUTE',
          title: 'Substituiu um servo',
          description: 'Assumiu uma escala para apoiar a equipe.',
          referenceId: `slot-substitute:${slotId}:${toServantId}`,
          occurredAt: event.occurredAt,
        });

        await this.registerJourneyEvent({
          servantId: fromServantId,
          churchId: event.churchId ?? null,
          type: 'HELP',
          title: 'Recebeu apoio em uma escala',
          description: 'Outro servo ajudou em uma substituicao.',
          referenceId: `slot-help:${slotId}:${fromServantId}`,
          occurredAt: event.occurredAt,
        });
        return;
      }

      if (toServantId && context === 'FILL_OPEN_SLOT') {
        await this.registerJourneyEvent({
          servantId: toServantId,
          churchId: event.churchId ?? null,
          type: 'SERVICE',
          title: 'Assumiu nova escala',
          description: 'Preencheu uma vaga aberta para servir.',
          referenceId: `slot-fill:${slotId}:${toServantId}`,
          occurredAt: event.occurredAt,
        });
      }
    });

    this.eventBus.on('MINISTRY_TASK_ASSIGNEE_ADDED', async (event) => {
      const servantId = String(event.payload.servantId ?? '');
      const occurrenceId = String(event.payload.occurrenceId ?? '');
      if (!servantId || !occurrenceId) return;
      await this.registerJourneyEvent({
        servantId,
        churchId: event.churchId ?? null,
        type: 'HELP',
        title: 'Ajudou em tarefa ministerial',
        description: 'Foi adicionado como apoio em uma tarefa.',
        referenceId: `task-help:${occurrenceId}:${servantId}`,
        occurredAt: event.occurredAt,
      });
    });

    void this.syncDefaultMilestones();
  }

  async getMyJourney(servantId: string, churchId: string | null) {
    const [summary, milestones, logs, indicators] = await Promise.all([
      this.getSummary(servantId, churchId),
      this.getMilestones(servantId, churchId),
      this.getLogs(servantId, churchId),
      this.getIndicators(servantId, churchId),
    ]);

    return {
      summary,
      milestones,
      logs,
      indicators,
      visual: this.buildVisual(summary),
      motivationalMessage: this.pickMotivationalMessage(summary, indicators),
      nextSteps: this.buildNextSteps(summary, indicators),
    };
  }

  async getSummary(servantId: string, churchId: string | null) {
    await this.ensureJourney(servantId, churchId);
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
    };
  }

  async getMilestones(servantId: string, churchId: string | null) {
    await this.ensureJourney(servantId, churchId);
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

  async getLogs(servantId: string, churchId: string | null) {
    await this.ensureJourney(servantId, churchId);
    const logs = await this.prisma.journeyLog.findMany({
      where: { servantId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return logs;
  }

  async getIndicators(servantId: string, churchId: string | null) {
    await this.ensureJourney(servantId, churchId);
    const indicators = await this.buildIndicators(servantId, churchId);
    return indicators;
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
    await this.ensureJourney(input.servantId, input.churchId);

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
        churchId: input.churchId,
        type: input.type,
        title: input.title,
        description: input.description,
        referenceId: input.referenceId,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    await this.refreshJourney(input.servantId, input.churchId);
    await this.evaluateMilestones(input.servantId, input.churchId);
    return log;
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
        churchId: servant.churchId ?? churchId,
        startedAt,
      },
    });
  }

  private async refreshJourney(servantId: string, churchId: string | null) {
    const [services, tasks, trainings, events, lastLog, servant] = await Promise.all([
      this.prisma.attendance.count({ where: { servantId, status: AttendanceStatus.PRESENTE } }),
      this.prisma.ministryTaskOccurrence.count({
        where: { assignedServantId: servantId, status: MinistryTaskOccurrenceStatus.COMPLETED },
      }),
      this.prisma.servantMinistry.count({ where: { servantId, trainingStatus: TrainingStatus.COMPLETED } }),
      this.prisma.attendance.count({
        where: {
          servantId,
          status: AttendanceStatus.PRESENTE,
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
        churchId: servant?.churchId ?? churchId,
        startedAt,
        totalServices: services,
        totalTasksCompleted: tasks,
        totalTrainingsCompleted: trainings,
        totalEventsServed: events,
        monthsServing,
        lastActivityAt: lastLog?.occurredAt ?? startedAt,
      },
      update: {
        churchId: servant?.churchId ?? churchId,
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
    for (const item of DEFAULT_MILESTONES) {
      const exists = await this.prisma.journeyMilestone.findUnique({
        where: { code: item.code },
        select: { id: true },
      });
      if (exists) continue;
      await this.prisma.journeyMilestone.create({ data: item });
    }
  }

  private async evaluateMilestones(servantId: string, churchId: string | null) {
    await this.refreshJourney(servantId, churchId);
    const [journey, tracksCompleted, monthsWithoutAbsence, checklistCount, helpCount, substituteCount] = await Promise.all([
      this.prisma.servantJourney.findUnique({ where: { servantId } }),
      this.countCompletedTracks(servantId),
      this.countMonthsWithoutAbsence(servantId),
      this.prisma.journeyLog.count({ where: { servantId, type: 'CHECKLIST' } }),
      this.prisma.journeyLog.count({ where: { servantId, type: 'HELP' } }),
      this.prisma.journeyLog.count({ where: { servantId, type: 'SUBSTITUTE' } }),
    ]);
    if (!journey) return;

    const conditionMap = new Map<string, boolean>([
      ['FIRST_SERVICE', journey.totalServices >= 1],
      ['TEN_SERVICES', journey.totalServices >= 10],
      ['THREE_MONTHS_SERVING', journey.monthsServing >= 3],
      ['ONE_YEAR_SERVING', journey.monthsServing >= 12],
      ['SIX_MONTHS_WITHOUT_ABSENCE', monthsWithoutAbsence >= 6],
      ['FIRST_TASK', journey.totalTasksCompleted >= 1],
      ['TEN_TASKS', journey.totalTasksCompleted >= 10],
      ['PERFECT_CHECKLIST', checklistCount >= 1],
      ['FIRST_TRAINING', journey.totalTrainingsCompleted >= 1],
      ['COMPLETED_TRACK', tracksCompleted >= 1],
      ['SERVED_EVENT', journey.totalEventsServed >= 1],
      ['HELPED_OTHER_MINISTRY', helpCount >= 1],
      ['SUBSTITUTE_SOMEONE', substituteCount >= 1],
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

    await this.refreshJourney(servantId, churchId);
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

  private async buildIndicators(servantId: string, churchId: string | null): Promise<Indicator[]> {
    const [journey, attendance, totalAttendance, tracksCompleted] = await Promise.all([
      this.prisma.servantJourney.findUnique({ where: { servantId } }),
      this.prisma.attendance.count({ where: { servantId, status: AttendanceStatus.PRESENTE } }),
      this.prisma.attendance.count({ where: { servantId } }),
      this.countCompletedTracks(servantId),
    ]);
    if (!journey) return [];

    const presentRate = totalAttendance > 0 ? attendance / totalAttendance : 0;
    const taskStrength = Math.min(1, journey.totalTasksCompleted / 30);
    const trainingStrength = Math.min(1, journey.totalTrainingsCompleted / 5);
    const timeStrength = Math.min(1, journey.monthsServing / 24);
    const trackStrength = Math.min(1, tracksCompleted / 3);
    const eventStrength = Math.min(1, journey.totalEventsServed / 10);

    const indicators: Indicator[] = [
      this.makeIndicator('constancy', 'Constancia', presentRate * 100, 'Presenca e regularidade no servico.'),
      this.makeIndicator('commitment', 'Compromisso', (presentRate * 0.45 + taskStrength * 0.55) * 100, 'Entrega em presenca e tarefas.'),
      this.makeIndicator('training', 'Treinamento', trainingStrength * 100, 'Avanco em treinamentos ministeriais.'),
      this.makeIndicator('availability', 'Disponibilidade', (presentRate * 0.6 + eventStrength * 0.4) * 100, 'Apoio em cultos e eventos.'),
      this.makeIndicator('teamwork', 'Trabalho em equipe', (taskStrength * 0.5 + eventStrength * 0.5) * 100, 'Colaboracao em tarefas e operacao.'),
      this.makeIndicator('responsibility', 'Responsabilidade', (taskStrength * 0.7 + presentRate * 0.3) * 100, 'Conclusao e constancia nas entregas.'),
      this.makeIndicator('leadership', 'Lideranca (em desenvolvimento)', (trackStrength * 0.4 + timeStrength * 0.6) * 100, 'Maturidade e formacao para lideranca.'),
      this.makeIndicator('growth', 'Crescimento', (taskStrength * 0.25 + trainingStrength * 0.25 + timeStrength * 0.25 + trackStrength * 0.25) * 100, 'Evolucao ministerial geral.'),
      this.makeIndicator('ministryTime', 'Tempo de ministerio', timeStrength * 100, 'Tempo de caminhada e fidelidade.'),
    ];

    return indicators;
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
    const growth = indicators.find((item) => item.key === 'growth');
    if (growth?.level === 'REFERENCIA' || growth?.level === 'MUITO_BOM') {
      return 'Voce tem sido fiel.';
    }
    return DEFAULT_MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * DEFAULT_MOTIVATIONAL_MESSAGES.length)];
  }

  private buildNextSteps(
    summary: {
      totalServices: number;
      totalTasksCompleted: number;
      totalTrainingsCompleted: number;
      completedTracks: number;
      milestonesUnlocked: number;
    },
    indicators: Indicator[],
  ) {
    const nextSteps: string[] = [];
    if (summary.totalTrainingsCompleted < 1) {
      nextSteps.push('Concluir o proximo treinamento recomendado.');
    }
    if (summary.completedTracks < 1) {
      nextSteps.push('Avancar no proximo passo da sua trilha ministerial.');
    }
    if (summary.totalTasksCompleted < 10) {
      nextSteps.push('Seguir com constancia nas tarefas da equipe.');
    }
    const commitment = indicators.find((item) => item.key === 'commitment');
    if (commitment?.level === 'INICIANTE' || commitment?.level === 'EM_DESENVOLVIMENTO') {
      nextSteps.push('Confirmar presenca e manter regularidade nas escalas.');
    }
    if (summary.milestonesUnlocked < 3) {
      nextSteps.push('Dar pequenos passos para conquistar os proximos marcos da caminhada.');
    }

    return nextSteps.slice(0, 3);
  }

  private async countMonthsWithoutAbsence(servantId: string) {
    const attendances = await this.prisma.attendance.findMany({
      where: { servantId },
      select: {
        status: true,
        service: {
          select: { serviceDate: true },
        },
      },
    });

    const byMonth = new Map<string, { hasPresence: boolean; hasAbsence: boolean }>();
    for (const item of attendances) {
      const date = item.service?.serviceDate ? new Date(item.service.serviceDate) : null;
      if (!date || Number.isNaN(date.getTime())) continue;
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const state = byMonth.get(key) ?? { hasPresence: false, hasAbsence: false };
      if (item.status === AttendanceStatus.PRESENTE) state.hasPresence = true;
      if (item.status === AttendanceStatus.FALTA || item.status === AttendanceStatus.FALTA_JUSTIFICADA) state.hasAbsence = true;
      byMonth.set(key, state);
    }

    return [...byMonth.values()].filter((item) => item.hasPresence && !item.hasAbsence).length;
  }

  private monthsBetween(start: Date, end: Date) {
    const startYear = start.getUTCFullYear();
    const endYear = end.getUTCFullYear();
    const startMonth = start.getUTCMonth();
    const endMonth = end.getUTCMonth();
    const raw = (endYear - startYear) * 12 + (endMonth - startMonth);
    return Math.max(0, raw);
  }
}

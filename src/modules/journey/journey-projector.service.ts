import { Injectable, OnModuleInit } from '@nestjs/common';
import { JourneyProjectionCheckpointStatus } from '@prisma/client';
import { EventBusService } from 'src/common/events/event-bus.service';
import { mapAttendanceToJourneyProjection } from 'src/common/journey/journey-policy';
import { LogService } from 'src/common/log/log.service';
import { AppMetricsService } from 'src/common/observability/app-metrics.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JourneyCheckpointService } from './journey-checkpoint.service';
import { JourneyService } from './journey.service';

@Injectable()
export class JourneyProjectorService implements OnModuleInit {
  private static readonly PROJECTOR_NAME = 'journey_projector_v1';

  constructor(
    private readonly eventBus: EventBusService,
    private readonly journeyService: JourneyService,
    private readonly prisma: PrismaService,
    private readonly checkpointService: JourneyCheckpointService,
    private readonly metrics: AppMetricsService,
    private readonly logService: LogService,
  ) {}

  onModuleInit() {
    this.eventBus.on('ATTENDANCE_REGISTERED', async (event) => {
      const projection = mapAttendanceToJourneyProjection(String(event.payload.status ?? ''));
      if (!projection) return;
      const servantId = String(event.payload.servantId ?? '');
      const attendanceId = String(event.payload.attendanceId ?? '');
      if (!servantId || !attendanceId) return;

      await this.projectWithCheckpoint(
        event.name,
        servantId,
        event.churchId ?? null,
        `attendance:${attendanceId}`,
        async () =>
          this.journeyService.registerJourneyEvent({
            servantId,
            churchId: event.churchId ?? null,
            type: projection.type,
            title: projection.title,
            description: projection.description,
            referenceId: `attendance:${attendanceId}`,
            occurredAt: event.occurredAt,
          }),
      );
    });

    this.eventBus.on('SLOT_CONFIRMED', async (event) => {
      const servantId = String(event.payload.servantId ?? '');
      const slotId = String(event.payload.slotId ?? '');
      if (!servantId || !slotId) return;
      await this.projectWithCheckpoint(
        event.name,
        servantId,
        event.churchId ?? null,
        `slot-confirmed:${slotId}:${servantId}`,
        async () =>
          this.journeyService.registerJourneyEvent({
            servantId,
            churchId: event.churchId ?? null,
            type: 'SERVICE',
            title: 'Voce confirmou uma escala',
            description: 'Sua disponibilidade foi confirmada para servir.',
            referenceId: `slot-confirmed:${slotId}:${servantId}`,
            occurredAt: event.occurredAt,
          }),
      );
    });

    this.eventBus.on('SLOT_DECLINED', async (event) => {
      const servantId = String(event.payload.servantId ?? '');
      const slotId = String(event.payload.slotId ?? '');
      if (!servantId || !slotId) return;
      await this.projectWithCheckpoint(
        event.name,
        servantId,
        event.churchId ?? null,
        `slot-declined:${slotId}:${servantId}`,
        async () =>
          this.journeyService.registerJourneyEvent({
            servantId,
            churchId: event.churchId ?? null,
            type: 'EVENT',
            title: 'Voce recusou uma escala',
            description: 'A coordenacao foi avisada para reorganizar a escala.',
            referenceId: `slot-declined:${slotId}:${servantId}`,
            occurredAt: event.occurredAt,
          }),
      );
    });

    this.eventBus.on('MINISTRY_TASK_COMPLETED', async (event) => {
      const occurrenceId = String(event.payload.occurrenceId ?? '');
      if (!occurrenceId) return;
      const occurrence = await this.prisma.ministryTaskOccurrence.findUnique({
        where: { id: occurrenceId },
        select: { id: true, assignedServantId: true },
      });
      const assignedServantId = occurrence?.assignedServantId;
      if (!occurrence || !assignedServantId) return;
      await this.projectWithCheckpoint(
        event.name,
        assignedServantId,
        event.churchId ?? null,
        `task:${occurrence.id}`,
        async () =>
          this.journeyService.registerJourneyEvent({
            servantId: assignedServantId,
            churchId: event.churchId ?? null,
            type: 'TASK',
            title: 'Concluiu tarefa',
            description: 'Concluiu uma tarefa ministerial.',
            referenceId: `task:${occurrence.id}`,
            occurredAt: event.occurredAt,
          }),
      );
    });

    this.eventBus.on('MINISTRY_TASK_PROGRESS_UPDATED', async (event) => {
      const occurrenceId = String(event.payload.occurrenceId ?? '');
      const progressPercent = Number(event.payload.progressPercent ?? 0);
      if (!occurrenceId || progressPercent < 100) return;
      const occurrence = await this.prisma.ministryTaskOccurrence.findUnique({
        where: { id: occurrenceId },
        select: { id: true, assignedServantId: true },
      });
      const assignedServantId = occurrence?.assignedServantId;
      if (!occurrence || !assignedServantId) return;
      await this.projectWithCheckpoint(
        event.name,
        assignedServantId,
        event.churchId ?? null,
        `checklist:${occurrence.id}:100`,
        async () =>
          this.journeyService.registerJourneyEvent({
            servantId: assignedServantId,
            churchId: event.churchId ?? null,
            type: 'CHECKLIST',
            title: 'Completou checklist',
            description: 'Finalizou checklist de tarefa.',
            referenceId: `checklist:${occurrence.id}:100`,
            occurredAt: event.occurredAt,
          }),
      );
    });

    this.eventBus.on('TRAINING_COMPLETED', async (event) => {
      const servantId = String(event.payload.servantId ?? '');
      const ministryId = String(event.payload.ministryId ?? '');
      if (!servantId) return;
      await this.projectWithCheckpoint(
        event.name,
        servantId,
        event.churchId ?? null,
        ministryId ? `training:${servantId}:${ministryId}` : `training:${servantId}`,
        async () =>
          this.journeyService.registerJourneyEvent({
            servantId,
            churchId: event.churchId ?? null,
            type: 'TRAINING',
            title: 'Concluiu treinamento',
            description: ministryId ? 'Treinamento ministerial concluido.' : 'Treinamento concluido.',
            referenceId: ministryId ? `training:${servantId}:${ministryId}` : `training:${servantId}`,
            occurredAt: event.occurredAt,
          }),
      );
    });

    this.eventBus.on('SLOT_ASSIGNED', async (event) => {
      const toServantId = String(event.payload.toServantId ?? '');
      const fromServantId = String(event.payload.fromServantId ?? '');
      const slotId = String(event.payload.slotId ?? '');
      const context = String(event.payload.context ?? '');

      if (toServantId && fromServantId && toServantId !== fromServantId) {
        await this.projectWithCheckpoint(
          event.name,
          toServantId,
          event.churchId ?? null,
          `slot-substitute:${slotId}:${toServantId}`,
          async () =>
            this.journeyService.registerJourneyEvent({
              servantId: toServantId,
              churchId: event.churchId ?? null,
              type: 'SUBSTITUTE',
              title: 'Substituiu um servo',
              description: 'Assumiu uma escala para apoiar a equipe.',
              referenceId: `slot-substitute:${slotId}:${toServantId}`,
              occurredAt: event.occurredAt,
            }),
        );
        await this.projectWithCheckpoint(
          event.name,
          fromServantId,
          event.churchId ?? null,
          `slot-help:${slotId}:${fromServantId}`,
          async () =>
            this.journeyService.registerJourneyEvent({
              servantId: fromServantId,
              churchId: event.churchId ?? null,
              type: 'HELP',
              title: 'Recebeu apoio em uma escala',
              description: 'Outro servo ajudou em uma substituicao.',
              referenceId: `slot-help:${slotId}:${fromServantId}`,
              occurredAt: event.occurredAt,
            }),
        );
        return;
      }

      if (toServantId && context === 'FILL_OPEN_SLOT') {
        await this.projectWithCheckpoint(
          event.name,
          toServantId,
          event.churchId ?? null,
          `slot-fill:${slotId}:${toServantId}`,
          async () =>
            this.journeyService.registerJourneyEvent({
              servantId: toServantId,
              churchId: event.churchId ?? null,
              type: 'SERVICE',
              title: 'Assumiu nova escala',
              description: 'Preencheu uma vaga aberta para servir.',
              referenceId: `slot-fill:${slotId}:${toServantId}`,
              occurredAt: event.occurredAt,
            }),
        );
      }
    });

    this.eventBus.on('MINISTRY_TASK_ASSIGNEE_ADDED', async (event) => {
      const servantId = String(event.payload.servantId ?? '');
      const occurrenceId = String(event.payload.occurrenceId ?? '');
      if (!servantId || !occurrenceId) return;
      await this.projectWithCheckpoint(
        event.name,
        servantId,
        event.churchId ?? null,
        `task-help:${occurrenceId}:${servantId}`,
        async () =>
          this.journeyService.registerJourneyEvent({
            servantId,
            churchId: event.churchId ?? null,
            type: 'HELP',
            title: 'Ajudou em tarefa ministerial',
            description: 'Foi adicionado como apoio em uma tarefa.',
            referenceId: `task-help:${occurrenceId}:${servantId}`,
            occurredAt: event.occurredAt,
          }),
      );
    });
  }

  private async projectWithCheckpoint(
    eventName: string,
    servantId: string,
    churchId: string | null,
    dedupeRef: string,
    execute: () => Promise<unknown>,
  ) {
    const startedAt = performance.now();
    const eventKey = `${eventName}:${servantId}:${dedupeRef}`;
    const wasProcessed = await this.checkpointService.wasLastEventProcessed(
      JourneyProjectorService.PROJECTOR_NAME,
      servantId,
      eventKey,
    );

    if (wasProcessed) {
      this.metrics.recordJob('journey_project_event', 0, true, { skipped: true });
      this.metrics.incrementCounter('journey.projector.duplicate_skipped', 1);
      return;
    }

    try {
      await execute();
      const durationMs = performance.now() - startedAt;
      await this.checkpointService.markProcessed({
        projectorName: JourneyProjectorService.PROJECTOR_NAME,
        churchId,
        servantId,
        eventKey,
        status: JourneyProjectionCheckpointStatus.OK,
        details: { eventName, dedupeRef },
      });
      this.metrics.recordJob('journey_project_event', durationMs, true, { processedItems: 1 });
      this.metrics.incrementCounter('journey.projector.processed', 1);
      this.logService.event({
        level: 'info',
        module: 'journey-projector',
        action: 'event.projected',
        message: 'Journey event projected',
        churchId,
        durationMs,
        metadata: { servantId, eventName, dedupeRef },
      });
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      await this.checkpointService.markProcessed({
        projectorName: JourneyProjectorService.PROJECTOR_NAME,
        churchId,
        servantId,
        eventKey,
        status: JourneyProjectionCheckpointStatus.ERROR,
        details: { eventName, dedupeRef, error: String(error) },
      });
      this.metrics.recordJob('journey_project_event', durationMs, false);
      this.metrics.incrementCounter('journey.projector.failed', 1);
      this.logService.error(
        'Journey projector failed to process event',
        String(error),
        JourneyProjectorService.name,
        { servantId, churchId, eventName, dedupeRef },
      );
    }
  }
}

import { Injectable } from '@nestjs/common';
import { JourneyProjectionCheckpointStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JourneyCheckpointService {
  constructor(private readonly prisma: PrismaService) {}

  async markProcessed(input: {
    projectorName: string;
    churchId: string | null;
    servantId: string;
    eventKey: string;
    status: JourneyProjectionCheckpointStatus;
    details?: Record<string, unknown>;
  }) {
    const existing = await this.prisma.journeyProjectionCheckpoint.findFirst({
      where: {
        projectorName: input.projectorName,
        servantId: input.servantId,
      },
      select: { id: true },
    });

    if (existing) {
      return this.prisma.journeyProjectionCheckpoint.update({
        where: { id: existing.id },
        data: {
          churchId: input.churchId,
          lastProcessedAt: new Date(),
          lastProcessedEventKey: input.eventKey,
          status: input.status,
          details: input.details as any,
        },
      });
    }

    return this.prisma.journeyProjectionCheckpoint.create({
      data: {
        projectorName: input.projectorName,
        churchId: input.churchId,
        servantId: input.servantId,
        lastProcessedAt: new Date(),
        lastProcessedEventKey: input.eventKey,
        status: input.status,
        details: input.details as any,
      },
    });
  }

  async markReconciled(input: {
    projectorName: string;
    churchId: string | null;
    servantId: string;
    status: JourneyProjectionCheckpointStatus;
    details?: Record<string, unknown>;
  }) {
    const existing = await this.prisma.journeyProjectionCheckpoint.findFirst({
      where: {
        projectorName: input.projectorName,
        servantId: input.servantId,
      },
      select: { id: true },
    });

    if (existing) {
      return this.prisma.journeyProjectionCheckpoint.update({
        where: { id: existing.id },
        data: {
          churchId: input.churchId,
          lastReconciledAt: new Date(),
          status: input.status,
          details: input.details as any,
        },
      });
    }

    return this.prisma.journeyProjectionCheckpoint.create({
      data: {
        projectorName: input.projectorName,
        churchId: input.churchId,
        servantId: input.servantId,
        lastReconciledAt: new Date(),
        status: input.status,
        details: input.details as any,
      },
    });
  }

  async wasLastEventProcessed(projectorName: string, servantId: string, eventKey: string) {
    const checkpoint = await this.prisma.journeyProjectionCheckpoint.findFirst({
      where: {
        projectorName,
        servantId,
      },
      select: {
        lastProcessedEventKey: true,
      },
    });
    return checkpoint?.lastProcessedEventKey === eventKey;
  }

  async statusSummary(projectorName: string) {
    const [ok, warning, error] = await Promise.all([
      this.prisma.journeyProjectionCheckpoint.count({
        where: { projectorName, status: JourneyProjectionCheckpointStatus.OK },
      }),
      this.prisma.journeyProjectionCheckpoint.count({
        where: { projectorName, status: JourneyProjectionCheckpointStatus.WARNING },
      }),
      this.prisma.journeyProjectionCheckpoint.count({
        where: { projectorName, status: JourneyProjectionCheckpointStatus.ERROR },
      }),
    ]);

    return { ok, warning, error };
  }
}

import { Injectable } from '@nestjs/common';
import { AutomationCheckpointStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AutomationCheckpointService {
  constructor(private readonly prisma: PrismaService) {}

  async markStarted(
    schedulerName: string,
    input: {
      churchId?: string;
      cursor?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    return this.upsertCheckpoint(schedulerName, {
      churchId: input.churchId,
      status: AutomationCheckpointStatus.OK,
      lastProcessedCursor: input.cursor,
      details: {
        ...(input.details ?? {}),
        startedAt: new Date().toISOString(),
      },
    });
  }

  async markSuccess(
    schedulerName: string,
    input: {
      churchId?: string;
      cursor?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    return this.upsertCheckpoint(schedulerName, {
      churchId: input.churchId,
      status: AutomationCheckpointStatus.OK,
      lastProcessedAt: new Date(),
      lastProcessedCursor: input.cursor,
      details: input.details,
    });
  }

  async markFailure(
    schedulerName: string,
    error: unknown,
    input: {
      churchId?: string;
      cursor?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return this.upsertCheckpoint(schedulerName, {
      churchId: input.churchId,
      status: AutomationCheckpointStatus.ERROR,
      lastProcessedCursor: input.cursor,
      details: {
        ...(input.details ?? {}),
        error: errorMessage,
      },
    });
  }

  async listStatus(churchId?: string) {
    return this.prisma.automationCheckpoint.findMany({
      where: churchId ? { churchId } : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  private async upsertCheckpoint(
    schedulerName: string,
    input: {
      churchId?: string;
      status: AutomationCheckpointStatus;
      lastProcessedAt?: Date;
      lastProcessedCursor?: string;
      details?: Record<string, unknown>;
    },
  ) {
    const churchId = input.churchId ?? null;

    if (churchId) {
      return this.prisma.automationCheckpoint.upsert({
        where: {
          churchId_schedulerName: {
            churchId,
            schedulerName,
          },
        },
        create: {
          churchId,
          schedulerName,
          status: input.status,
          lastProcessedAt: input.lastProcessedAt,
          lastProcessedCursor: input.lastProcessedCursor,
          details: input.details as Prisma.InputJsonValue | undefined,
        },
        update: {
          status: input.status,
          lastProcessedAt: input.lastProcessedAt,
          lastProcessedCursor: input.lastProcessedCursor,
          details: input.details as Prisma.InputJsonValue | undefined,
        },
      });
    }

    const existing = await this.prisma.automationCheckpoint.findFirst({
      where: {
        churchId: null,
        schedulerName,
      },
      select: { id: true },
    });

    if (!existing) {
      return this.prisma.automationCheckpoint.create({
        data: {
          churchId: null,
          schedulerName,
          status: input.status,
          lastProcessedAt: input.lastProcessedAt,
          lastProcessedCursor: input.lastProcessedCursor,
          details: input.details as Prisma.InputJsonValue | undefined,
        },
      });
    }

    return this.prisma.automationCheckpoint.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        lastProcessedAt: input.lastProcessedAt,
        lastProcessedCursor: input.lastProcessedCursor,
        details: input.details as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

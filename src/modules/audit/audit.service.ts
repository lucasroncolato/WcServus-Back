import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    action: AuditAction;
    entity: string;
    entityId: string;
    churchId?: string | null;
    userId?: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  }) {
    const resolvedBefore = params.before ?? null;
    const resolvedAfter = params.after ?? params.metadata ?? null;

    let resolvedChurchId = params.churchId ?? null;
    if (!resolvedChurchId && params.userId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { churchId: true },
      });
      resolvedChurchId = actor?.churchId ?? null;
    }

    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        churchId: resolvedChurchId,
        userId: params.userId,
        before:
          resolvedBefore === null ? undefined : (resolvedBefore as Prisma.InputJsonValue | undefined),
        after: resolvedAfter === null ? undefined : (resolvedAfter as Prisma.InputJsonValue | undefined),
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async list(limit = 50, actor?: JwtPayload) {
    const records = await this.prisma.auditLog.findMany({
      where: {
        ...(actor?.churchId ? { churchId: actor.churchId } : {}),
        ...(actor?.role === Role.ADMIN
          ? {
              entity: {
                in: ['User', 'Servant', 'Schedule', 'Attendance', 'PastoralVisit'],
              },
            }
          : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (actor?.role === Role.ADMIN) {
      return records.map((record) => ({
        ...record,
        metadata: null,
      }));
    }

    return records;
  }
}

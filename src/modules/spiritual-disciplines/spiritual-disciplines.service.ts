import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  AuditAction,
  DevotionalStatus,
  MonthlyFastingStatus,
  Prisma,
  Role,
  RewardSource,
} from '@prisma/client';
import { assertServantAccess, getServantAccessWhere, resolveServantSelfScope } from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { RewardsService } from '../rewards/rewards.service';
import { ListDailyDevotionalsQueryDto } from './dto/list-daily-devotionals-query.dto';
import { ListMonthlyFastingsQueryDto } from './dto/list-monthly-fastings-query.dto';
import { RegisterDailyDevotionalDto } from './dto/register-daily-devotional.dto';
import { RegisterMonthlyFastingDto } from './dto/register-monthly-fasting.dto';

function toUtcDayStart(input: string | Date) {
  const value = new Date(input);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0));
}

function toUtcDayEnd(input: string | Date) {
  const day = new Date(input);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 59));
}

function parseReferenceMonth(referenceMonth: string) {
  const [yearRaw, monthRaw] = referenceMonth.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
}

@Injectable()
export class SpiritualDisciplinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly rewardsService: RewardsService,
  ) {}

  async registerDailyDevotional(dto: RegisterDailyDevotionalDto, actor: JwtPayload) {
    const servantId = await this.resolvePersonalServantTarget(actor, dto.servantId, 'devocional diario');
    await assertServantAccess(this.prisma, actor, servantId);
    const devotionalDate = toUtcDayStart(dto.devotionalDate);

    const record = await this.prisma.dailyDevotional.upsert({
      where: {
        servantId_devotionalDate: {
          servantId,
          devotionalDate,
        },
      },
      update: {
        status: dto.status ?? DevotionalStatus.DONE,
        notes: dto.notes,
        registeredByUserId: actor.sub,
      },
      create: {
        servantId,
        devotionalDate,
        status: dto.status ?? DevotionalStatus.DONE,
        notes: dto.notes,
        registeredByUserId: actor.sub,
      },
      include: {
        servant: { select: { id: true, name: true } },
        registeredBy: { select: { id: true, name: true, role: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'DailyDevotional',
      entityId: record.id,
      userId: actor.sub,
      metadata: {
        servantId,
        devotionalDate: devotionalDate.toISOString(),
        status: dto.status ?? DevotionalStatus.DONE,
      },
    });

    if ((dto.status ?? DevotionalStatus.DONE) === DevotionalStatus.DONE) {
      await this.rewardsService.grantReward({
        servantId,
        source: RewardSource.DEVOTIONAL_DAILY,
        points: 2,
        title: 'Devocional diario',
        description: 'Recompensa por disciplina devocional diaria.',
        referenceId: record.id,
        grantedByUserId: actor.sub,
      });
    }

    return record;
  }

  async listDailyDevotionals(query: ListDailyDevotionalsQueryDto, actor: JwtPayload) {
    const servantScope = await getServantAccessWhere(this.prisma, actor);
    const scopedServantId = await this.resolvePersonalServantFilter(actor, query.servantId, 'devocional diario');

    const queryWhere: Prisma.DailyDevotionalWhereInput = {
      servantId: scopedServantId,
      status: query.status,
      registeredByUserId: query.responsibleUserId,
      devotionalDate:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? toUtcDayStart(query.dateFrom) : undefined,
              lte: query.dateTo ? toUtcDayEnd(query.dateTo) : undefined,
            }
          : undefined,
    };

    const where: Prisma.DailyDevotionalWhereInput = servantScope
      ? {
          AND: [
            queryWhere,
            {
              servant: servantScope,
            },
          ],
        }
      : queryWhere;

    return this.prisma.dailyDevotional.findMany({
      where,
      include: {
        servant: { select: { id: true, name: true } },
        registeredBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: [{ devotionalDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async registerMonthlyFasting(dto: RegisterMonthlyFastingDto, actor: JwtPayload) {
    const servantId = await this.resolvePersonalServantTarget(actor, dto.servantId, 'jejum mensal');
    await assertServantAccess(this.prisma, actor, servantId);
    const referenceMonth = parseReferenceMonth(dto.referenceMonth);
    const status = dto.status ?? MonthlyFastingStatus.COMPLETED;

    const record = await this.prisma.monthlyFasting.upsert({
      where: {
        servantId_referenceMonth: {
          servantId,
          referenceMonth,
        },
      },
      update: {
        status,
        completedAt:
          status === MonthlyFastingStatus.COMPLETED
            ? dto.completedAt
              ? new Date(dto.completedAt)
              : new Date()
            : null,
        notes: dto.notes,
        registeredByUserId: actor.sub,
      },
      create: {
        servantId,
        referenceMonth,
        status,
        completedAt:
          status === MonthlyFastingStatus.COMPLETED
            ? dto.completedAt
              ? new Date(dto.completedAt)
              : new Date()
            : null,
        notes: dto.notes,
        registeredByUserId: actor.sub,
      },
      include: {
        servant: { select: { id: true, name: true } },
        registeredBy: { select: { id: true, name: true, role: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'MonthlyFasting',
      entityId: record.id,
      userId: actor.sub,
      metadata: {
        servantId,
        referenceMonth: referenceMonth.toISOString(),
        status,
      },
    });

    if (status === MonthlyFastingStatus.COMPLETED) {
      await this.rewardsService.grantReward({
        servantId,
        source: RewardSource.FASTING_MONTHLY,
        points: 10,
        title: 'Jejum mensal',
        description: 'Recompensa por conclusao de jejum mensal.',
        referenceId: record.id,
        grantedByUserId: actor.sub,
      });
    }

    return record;
  }

  async listMonthlyFastings(query: ListMonthlyFastingsQueryDto, actor: JwtPayload) {
    const servantScope = await getServantAccessWhere(this.prisma, actor);
    const scopedServantId = await this.resolvePersonalServantFilter(actor, query.servantId, 'jejum mensal');

    const rangeStart =
      query.year && query.month
        ? new Date(Date.UTC(query.year, query.month - 1, 1, 0, 0, 0))
        : query.year
          ? new Date(Date.UTC(query.year, 0, 1, 0, 0, 0))
          : undefined;

    const rangeEnd =
      query.year && query.month
        ? new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59))
        : query.year
          ? new Date(Date.UTC(query.year, 11, 31, 23, 59, 59))
          : undefined;

    const queryWhere: Prisma.MonthlyFastingWhereInput = {
      servantId: scopedServantId,
      status: query.status,
      registeredByUserId: query.responsibleUserId,
      referenceMonth:
        rangeStart || rangeEnd
          ? {
              gte: rangeStart,
              lte: rangeEnd,
            }
          : undefined,
    };

    const where: Prisma.MonthlyFastingWhereInput = servantScope
      ? {
          AND: [
            queryWhere,
            {
              servant: servantScope,
            },
          ],
        }
      : queryWhere;

    return this.prisma.monthlyFasting.findMany({
      where,
      include: {
        servant: { select: { id: true, name: true } },
        registeredBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async resolvePersonalServantTarget(
    actor: JwtPayload,
    requestedServantId: string | undefined,
    disciplineName: string,
  ) {
    if (actor.role === Role.COORDENADOR || actor.role === Role.SERVO) {
      const personalServantId = await this.requirePersonalServant(actor, disciplineName);
      if (requestedServantId && requestedServantId !== personalServantId) {
        throw new ForbiddenException(
          `Para ${disciplineName}, ${actor.role} so pode registrar o proprio compromisso pessoal.`,
        );
      }
      return personalServantId;
    }

    if (!requestedServantId) {
      throw new BadRequestException('servantId is required for this profile');
    }

    return requestedServantId;
  }

  private async resolvePersonalServantFilter(
    actor: JwtPayload,
    requestedServantId: string | undefined,
    disciplineName: string,
  ) {
    if (actor.role === Role.COORDENADOR || actor.role === Role.SERVO) {
      const personalServantId = await this.requirePersonalServant(actor, disciplineName);
      if (requestedServantId && requestedServantId !== personalServantId) {
        throw new ForbiddenException(
          `Para ${disciplineName}, ${actor.role} so pode consultar o proprio compromisso pessoal.`,
        );
      }
      return personalServantId;
    }

    return requestedServantId;
  }

  private async requirePersonalServant(actor: JwtPayload, disciplineName: string) {
    const servantId = await resolveServantSelfScope(this.prisma, actor);
    if (!servantId) {
      throw new ForbiddenException(
        `Usuario ${actor.role} precisa estar vinculado a um cadastro de servo para registrar ${disciplineName}.`,
      );
    }
    return servantId;
  }
}

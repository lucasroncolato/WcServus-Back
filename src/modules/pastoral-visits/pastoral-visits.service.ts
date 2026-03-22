import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertStatus, AuditAction, PastoralVisitStatus, Prisma } from '@prisma/client';
import {
  assertServantAccess,
  getPastoralVisitAccessWhere,
} from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { CreatePastoralVisitDto } from './dto/create-pastoral-visit.dto';
import { ListPastoralVisitsQueryDto } from './dto/list-pastoral-visits-query.dto';
import { ResolvePastoralVisitDto } from './dto/resolve-pastoral-visit.dto';

@Injectable()
export class PastoralVisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: ListPastoralVisitsQueryDto, actor: JwtPayload) {
    const scopeWhere = await getPastoralVisitAccessWhere(this.prisma, actor);
    const queryWhere: Prisma.PastoralVisitWhereInput = {
      status: query.status,
      servantId: query.servantId,
    };
    const where: Prisma.PastoralVisitWhereInput =
      scopeWhere !== undefined ? { AND: [queryWhere, scopeWhere] } : queryWhere;

    return this.prisma.pastoralVisit.findMany({
      where,
      include: {
        servant: true,
        createdBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async create(dto: CreatePastoralVisitDto, actor: JwtPayload) {
    await assertServantAccess(this.prisma, actor, dto.servantId);

    const servant = await this.prisma.servant.findUnique({
      where: { id: dto.servantId },
      select: { id: true },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    const visit = await this.prisma.pastoralVisit.create({
      data: {
        servantId: dto.servantId,
        reason: dto.reason,
        notes: dto.notes,
        createdByUserId: actor.sub,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'PastoralVisit',
      entityId: visit.id,
      userId: actor.sub,
    });

    return visit;
  }

  async resolve(id: string, dto: ResolvePastoralVisitDto, actor: JwtPayload) {
    const current = await this.prisma.pastoralVisit.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Pastoral visit not found');
    }

    await assertServantAccess(this.prisma, actor, current.servantId);

    const visit = await this.prisma.pastoralVisit.update({
      where: { id },
      data: {
        status: PastoralVisitStatus.RESOLVIDA,
        resolvedAt: new Date(),
        resolvedByUserId: actor.sub,
        notes: dto.notes ?? current.notes,
      },
    });

    await this.prisma.pastoralAlert.updateMany({
      where: {
        servantId: visit.servantId,
        status: AlertStatus.OPEN,
      },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedByUserId: actor.sub,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      action: AuditAction.VISIT_RESOLVED,
      entity: 'PastoralVisit',
      entityId: id,
      userId: actor.sub,
      metadata: { notes: dto.notes },
    });

    return visit;
  }

  async historyByServant(servantId: string, actor: JwtPayload) {
    await assertServantAccess(this.prisma, actor, servantId);

    return this.prisma.pastoralVisit.findMany({
      where: { servantId },
      orderBy: { openedAt: 'desc' },
    });
  }
}

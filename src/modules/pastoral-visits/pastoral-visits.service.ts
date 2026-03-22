import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertStatus, AuditAction, PastoralVisitStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
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

  findAll(query: ListPastoralVisitsQueryDto) {
    return this.prisma.pastoralVisit.findMany({
      where: {
        status: query.status,
        servantId: query.servantId,
      },
      include: {
        servant: true,
        createdBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async create(dto: CreatePastoralVisitDto, actorUserId: string) {
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
        createdByUserId: actorUserId,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'PastoralVisit',
      entityId: visit.id,
      userId: actorUserId,
    });

    return visit;
  }

  async resolve(id: string, dto: ResolvePastoralVisitDto, actorUserId: string) {
    const current = await this.prisma.pastoralVisit.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Pastoral visit not found');
    }

    const visit = await this.prisma.pastoralVisit.update({
      where: { id },
      data: {
        status: PastoralVisitStatus.RESOLVIDA,
        resolvedAt: new Date(),
        resolvedByUserId: actorUserId,
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
        resolvedByUserId: actorUserId,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      action: AuditAction.VISIT_RESOLVED,
      entity: 'PastoralVisit',
      entityId: id,
      userId: actorUserId,
      metadata: { notes: dto.notes },
    });

    return visit;
  }

  historyByServant(servantId: string) {
    return this.prisma.pastoralVisit.findMany({
      where: { servantId },
      orderBy: { openedAt: 'desc' },
    });
  }
}
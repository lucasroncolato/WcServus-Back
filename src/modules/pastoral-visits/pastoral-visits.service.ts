import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertStatus, AuditAction, PastoralVisitStatus, Prisma } from '@prisma/client';
import {
  assertServantAccess,
  getPastoralVisitAccessWhere,
} from 'src/common/auth/access-scope';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventBusService } from 'src/common/events/event-bus.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePastoralVisitDto } from './dto/create-pastoral-visit.dto';
import { ListPastoralVisitsQueryDto } from './dto/list-pastoral-visits-query.dto';
import { ResolvePastoralVisitDto } from './dto/resolve-pastoral-visit.dto';

@Injectable()
export class PastoralVisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantIntegrity: TenantIntegrityService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventBus: EventBusService,
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
    const actorChurchId = this.tenantIntegrity.assertActorChurch(actor);

    const servant = await this.prisma.servant.findUnique({
      where: { id: dto.servantId },
      select: { id: true, churchId: true },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }
    this.tenantIntegrity.assertSameChurch(actorChurchId, servant.churchId, 'Servant');

    const visit = await this.prisma.pastoralVisit.create({
      data: {
        servantId: dto.servantId,
        reason: dto.reason,
        notes: dto.notes,
        createdByUserId: actor.sub,
        churchId: actorChurchId,
      },
    });

    await this.auditService.log({
      action: AuditAction.PASTORAL_ACTION,
      entity: 'PastoralVisit',
      entityId: visit.id,
      userId: actor.sub,
    });

    await this.eventBus.emit({
      name: 'PASTORAL_PENDING_OPENED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: visit.churchId,
      payload: { pastoralVisitId: visit.id, servantId: visit.servantId },
    });

    await this.notificationsService.notifyServantLinkedUser(dto.servantId, {
      type: 'PASTORAL_VISIT_OPENED',
      title: 'Acompanhamento pastoral aberto',
      message: 'Foi aberto um registro de acompanhamento pastoral para voce.',
      link: '/pastoral-visits',
      metadata: { pastoralVisitId: visit.id },
    });

    return visit;
  }

  async resolve(id: string, dto: ResolvePastoralVisitDto, actor: JwtPayload) {
    const current = await this.prisma.pastoralVisit.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Pastoral visit not found');
    }
    this.tenantIntegrity.assertSameChurch(
      this.tenantIntegrity.assertActorChurch(actor),
      current.churchId,
      'Pastoral visit',
    );

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
      action: AuditAction.PASTORAL_ACTION,
      entity: 'PastoralVisit',
      entityId: id,
      userId: actor.sub,
      metadata: { notes: dto.notes },
    });

    await this.eventBus.emit({
      name: 'PASTORAL_PENDING_RESOLVED',
      occurredAt: new Date(),
      actorUserId: actor.sub,
      churchId: visit.churchId,
      payload: { pastoralVisitId: visit.id, servantId: visit.servantId },
    });

    await this.notificationsService.notifyServantLinkedUser(visit.servantId, {
      type: 'PASTORAL_VISIT_RESOLVED',
      title: 'Acompanhamento pastoral resolvido',
      message: 'Seu acompanhamento pastoral foi marcado como resolvido.',
      link: '/pastoral-visits',
      metadata: { pastoralVisitId: visit.id },
    });

    return visit;
  }

  async historyByServant(servantId: string, actor: JwtPayload) {
    await assertServantAccess(this.prisma, actor, servantId);
    await this.tenantIntegrity.assertServantChurch(servantId, actor);

    return this.prisma.pastoralVisit.findMany({
      where: {
        servantId,
        ...(actor.churchId ? { churchId: actor.churchId } : {}),
      },
      orderBy: { openedAt: 'desc' },
    });
  }
}

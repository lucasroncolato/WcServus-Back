import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ServantStatus, TalentStage } from '@prisma/client';
import { assertServantAccess, getServantAccessWhere } from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApproveTalentDto } from './dto/approve-talent.dto';
import { CreateTalentDto } from './dto/create-talent.dto';
import { UpdateTalentStageDto } from './dto/update-talent-stage.dto';

@Injectable()
export class TalentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(actor: JwtPayload) {
    const servantScope = await getServantAccessWhere(this.prisma, actor);

    return this.prisma.talent.findMany({
      where: servantScope ? { servant: servantScope } : undefined,
      include: { servant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateTalentDto, actor: JwtPayload) {
    await assertServantAccess(this.prisma, actor, dto.servantId);

    const servant = await this.prisma.servant.findUnique({
      where: { id: dto.servantId },
      select: { id: true },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    const talent = await this.prisma.talent.create({
      data: dto,
      include: { servant: true },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'Talent',
      entityId: talent.id,
      userId: actor.sub,
    });

    await this.notificationsService.notifyServantLinkedUser(dto.servantId, {
      type: 'TALENT_CREATED',
      title: 'Talento registrado',
      message: 'Seu talento foi registrado no pipeline ministerial.',
      link: '/talents',
      metadata: { talentId: talent.id, stage: talent.stage },
    });

    return talent;
  }

  async moveStage(id: string, dto: UpdateTalentStageDto, actor: JwtPayload) {
    const talent = await this.prisma.talent.findUnique({ where: { id } });
    if (!talent) {
      throw new NotFoundException('Talent pipeline entry not found');
    }

    await assertServantAccess(this.prisma, actor, talent.servantId);

    const updated = await this.prisma.talent.update({
      where: { id },
      data: {
        stage: dto.stage,
        notes: dto.notes ?? talent.notes,
        approvedAt: dto.stage === TalentStage.APROVADO ? new Date() : null,
      },
      include: { servant: true },
    });

    if (dto.stage === TalentStage.APROVADO) {
      await this.prisma.servant.update({
        where: { id: updated.servantId },
        data: { status: ServantStatus.ATIVO, joinedAt: new Date() },
      });
    }

    await this.auditService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: 'Talent',
      entityId: id,
      userId: actor.sub,
      metadata: { stage: dto.stage },
    });

    await this.notificationsService.notifyServantLinkedUser(updated.servantId, {
      type: dto.stage === TalentStage.APROVADO ? 'TALENT_APPROVED' : 'TALENT_STAGE_UPDATED',
      title: dto.stage === TalentStage.APROVADO ? 'Talento aprovado' : 'Etapa do talento atualizada',
      message:
        dto.stage === TalentStage.APROVADO
          ? 'Parabens! Seu talento foi aprovado.'
          : `Seu talento foi movido para a etapa ${dto.stage}.`,
      link: '/talents',
      metadata: { talentId: updated.id, stage: dto.stage },
    });

    return updated;
  }

  async approve(id: string, dto: ApproveTalentDto, actor: JwtPayload) {
    return this.moveStage(
      id,
      {
        stage: TalentStage.APROVADO,
        notes: dto.notes,
      },
      actor,
    );
  }
}

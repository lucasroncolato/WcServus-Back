import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ServantStatus, TalentStage } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApproveTalentDto } from './dto/approve-talent.dto';
import { CreateTalentDto } from './dto/create-talent.dto';
import { UpdateTalentStageDto } from './dto/update-talent-stage.dto';

@Injectable()
export class TalentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.talent.findMany({
      include: { servant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateTalentDto, actorUserId: string) {
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
      userId: actorUserId,
    });

    return talent;
  }

  async moveStage(id: string, dto: UpdateTalentStageDto, actorUserId: string) {
    const talent = await this.prisma.talent.findUnique({ where: { id } });
    if (!talent) {
      throw new NotFoundException('Talent pipeline entry not found');
    }

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
      userId: actorUserId,
      metadata: { stage: dto.stage },
    });

    return updated;
  }

  async approve(id: string, dto: ApproveTalentDto, actorUserId: string) {
    return this.moveStage(
      id,
      {
        stage: TalentStage.APROVADO,
        notes: dto.notes,
      },
      actorUserId,
    );
  }
}
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Role, ServantStatus, TrainingStatus } from '@prisma/client';
import { assertMinistryAccess, getMinistryAccessWhere } from 'src/common/auth/access-scope';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { CreateMinistryResponsibilityDto } from './dto/create-ministry-responsibility.dto';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { UpdateMinistryResponsibilityDto } from './dto/update-ministry-responsibility.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';

@Injectable()
export class MinistriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantIntegrity: TenantIntegrityService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(actor: JwtPayload) {
    const scopeWhere = await getMinistryAccessWhere(this.prisma, actor);

    const ministries = await this.prisma.ministry.findMany({
      where: scopeWhere,
      include: {
        coordinator: { select: { id: true, name: true, email: true } },
        servantMinistries: {
          include: {
            servant: {
              select: {
                id: true,
                status: true,
                trainingStatus: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return ministries.map((ministry) => {
      const members = ministry.servantMinistries.map((x) => x.servant);
      const activeMembers = members.filter((m) => m.status === ServantStatus.ATIVO).length;
      const pendingTrainingMembers = members.filter(
        (m) => m.trainingStatus === TrainingStatus.PENDING,
      ).length;

      return {
        ...this.toApiMinistry(ministry),
        membersCount: members.length,
        activeMembersCount: activeMembers,
        pendingTrainingCount: pendingTrainingMembers,
      };
    });
  }

  async findOne(id: string, actor: JwtPayload) {
    await assertMinistryAccess(this.prisma, actor, id);

    const ministry = await this.prisma.ministry.findUniqueOrThrow({
      where: { id },
      include: {
        coordinator: { select: { id: true, name: true, email: true } },
      },
    });

    return this.toApiMinistry(ministry);
  }

  async create(dto: CreateMinistryDto, actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN and ADMIN can create ministries');
    }

    const actorChurchId = this.tenantIntegrity.assertActorChurch(actor);

    const duplicated = await this.prisma.ministry.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });

    if (duplicated) {
      throw new ConflictException('Ministry with this name already exists');
    }

    if (dto.servantIds?.length) {
      await this.ensureServantsExist(dto.servantIds, actor);
    }

    const ministry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ministry.create({
        data: {
          churchId: actorChurchId,
          name: dto.name,
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          coordinatorUserId: dto.coordinatorUserId,
          popText: dto.pop ?? dto.description ?? dto.popText,
        },
      });

      if (dto.servantIds?.length) {
        await tx.servantMinistry.createMany({
          data: dto.servantIds.map((servantId: string) => ({ servantId, ministryId: created.id })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    await this.auditService.log({
      action: AuditAction.CREATE_MINISTRY,
      entity: 'Ministry',
      entityId: ministry.id,
      userId: actor.sub,
      metadata: { servantIds: dto.servantIds },
    });

    return this.toApiMinistry(ministry);
  }

  async update(id: string, dto: UpdateMinistryDto, actor: JwtPayload) {
    if (
      actor.role !== Role.SUPER_ADMIN &&
      actor.role !== Role.ADMIN &&
      actor.role !== Role.COORDENADOR
    ) {
      throw new ForbiddenException('You do not have permission to update ministries');
    }

    if (actor.role === Role.COORDENADOR) {
      await assertMinistryAccess(this.prisma, actor, id);
    }

    await this.ensureExists(id);
    await this.tenantIntegrity.assertMinistryChurch(id, actor);

    if (dto.name) {
      const duplicated = await this.prisma.ministry.findFirst({
        where: { name: dto.name, NOT: { id } },
        select: { id: true },
      });

      if (duplicated) {
        throw new ConflictException('Ministry with this name already exists');
      }
    }

    if (dto.servantIds) {
      await this.ensureServantsExist(dto.servantIds, actor);
    }

    const ministry = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ministry.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          coordinatorUserId: dto.coordinatorUserId,
          popText: dto.pop ?? dto.description ?? dto.popText,
        },
      });

      if (dto.servantIds) {
        await tx.servantMinistry.deleteMany({ where: { ministryId: id } });

        if (dto.servantIds.length > 0) {
          await tx.servantMinistry.createMany({
            data: dto.servantIds.map((servantId: string) => ({ servantId, ministryId: id })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });

    await this.auditService.log({
      action: AuditAction.UPDATE_MINISTRY,
      entity: 'Ministry',
      entityId: id,
      userId: actor.sub,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return this.toApiMinistry(ministry);
  }

  async listServants(ministryId: string, actor: JwtPayload) {
    await this.ensureExists(ministryId);
    await assertMinistryAccess(this.prisma, actor, ministryId);

    const servantMinistries = await this.prisma.servantMinistry.findMany({
      where: { ministryId },
      include: {
        servant: {
          include: {
            mainMinistry: true,
            servantMinistries: { include: { ministry: true } },
          },
        },
      },
      orderBy: { servant: { name: 'asc' } },
    });

    return servantMinistries.map((relation) => ({
      ...relation.servant,
      status: relation.servant.status === ServantStatus.ATIVO ? 'ACTIVE' : 'INACTIVE',
      ministryIds: relation.servant.servantMinistries.map((item) => item.ministryId),
      ministryNames: relation.servant.servantMinistries.map((item) => item.ministry.name),
      ministryId: relation.servant.servantMinistries[0]?.ministryId ?? relation.servant.mainMinistry?.id ?? null,
      ministryName:
        relation.servant.servantMinistries[0]?.ministry.name ??
        relation.servant.mainMinistry?.name ??
        null,
    }));
  }

  async listResponsibilities(ministryId: string, actor: JwtPayload) {
    await this.ensureExists(ministryId);
    await assertMinistryAccess(this.prisma, actor, ministryId);

    return this.prisma.ministryResponsibility.findMany({
      where: { ministryId: ministryId, deletedAt: null },
      include: {
        responsibleServant: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }, { title: 'asc' }],
    });
  }

  async createResponsibility(ministryId: string, dto: CreateMinistryResponsibilityDto, actor: JwtPayload) {
    await this.ensureExists(ministryId);
    await assertMinistryAccess(this.prisma, actor, ministryId);

    if (dto.responsibleServantId) {
      await this.ensureServantBelongsToSector(dto.responsibleServantId, ministryId);
    }

    const created = await this.prisma.ministryResponsibility.create({
      data: {
        ministryId: ministryId,
        name: dto.name ?? dto.title,
        title: dto.title,
        activity: dto.activity,
        functionName: dto.functionName,
        description: dto.description,
        requiredTraining: dto.requiredTraining ?? false,
        requiredAptitude: dto.requiredAptitude,
        responsibleServantId: dto.responsibleServantId,
        active: dto.active ?? true,
      },
      include: {
        responsibleServant: {
          select: { id: true, name: true },
        },
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'MinistryResponsibility',
      entityId: created.id,
      userId: actor.sub,
      metadata: { ministryId: ministryId },
    });

    return created;
  }

  async updateResponsibility(
    responsibilityId: string,
    dto: UpdateMinistryResponsibilityDto,
    actor: JwtPayload,
  ) {
    const current = await this.prisma.ministryResponsibility.findUnique({
      where: { id: responsibilityId },
      select: { id: true, ministryId: true },
    });

    if (!current) {
      throw new NotFoundException('Ministry responsibility not found');
    }

    await assertMinistryAccess(this.prisma, actor, current.ministryId);

    if (dto.responsibleServantId) {
      await this.ensureServantBelongsToSector(dto.responsibleServantId, current.ministryId);
    }

    const updated = await this.prisma.ministryResponsibility.update({
      where: { id: responsibilityId },
      data: {
        name: dto.name,
        title: dto.title,
        activity: dto.activity,
        functionName: dto.functionName,
        description: dto.description,
        requiredTraining: dto.requiredTraining,
        requiredAptitude: dto.requiredAptitude,
        responsibleServantId: dto.responsibleServantId,
        active: dto.active,
      },
      include: {
        responsibleServant: {
          select: { id: true, name: true },
        },
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'MinistryResponsibility',
      entityId: responsibilityId,
      userId: actor.sub,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return updated;
  }

  private async ensureServantsExist(servantIds: string[], actor: JwtPayload) {
    const uniqueServantIds = [...new Set(servantIds)];
    const servants = await this.prisma.servant.findMany({
      where: { id: { in: uniqueServantIds } },
      select: { id: true, churchId: true },
    });

    if (servants.length !== uniqueServantIds.length) {
      throw new NotFoundException('One or more servants were not found');
    }

    const actorChurchId = this.tenantIntegrity.assertActorChurch(actor);
    servants.forEach((servant) =>
      this.tenantIntegrity.assertSameChurch(actorChurchId, servant.churchId, 'Servant'),
    );
  }

  private async ensureExists(id: string) {
    const ministry = await this.prisma.ministry.findUnique({ where: { id }, select: { id: true } });
    if (!ministry) {
      throw new NotFoundException('Ministry not found');
    }
  }

  private async ensureServantBelongsToSector(servantId: string, ministryId: string) {
    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: {
        id: true,
        mainMinistryId: true,
        servantMinistries: {
          select: { ministryId: true },
        },
      },
    });

    if (!servant) {
      throw new NotFoundException('Servant not found');
    }

    const belongsToMinistry =
      servant.mainMinistryId === ministryId || servant.servantMinistries.some((item) => item.ministryId === ministryId);

    if (!belongsToMinistry) {
      throw new BadRequestException('Responsible servant must belong to this ministry');
    }
  }

  private toApiMinistry<
    T extends { id: string; name: string; description?: string | null; popText?: string | null },
  >(ministry: T) {
    return {
      ...ministry,
      pop: ministry.popText ?? ministry.description ?? null,
      ministryId: ministry.id,
      ministryName: ministry.name,
      ministryDescription: ministry.description ?? null,
    };
  }
}




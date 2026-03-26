import {
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Role, ServantStatus, TrainingStatus } from '@prisma/client';
import { assertSectorAccess, getSectorAccessWhere } from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';

@Injectable()
export class SectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(actor: JwtPayload) {
    const scopeWhere = await getSectorAccessWhere(this.prisma, actor);

    const sectors = await this.prisma.sector.findMany({
      where: scopeWhere,
      include: {
        coordinator: { select: { id: true, name: true, email: true } },
        servantSectors: {
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

    return sectors.map((sector) => {
      const members = sector.servantSectors.map((x) => x.servant);
      const activeMembers = members.filter((m) => m.status === ServantStatus.ATIVO).length;
      const pendingTrainingMembers = members.filter(
        (m) => m.trainingStatus === TrainingStatus.PENDING,
      ).length;

      return {
        ...sector,
        pop: sector.popText ?? sector.description ?? null,
        membersCount: members.length,
        activeMembersCount: activeMembers,
        pendingTrainingCount: pendingTrainingMembers,
      };
    });
  }

  async findOne(id: string, actor: JwtPayload) {
    await assertSectorAccess(this.prisma, actor, id);

    const sector = await this.prisma.sector.findUniqueOrThrow({
      where: { id },
      include: {
        coordinator: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      ...sector,
      pop: sector.popText ?? sector.description ?? null,
    };
  }

  async create(dto: CreateSectorDto, actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN and ADMIN can create sectors');
    }

    const duplicated = await this.prisma.sector.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });

    if (duplicated) {
      throw new ConflictException('Sector with this name already exists');
    }

    if (dto.servantIds?.length) {
      await this.ensureServantsExist(dto.servantIds);
    }

    const sector = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sector.create({
        data: {
          name: dto.name,
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          coordinatorUserId: dto.coordinatorUserId,
          popText: dto.pop ?? dto.description ?? dto.popText,
        },
      });

      if (dto.servantIds?.length) {
        await tx.servantSector.createMany({
          data: dto.servantIds.map((servantId) => ({ servantId, sectorId: created.id })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'Sector',
      entityId: sector.id,
      userId: actor.sub,
      metadata: { servantIds: dto.servantIds },
    });

    return {
      ...sector,
      pop: sector.popText ?? sector.description ?? null,
    };
  }

  async update(id: string, dto: UpdateSectorDto, actor: JwtPayload) {
    if (
      actor.role !== Role.SUPER_ADMIN &&
      actor.role !== Role.ADMIN &&
      actor.role !== Role.COORDENADOR
    ) {
      throw new ForbiddenException('You do not have permission to update sectors');
    }

    if (actor.role === Role.COORDENADOR) {
      await assertSectorAccess(this.prisma, actor, id);
    }

    await this.ensureExists(id);

    if (dto.name) {
      const duplicated = await this.prisma.sector.findFirst({
        where: { name: dto.name, NOT: { id } },
        select: { id: true },
      });

      if (duplicated) {
        throw new ConflictException('Sector with this name already exists');
      }
    }

    if (dto.servantIds) {
      await this.ensureServantsExist(dto.servantIds);
    }

    const sector = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.sector.update({
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
        await tx.servantSector.deleteMany({ where: { sectorId: id } });

        if (dto.servantIds.length > 0) {
          await tx.servantSector.createMany({
            data: dto.servantIds.map((servantId) => ({ servantId, sectorId: id })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'Sector',
      entityId: id,
      userId: actor.sub,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return {
      ...sector,
      pop: sector.popText ?? sector.description ?? null,
    };
  }

  async listServants(sectorId: string, actor: JwtPayload) {
    await this.ensureExists(sectorId);
    await assertSectorAccess(this.prisma, actor, sectorId);

    const servantSectors = await this.prisma.servantSector.findMany({
      where: { sectorId },
      include: {
        servant: {
          include: {
            mainSector: true,
            servantSectors: { include: { sector: true } },
          },
        },
      },
      orderBy: { servant: { name: 'asc' } },
    });

    return servantSectors.map((relation) => ({
      ...relation.servant,
      status: relation.servant.status === ServantStatus.ATIVO ? 'ACTIVE' : 'INACTIVE',
      sectorIds: relation.servant.servantSectors.map((item) => item.sectorId),
      sectorNames: relation.servant.servantSectors.map((item) => item.sector.name),
      sectorId: relation.servant.servantSectors[0]?.sectorId ?? relation.servant.mainSector?.id ?? null,
      sectorName:
        relation.servant.servantSectors[0]?.sector.name ??
        relation.servant.mainSector?.name ??
        null,
    }));
  }

  private async ensureServantsExist(servantIds: string[]) {
    const uniqueServantIds = [...new Set(servantIds)];
    const servants = await this.prisma.servant.findMany({
      where: { id: { in: uniqueServantIds } },
      select: { id: true },
    });

    if (servants.length !== uniqueServantIds.length) {
      throw new NotFoundException('One or more servants were not found');
    }
  }

  private async ensureExists(id: string) {
    const sector = await this.prisma.sector.findUnique({ where: { id }, select: { id: true } });
    if (!sector) {
      throw new NotFoundException('Sector not found');
    }
  }
}
